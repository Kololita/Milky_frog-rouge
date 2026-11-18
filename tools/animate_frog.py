"""Author the milk-frog FK animation library without altering the mesh or rest rig."""
import bpy, math, json, hashlib, sys, numpy as np
from pathlib import Path
from mathutils import Matrix, Vector, Quaternion
sys.path.insert(0,str(Path(__file__).resolve().parent))
from frog_expressions import ensure_expressions, apply_expression, expression_values, jaw_pose, finalize_expression_clearance, LAUGH_FRAMES
from frog_hand_pose import hand_pose
root=Path(__file__).resolve().parents[1];out=root/'output/animations';out.mkdir(exist_ok=True,parents=True)
source=root/'assets-source/blender/frog.blend';source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source))
if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');mesh=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));scene=bpy.context.scene;scene.render.fps=24
locomotion_only='--locomotion-only' in sys.argv
dodge_names=['DodgeRoll','DodgeBackflip','DodgeSideL','DodgeSideR']
names=['Walk','WalkBack','Run'] if locomotion_only else ['Idle','Walk','WalkBack','Run','TurnLeft','TurnRight','Jump','JumpWalk','JumpRun',*dodge_names,'Attack1','Attack2','Attack3','Attack4','Hit','Block','Sit','Crouch','Blink','Laugh']
if '--update-hands-and-face' in sys.argv:names=['Walk','WalkBack','Run','Blink','Laugh']
if '--expressions-only' in sys.argv:names=['Blink','Laugh']
if '--jumps-only' in sys.argv:names=['Jump','JumpWalk','JumpRun']
if '--performance-pass' in sys.argv:names=['Laugh','Jump','JumpWalk','JumpRun']
if '--push-contact-only' in sys.argv:names=['Laugh','RunAttack']
if '--laugh-only' in sys.argv:names=['Laugh']
if '--block-only' in sys.argv:names=['Block']
if '--attacks-only' in sys.argv:names=['Attack1','Attack2','Attack3','Attack4']
if '--combat-only' in sys.argv:names=['Attack1','Attack2','Attack3','Attack4',*dodge_names,'RunAttack','AirAttack']
if '--dodges-only' in sys.argv:names=dodge_names
if '--run-only' in sys.argv:names=['Run']
if '--pivots-only' in sys.argv:names=['PivotLeft','PivotRight']
elif '--air-attack-only' in sys.argv:names=['AirAttack']
elif '--special-attacks-only' in sys.argv:names=['RunAttack','AirAttack']
elif not any(flag in sys.argv for flag in ['--locomotion-only','--update-hands-and-face','--expressions-only','--jumps-only','--performance-pass','--push-contact-only','--laugh-only','--block-only','--attacks-only','--combat-only','--dodges-only','--run-only']):names+=['PivotLeft','PivotRight','RunAttack','AirAttack']
face_meshes=ensure_expressions(mesh,rig,rebuild=('Blink' in names or 'Laugh' in names))
# Preserve the belly-contact foundation used inside Laugh, without a separate action.
laugh_base_quats={name:Quaternion(q) for name,q in json.loads(rig.get('laugh_baseline_rotations','{}')).items()}
old=bpy.data.actions.get('HoldBelly')
if old:
 rig.animation_data.action=old;scene.frame_set(37);bpy.context.view_layer.update();laugh_base_quats={p.name:p.rotation_quaternion.copy() for p in rig.pose.bones}
 rig['laugh_baseline_rotations']=json.dumps({name:list(q) for name,q in laugh_base_quats.items()})
if rig.animation_data:rig.animation_data.action=None
removed_actions={'Wave','HoldBelly','Cheer','Death','Attack','Dodge'}
for a in list(bpy.data.actions):
 if a.name in names or a.name in removed_actions:bpy.data.actions.remove(a)
rig_snapshot=[(b.name,tuple(b.head_local),tuple(b.tail_local),b.parent.name if b.parent else None) for b in rig.data.bones];geometry=[tuple(v.co) for v in mesh.data.vertices]
axes={b.name:(rig.matrix_world@b.matrix_local).to_quaternion().to_matrix() for b in rig.data.bones}
for p in rig.pose.bones:p.rotation_mode='QUATERNION';p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update();raw=np.array(geometry);mesh_world=mesh.matrix_world.copy();model_offset=np.array(((raw[:,0].min()+raw[:,0].max())/2,raw[:,1].min()+.248777,raw[:,2].min()));local=raw-model_offset

