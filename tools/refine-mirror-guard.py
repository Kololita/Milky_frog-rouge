import bpy,math,shutil
from pathlib import Path
from mathutils import Vector as V,Quaternion as Q,Matrix
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets-source/blender/rigged/mirrorGuard.blend'))
bpy.context.preferences.filepaths.save_version=0
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
rest={b.name:b.matrix_local.copy()for b in rig.data.bones}
def arm(side,goal,delta):
 upper='upper_arm_'+side;lower='forearm_'+side;hand='hand_'+side
 origin=rig.pose.bones[upper].head.copy();goal=V(goal);axis=(goal-origin).normalized();l1=rig.data.bones[upper].length;l2=rig.data.bones[lower].length;d=min((goal-origin).length,l1+l2-.006);along=(l1*l1+d*d-l2*l2)/(2*d)
 pole=V((-.55 if side=='L'else .55,.10,.8));perp=pole-origin-axis*(pole-origin).dot(axis);perp.normalize();elbow=origin+axis*along+perp*math.sqrt(max(0,l1*l1-along*along));end=origin+axis*d
 source_normal=(rig.data.bones[upper].tail_local-rig.data.bones[upper].head_local).cross(rig.data.bones[lower].tail_local-rig.data.bones[lower].head_local).normalized();normal=(elbow-origin).cross(end-elbow).normalized()
 for n,a,b in [(upper,origin,elbow),(lower,elbow,end)]:
  sy=(rig.data.bones[n].tail_local-rig.data.bones[n].head_local).normalized();ty=(b-a).normalized();sz=source_normal.cross(sy).normalized();tz=normal.cross(ty).normalized();rot=Matrix((normal,ty,tz)).transposed().to_quaternion()@Matrix((source_normal,sy,sz)).transposed().to_quaternion().inverted()@rest[n].to_quaternion();rig.pose.bones[n].matrix=Matrix.Translation(a)@rot.to_matrix().to_4x4();bpy.context.view_layer.update()
 rig.pose.bones[hand].matrix=Matrix.Translation(end)@delta.to_matrix().to_4x4()@rest[hand].to_3x3().to_4x4();bpy.context.view_layer.update()
 if 'elbow_'+side in rig.pose.bones:rig.pose.bones['elbow_'+side].rotation_quaternion=rig.pose.bones[lower].rotation_quaternion.copy()
def smooth(v):v=max(0,min(1,v));return v*v*(3-2*v)
for action_name in ['Parry','ParryPush','Riposte']:
 action=bpy.data.actions[action_name];rig.animation_data.action=action
 # Sample unchanged torso and legs first so replacing arm curves never feeds back into sampling.
 samples=[]
 for frame in range(61):bpy.context.scene.frame_set(frame);samples.append({pb.name:pb.matrix_basis.copy()for pb in rig.pose.bones})
 for frame in range(61):
  for pb in rig.pose.bones:pb.matrix_basis=samples[frame][pb.name]
  bpy.context.view_layer.update();t=frame/60
  weight=smooth(t/.3) if action_name=='Parry'else 1
  strike=smooth(t/.28)*(1-smooth((t-.55)/.45)) if action_name=='ParryPush'else smooth((t-.38)/.24)*(1-smooth((t-.72)/.28))if action_name=='Riposte'else 0
  left=V((-.28,-.28,1.08))+V((-.23,.05,.03))*strike;right=V((.28,-.26,1.10))+V((0,-.22,.01))*strike
  for side,target in [('L',left),('R',right)]:
   wrist=V((-.45,-.04,.94)if side=='L'else(.54,-.08,.89));goal=wrist.lerp(target,weight)
   delta=Q()if side=='L'else V((.08,-.53,.62)).normalized().rotation_difference(V((0,-1,.06)).normalized())
   arm(side,goal,Q().slerp(delta,weight))
   for name in ['upper_arm_'+side,'forearm_'+side,'hand_'+side,'elbow_'+side]:
    if name in rig.pose.bones:
     pb=rig.pose.bones[name]
     for prop in ['location','rotation_quaternion','scale']:pb.keyframe_insert(prop,frame=frame)
# Lighten existing albedo while preserving texture detail and material identity.
seen=set()
for mat in bpy.data.materials:
 if not mat.use_nodes:continue
 for node in mat.node_tree.nodes:
  if node.type=='BSDF_PRINCIPLED':node.inputs['Metallic'].default_value=.55;node.inputs['Roughness'].default_value=.28
  if node.type=='TEX_IMAGE' and node.image and node.image.name not in seen:
   image=node.image;seen.add(image.name);pixels=list(image.pixels[:])
   for i in range(0,len(pixels),4):
    for c in range(3):pixels[i+c]=min(1,.06+pixels[i+c]**.78*.94)
   image.pixels[:]=pixels;image.pack()
rig.animation_data.action=bpy.data.actions['Idle'];bpy.context.scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/blender/rigged/mirrorGuard.blend'))
bpy.ops.object.select_all(action='SELECT');target=ROOT/'output/mirrorGuard-refined.glb'
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True,export_tangents=True)
shutil.copy2(target,ROOT/'public/models/enemies/mirrorGuard.glb');shutil.copy2(target,ROOT/'assets-source/blender/mirrorGuard.glb')
print('MIRROR_GUARD_REFINED',len(seen))
