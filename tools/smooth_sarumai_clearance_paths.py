import bpy,math,shutil
from pathlib import Path
ROOT=Path.cwd();src=ROOT/'assets-source/blender/sarumai.blend';bpy.ops.wm.open_mainfile(filepath=str(src));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
def smooth(x):return x*x*(3-2*x)
plans={'CrossLeft':('CrossRight',lambda t:.70*smooth(t/.45)if t<.45 else .70-.25*smooth((t-.45)/.25)if t<.70 else .45*(1-smooth((t-.70)/.30))), 'BuriedOverhead':('Overhead',lambda t:min(t,.70)), 'Extract':('Overhead',lambda t:.70 if t<.30 else .70-.25*smooth((t-.30)/.40)if t<.70 else .45*(1-smooth((t-.70)/.30)))}
for name,(source,warp)in plans.items():
 action=bpy.data.actions[source];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0];poses=[]
 for k in range(121):
  f=warp(k/120)*60;bpy.context.scene.frame_set(int(f),subframe=f%1);poses.append({b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy())for b in rig.pose.bones})
 old=bpy.data.actions.get(name)
 if old:bpy.data.actions.remove(old)
 a=bpy.data.actions.new(name);a.use_fake_user=True;rig.animation_data.action=a
 for k,pose in enumerate(poses):
  for n,(p,q,s)in pose.items():
   b=rig.pose.bones[n];b.location=p;b.rotation_quaternion=q;b.scale=s
   for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(data_path=prop,frame=k/2,group=n)
 for layer in a.layers:
  for strip in layer.strips:
   for f in strip.channelbag(a.slots[0]).fcurves:
    for key in f.keyframe_points:key.interpolation='LINEAR'
 print('SMOOTH_PATH',name,source)
rig.animation_data.action=bpy.data.actions['Idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];bpy.context.scene.frame_set(0);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src))