def rad(x):return math.radians(x)
def set_matrix(name,R):
 if name not in rig.pose.bones:return
 A=axes[name];rig.pose.bones[name].rotation_quaternion=(A.transposed()@R@A).to_quaternion()
def rot(name,x=0,y=0,z=0):set_matrix(name,Matrix.Rotation(rad(z),3,'Z')@Matrix.Rotation(rad(y),3,'Y')@Matrix.Rotation(rad(x),3,'X'))

def direction(name,target):
 # A desired world orientation must compensate the ACTUAL posed parent.
 # Conjugating against rest axes alone also inherits the parent's rotation.
 b=rig.data.bones[name];p=rig.pose.bones[name]
 rest_world=rig.matrix_world@b.matrix_local
 rest_axis=(rig.matrix_world.to_3x3()@(b.tail_local-b.head_local)).normalized()
 desired=rest_axis.rotation_difference(Vector(target).normalized())@rest_world.to_quaternion()
 world_rotation(name,desired)

def world_rotation(name,desired):
 b=rig.data.bones[name];p=rig.pose.bones[name]
 rest_world=rig.matrix_world@b.matrix_local
 if b.parent:
  relative=b.parent.matrix_local.inverted()@b.matrix_local
  base=rig.matrix_world@rig.pose.bones[b.parent.name].matrix@relative
 else:base=rest_world
 p.rotation_quaternion=base.to_quaternion().inverted()@desired
 bpy.context.view_layer.update()

def limb_direction(side,angle,splay):
 s=1 if side=='L' else -1
 return Vector((s*math.sin(rad(splay)),-math.sin(rad(angle))*math.cos(rad(splay)),-math.cos(rad(angle))*math.cos(rad(splay))))
def arm(side,swing=0,lower=52,spread=0):
 s=1 if side=='L' else -1
 # Lower the arm FIRST, then swing it about world X. The previous order
 # twisted the T-pose arm about its length instead of swinging it forward.
 R=Matrix.Rotation(rad(swing),3,'X')@Matrix.Rotation(rad(s*lower),3,'Y')@Matrix.Rotation(rad(s*spread),3,'Z');set_matrix('upper_arm.'+side,R)
def location(delta):rig.pose.bones['spine'].location=(rig.matrix_world@rig.data.bones['spine'].matrix_local).to_3x3().inverted()@Vector(delta)
def reset():
 for p in rig.pose.bones:p.location=(0,0,0);p.rotation_quaternion=(1,0,0,0);p.scale=(1,1,1)
def coordinates():
 bpy.context.view_layer.update();obj=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=obj.to_mesh();a=np.array([tuple(obj.matrix_world@v.co) for v in data.vertices]);obj.to_mesh_clear();return a
reset();neutral=coordinates();floor=float(np.min(neutral[:,2]));footids=np.where(local[:,2]<.058)[0]
def ground(extra_z=0,x=0,y=0,whole=False):
 location((0,0,0));a=coordinates();minimum=float(np.min(a[:,2] if whole else a[footids,2]));location((x,y,floor-minimum+.001+extra_z))
def ease(t):u=max(0,min(1,t));return u*u*(3-2*u)
def pulse(t,rise=.25,fall=.75):return ease(t/rise) if t<rise else (ease((1-t)/(1-fall)) if t>fall else 1)
def relax():
 for side,s in [('L',1),('R',-1)]:arm(side);rot('forearm.'+side,-5,0,-s*7);rot('hand.'+side,0,0,s*2)
 if rig.get('four_segment_fingers'):
  bpy.context.view_layer.update()
  for side in ['L','R']:hand_pose(rig,side,0)
def fingers(side,amount):
 if rig.get('four_segment_fingers'):hand_pose(rig,side,max(0,min(1,amount/55)));return
 for p in rig.pose.bones:
  if p.name.startswith('f_') and p.name.endswith('.'+side):p.rotation_quaternion=Quaternion((1,0,0),rad(amount))

