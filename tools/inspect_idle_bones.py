import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/sarumai.blend'));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
for n in ['upper_arm_R','forearm_R','hand_R','upper_arm_L','forearm_L','hand_L','blade']:
 b=rig.data.bones[n];print(n,list(b.head_local),list(b.tail_local))
