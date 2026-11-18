import bpy, shutil
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];source=root/'assets-source/blender/sarumai.blend'
backup=root/'assets-source/blender/reference/sarumai-user-calibrated.blend';backup.parent.mkdir(exist_ok=True,parents=True)
if not backup.exists():shutil.copy2(source,backup)
bpy.ops.wm.open_mainfile(filepath=str(source));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');bpy.context.view_layer.objects.active=rig
if bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
thumb={b.name:(b.head_local.copy(),b.tail_local.copy())for b in rig.data.bones if b.name.startswith(('finger_L_0','finger_R_0'))}
bpy.ops.object.mode_set(mode='EDIT')
# Explicit landmarks read against the front, side and top mesh projections.
left=[ [(-.815,-.025,1.714),(-.864,-.043,1.727),(-.910,-.056,1.732),(-.943,-.062,1.729)],
[(-.819,-.031,1.685),(-.875,-.048,1.692),(-.927,-.062,1.696),(-.959,-.065,1.693)],
[(-.815,-.034,1.655),(-.865,-.051,1.656),(-.916,-.064,1.656),(-.950,-.066,1.651)],
[(-.806,-.039,1.625),(-.844,-.057,1.611),(-.883,-.067,1.602),(-.914,-.071,1.599)] ]
right=[[(.700,-.128,1.294),(.717,-.172,1.281),(.687,-.206,1.268),(.660,-.190,1.277)],
[(.700,-.130,1.260),(.711,-.177,1.247),(.679,-.213,1.235),(.650,-.190,1.246)],
[(.684,-.135,1.225),(.696,-.182,1.212),(.667,-.216,1.200),(.642,-.190,1.210)],
[(.668,-.140,1.194),(.678,-.183,1.180),(.653,-.207,1.169),(.632,-.187,1.180)]]
for side,chains in [('L',left),('R',right)]:
 for digit,points in enumerate(chains,1):
  for j in range(3):
   b=rig.data.edit_bones[f'finger_{side}_{digit}_{j}'];b.use_connect=False;b.head=points[j];b.tail=points[j+1];b.align_roll(Vector((0,-1,0)))
# Right-arm landmarks follow the sleeve opening, elbow bend and wrist cuff.
for name,head,tail in [
 ('upper_arm_R',(.31,.04,1.68),(.47,.015,1.48)),
 ('forearm_R',(.47,.015,1.48),(.615,-.118,1.335)),
 ('hand_R',(.615,-.118,1.335),(.680,-.138,1.260)),
 ('elbow_R',(.47,.015,1.48),(.529,-.039,1.421))]:
 b=rig.data.edit_bones[name];b.use_connect=False;b.head=head;b.tail=tail
# The palm centre must not follow the thumb branch.
b=rig.data.edit_bones['hand_L'];b.tail=(-.811,-.031,1.665)
# Keep the thumb roots independent of the palm endpoint.
for name,(head,tail) in thumb.items():
 b=rig.data.edit_bones[name];b.use_connect=False;b.head=head;b.tail=tail
bpy.ops.object.mode_set(mode='OBJECT');rig.data.pose_position='REST';rig.show_in_front=True
for name,(head,tail) in thumb.items():
 b=rig.data.bones[name];assert (b.head_local-head).length<1e-6 and (b.tail_local-tail).length<1e-6
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(source));print('USER_THUMBS_PRESERVED; 24 finger segments and left palm corrected')