def fist(side):
 if rig.get('four_segment_fingers'):hand_pose(rig,side,1);return
 # Close the three phalanges independently; include the opposing thumb.
 for p in rig.pose.bones:
  if not p.name.endswith('.'+side):continue
  parts=p.name.split('.')
  if p.name.startswith('f_') and len(parts)>2:
   amount={'01':45,'02':65,'03':40}.get(parts[1],0)
   p.rotation_quaternion=Quaternion((1,0,0),rad(amount))
  elif p.name.startswith('thumb.'):
   amount={'01':70,'02':80,'03':55}.get(parts[1],0)
   p.rotation_quaternion=Quaternion((1,0,0),rad(amount))

def palm_frame(side):
 # Use the wrist and actual metacarpal roots, rather than assuming that
 # local wrist Z means palm normal on both manually positioned hands.
 wrist=rig.matrix_world@rig.data.bones['hand.'+side].head_local
 index=rig.matrix_world@rig.data.bones['f_index.01.'+side].head_local
 outer=rig.matrix_world@rig.data.bones[('f_pinky.01.' if side=='L' else 'f_ring.01.')+side].head_local
 forward=((index+outer)*.5-wrist).normalized()
 normal=forward.cross(outer-index).normalized()*(-1 if side=='L' else 1)
 return Matrix((forward.cross(normal).normalized(),forward,normal)).transposed()

palm_frames={side:palm_frame(side) for side in ['L','R']}

def inward_wrist(side,target):
 forward=Vector(target).normalized()
 inward=Vector((-1 if side=='L' else 1,0,0))
 normal=(inward-forward*inward.dot(forward)).normalized()
 frame=Matrix((forward.cross(normal).normalized(),forward,normal)).transposed()
 rest=(rig.matrix_world@rig.data.bones['hand.'+side].matrix_local).to_quaternion().to_matrix()
 world_rotation('hand.'+side,(frame@palm_frames[side].transposed()@rest).to_quaternion())

def planted_foot(side,heel_lift):
 # The rest foot bone points diagonally downward. Preserve that full rest
 # orientation, then plantarflex the actual sole: heel UP, forefoot DOWN.
 foot='foot.'+side;rest=(rig.matrix_world@rig.data.bones[foot].matrix_local).to_quaternion()
 world_rotation(foot,Quaternion((1,0,0),rad(heel_lift))@rest)
 # Both real toes have separate deform bones. Counter-rotate their tips
 # to keep the forefoot flatter while rolling over the ball of the foot.
 for name in ['toe.'+side,'foot.'+side+'.001']:
  if name in rig.data.bones:world_rotation(name,(rig.matrix_world@rig.data.bones[name].matrix_local).to_quaternion())
def idle(t):
 reset();relax();p=math.tau*t;rot('spine.002',.6*math.sin(p));rot('spine.006',.8*math.sin(p),0,.8*math.sin(p))
 for side,s in [('L',1),('R',-1)]:arm(side,.8*math.sin(p));rot('hand.'+side,1.5*math.sin(p),0,s*2)
 ground()
def turn_gait(t,running=False,back=False,turn=0):
 reset();p=math.tau*t*(-1 if back else 1);hip_amp=30 if running else (12 if turn else 19);knee_amp=48 if running else (16 if turn else 30);swing_amp=38 if running else (9 if turn else 25)
 rot('spine',3 if running else 0,2.2*math.sin(p),2.5*math.sin(p));rot('spine.003',3 if running else 1,0,-2*math.sin(p));rot('spine.006',-2 if running else -1,0,-.7*math.sin(p)+turn*4*math.sin(p))
 for side,s,offset in [('L',1,0),('R',-1,math.pi)]:
  q=p+offset;hip=hip_amp*math.cos(q);knee=knee_amp*max(0,math.sin(q));rot('thigh.'+side,hip);rot('shin.'+side,knee);rot('foot.'+side,-hip-.75*knee);rot('toe.'+side,6*max(0,-math.sin(q)))
  arm(side,-swing_amp*math.cos(q),50 if running else 52);rot('forearm.'+side,-12 if running else -5,0,-s*(18 if running else 7));rot('hand.'+side,4*math.sin(q),0,s*2)
 ground(.025*math.sin(p)**2 if running else 0)

