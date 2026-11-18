import bpy,sys,math,json,colorsys,numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'tools'))
from frog_mouth import ensure_true_mouth
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'))
if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
m=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
rig.animation_data.action=None
for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
ensure_true_mouth(m,rig)
base=[v.co.copy() for v in m.data.shape_keys.key_blocks['Basis'].data];tree=BVHTree.FromPolygons(base,[list(p.vertices) for p in m.data.polygons])
def front(x,z):
 hit=tree.ray_cast(Vector((x,-1,z)),Vector((0,1,0)),2)[0]
 assert hit is not None,(x,z)
 return hit.y
# Use one clean gold for all exterior yellow surfaces, preserving the belly, eyes and brown tips.
srgb=(1.,.72,.035);linear=tuple(((c+.055)/1.055)**2.4 if c>.04045 else c/12.92 for c in srgb)
image=bpy.data.images['Frog_Low_CleanColor_2048'];pixels=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(pixels);a=pixels.reshape(-1,4)
mask=(a[:,0]>.45)&(a[:,1]>.35)&(a[:,0]>a[:,1]*.98)&(a[:,1]>a[:,2]*1.7)&((a[:,0]-a[:,2])>.35)
a[mask,:3]=srgb;image.pixels.foreach_set(pixels);image.pack()
skin=bpy.data.materials.get('Frog unified gold') or bpy.data.materials.new('Frog unified gold');skin.use_nodes=True
shader=skin.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(*linear,1);skin.diffuse_color=(*linear,1)
for mat in list(m.data.materials)+[skin]:
 sh=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
 if not sh:continue
 if mat.name in ['Frog golden skin','Repaired inner arm golden skin','Frog mouth skin']:
  for link in list(sh.inputs['Base Color'].links):mat.node_tree.links.remove(link)
  sh.inputs['Base Color'].default_value=(*linear,1);mat.diffuse_color=(*linear,1)
 if mat.name not in ['Frog oral lining','Frog oral depth','Frog brown hands']:
  sh.inputs['Roughness'].default_value=.8;sh.inputs['Specular IOR Level'].default_value=.15
eye_fit=json.loads((root/'output/animations/eye-boundaries.json').read_text())
for side in ['L','R']:
 cx,cz=eye_fit[side]['center'];rx,rz=eye_fit[side]['radii'];rx+=.0013;rz+=.0013
 obj=bpy.data.objects['Frog eyelid '+side];old=obj.data;keyname=old.shape_keys.name
 slots={name:next(s for s in bpy.data.actions[name].slots if s.target_id_type=='KEY' and s.name_display==keyname) for name in ['Blink','Laugh']}
 params=[(half,i/24,j/6) for half in [1,-1] for j in range(7) for i in range(25)];faces=[]
 for h in range(2):
  for j in range(6):
   for i in range(24):
    a=h*175+j*25+i
    faces.extend([(a,a+1,a+26),(a,a+26,a+25)] if h==0 else [(a,a+26,a+1),(a,a+25,a+26)])
 def coords(u):
  out=[]
  for half,a,v in params:
   x=cx+(rx+.0045*u**6)*(2*a-1);height=(rz+.0045*u**6)*math.sqrt(max(0,1-(2*a-1)**2));z=cz+half*height*(1-u*v)-half*.00035*u*v
   out.append((x,front(x,z)-.0025,z))
  return out
 data=bpy.data.meshes.new('Opposing eyelids '+side);data.from_pydata(coords(0),[],faces);data.materials.append(skin);obj.data=data;bpy.data.meshes.remove(old)
 obj.vertex_groups.clear();obj.vertex_groups.new(name='face').add(list(range(len(params))),1,'REPLACE')
 for p in data.polygons:p.use_smooth=True
 obj.shape_key_add(name='Basis');data.shape_keys.name=keyname
 for i in range(1,9):
  key=obj.shape_key_add(name=f'Blink_{i/8:.3f}')
  for v,co in zip(key.data,coords(i/8)):v.co=co
 data.shape_keys.animation_data_create()
 for name in ['Blink','Laugh']:
  track=data.shape_keys.animation_data.nla_tracks.new();track.name='Face_'+name;track.mute=True;strip=track.strips.new(name,1,bpy.data.actions[name]);strip.action_slot=slots[name]
 crease=bpy.data.objects['Frog eyelid crease '+side];crease.vertex_groups.clear();crease.vertex_groups.new(name='face').add(list(range(len(crease.data.vertices))),1,'REPLACE')
 for key in crease.data.shape_keys.key_blocks:
  u=0 if key.name=='Basis' else float(key.name.rsplit('_',1)[1])
  for i,v in enumerate(key.data):
   x=cx+rx*.85*(2*(i//2)/24-1)*u;z=cz+(-1 if i%2==0 else 1)*.0003*u
   v.co=(x,front(x,z)-.004,z)
 for v,b in zip(crease.data.vertices,crease.data.shape_keys.key_blocks['Basis'].data):v.co=b.co
from frog_expressions import finalize_expression_clearance
objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.shape_keys]
finalize_expression_clearance(m,rig,objects,{a.name:a for a in bpy.data.actions})
# Neutral export; preserve all existing action slots and body movement.
for o in bpy.context.scene.objects:
 if o.type=='MESH' and o.data.shape_keys:
  if o.data.shape_keys.animation_data:o.data.shape_keys.animation_data.action=None
  for k in o.data.shape_keys.key_blocks:k.value=0
rig.animation_data.action=bpy.data.actions['Idle'];bpy.context.scene.frame_set(1)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets-source/blender/frog.blend'))
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
for o in bpy.context.scene.objects:
 if o.type=='MESH':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'output/frog.glb'),export_format='GLB',export_vertex_color='NONE',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_merge_animation='ACTION',export_frame_range=False,export_force_sampling=True,export_anim_single_armature=True,export_anim_slide_to_zero=True,export_morph=True,export_morph_animation=True)
print('FACE_POLISH_DONE',int(mask.sum()))
