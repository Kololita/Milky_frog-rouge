import bpy,shutil
from pathlib import Path
ROOT=Path.cwd();src=ROOT/'assets-source/blender/sarumai.blend';bpy.ops.wm.open_mainfile(filepath=str(src));r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');idle=bpy.data.actions['Idle'];r.animation_data.action=idle;r.animation_data.action_slot=idle.slots[0];bpy.context.scene.frame_set(0);base={b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy())for b in r.pose.bones}
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
for name in ['Overhead','BuriedOverhead','RisingLeft','RisingRight','Extract']:
 a=bpy.data.actions[name];r.animation_data.action=a;r.animation_data.action_slot=a.slots[0];end=float(a.frame_range[1]);poses=[]
 for k in range(121):
  f=k/120*end;bpy.context.scene.frame_set(int(f),subframe=f%1);poses.append({b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy())for b in r.pose.bones})
 for k,pose in enumerate(poses):
  enter=1 if name=='Extract'else smooth(k/12);leave=1 if name=='BuriedOverhead'else smooth((120-k)/12);weight=min(enter,leave)
  if weight==1:continue
  for n,(p,q,s)in pose.items():
   p0,q0,s0=base[n];b=r.pose.bones[n];b.location=p0.lerp(p,weight);b.rotation_quaternion=q0.slerp(q,weight);b.scale=s0.lerp(s,weight)
   for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(data_path=prop,frame=k/120*end,group=n)
 print('BOUNDARY_READY',name)
r.animation_data.action=idle;r.animation_data.action_slot=idle.slots[0];bpy.context.scene.frame_set(0);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));shutil.copy2(src,ROOT/'assets-source/blender/rigged/sarumai.blend')