def gait(t,running=False,back=False,turn=0):
 if turn:return turn_gait(t,turn=turn)
 reset();p=math.tau*t*(-1 if back else 1)
 rot('spine',4 if running else 1,1.2*math.sin(p),1.2*math.sin(p))
 rot('spine.003',2 if running else .5,0,-1.5*math.sin(p))
 rot('spine.006',-3 if running else -1,0,-.5*math.sin(p))
 bpy.context.view_layer.update()
 for side,s,offset in [('L',1,0),('R',-1,math.pi)]:
  q=p+offset;phase=(q/math.tau)%1
  hip=(26 if running else (14 if back else 19))*math.cos(q)
  swing=max(0,math.sin(math.pi*(phase-.5)*2)) if phase>=.5 else 0
  knee=(20 if running else 10)+(45 if running else 34)*swing*swing
  if phase<.5:knee+=(10 if running else 5)*math.sin(phase*math.tau)**2
  direction('thigh.'+side,limb_direction(side,hip,24))
  # The shin rotates BACK at the knee; the toes continue to face forward.
  direction('shin.'+side,limb_direction(side,hip-knee,7))
  heel_lift=(7 if running else 5)+(13 if running else 10)*math.sin(math.pi*phase)**2
  planted_foot(side,heel_lift)
  # Opposite arm and leg advance together. Flexion stays present throughout
  # the cycle, keeping the hands in FRONT even during the backswing.
  shoulder=(12 if running else 7)-(26 if running else 17)*math.cos(q)
  elbow=(88 if running else 72)+8*math.cos(q-.3)
  # This character's torso is wider than a human runner's. Give the elbow
  # room outside the ribcage, then angle the forearm inward toward the front.
  # A small delayed variation avoids a rigid, permanently tucked silhouette.
  upper_splay=(37 if running else 34)+1.5*math.sin(q-.4)
  forearm_splay=(-18 if running else -16)+.8*math.sin(q-.2)
  direction('upper_arm.'+side,limb_direction(side,shoulder,upper_splay))
  direction('forearm.'+side,limb_direction(side,shoulder+elbow,forearm_splay))
  inward_wrist(side,limb_direction(side,shoulder+elbow-3+1.5*math.sin(q-.2),forearm_splay+.6*math.sin(q-.6)))
  fist(side)
 ground(.006*math.sin(p)**2 if running else 0)
def prepare_laugh_body(t):
 reset();relax();u=pulse(t,.14,.90)
 for p in rig.pose.bones:
  if p.name in laugh_base_quats:p.rotation_quaternion=p.rotation_quaternion.slerp(laugh_base_quats[p.name],u)
 if .24<t<.76:
  b=math.sin((t-.24)/.52*math.tau*2)*math.sin((t-.24)/.52*math.pi);rot('spine.003',.45*b)
 for side in ['L','R']:fingers(side,3*u)
 ground()
def crouch_pose(u):
 relax();rot('spine.001',8*u);rot('spine.006',-5*u)
 for side in ['L','R']:rot('thigh.'+side,-23*u);rot('shin.'+side,46*u);rot('foot.'+side,-23*u);arm(side,-12*u)
def crouch(t):reset();crouch_pose(ease(t/.45));ground(whole=True)
def jump(t):
 reset();relax()
 if t<.22:u=ease(t/.22);crouch_pose(.75*u);height=0
 elif t<.78:
  q=(t-.22)/.56;height=.20*math.sin(math.pi*q);u=.25+.2*math.sin(math.pi*q);crouch_pose(u)
  for side in ['L','R']:arm(side,-20*math.sin(math.pi*q),38)
 else:u=.6*math.sin(math.pi*(t-.78)/.22);crouch_pose(u);height=0
 if .22<t<.78:match_jump_hands()
 ground(height,whole=True)
def match_jump_hands():
 # Mirror the actual right wrist, keeping its authored height unchanged.
 bpy.context.view_layer.update()
 target=mesh_world.inverted()@(rig.matrix_world@rig.pose.bones['hand.R'].head)
 target.x=-target.x
 attack_helpers['reach']('upper_arm.L','forearm.L',mesh_world@target,mesh_world.to_3x3()@Vector((.8,.05,-1)))
 forward=(rig.matrix_world.to_3x3()@(rig.pose.bones['forearm.L'].tail-rig.pose.bones['forearm.L'].head)).normalized()
 inward_wrist('L',forward)
