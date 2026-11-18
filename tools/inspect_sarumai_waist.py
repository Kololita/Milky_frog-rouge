import bpy,bmesh
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path.cwd()/'assets-source/blender/sarumai.blend'))
for obj in bpy.context.scene.objects:
 if obj.type!='MESH':continue
 ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());bm=bmesh.new();bm.from_mesh(ev.to_mesh());bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001);seen=set()
 for v in bm.verts:
  if v in seen:continue
  todo=[v];seen.add(v);vs=[]
  while todo:
   q=todo.pop();vs.append(q)
   for e in q.link_edges:
    w=e.other_vert(q)
    if w not in seen:todo.append(w);seen.add(w)
  if 4<=len(vs)<80:
   center=sum((v.co for v in vs),v.co*0)/len(vs)
   if 1.0<center.z<1.3:print(obj.name,len(vs),[round(x,3)for x in center],[[round(min(v.co[k]for v in vs),3),round(max(v.co[k]for v in vs),3)]for k in range(3)])
 bm.free();ev.to_mesh_clear()
