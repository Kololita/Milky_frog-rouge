import bpy,bmesh,json,math
from pathlib import Path
r=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(r/'assets-source/blender/frog.blend'))
m=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
for k in m.data.shape_keys.key_blocks:k.value=0
bm=bmesh.new();bm.from_mesh(m.data);bm.verts.ensure_lookup_table();tag=bm.verts.layers.int.new('refine_old_index')
for v in bm.verts:v[tag]=v.index+1
before=(len(bm.verts),len(bm.faces));candidates=[]
for v in bm.verts:
 x,y,z=v.co
 if .145<abs(x)<.31 and .625<z<.79 and v.is_manifold and len(v.link_edges)>=4:
  lengths=[e.calc_length() for e in v.link_edges]
  if max(lengths)<.036 and min(lengths)<.014:candidates.append(v)
blocked=set();selected=[]
for v in sorted(candidates,key=lambda v:min(e.calc_length() for e in v.link_edges)):
 if v in blocked:continue
 selected.append(v);blocked.add(v);blocked.update(e.other_vert(v) for e in v.link_edges)
 if len(selected)>=100:break
bmesh.ops.dissolve_verts(bm,verts=selected,use_face_split=False,use_boundary_tear=False)
# Triangulate only new polygons for stable skinning; keep the existing contour vertices.
bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>4],quad_method='BEAUTY',ngon_method='BEAUTY')
bm.verts.index_update();mapping={v[tag]-1:v.index for v in bm.verts}
for name in ['mouth_vertex_ids','mouth_boundary_ids']:
 m[name]=json.dumps([mapping[i] for i in json.loads(m[name])])
for f in bm.faces:f.smooth=True
bm.to_mesh(m.data);bm.free();m.data.update()
assert all(len(k.data)==len(m.data.vertices) for k in m.data.shape_keys.key_blocks)
report={'before':before,'after':[len(m.data.vertices),len(m.data.polygons)],'removed_vertices':len(selected),'region':'shoulders only','shape_keys_preserved':True}
(r/'output/animations/shoulder-refinement.json').write_text(json.dumps(report,indent=2));print('SHOULDER_REFINED',report)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(r/'assets-source/blender/frog.blend'))
