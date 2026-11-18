import bpy,bmesh
from pathlib import Path
from mathutils import Vector as V
p=Path.cwd()/'assets-source/blender/sarumai.blend';bpy.ops.wm.open_mainfile(filepath=str(p));o=bpy.data.objects['samurai_body'];rig=next(x for x in bpy.context.scene.objects if x.type=='ARMATURE');r=rig.data.bones['hand_R'];forward=(r.tail_local-r.head_local).normalized();wrist=r.head_local;mi=next(i for i,m in enumerate(o.data.materials)if m.name=='Samurai_Wrist_Skin');ids={i for f in o.data.polygons if f.material_index==mi for i in f.vertices}
for i in ids:
 v=o.data.vertices[i];t=(v.co-wrist).dot(forward)
 if t<0:v.co+=forward*t*.5
 for g in o.vertex_groups:g.remove([i])
 o.vertex_groups['hand_R'].add([i],1,'REPLACE')
bpy.context.view_layer.update();ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();center=rig.pose.bones['hand_R'].head;bad=[]
for f in m.polygons:
 ps=[m.vertices[i].co for i in f.vertices]
 if f.material_index==mi or min((v-center).length for v in ps)>.16:continue
 edges=[(a-b).length for a in ps for b in ps];long=max(edges)
 if long>.075 and long*long/max(f.area,1e-9)>40:bad.append(f.index)
ev.to_mesh_clear();bm=bmesh.new();bm.from_mesh(o.data);bm.faces.ensure_lookup_table();bmesh.ops.delete(bm,geom=[bm.faces[i]for i in bad],context='FACES');bm.to_mesh(o.data);bm.free();bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(p));print('REMOVED_WRIST_SLIVERS',len(bad))
