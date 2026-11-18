import bpy,collections
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path.cwd()/'assets-source/blender/sarumai.blend'))
for o in bpy.context.scene.objects:
 if o.type!='MESH' or o.name=='Icosphere':continue
 adj=[[]for v in o.data.vertices]
 for e in o.data.edges:a,b=e.vertices;adj[a].append(b);adj[b].append(a)
 seen=set();cs=[]
 for v in o.data.vertices:
  if v.index in seen:continue
  todo=[v.index];seen.add(v.index);c=[]
  while todo:
   i=todo.pop();c.append(i)
   for j in adj[i]:
    if j not in seen:seen.add(j);todo.append(j)
  if len(c)>10:cs.append((len(c),[[round(min(o.data.vertices[i].co[k]for i in c),3),round(max(o.data.vertices[i].co[k]for i in c),3)]for k in range(3)]))
 print(o.name,sorted(cs,reverse=True)[:35])