def moving_jump(t,running=False):
 reset();relax();u=pulse(t,.14,.84)
 flight=max(0,math.sin(math.pi*max(0,min(1,(t-.14)/.64)))) if .14<t<.78 else 0
 height=(.23 if running else .20)*flight
 rot('spine.001',(10 if running else 6)*u);rot('spine.006',-4*u)
 for side,s in [('L',1),('R',-1)]:
  thigh=(-26 if side=='L' else 10)*flight-10*u
  knee=(46 if side=='L' else 56)*flight+12*u
  rot('thigh.'+side,thigh);rot('shin.'+side,knee);rot('foot.'+side,-thigh-knee+8*flight)
  swing=32*flight
  direction('upper_arm.'+side,limb_direction(side,swing,22))
  direction('forearm.'+side,limb_direction(side,swing+75,14))
  inward_wrist(side,limb_direction(side,swing+72,14));fist(side)
 # Blend from and back to the relaxed pose at ground contact.
 if u<1:
  target={p.name:p.rotation_quaternion.copy() for p in rig.pose.bones}
  reset();relax()
  for p in rig.pose.bones:p.rotation_quaternion=p.rotation_quaternion.slerp(target[p.name],u)
 if flight>0:match_jump_hands()
 ground(height,whole=True)

def hit(t):
 reset();relax();u=math.sin(math.pi*t)**2;rot('spine.001',-10*u);rot('spine.006',-12*u)
 for side in ['L','R']:arm(side,-18*u,52-8*u);rot('shin.'+side,8*u)
 ground(whole=True)
def sit(t):
 reset();relax();u=ease(t/.65);rot('spine.001',7*u);rot('spine.006',-4*u)
 for side in ['L','R']:rot('thigh.'+side,-78*u);rot('shin.'+side,25*u);rot('foot.'+side,53*u);arm(side,-27*u)
 ground(whole=True)
def block(t):
 reset();relax();u=ease(t/.45)
 start={p.name:p.rotation_quaternion.copy() for p in rig.pose.bones}
 # Protract the shoulder at its natural height to leave two fists of air in front.
 direction('shoulder.R',mesh_world.to_3x3()@Vector((-.11,-.10,-.03)))
 upper=(mesh_world.to_3x3()@Vector((.12,-.93,.35))).normalized()
 hint=(mesh_world.to_3x3()@Vector((1,0,0))).normalized()
 forearm=(hint-upper*hint.dot(upper)).normalized()
 # Match the upper/lower arm roll through a shared elbow bend plane.
 target_normal=upper.cross(forearm).normalized()
 rest_upper=(rig.matrix_world.to_3x3()@(rig.data.bones['upper_arm.R'].tail_local-rig.data.bones['upper_arm.R'].head_local)).normalized()
 rest_lower=(rig.matrix_world.to_3x3()@(rig.data.bones['forearm.R'].tail_local-rig.data.bones['forearm.R'].head_local)).normalized()
 rest_normal=rest_upper.cross(rest_lower).normalized()
 for name,axis,rest_axis in [('upper_arm.R',upper,rest_upper),('forearm.R',forearm,rest_lower)]:
  rest_frame=Matrix((rest_axis.cross(rest_normal).normalized(),rest_axis,rest_normal)).transposed()
  frame=Matrix((axis.cross(target_normal).normalized(),axis,target_normal)).transposed()
  rest=(rig.matrix_world@rig.data.bones[name].matrix_local).to_quaternion().to_matrix()
  world_rotation(name,(frame@rest_frame.transposed()@rest).to_quaternion())
 inward=(mesh_world.to_3x3()@Vector((0,1,0))).normalized()
 normal=(inward-forearm*inward.dot(forearm)).normalized()
 frame=Matrix((forearm.cross(normal).normalized(),forearm,normal)).transposed()
 rest=(rig.matrix_world@rig.data.bones['hand.R'].matrix_local).to_quaternion().to_matrix()
 world_rotation('hand.R',(frame@palm_frames['R'].transposed()@rest).to_quaternion());fist('R')
 for p in rig.pose.bones:p.rotation_quaternion=start[p.name].slerp(p.rotation_quaternion,u)
 ground()

