import bpy,math,shutil,json,numpy as np
from pathlib import Path
from mathutils import Vector as V,Quaternion,Matrix
ROOT=Path.cwd();src=ROOT/'assets-source/blender/sarumai.blend';backup=ROOT/'assets-source/blender/reference/sarumai-before-elbow-jitter-fix.blend'
if not backup.exists():shutil.copy2(src,backup)
bpy.ops.wm.open_mainfile(filepath=str(backup));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');names=list(rig.pose.bones.keys());flat={'CrossLeft','CrossRight','RoundSweep'};idle=bpy.data.actions['Idle'];rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0];bpy.context.scene.frame_set(0);idle_root=rig.pose.bones['root'].rotation_quaternion.copy();axis_root=rig.data.bones['root'].matrix_local.to_quaternion().inverted()@V((0,0,1));R=[n for n in names if n in ['upper_arm_R','elbow_R','forearm_R','hand_R','blade']or n.startswith('finger_R')];L=[n for n in names if n in ['upper_arm_L','elbow_L','forearm_L','hand_L']or n.startswith('finger_L')]
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def mean_q(qs,weights):
 a=np.zeros((4,4))
 for q,w in zip(qs,weights):v=np.array(tuple(q));a+=np.outer(v,v)*w
 val,vec=np.linalg.eigh(a);return Quaternion(tuple(vec[:,-1])).normalized()
def around(p,q):return Matrix.Translation(p)@q.to_matrix().to_4x4()@Matrix.Translation(-p)
report={}
for action in list(bpy.data.actions):
 if action.name in ['Idle','Walk','Hurt','Death']:continue
 rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0];end=float(action.frame_range[1]);frames=[]
 for k in range(121):
  f=k*end/120;bpy.context.scene.frame_set(int(f),subframe=f%1);frames.append({b.name:(b.location.copy(),b.rotation_quaternion.normalized(),b.scale.copy())for b in rig.pose.bones})
 # Reject isolated quaternion spikes before applying a short spherical low pass.
 clean=[{n:(p.copy(),q.copy(),s.copy())for n,(p,q,s)in frame.items()}for frame in frames]
 for k in range(121):
  for n in names:
   window=[frames[max(0,min(120,k+j))][n][1]for j in range(-3,4)];medoid=min(window,key=lambda q:sum(min(q.rotation_difference(x).angle,math.tau-q.rotation_difference(x).angle)for x in window));q=frames[k][n][1]
   if min(q.rotation_difference(medoid).angle,math.tau-q.rotation_difference(medoid).angle)>math.radians(60):clean[k][n]=(frames[k][n][0],medoid.copy(),frames[k][n][2])
 out=[]
 for k in range(121):
  result={};indices=[max(0,min(120,k+j))for j in range(-7,8)];weights=[math.exp(-j*j/(2*2.5**2))for j in range(-7,8)];total=sum(weights)
  for n in names:
   p=sum((clean[i][n][0]*w for i,w in zip(indices,weights)),V())/total;q=mean_q([clean[i][n][1]for i in indices],weights);s=sum((clean[i][n][2]*w for i,w in zip(indices,weights)),V())/total
   blend=smooth(k/7)*smooth((120-k)/7);p=frames[k][n][0].lerp(p,blend);q=frames[k][n][1].slerp(q,blend);s=frames[k][n][2].lerp(s,blend);result[n]=(p,q,s)
  if action.name=='RoundSweep':
   p,q,s=result['root'];angle=math.tau*smooth((k/120-.4)/.45);result['root']=(p,Quaternion(axis_root,angle)@idle_root,s)
  out.append(result)
 # Bound per-frame angular motion in both directions, preserving clip endpoints.
 # This removes residual forearm/weapon half-turns without adding playback lag.
 for n in names:
  limit=math.radians(8 if n=='blade'else 12 if n=='root'else 6)
  qs=[pose[n][1].copy()for pose in out]
  for i in range(1,121):
   if qs[i].dot(qs[i-1])<0:qs[i].negate()
  first=qs[0].copy();last=qs[-1].copy()
  for iteration in range(4):
   qs[0]=first.copy()
   for i in range(1,121):
    angle=min(qs[i-1].rotation_difference(qs[i]).angle,math.tau-qs[i-1].rotation_difference(qs[i]).angle)
    if angle>limit:qs[i]=qs[i-1].slerp(qs[i],limit/angle)
   qs[-1]=last.copy()
   for i in range(119,-1,-1):
    angle=min(qs[i+1].rotation_difference(qs[i]).angle,math.tau-qs[i+1].rotation_difference(qs[i]).angle)
    if angle>limit:qs[i]=qs[i+1].slerp(qs[i],limit/angle)
  for i,q in enumerate(qs):p,old,scale=out[i][n];out[i][n]=(p,q,scale)
 previous={};elbow_max=-100
 for k,pose in enumerate(out):
  for n,(p,q,s)in pose.items():b=rig.pose.bones[n];b.location=p;b.rotation_quaternion=q;b.scale=s
  bpy.context.view_layer.update()
  if action.name in flat:
   for side,chain in [('R',R),('L',L)]:
    shoulder=rig.pose.bones['upper_arm_'+side].head.copy();elbow=rig.pose.bones['forearm_'+side].head.copy();wrist=rig.pose.bones['hand_'+side].head.copy();limit=rig.pose.bones['head'].head.z-.12
    if elbow.z>limit:
     axis=(wrist-shoulder).normalized();v=elbow-shoulder;parallel=axis*axis.dot(v);a=(v-parallel).z;b=axis.cross(v).z;c=shoulder.z+parallel.z;radius=math.hypot(a,b)
     if radius>.0001:
      value=max(-1,min(1,(limit-c)/radius));alpha=math.atan2(b,a);angles=[alpha+math.acos(value),alpha-math.acos(value)];angles=[math.atan2(math.sin(x),math.cos(x))for x in angles];theta=min(angles,key=abs);move=around(shoulder,Quaternion(axis,theta));mats={n:move@rig.pose.bones[n].matrix for n in chain}
      for n in chain:rig.pose.bones[n].matrix=mats[n];bpy.context.view_layer.update()
    elbow_max=max(elbow_max,rig.pose.bones['forearm_'+side].head.z-rig.pose.bones['head'].head.z)
  for bone in rig.pose.bones:
   q=bone.rotation_quaternion;old=previous.get(bone.name)
   if old is not None and q.dot(old)<0:q.negate()
   previous[bone.name]=q.copy()
   for prop in ['location','rotation_quaternion','scale']:bone.keyframe_insert(data_path=prop,frame=k*end/120,group=bone.name)
 for layer in action.layers:
  for strip in layer.strips:
   bag=strip.channelbag(action.slots[0])
   if bag:
    for curve in bag.fcurves:
     for key in curve.keyframe_points:key.interpolation='LINEAR'
 report[action.name]={'elbow_above_head_root':elbow_max if action.name in flat else None};print('SMOOTHED',action.name,report[action.name],flush=True)
rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0];bpy.context.scene.frame_set(0);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));shutil.copy2(src,ROOT/'assets-source/blender/rigged/sarumai.blend');(ROOT/'output/sarumai-jitter-fix.json').write_text(json.dumps(report,indent=2))
