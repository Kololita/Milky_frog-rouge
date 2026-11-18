import bpy,math,shutil,json
from pathlib import Path
from mathutils import Vector as V,Matrix,Quaternion,Euler
ROOT=Path.cwd();src=ROOT/'assets-source/blender/sarumai.blend';backup=ROOT/'assets-source/blender/reference/sarumai-before-animation-rebuild.blend'
if not backup.exists():shutil.copy2(src,backup)
bpy.ops.wm.open_mainfile(filepath=str(src));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rig.data.pose_position='POSE';idle=bpy.data.actions['Idle'];rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0];bpy.context.scene.frame_set(0)
for track in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(track)
for old in list(bpy.data.actions):
 if old!=idle:bpy.data.actions.remove(old)
base={b.name:b.matrix.copy()for b in rig.pose.bones};rest={b.name:b.matrix_local.copy()for b in rig.data.bones};names=list(base)
right=[n for n in names if n in ['upper_arm_R','elbow_R','forearm_R','hand_R','blade']or n.startswith('finger_R')];left=[n for n in names if n in ['upper_arm_L','elbow_L','forearm_L','hand_L']or n.startswith('finger_L')]
axis=(base['blade'].to_quaternion()@rig.data.bones['blade'].matrix_local.to_quaternion().inverted())@V((1.365,-.78,-.65)).normalized()
# Every clip shares the accepted ready stance at its boundaries.
# phase 0.45 = anticipation complete, phase 0.70 = strike complete.
# Each value is (phase, shoulder X/Y/Z angles, body yaw, knee dip).
tracks={
 'CrossLeft':[(0,(0,0,0),0,0),(.20,(-15,-12,-28),-.12,.025),(.45,(-25,-18,-65),-.30,.035),(.57,(0,8,0),0,.045),(.70,(25,22,68),.32,.035),(1,(0,0,0),0,0)],
 'CrossRight':[(0,(0,0,0),0,0),(.45,(-5,25,62),.28,.035),(.58,(12,-5,0),0,.045),(.70,(15,-25,-60),-.32,.03),(1,(0,0,0),0,0)],
 'Overhead':[(0,(0,0,0),0,0),(.23,(-40,-10,-12),-.10,.04),(.45,(-85,-5,-6),-.08,.055),(.54,(-65,0,0),0,.04),(.64,(30,0,5),.08,.10),(.70,(48,0,5),.1,.12),(1,(0,0,0),0,0)],
 'BuriedOverhead':[(0,(0,0,0),0,0),(.14,(-35,-10,-8),-.12,.025),(.34,(-75,-5,-5),-.1,.06),(.45,(-85,-5,-5),-.08,.07),(.54,(-72,0,0),0,.05),(.66,(55,0,0),.06,.16),(.70,(58,0,0),.06,.18),(1,(58,0,0),.06,.18)],
 'Rising':[(0,(0,0,0),0,0),(.45,(48,-20,-22),-.3,.12),(.56,(12,-8,0),0,.08),(.70,(-70,16,38),.3,.015),(1,(0,0,0),0,0)],
 'RisingLeft':[(0,(0,0,0),0,0),(.26,(42,-25,18),.22,.08),(.45,(52,-30,25),.30,.11),(.57,(0,0,0),0,.05),(.70,(-78,22,-25),-.30,.015),(1,(0,0,0),0,0)],
 'RisingRight':[(0,(0,0,0),0,0),(.45,(48,28,-34),-.3,.11),(.57,(0,0,0),0,.05),(.70,(-74,-18,38),.32,.015),(1,(0,0,0),0,0)],
 'ShortThrust':[(0,(0,0,0),0,0),(.45,(8,-52,-12),-.2,.055),(.58,(36,-58,3),.12,.065),(.70,(42,-58,3),.16,.07),(1,(0,0,0),0,0)],
 'LongThrust':[(0,(0,0,0),0,0),(.45,(-8,-65,-22),-.32,.08),(.56,(30,-62,2),.16,.11),(.70,(42,-62,4),.24,.13),(1,(0,0,0),0,0)],
 'RoundSweep':[(0,(0,0,0),0,0),(.45,(44,-20,-68),-.55,.16),(.55,(54,0,-25),-.22,.16),(.62,(54,15,25),.24,.16),(.70,(44,25,78),.65,.13),(1,(0,0,0),0,0)],
 'Extract':[(0,(58,0,0),.06,.18),(.35,(58,0,0),.06,.18),(.62,(0,0,-8),-.08,.06),(.80,(-28,0,-12),-.10,.025),(1,(0,0,0),0,0)],
 'Hurt':[(0,(0,0,0),0,0),(.22,(-16,-12,-14),-.12,.09),(.48,(-12,-8,-8),-.08,.065),(1,(0,0,0),0,0)],
 'Death':[(0,(0,0,0),0,0),(.20,(12,-8,-10),-.08,.16),(.45,(25,8,-14),-.14,.4),(.7,(38,10,-20),-.20,.65),(1,(42,15,-25),-.25,.72)]}