def blink(t):reset();relax();ground()
def clasp_belly(side,u,beat):
 # Analytic two-bone reach, baked onto the existing FK bones for glTF.
 s=1 if side=='L' else -1;upper='upper_arm.'+side;lower='forearm.'+side;hand='hand.'+side
 bpy.context.view_layer.update();wrist=rig.matrix_world@rig.pose.bones[hand].head
 hand_rotation=(rig.matrix_world@rig.pose.bones[hand].matrix).to_quaternion()
 b=rig.data.bones['spine.003']
 deform=rig.matrix_world@rig.pose.bones[b.name].matrix@b.matrix_local.inverted()@rig.matrix_world.inverted()
 target=deform@mesh_world@Vector((s*.150,.125,.575+.002*beat))
 target=wrist.lerp(target,u)
 a=rig.matrix_world@rig.pose.bones[upper].head
 l1=(rig.matrix_world.to_3x3()@(rig.data.bones[upper].tail_local-rig.data.bones[upper].head_local)).length
 l2=(rig.matrix_world.to_3x3()@(rig.data.bones[lower].tail_local-rig.data.bones[lower].head_local)).length
 delta=target-a;d=min(delta.length,l1+l2-.0001);axis=delta.normalized()
 pole=mesh_world.to_3x3()@Vector((s,0,-.35));pole=(pole-axis*pole.dot(axis)).normalized()
 along=(l1*l1-l2*l2+d*d)/(2*d);elbow=a+axis*along+pole*math.sqrt(max(0,l1*l1-along*along))
 direction(upper,elbow-a)
 direction(lower,target-(rig.matrix_world@rig.pose.bones[lower].head))
 # Palms face the abdomen; fingers point down on their own side.
 forward=(rig.matrix_world.to_3x3()@(rig.pose.bones[lower].tail-rig.pose.bones[lower].head)).normalized()
 inward=(deform.to_3x3()@mesh_world.to_3x3()@Vector((0,1,0))).normalized()
 normal=(inward-forward*inward.dot(forward)).normalized()
 frame=Matrix((forward.cross(normal).normalized(),forward,normal)).transposed()
 rest=(rig.matrix_world@rig.data.bones[hand].matrix_local).to_quaternion().to_matrix()
 desired=(frame@palm_frames[side].transposed()@rest).to_quaternion()
 world_rotation(hand,hand_rotation.slerp(desired,u))
 for p in rig.pose.bones:
  if p.name.endswith('.'+side) and p.name.startswith(('f_','thumb.')):
   segment=p.name.split('.')[1]
   angle=({'01':0,'02':2,'03':2} if p.name.startswith('f_') else {'01':12,'02':8,'03':5}).get(segment,0)
   p.rotation_quaternion=p.rotation_quaternion.slerp(Quaternion((1,0,0),rad(angle)),u)
 if rig.get('four_segment_fingers'):hand_pose(rig,side,0)
def laugh(t):
 prepare_laugh_body(t);u=pulse(t,.12,.90);beat=math.sin(t*math.tau*8-.3)
 lean=ease((t-.04)/.12)*ease((1-t)/.10)
 back=ease((t-.43)/.14)
 # Keep the hands in the fitted belly-contact pose while the torso folds
 # forward first, then throws the head back while keeping both palms fitted.
 rot('spine',3*lean+1.2*u*beat,0,1.8*u*math.sin(t*math.tau*2))
 rot('spine.001',(16-23*back)*lean+4*u*beat)
 rot('spine.003',(3-5*back)*lean+1.6*u*beat,0,1.5*u*math.sin(t*math.tau*2-.4))
 rot('spine.006',(8-34*back)*lean+5*u*math.sin(t*math.tau*8-.55),0,-2*u*math.sin(t*math.tau*2))
 for side,s in [('L',1),('R',-1)]:
  bend=(10+3*beat)*u
  rot('thigh.'+side,-bend);rot('shin.'+side,2*bend);rot('foot.'+side,-bend)
  clasp_belly(side,pulse(t,.14,.90),beat)
 fit_belly_hands(pulse(t,.14,.90),t)
 ground(.0015*u*beat*beat)
 jaw_pose(rig,mesh,expression_values(t,'Laugh')[1])
