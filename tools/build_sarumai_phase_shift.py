import bpy,math,shutil
from pathlib import Path
ROOT=Path.cwd();src=ROOT/'assets-source/blender/sarumai.blend'
backup=ROOT/'assets-source/blender/reference/sarumai-before-phase-shift.blend'
if not backup.exists():shutil.copy2(src,backup)
bpy.ops.wm.open_mainfile(filepath=str(src));r=next(o for o in bpy.data.objects if o.type=='ARMATURE')
source=bpy.data.actions['Overhead'];r.animation_data.action=source;r.animation_data.action_slot=source.slots[0];end=float(source.frame_range[1]);poses=[]
def smooth(u):u=max(0,min(1,u));return u*u*(3-2*u)
for k in range(121):
 t=k/120;phase=.45*smooth(t/.26) if t<.26 else .45 if t<.78 else .45*(1-smooth((t-.78)/.22))
 f=phase*end;bpy.context.scene.frame_set(int(f),subframe=f%1)
 poses.append({b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy()) for b in r.pose.bones})
old=bpy.data.actions.get('PhaseShift')
if old:bpy.data.actions.remove(old)
a=bpy.data.actions.new('PhaseShift');a.use_fake_user=True;r.animation_data.action=a
for k,pose in enumerate(poses):
 for name,(p,q,s) in pose.items():
  b=r.pose.bones[name];b.location=p;b.rotation_quaternion=q;b.scale=s
  for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(data_path=prop,frame=k,group=name)
for layer in a.layers:
 for strip in layer.strips:
  for bag in strip.channelbags:
   for fc in bag.fcurves:
    for key in fc.keyframe_points:key.interpolation='LINEAR'
r.animation_data.action=bpy.data.actions['Idle'];r.animation_data.action_slot=r.animation_data.action.slots[0];bpy.context.scene.frame_set(0)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));shutil.copy2(src,ROOT/'assets-source/blender/rigged/sarumai.blend');print('PHASE_SHIFT_AUTHORED')