def smooth(x):return x*x*(3-2*x)
def sample(keys,t):
 for a,b in zip(keys,keys[1:]):
  if a[0]<=t<=b[0]:
   u=smooth((t-a[0])/(b[0]-a[0]));return ([x+(y-x)*u for x,y in zip(a[1],b[1])],a[2]+(b[2]-a[2])*u,a[3]+(b[3]-a[3])*u)
 return keys[-1][1:]
def around(p,q):return Matrix.Translation(p)@q.to_matrix().to_4x4()@Matrix.Translation(-p)
def put(mats):
 for n in names:rig.pose.bones[n].matrix=mats[n];bpy.context.view_layer.update()
def ik(side,target,mats):
 upper='upper_arm_'+side;fore='forearm_'+side;hand='hand_'+side;reference={n:m.copy()for n,m in (mats if side=='R'else base).items()};o=mats[upper].translation;a=(base[fore].translation-base[upper].translation).length;b=(base[hand].translation-base[fore].translation).length;delta=target-o;d=min(delta.length,a+b-.004);direction=delta.normalized();pole=V((.9 if side=='L'else -.9,-.45,1.4));perp=pole-o-direction*(pole-o).dot(direction)
 if perp.length<.001:perp=V((1,0,0))
 perp.normalize();along=(a*a+d*d-b*b)/(2*d);elbow=o+direction*along+perp*math.sqrt(max(0,a*a-along*along));end=o+direction*d
 for n,start,stop,refstop in [(upper,o,elbow,base[fore].translation),(fore,elbow,end,base[hand].translation)]:
  q=(reference[fore if n==upper else hand].translation-reference[n].translation).rotation_difference(stop-start);mats[n]=Matrix.Translation(start)@q.to_matrix().to_4x4()@reference[n].to_3x3().to_4x4()
 q=mats[fore].to_quaternion()@reference[fore].to_quaternion().inverted();delta=Matrix.Translation(end)@q.to_matrix().to_4x4()@Matrix.Translation(-reference[hand].translation)
 for n in (left if side=='L'else right):
  if n not in [upper,fore,'elbow_'+side]:mats[n]=delta@reference[n]
 mats['elbow_'+side]=mats[fore].copy()
def legs(mats,t,dip,walking=False,drive=0,attack_step=None,step_weight=0,step_lift=0):
 for i,side in enumerate('LR'):
  ns=[f'leg_{side}_{j}'for j in range(3)];hip=base[ns[0]].translation+V((0,0,-dip));knee=base[ns[1]].translation;ankle=base[ns[2]].translation.copy();hip.y-=drive
  if attack_step and side==attack_step:
   ankle.y-=.18*step_weight;ankle.z+=.065*step_lift
  if walking:
   phase=math.tau*t+i*math.pi;ankle.y+=.13*math.sin(phase);ankle.z+=.065*max(0,math.cos(phase))**1.5
  a=(knee-base[ns[0]].translation).length;b=(base[ns[2]].translation-knee).length;vec=ankle-hip;d=min(vec.length,a+b-.001);direction=vec.normalized();pole=V((0,-1,0));perp=(pole-direction*pole.dot(direction)).normalized();along=(a*a+d*d-b*b)/(2*d);bend=hip+direction*along+perp*math.sqrt(max(0,a*a-along*along))
  for n,start,stop,refstop in [(ns[0],hip,bend,base[ns[1]].translation),(ns[1],bend,ankle,base[ns[2]].translation)]:
   q=(refstop-base[n].translation).rotation_difference(stop-start);mats[n]=Matrix.Translation(start)@q.to_matrix().to_4x4()@base[n].to_3x3().to_4x4()
  mats[ns[2]]=base[ns[2]].copy();mats[ns[2]].translation=ankle