specs=[('Idle',97,idle,True),('Walk',31,lambda t:gait(t),True),('WalkBack',37,lambda t:gait(t,back=True),True),('TurnLeft',25,lambda t:gait(t,turn=1),True),('TurnRight',25,lambda t:gait(t,turn=-1),True),('Jump',37,jump,False),('Hit',19,hit,False),('Sit',61,sit,False),('Crouch',49,crouch,False),('Block',17,block,False)]
from frog_run import build_run
specs += [build_run(rig,mesh,globals())]
from frog_pivot import build_pivots
specs += build_pivots(rig,mesh,globals())
specs += [('JumpWalk',31,lambda t:moving_jump(t),False),('JumpRun',25,lambda t:moving_jump(t,True),False)]
specs += [('Blink',13,blink,False),('Laugh',LAUGH_FRAMES,laugh,False)]
from frog_attacks import build_attacks
specs += build_attacks(rig,mesh,globals())
from frog_laugh_grip import build_laugh_grip
fit_belly_hands=build_laugh_grip(rig,mesh,globals())
from frog_directional_dodge import build_dodges
specs += build_dodges(rig,mesh,globals())
from frog_special_attacks import build_special_attacks
specs += build_special_attacks(rig,mesh,globals())
specs=[item for item in specs if item[0] in names]
rig.animation_data_create();actions={a.name:a for a in bpy.data.actions};checks={}
if (locomotion_only or any(flag in sys.argv for flag in ['--update-hands-and-face','--expressions-only','--jumps-only','--performance-pass','--push-contact-only','--laugh-only','--block-only','--attacks-only','--combat-only','--dodges-only','--run-only','--pivots-only','--special-attacks-only','--air-attack-only'])) and (out/'animation-info.json').exists():checks=json.loads((out/'animation-info.json').read_text())['clips']
for name in removed_actions:checks.pop(name,None)
for name,end,pose,loop in specs:
 action=bpy.data.actions.new(name);action.use_fake_user=True;rig.animation_data.action=action
 previous_quaternions={}
 shape_slots={}
 if name in ['Blink','Laugh']:
  for obj in face_meshes:
   sk=obj.data.shape_keys;sk.animation_data_create();sk.animation_data.action=action
   slot=action.slots.new('KEY',sk.name);sk.animation_data.action_slot=slot;shape_slots[obj.name]=slot
 if name=='Laugh':
  # Fit contact depths first, then smooth that scalar trajectory before baking.
  for contact_frame in range(1,end+1):
   scene.frame_set(contact_frame);pose((contact_frame-1)/(end-1))
  fit_belly_hands.freeze()
 for frame in range(1,end+1):
  scene.frame_set(frame);pose((frame-1)/(end-1))
  for p in ([] if name=='Blink' else rig.pose.bones):
   if name in ['Run','RunAttack','AirAttack','Laugh'] or name.startswith('Pivot'):
    previous=previous_quaternions.get(p.name)
    if previous is not None and previous.dot(p.rotation_quaternion)<0:p.rotation_quaternion.negate()
    previous_quaternions[p.name]=p.rotation_quaternion.copy()
   p.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=p.name)
   if p.name in ['spine','jaw']:p.keyframe_insert(data_path='location',frame=frame,group=p.name)
  if name in ['Blink','Laugh']:
   t=(frame-1)/(end-1)
   closing,opening=expression_values(t,name)
   apply_expression(face_meshes,closing,opening)
   for obj in face_meshes:
    for key in obj.data.shape_keys.key_blocks:
     if key.name=='Basis':continue
     key.keyframe_insert('value',frame=frame)
  a=coordinates();assert np.isfinite(a).all()
  if frame==1:first=a.copy()
  if frame==end:last=a.copy()
 actions[name]=action;error=float(np.max(np.linalg.norm(first-last,axis=1)));checks[name]={'frames':end,'duration_seconds':(end-1)/24,'loop':loop,'endpoint_error':error}
 if name in ['Run','RunAttack','AirAttack','Laugh'] or name.startswith('Pivot'):
  for layer in action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for curve in bag.fcurves:
      for point in curve.keyframe_points:point.interpolation='LINEAR'
 if name in ['Blink','Laugh']:
  for layer in action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for curve in bag.fcurves:
      if curve.data_path.startswith('key_blocks') or curve.data_path=='pose.bones["jaw"].location':
       for point in curve.keyframe_points:point.interpolation='LINEAR'
 if loop:assert error<1e-5,(name,error)
 print('CLIP_READY',name,checks[name],flush=True)
 for obj in face_meshes:
  if obj.data.shape_keys.animation_data:obj.data.shape_keys.animation_data.action=None
  for key in obj.data.shape_keys.key_blocks:key.value=0
