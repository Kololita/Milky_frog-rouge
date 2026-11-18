import bpy,math
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path.cwd()/'assets-source/blender/sarumai.blend'));r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');r.animation_data.action=bpy.data.actions['Idle'];r.animation_data.action_slot=r.animation_data.action.slots[0];bpy.context.scene.frame_set(0)
print('BONES',list(r.pose.bones.keys()))
for side in 'LR':
 f=r.pose.bones['forearm_'+side];d=f.tail-f.head
 for i in range(5):
  a=r.pose.bones[f'finger_{side}_{i}_0'];b=r.pose.bones[f'finger_{side}_{i}_{1 if i==0 else 2}'];print(side,i,math.degrees((b.tail-a.head).angle(d)))
