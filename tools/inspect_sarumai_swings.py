import bpy,math
from mathutils import Vector as V
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path.cwd()/'assets-source/blender/sarumai.blend'));r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');axis=V((1.365,-.78,-.65)).normalized();origin=r.data.bones['blade'].head_local
for name in ['CrossLeft','CrossRight','Overhead','BuriedOverhead','RisingLeft','RisingRight','ShortThrust','LongThrust','RoundSweep']:
 a=bpy.data.actions[name];r.animation_data.action=a;r.animation_data.action_slot=a.slots[0]
 for t in [.45,.575,.7]:
  bpy.context.scene.frame_set(int(t*60),subframe=t*60%1);m=r.pose.bones['blade'].matrix@r.data.bones['blade'].matrix_local.inverted();d=m.to_3x3()@axis;tip=m@(origin+axis*1.5);print(name,t,'direction',*[round(x,2)for x in d],'tip',*[round(x,2)for x in tip])