if 'Blink' in names or 'Laugh' in names:finalize_expression_clearance(mesh,rig,face_meshes,actions)
assert geometry==[tuple(v.co) for v in mesh.data.vertices];assert rig_snapshot==[(b.name,tuple(b.head_local),tuple(b.tail_local),b.parent.name if b.parent else None) for b in rig.data.bones]
rig.animation_data.action=actions['Idle'];scene.frame_start=1;scene.frame_end=97;scene.frame_set(1)
if 'Laugh' in actions:
 for obj in face_meshes:
  sk=obj.data.shape_keys;sk.animation_data_create();sk.animation_data.action=None
  for key in sk.key_blocks:key.value=0
  for track in list(sk.animation_data.nla_tracks):
   if track.name in ['Face_Blink','Face_Laugh']:sk.animation_data.nla_tracks.remove(track)
  for name in ['Blink','Laugh']:
   track=sk.animation_data.nla_tracks.new();track.name='Face_'+name;track.mute=True
   strip=track.strips.new(name,1,actions[name])
   strip.action_slot=next(s for s in actions[name].slots if s.target_id_type=='KEY' and s.name_display==sk.name)
 scene.frame_set(1)
assert hashlib.sha256(source.read_bytes()).hexdigest()==source_hash,'frog.blend changed concurrently'
bpy.context.preferences.filepaths.save_version=0;bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.wm.save_as_mainfile(filepath=str(source));mesh.select_set(True)
for obj in face_meshes:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'output/frog.glb'),export_format='GLB',export_vertex_color='NONE',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_merge_animation='ACTION',export_frame_range=False,export_force_sampling=True,export_anim_single_armature=True,export_anim_slide_to_zero=True,export_morph=True,export_morph_animation=True)
(out/'animation-info.json').write_text(json.dumps({'clips':checks,'rig_rest_bones_unchanged':not (out/'hand-rig-repair.json').exists(),'rig_unchanged_during_animation_generation':True,'mesh_geometry_unchanged_during_animation_generation':True,'mouth_topology_rebuilt':bool(mesh.get('mouth_topology_version')),'mouth_model_info':'mouth-model-info.json' if mesh.get('mouth_topology_version') else None,'expression_surface_meshes':len(face_meshes)-1,'expression_method':'glTF morph targets plus FK jaw/body animation; welded mouth opening, deep oral cavity and volumetric tongue' if mesh.get('mouth_topology_version') else 'glTF morph targets plus FK body animation','hand_rig_repair':'hand-rig-repair.json' if (out/'hand-rig-repair.json').exists() else None},indent=2))
if '--no-preview' in sys.argv:sys.exit(0)
# Review representative poses with the studio excluded from the saved asset.
scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True;scene.render.resolution_x=510;scene.render.resolution_y=570;scene.render.resolution_percentage=100;scene.render.film_transparent=False;scene.world=bpy.data.worlds.new('Animation studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.11,.13,.16,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
center=mesh_world@Vector(model_offset+np.array((0,0,.53)))
for pos in [(-1,-1.5,2),(1,-.7,1),(.2,1.5,1.7)]:
 bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=85;l.data.size=1.5;l.rotation_euler=(center-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=center+Vector((.5,-3,.3)));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=1.50;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
for name,end,pose,loop in specs:
 rig.animation_data.action=actions[name] if name!='Blink' else actions['Idle']
 for obj in face_meshes:
  sk=obj.data.shape_keys;slot=next((s for s in actions[name].slots if s.target_id_type=='KEY' and s.name_display==sk.name),None)
  sk.animation_data.action=actions[name] if slot else None
  if slot:sk.animation_data.action_slot=slot
  for key in sk.key_blocks:key.value=0
 scene.frame_set(1+int((end-1)*(.72 if name in ['Death','Sit','Crouch'] else .3 if name=='Blink' else .45)));scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
scene.cycles.samples=10
for obj in face_meshes:
 obj.data.shape_keys.animation_data.action=None
 for key in obj.data.shape_keys.key_blocks:key.value=0
for name,end,step in [('Walk',31,1),('Run',19,1),('Wave',73,3)]:
 if name not in names:continue
 cam.location=center+Vector((1.6,-2.4,.27) if name in ['Walk','Run'] else (.5,-3,.3));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();rig.animation_data.action=actions[name];frames=out/('_'+name+'_frames');frames.mkdir(exist_ok=True)
 for frame in range(1,end,step):scene.frame_set(frame);scene.render.filepath=str(frames/(str(frame).zfill(3)+'.png'));bpy.ops.render.render(write_still=True)
print('ANIMATION_LIBRARY_READY',len(specs),flush=True)
