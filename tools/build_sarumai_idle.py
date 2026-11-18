import bpy,math,shutil
from pathlib import Path
from mathutils import Vector as V,Matrix,Quaternion
root=Path(__file__).resolve().parents[1];src=root/'assets-source/blender/sarumai.blend';backup=root/'assets-source/blender/reference/sarumai-before-ready-idle.blend'
if not backup.exists():shutil.copy2(src,backup)
bpy.ops.wm.open_mainfile(filepath=str(backup));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.data.pose_position='POSE';rest={b.name:b.matrix_local.copy()for b in rig.data.bones}
if rig.animation_data:
 rig.animation_data_clear()
old=bpy.data.actions.get('Idle')
if old:bpy.data.actions.remove(old)
a=bpy.data.actions.new('Idle');a.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=a
blade_axis=V((1.365,-.78,-.65)).normalized();right_delta=blade_axis.rotation_difference(V((.32,-.38,.86)).normalized())
# Open left palm: fingers upright, palm normal towards character's right (-X).
hand_y=(rig.data.bones['hand_L'].tail_local-rig.data.bones['hand_L'].head_local).normalized();left_delta=Quaternion(V((0,0,1)),-math.pi/2)@hand_y.rotation_difference(V((0,0,1)))
def arm(side,grip,delta):
 names=['upper_arm_'+side,'forearm_'+side,'hand_'+side];rb=[rig.data.bones[n]for n in names];origin=rb[0].head_local.copy();offset=(rig.data.bones['blade'].head_local-rb[2].head_local)if side=='R'else(rb[2].tail_local-rb[2].head_local)*.5
 wrist=grip-delta@offset;direction=(wrist-origin).normalized();l1=rb[0].length;l2=rb[1].length;d=min((wrist-origin).length,l1+l2-.005);along=(l1*l1+d*d-l2*l2)/(2*d);pole=V((-.85,-.38,1.58))if side=='R'else V((.65,-.12,1.28));perp=pole-origin-direction*(pole-origin).dot(direction);perp.normalize();elbow=origin+direction*along+perp*math.sqrt(max(0,l1*l1-along*along));end=origin+direction*d
 for n,start,stop in [(names[0],origin,elbow),(names[1],elbow,end)]:
  b=rig.data.bones[n];q=(b.tail_local-b.head_local).rotation_difference(stop-start);rig.pose.bones[n].matrix=Matrix.Translation(start)@q.to_matrix().to_4x4()@rest[n].to_3x3().to_4x4();bpy.context.view_layer.update()
 if side=='L':
  # Keep palm/fingers along the forearm, then roll the palm to a diagonal plane.
  target_y=(end-elbow).normalized();normal=V((-1,-1,1)).normalized();target_z=(normal-target_y*normal.dot(target_y)).normalized();target_x=target_y.cross(target_z).normalized();target=Matrix((target_x,target_y,target_z)).transposed().to_quaternion();delta=target@rest[names[2]].to_quaternion().inverted()
 rig.pose.bones[names[2]].matrix=Matrix.Translation(end)@delta.to_matrix().to_4x4()@rest[names[2]].to_3x3().to_4x4();bpy.context.view_layer.update()
for frame in range(61):
 for b in rig.pose.bones:b.rotation_mode='QUATERNION';b.location=(0,0,0);b.rotation_quaternion=Quaternion();b.scale=(1,1,1)
 bpy.context.view_layer.update();breath=.004*math.sin(math.tau*frame/60)
 arm('R',V((-.17,-.54,1.43+breath)),right_delta);arm('L',V((.14,-.45,1.61+breath)),left_delta)
 # Thumb follows the forearm; the four closed fingers share one upward diagonal.
 fore=rig.pose.bones['forearm_L'];forward=(fore.tail-fore.head).normalized();up=V((0,0,1));up=(up-forward*up.dot(forward)).normalized();horizontal=V((forward.x,forward.y,0)).normalized();fingers=(horizontal+V((0,0,1))).normalized();across=forward.cross(up).normalized();hand=rig.pose.bones['hand_L'];palm=hand.head+forward*.065
 for digit in range(5):
  direction=forward if digit==0 else fingers
  start=hand.matrix@rest['hand_L'].inverted()@rig.data.bones[f'finger_L_{digit}_0'].head_local
  for joint in range(2 if digit==0 else 3):
   name=f'finger_L_{digit}_{joint}';bone=rig.data.bones[name];length=bone.length
   q=(bone.tail_local-bone.head_local).rotation_difference(direction)
   rig.pose.bones[name].matrix=Matrix.Translation(start)@q.to_matrix().to_4x4()@rest[name].to_3x3().to_4x4();bpy.context.view_layer.update()
   posed=rig.pose.bones[name];angle=math.degrees((posed.tail-posed.head).angle(forward));assert angle<=60.01,(name,angle)
   start=posed.tail.copy()
 chest=rig.pose.bones['root'];matrix=chest.matrix.copy();rotation=Matrix.Rotation(-.12,4,'Z');chest.matrix=Matrix.Translation(matrix.translation)@rotation@matrix.to_3x3().to_4x4()
 for side,offset in [('L',V((.04,-.10,0))),('R',V((-.04,.05,0)))]:
  b=rig.pose.bones['leg_'+side+'_0'];matrix=b.matrix.copy();matrix.translation+=offset;b.matrix=matrix
 bpy.context.view_layer.update()
 for b in rig.pose.bones:
  for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(data_path=prop,frame=frame,group=b.name)
bpy.context.scene.frame_set(0);rig.data.pose_position='POSE';bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));print('READY_IDLE_REBUILT')
