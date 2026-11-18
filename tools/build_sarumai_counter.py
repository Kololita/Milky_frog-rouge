"""Add paired cuts and evasive counter poses without rebuilding accepted clips."""
import bpy,math,shutil
from pathlib import Path
from mathutils import Vector as V, Matrix, Quaternion
ROOT=Path.cwd();src=ROOT/'assets-source/blender/sarumai.blend'
backup=ROOT/'assets-source/blender/reference/sarumai-before-evade-counter.blend'
if not backup.exists():shutil.copy2(src,backup)
bpy.ops.wm.open_mainfile(filepath=str(backup))
r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');names=list(r.pose.bones.keys())
def sample(name,t):
 a=bpy.data.actions[name];r.animation_data.action=a;r.animation_data.action_slot=a.slots[0];f=t*float(a.frame_range[1]);bpy.context.scene.frame_set(int(f),subframe=f%1)
 return {b.name:b.matrix.copy() for b in r.pose.bones}
base=sample('Idle',0)
R=[n for n in names if n in ['upper_arm_R','forearm_R','elbow_R','hand_R','blade'] or n.startswith('finger_R')]
L=[n for n in names if n in ['upper_arm_L','forearm_L','elbow_L','hand_L'] or n.startswith('finger_L')]
rest={b.name:b.matrix_local.copy() for b in r.data.bones}
axis=(base['blade'].to_quaternion()@rest['blade'].to_quaternion().inverted())@V((1.365,-.78,-.65)).normalized()
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def around(p,q):return Matrix.Translation(p)@q.to_matrix().to_4x4()@Matrix.Translation(-p)
def mix(a,b,u):
 return {n:Matrix.LocRotScale(a[n].translation.lerp(b[n].translation,u),a[n].to_quaternion().slerp(b[n].to_quaternion(),u),a[n].to_scale().lerp(b[n].to_scale(),u)) for n in names}
def solve(side,target,mats):
 ns=['upper_arm_'+side,'forearm_'+side,'hand_'+side];old={n:m.copy() for n,m in mats.items()};o=mats[ns[0]].translation
 a=(base[ns[1]].translation-base[ns[0]].translation).length;b=(base[ns[2]].translation-base[ns[1]].translation).length
 vec=target-o;d=max(.01,min(vec.length,a+b-.003));direction=vec.normalized()
 pole=V((-.85 if side=='R' else .85,-.65,1.35));perp=pole-o-direction*(pole-o).dot(direction);perp.normalize()
 along=(a*a+d*d-b*b)/(2*d);elbow=o+direction*along+perp*math.sqrt(max(0,a*a-along*along));end=o+direction*d
 for n,start,stop,ref in [(ns[0],o,elbow,ns[1]),(ns[1],elbow,end,ns[2])]:
  q=(old[ref].translation-old[n].translation).rotation_difference(stop-start)
  mats[n]=Matrix.Translation(start)@q.to_matrix().to_4x4()@old[n].to_3x3().to_4x4()
 shift=end-old[ns[2]].translation
 turn=mats[ns[1]].to_quaternion()@old[ns[1]].to_quaternion().inverted()
 hand_delta=Matrix.Translation(end)@turn.to_matrix().to_4x4()@Matrix.Translation(-old[ns[2]].translation)
 for n in (R if side=='R' else L):
  if n not in [ns[0],ns[1],'elbow_'+side]:
   if side=='L':mats[n]=hand_delta@old[n]
   else:mats[n].translation+=shift
 mats['elbow_'+side]=mats[ns[1]].copy()
def left_grip(m):
 # Bring the open hand to the pommel, with the palm following the forearm.
 blade_axis=(m['blade'].to_quaternion()@base['blade'].to_quaternion().inverted())@axis
 target=m['hand_R'].translation-blade_axis*.10+V((.035,0,0))
 # Let the clavicle protract before asking the elbow to reach across the body.
 origin=m['upper_arm_L'].translation;gap=target-origin
 reach=(base['forearm_L'].translation-base['upper_arm_L'].translation).length+(base['hand_L'].translation-base['forearm_L'].translation).length-.015
 shift=gap.normalized()*max(0,gap.length-reach)
 m['clavicle_L'].translation+=shift;m['upper_arm_L'].translation+=shift
 solve('L',target,m)
 mirror=Matrix.Diagonal((-1,1,1,1));closed=m['hand_L']@mirror@base['hand_R'].inverted()
 for n in L:
  if n.startswith('finger_L'):m[n]=closed@base[n.replace('_L','_R')]@mirror
