import bpy,bmesh,json
from pathlib import Path
root=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'));m=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));bm=bmesh.new();bm.from_mesh(m.data);bm.verts.ensure_lookup_table()
print('MESH_ATTR',[(a.name,a.domain,a.data_type) for a in m.data.attributes]);print('SHAPE_LAYERS',list(bm.verts.layers.shape.keys()), 'MOUTH',len(json.loads(m['mouth_boundary_ids'])),len(json.loads(m['mouth_vertex_ids'])))
sk=m.data.shape_keys;old_name=sk.name;action_names=[a.name for a in bpy.data.actions];oldcount=len(m.data.vertices);a,b=bm.verts[0],bm.verts[1];v=bm.verts.new((a.co+b.co)*.5)
for key in bm.verts.layers.shape.values():v[key]=(a[key]+b[key])*.5
bm.to_mesh(m.data);bm.free();print('BM_RESULT',oldcount,len(m.data.vertices),[(k.name,len(k.data),tuple(k.data[-1].co)) for k in m.data.shape_keys.key_blocks],m.data.shape_keys==sk,m.data.shape_keys.name==old_name)
