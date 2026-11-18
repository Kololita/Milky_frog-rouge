import bpy,shutil
from pathlib import Path
root=Path.cwd();src=root/'assets-source/blender/sarumai.blend';bpy.ops.wm.open_mainfile(filepath=str(src));r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for name in ['Overhead','BuriedOverhead']:
 a=bpy.data.actions[name];r.animation_data.action=a;r.animation_data.action_slot=a.slots[0];poses=[]
 for frame in [61,66]:bpy.context.scene.frame_set(frame);poses.append({b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy())for b in r.pose.bones})
 for frame in range(62,66):
  u=(frame-61)/5
  for n,(p,q,s)in poses[0].items():
   p1,q1,s1=poses[1][n];b=r.pose.bones[n];b.location=p.lerp(p1,u);b.rotation_quaternion=q.slerp(q1,u);b.scale=s.lerp(s1,u)
   for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(data_path=prop,frame=frame,group=n)
r.animation_data.action=bpy.data.actions['Idle'];r.animation_data.action_slot=r.animation_data.action.slots[0];bpy.context.scene.frame_set(0);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src))