def constrain_fingers(m):
 for side in 'LR':
  forward=(m['hand_'+side].translation-m['forearm_'+side].translation).normalized()
  for digit in range(5):
   chain=[f'finger_{side}_{digit}_{j}' for j in range(2 if digit==0 else 3)]
   end=m[chain[-1]]@V((0,r.data.bones[chain[-1]].length,0));start=m[chain[0]].translation
   direction=(end-start).normalized();angle=direction.angle(forward)
   if angle>math.radians(55):
    q=Quaternion().slerp(direction.rotation_difference(forward),(angle-math.radians(55))/angle)
    transform=around(start,q)
    for n in chain:m[n]=transform@m[n]
def counter_pose(t):
 m={n:b.copy() for n,b in base.items()}
 # Shoulder drives the hands; the blade stays rigidly attached to the grip.
 thrust=smooth((t-.45)/.25);withdraw=1-smooth((t-.76)/.24)
 yaw=.30*(1-thrust)-.08*thrust
 aim=Quaternion(V((0,0,1)),-yaw)@V((.035,-1,.035)).normalized();rot=axis.rotation_difference(aim)
 for n in R:
  if n not in ['upper_arm_R','forearm_R','elbow_R']:m[n]=around(base['hand_R'].translation,rot)@m[n]
 for side in 'LR':
  m['clavicle_'+side].translation.y-=.12;m['upper_arm_'+side].translation.y-=.12
 target=V((-.06,-.53-.18*thrust,1.47-.05*thrust))
 solve('R',target,m);left_grip(m)
 # A side-on guard opens into a forward thrust, then smoothly resets.
 turn=around(base['pelvis'].translation,Quaternion(V((0,0,1)),yaw))
 for n in names:
  if not n.startswith('leg_'):m[n]=turn@m[n]
 m=mix(base,m,withdraw);constrain_fingers(m);return m
guard=counter_pose(.45)
clips={}
for name,original in [('DoubleLeft','CrossLeft'),('DoubleRight','CrossRight')]:
 poses=[]
 for k in range(121):
  t=k/120;m=sample(original,t);held={n:v.copy() for n,v in m.items()}
  for side in 'LR':
   held['clavicle_'+side].translation.y-=.12;held['upper_arm_'+side].translation.y-=.12
  wrist=held['hand_R'].translation.copy();wrist.x=max(-.18,min(.18,wrist.x*.35));wrist.y=min(-.54,wrist.y);wrist.z=min(1.60,wrist.z)
  solve('R',wrist,held);left_grip(held)
  weight=smooth(t/.25)*(1-smooth((t-.76)/.24))
  m=mix(m,held,weight)
  constrain_fingers(m);poses.append(m)
 clips[name]=poses
clips['Backstep']=[mix(base,guard,smooth(k/120/.55)) for k in range(121)]
clips['CounterThrust']=[counter_pose(k/120) for k in range(121)]
for name,poses in clips.items():
 # The long pommel needs room behind the grip when held horizontally.
 # Shared offset keeps both hands on the same handle through the sidestep/pause.
 for k,m in enumerate(poses):
  t=k/120
  weight=smooth(t/.55) if name=='Backstep' else 1-smooth((t-.76)/.24) if name=='CounterThrust' else smooth(t/.25)*(1-smooth((t-.76)/.24))
  for n in R+L+['clavicle_L','clavicle_R']:m[n].translation.y-=.24*weight
 old=bpy.data.actions.get(name)
 if old:bpy.data.actions.remove(old)
 a=bpy.data.actions.new(name);a.use_fake_user=True;r.animation_data.action=a;previous={}
 for k,m in enumerate(poses):
  for n in names:r.pose.bones[n].matrix=m[n];bpy.context.view_layer.update()
  for b in r.pose.bones:
   b.rotation_mode='QUATERNION';q=b.rotation_quaternion
   if b.name in previous and q.dot(previous[b.name])<0:q.negate()
   previous[b.name]=q.copy()
   for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(data_path=prop,frame=k,group=b.name)
 r.animation_data.action=a
 for layer in a.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for key in fc.keyframe_points:key.interpolation='LINEAR'
 print('CREATED',name,flush=True)
r.animation_data.action=bpy.data.actions['Idle'];r.animation_data.action_slot=r.animation_data.action.slots[0];bpy.context.scene.frame_set(0)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));shutil.copy2(src,ROOT/'assets-source/blender/rigged/sarumai.blend')
