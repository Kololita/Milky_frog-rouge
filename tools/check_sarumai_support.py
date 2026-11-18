import bpy,math
from mathutils import Vector as V
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path.cwd()/'assets-source/blender/sarumai.blend'));r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rest=r.data.bones['blade'];axis=V((1.365,-.78,-.65)).normalized()
for name in ['Overhead','BuriedOverhead','RisingLeft','RisingRight','Extract']:
 a=bpy.data.actions[name];r.animation_data.action=a;r.animation_data.action_slot=a.slots[0];errors=[]
 for f in range(15,49):
  bpy.context.scene.frame_set(f);blade=r.pose.bones['blade'];direction=(blade.matrix@rest.matrix_local.inverted()).to_3x3()@axis;target=blade.head-direction*.1;palm=r.pose.bones['hand_L'].matrix@V((0,.05,0));errors.append((palm-target).length)
 print(name,max(errors))
