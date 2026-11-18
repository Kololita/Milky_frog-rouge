import bpy,math,shutil
from pathlib import Path
root=Path.cwd();src=root/'assets-source/blender/sarumai.blend';bpy.ops.wm.open_mainfile(filepath=str(src));r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for a in bpy.data.actions:
 if a.name in ['Idle','Walk','Hurt','Death']:continue
 r.animation_data.action=a;r.animation_data.action_slot=a.slots[0];end=float(a.frame_range[1]);tracks={b.name:[]for b in r.pose.bones}
 for k in range(121):
  f=k/120*end;bpy.context.scene.frame_set(int(f),subframe=f%1)
  for b in r.pose.bones:tracks[b.name].append(b.rotation_quaternion.normalized())
 for n,qs in tracks.items():
  cap=math.radians(12 if n=='root'else 8 if n=='blade'else 6);first=qs[0].copy();last=qs[-1].copy()
  for i in range(1,121):
   if qs[i].dot(qs[i-1])<0:qs[i].negate()
  for repeat in range(8):
   qs[0]=first.copy()
   for i in range(1,121):
    d=min(qs[i-1].rotation_difference(qs[i]).angle,math.tau-qs[i-1].rotation_difference(qs[i]).angle)
    if d>cap:qs[i]=qs[i-1].slerp(qs[i],cap/d)
   qs[-1]=last.copy()
   for i in range(119,-1,-1):
    d=min(qs[i+1].rotation_difference(qs[i]).angle,math.tau-qs[i+1].rotation_difference(qs[i]).angle)
    if d>cap:qs[i]=qs[i+1].slerp(qs[i],cap/d)
  for k,q in enumerate(qs):b=r.pose.bones[n];b.rotation_quaternion=q;b.keyframe_insert(data_path='rotation_quaternion',frame=k/120*end,group=n)
r.animation_data.action=bpy.data.actions['Idle'];r.animation_data.action_slot=r.animation_data.action.slots[0];bpy.context.scene.frame_set(0);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));shutil.copy2(src,root/'assets-source/blender/rigged/sarumai.blend')
