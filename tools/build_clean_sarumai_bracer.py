import bpy,math,shutil
from pathlib import Path
from mathutils import Vector as V
ROOT=Path.cwd();src=ROOT/'assets-source/blender/sarumai.blend';bpy.ops.wm.open_mainfile(filepath=str(src));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');old=bpy.data.objects.get('Samurai_Bracer_R')
if old:bpy.data.objects.remove(old,do_unlink=True)
bone=rig.data.bones['forearm_R'];verts=[];faces=[];ids=[]
def material(name,color,metal,rough):
 m=bpy.data.materials.get(name)or bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
mats=[material('Samurai_Bracer_BlueSteel',(.065,.087,.105),.45,.48),material('Samurai_Bracer_Bronze',(.29,.225,.135),.55,.56),material('Samurai_Bracer_Cloth',(.14,.065,.036),.05,.85)]
def ring(y,r,n=24):
 start=len(verts)
 for j in range(n):
  a=math.tau*j/n;verts.append(bone.matrix_local@V((r*math.cos(a),y,r*math.sin(a))))
 return list(range(start,start+n))
def band(points,mat):
 rings=[ring(y,r)for y,r in points]
 for a,b in zip(rings,rings[1:]):
  for j in range(len(a)):faces.append((a[j],a[(j+1)%len(a)],b[(j+1)%len(a)],b[j]));ids.append(mat)
length=bone.length
band([(.005,.069),(.02,.074),(.035,.066),(length-.025,.051),(length-.008,.06),(length+.006,.058)],2)
for y,r in [(.029,.070),(length-.017,.058)]:band([(y-.005,r-.003),(y,r+.002),(y+.005,r-.003)],1)
# Long, gently ridged lamellae follow the same silhouette as the left bracer.
for k in range(8):
 theta=math.tau*k/8;rows=[]
 for y,r in [(.04,.070),(.05,.071),(length-.032,.055),(length-.022,.053)]:
  row=[]
  for off,ridge in [(-.30,0),(0,.005),(.30,0)]:
   row.append(len(verts));a=theta+off;verts.append(bone.matrix_local@V(((r+ridge)*math.cos(a),y,(r+ridge)*math.sin(a))))
  rows.append(row)
 for a,b in zip(rows,rows[1:]):
  for j in range(2):faces.append((a[j],a[j+1],b[j+1],b[j]));ids.append(0)
 # Subtle metal seams along each plate, without extra loose strips.
mesh=bpy.data.meshes.new('Samurai_Clean_Bracer_R');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Samurai_Bracer_R',mesh);bpy.context.collection.objects.link(o)
for m in mats:mesh.materials.append(m)
for f,i in zip(mesh.polygons,ids):f.material_index=i;f.use_smooth=True
# The constructed ring winding points inward; reverse each face once.
for f in mesh.polygons:f.flip()
mesh.update();o.vertex_groups.new(name='forearm_R').add(list(range(len(verts))),1,'REPLACE');o.parent=rig;mod=o.modifiers.new('Armature','ARMATURE');mod.object=rig
assert not mesh.validate();bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));shutil.copy2(src,ROOT/'assets-source/blender/rigged/sarumai.blend');print('CLEAN_MATCHED_BRACER',len(verts),len(faces))