report={};two={'Overhead','BuriedOverhead','RisingLeft','RisingRight','Extract'}
for name in ['Walk',*tracks]:
 old=bpy.data.actions.get(name)
 if old:bpy.data.actions.remove(old)
 action=bpy.data.actions.new(name);action.use_fake_user=True;rig.animation_data.action=action;maximum=0
 for frame in range(61):
  t=frame/60;mats={n:m.copy()for n,m in base.items()};angles,yaw,dip=([0,0,0],0,0)if name=='Walk'else sample(tracks[name],t)
  q=Euler(tuple(math.radians(x)for x in angles),'XYZ').to_quaternion();arm=around(base['upper_arm_R'].translation,q)
  for n in right:mats[n]=arm@base[n]
  # The forearm follows through at the elbow: edge down for chops, tip forward for stabs.
  follow=0
  if name in ['Overhead','BuriedOverhead']:
   follow=(55 if name=='Overhead'else 60)*smooth(max(0,min(1,(t-.49)/.19)))
   if name=='Overhead':follow*=1-smooth(max(0,min(1,(t-.75)/.25)))
  elif name=='Extract':follow=60*(1-smooth(max(0,min(1,(t-.35)/.4))))
  elif name in ['ShortThrust','LongThrust']:follow=28*smooth(max(0,min(1,(t-.45)/.17)))*(1-smooth(max(0,min(1,(t-.75)/.25))))
  elif name in ['CrossLeft','CrossRight']:follow=48*smooth(min(1,t/.35))*(1-smooth(max(0,min(1,(t-.75)/.25))))
  elif name in ['Rising','RisingLeft','RisingRight']:follow=30*smooth(min(1,t/.25))*(1-smooth(max(0,min(1,(t-.45)/.25))))
  elbow=around(mats['forearm_R'].translation,Quaternion(V((1,0,0)),math.radians(follow)))
  for n in right:
   if n!='upper_arm_R':mats[n]=elbow@mats[n]
  if name in two:
   amount=1 if name=='Extract'else smooth(min(1,t/.25))*(1-smooth(max(0,(t-.8)/.2)))
   charge=smooth(min(1,t/.45))*(1-smooth(max(0,min(1,(t-.48)/.22))))
   if name=='Extract':charge=smooth(max(0,min(1,(t-.35)/.4)))
   desired=V((-.015,-.25,1.55+.46*charge))
   for side in 'LR':
    shoulder=V((-.09 if side=='L'else .09,-.10,.12*charge))*amount
    for n in (left if side=='L'else right):mats[n].translation+=shoulder
    mats['clavicle_'+side].translation+=shoulder
   blade=mats['blade'];delta=blade@base['blade'].inverted();bladeaxis=(delta.to_quaternion()@axis).normalized();grip=blade.translation-bladeaxis*.10
   target=base['hand_L'].translation.lerp(grip,amount)
   reach=rig.data.bones['upper_arm_L'].length+rig.data.bones['forearm_L'].length-.05
   gap=target-mats['upper_arm_L'].translation
   shift=gap.normalized()*max(0,min(.22,gap.length-reach))*amount
   mats['upper_arm_L'].translation+=shift;mats['clavicle_L'].translation+=shift
   for iteration in range(3):
    ik('L',target,mats);palm=mats['hand_L']@V((0,.05,0));target+=(grip-palm)*amount
   mirror=Matrix.Diagonal((-1,1,1,1));closed=mats['hand_L']@mirror@base['hand_R'].inverted()
   for n in left:
    if not n.startswith('finger_L'):continue
    goal=closed@base[n.replace('_L','_R')]@mirror;current=mats[n];q=current.to_quaternion().slerp(goal.to_quaternion(),amount);mats[n]=Matrix.Translation(current.translation.lerp(goal.translation,amount))@q.to_matrix().to_4x4()

  lift=.16*smooth(min(1,t/.25))*(1-smooth(max(0,min(1,(t-.8)/.2))))if name not in ['Walk','Hurt','Death']else 0
  if name=='BuriedOverhead':lift=.16*smooth(min(1,t/.25))
  if name=='Extract':lift=.16*(1-smooth(max(0,min(1,(t-.8)/.2))))
  for n in right:mats[n].translation+=V((0,-.08*lift/.16,lift))
  mats['clavicle_R'].translation+=V((0,-.08*lift/.16,lift))
  if name in two:
   for n in left:mats[n].translation+=V((0,-.08*lift/.16,lift))
   mats['clavicle_L'].translation+=V((0,-.08*lift/.16,lift))
  attack=name not in ['Walk','Hurt','Death','Extract'];drive=.065*smooth(max(0,min(1,(t-.32)/.24)))*(1-smooth(max(0,min(1,(t-.78)/.22))))if attack else 0
  if name=='RoundSweep':yaw=0
  if name=='Death':dip=min(dip,.22)
  torso=around(base['pelvis'].translation,Quaternion(V((0,0,1)),yaw));torso.translation+=V((0,-drive,-dip))
  if attack:torso=around(base['pelvis'].translation+V((0,-drive,0)),Quaternion(V((1,0,0)),drive*2))@torso
  for n in names:
   if not n.startswith('leg_'):mats[n]=torso@mats[n]
  step_name=None if not attack else 'R'if name in ['CrossRight','LongThrust','RisingRight']else 'L'
  step_weight=smooth(max(0,min(1,(t-.24)/.32)))*(1-smooth(max(0,min(1,(t-.78)/.22))))
  step_lift=math.sin(math.pi*max(0,min(1,(t-.24)/.32)))
  legs(mats,t,min(dip,.22),name=='Walk',drive,step_name,step_weight,step_lift)
  if name=='RoundSweep':
   spin=around(base['pelvis'].translation,Quaternion(V((0,0,1)),math.tau*smooth(max(0,min(1,(t-.4)/.45)))))
   mats={n:spin@m for n,m in mats.items()}
  if name=='Death':
   fall=smooth(max(0,min(1,(t-.35)/.65)));collapse=Matrix.Translation(V((0,.12*fall,-.85*fall)))@around(base['pelvis'].translation+V((0,0,-.22)),Quaternion(V((1,0,0)),-1.45*fall))
   mats={n:collapse@m for n,m in mats.items()}
  put(mats)
  for side in 'LR':
   fore=rig.pose.bones['forearm_'+side];direction=fore.tail-fore.head
   for digit in range(5):
    start=rig.pose.bones[f'finger_{side}_{digit}_0'].head;end=rig.pose.bones[f'finger_{side}_{digit}_{1 if digit==0 else 2}'].tail;angle=math.degrees((end-start).angle(direction));maximum=max(maximum,angle);assert angle<=60.01,(name,frame,side,digit,angle)
  for bone in rig.pose.bones:
   bone.rotation_mode='QUATERNION'
   for prop in ['location','rotation_quaternion','scale']:bone.keyframe_insert(data_path=prop,frame=frame,group=bone.name)
 for layer in action.layers:
  for strip in layer.strips:
   bag=strip.channelbag(action.slots[0])
   if bag:
    for curve in bag.fcurves:
     for key in curve.keyframe_points:key.interpolation='LINEAR'
 report[name]={'frames':61,'max_finger_forearm_angle':maximum}
 print('REBUILT',name,maximum)
