import bpy,math
from pathlib import Path
from mathutils import Vector as V
root=Path(__file__).resolve().parents[1];src=root/'assets-source/blender/sarumai.blend';bpy.ops.wm.open_mainfile(filepath=str(src));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');obj=next(o for o in bpy.data.objects if o.type=='MESH' and 'blade'in o.name)
axis=V((1.365,-.78,-.65)).normalized();origin=rig.data.bones['blade'].head_local.copy();cross=axis.cross(V((0,0,1))).normalized();depth=axis.cross(cross).normalized();verts=[];faces=[];mats=[]
def section(parts,material):
 start=len(verts)
 for t,width,thickness in parts:
  for x,y in [(-width,-thickness),(width,-thickness),(width,thickness),(-width,thickness)]:verts.append(origin+axis*t+cross*x+depth*y)
 faces.append(tuple(start+i for i in [3,2,1,0]));mats.append(material)
 for i in range(len(parts)-1):
  for j in range(4):faces.append((start+4*i+j,start+4*i+(j+1)%4,start+4*(i+1)+(j+1)%4,start+4*(i+1)+j));mats.append(material)
 end=start+4*(len(parts)-1);faces.append(tuple(end+j for j in range(4)));mats.append(material)
section([(-.145,.022,.017),(.105,.022,.017)],1)
section([(.105,.070,.014),(.132,.070,.014)],2)
section([(.132,.029,.006),(.22,.029,.006),(1.15,.021,.004),(1.29,.0005,.0005)],0)
# Narrow wrapping bands give the grip crisp detail without moving its axis.
for i in range(9):
 t=-.13+i*.025;section([(t,.023,.018),(t+.008,.023,.018)],2 if i in [0,8]else 3)
mesh=bpy.data.meshes.new('StraightSwordMesh');mesh.from_pydata(verts,[],faces);mesh.update();obj.data=mesh
for name,color,metal,rough in [('Blade steel',(.58,.65,.70,1),.85,.22),('Handle dark wrap',(.055,.065,.055,1),.1,.65),('Sword fittings',(.38,.27,.12,1),.7,.3),('Grip bands',(.17,.16,.12,1),.05,.75)]:
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=color;p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;mesh.materials.append(m)
for p,i in zip(mesh.polygons,mats):p.material_index=i;p.use_smooth=False
obj.vertex_groups.clear();g=obj.vertex_groups.new(name='blade');g.add(list(range(len(verts))),1,'REPLACE');assert all(abs((v-origin).dot(cross))<.071 for v in verts)
# Left fingers were still mostly weighted to the palm, masking their new angle.
def distance(p,a,b):
 d=b-a;t=max(0,min(1,(p-a).dot(d)/max(d.length_squared,1e-9)));return (p-a-t*d).length
fingerbones=[b for b in rig.data.bones if b.name.startswith('finger_L_')]
for body in [o for o in bpy.data.objects if o.type=='MESH'and o!=obj and 'scabbard'not in o.name]:
 groups={g.name:g for g in body.vertex_groups}
 for v in body.data.vertices:
  if not(.79<v.co.x<.99 and 1.585<v.co.z<1.80 and -.105<v.co.y<.04):continue
  nearest=sorted([(distance(v.co,b.head_local,b.tail_local),b.name)for b in fingerbones])[:2];weights=[1/(d+.004)**4 for d,n in nearest];total=sum(weights)
  for g in body.vertex_groups:g.remove([v.index])
  for (d,n),w in zip(nearest,weights):
   if n not in groups:groups[n]=body.vertex_groups.new(name=n)
   groups[n].add([v.index],w/total,'REPLACE')
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));print('STRAIGHT_SWORD_REBUILT',len(verts))
