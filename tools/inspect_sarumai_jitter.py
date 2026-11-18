import bpy,math
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path.cwd()/'assets-source/blender/sarumai.blend'));r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');r.animation_data.action=bpy.data.actions['Idle'];r.animation_data.action_slot=r.animation_data.action.slots[0];bpy.context.scene.frame_set(0)
for n in ['head','neck','upper_arm_R','forearm_R','hand_R']:print(n,list(r.pose.bones[n].head),list(r.pose.bones[n].tail))
for a in bpy.data.actions:
 r.animation_data.action=a;r.animation_data.action_slot=a.slots[0];prev={};angles={};maxacc={};prevstep={};height=-100
 for k in range(121):
  f=k/120*a.frame_range[1];bpy.context.scene.frame_set(int(f),subframe=f%1)
  for n in ['upper_arm_R','forearm_R','hand_R','blade','chest','root']:
   q=r.pose.bones[n].rotation_quaternion.copy();step=q.rotation_difference(prev[n]).angle if n in prev else 0;step=min(step,math.tau-step);angles[n]=max(angles.get(n,0),step);maxacc[n]=max(maxacc.get(n,0),abs(step-prevstep.get(n,step)));prev[n]=q;prevstep[n]=step
  height=max(height,r.pose.bones['forearm_R'].head.z)
 print(a.name,'max_step_deg',{n:round(math.degrees(v),1)for n,v in angles.items()},'max_elbow_z',round(height,3))