# Calibrate the cutting edge from the original blade section; preserve its style.
# The thinner (+width) side is the cutting edge, not the thicker spine.
edge_rest=V((-.39807494,.06585597,-.91498597));blade_rest=rig.data.bones['blade'];blade_rest['cutting_edge_rest']=list(edge_rest)
edge_report={}
for name in ['CrossLeft','CrossRight','Overhead','BuriedOverhead','Rising','RisingLeft','RisingRight','RoundSweep']:
 action=bpy.data.actions[name];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
 contact=.62 if 'Overhead'in name else .59
 def blade_at(t):
  f=t*60;bpy.context.scene.frame_set(int(f),subframe=f%1);return rig.pose.bones['blade'].matrix.copy()
 before=blade_at(contact-.006);after=blade_at(contact+.006);at=blade_at(contact);local_axis=V((0,1,0));point=V((0,.8,0));velocity=(after@point-before@point).normalized();axis_world=(at.to_3x3()@local_axis).normalized();cut=(at@blade_rest.matrix_local.inverted()).to_3x3()@edge_rest;cut-=axis_world*cut.dot(axis_world);cut.normalize();velocity-=axis_world*velocity.dot(axis_world);velocity.normalize();roll=math.atan2(axis_world.dot(cut.cross(velocity)),cut.dot(velocity))
 for frame in range(61):
  bpy.context.scene.frame_set(frame);b=rig.pose.bones['blade'];weight=smooth(min(1,(frame/60)/.4))*(1-smooth(max(0,min(1,(frame/60-.74)/.26))))
  if name=='BuriedOverhead':weight=smooth(min(1,(frame/60)/.4))
  b.rotation_quaternion=b.rotation_quaternion@Quaternion(V((0,1,0)),roll*weight);b.keyframe_insert(data_path='rotation_quaternion',frame=frame,group='blade')
 at=blade_at(contact);facing=((at@blade_rest.matrix_local.inverted()).to_3x3()@edge_rest).normalized().dot(velocity);edge_report[name]={'roll_degrees':math.degrees(roll),'edge_velocity_dot':facing};assert facing>.95,(name,facing)
(ROOT/'output/sarumai-cutting-edge-validation.json').write_text(json.dumps(edge_report,indent=2))
rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0];bpy.context.scene.frame_set(0);bpy.context.scene.render.fps=30;bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=60
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));shutil.copy2(src,ROOT/'assets-source/blender/rigged/sarumai.blend');(ROOT/'output/sarumai-animation-rebuild.json').write_text(json.dumps(report,indent=2))
