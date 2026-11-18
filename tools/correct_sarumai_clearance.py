import bpy,math,json,shutil
from pathlib import Path
from mathutils import Vector as V,Matrix,Quaternion,Euler
from mathutils.bvhtree import BVHTree
ROOT=Path.cwd();src=ROOT/'assets-source/blender/sarumai.blend';backup=ROOT/'assets-source/blender/reference/sarumai-before-clearance-fix.blend'
if not backup.exists():shutil.copy2(src,backup)
bpy.ops.wm.open_mainfile(filepath=str(src));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');body=bpy.data.objects['samurai_body'];weapon=bpy.data.objects['samurai_blade'];rest=rig.data.bones['blade'];edge_rest=V(rest['cutting_edge_rest']);names=list(rig.pose.bones.keys());groups={g.index:g.name for g in body.vertex_groups};deps=bpy.context.evaluated_depsgraph_get()
core=[]
for f in body.data.polygons:
 p=sum((body.data.vertices[i].co for i in f.vertices),V())/len(f.vertices)
 if abs(p.x)<.46 and p.z>.05:
  w=sum(sum(g.weight for g in body.data.vertices[i].groups if groups[g.group]in ['root','pelvis','spine','chest','neck','head']or groups[g.group].startswith('leg_'))for i in f.vertices)/len(f.vertices)
  if w>.55:core.append(tuple(f.vertices))
hand_faces=[]
for f in body.data.polygons:
 w=sum(sum(g.weight for g in body.data.vertices[i].groups if groups[g.group].startswith('finger_')or groups[g.group].startswith('hand_'))for i in f.vertices)/len(f.vertices)
 if w>.65:hand_faces.append(tuple(f.vertices))
weapon_points=[rest.matrix_local.inverted()@v.co for v in weapon.data.vertices];weapon_faces=[tuple(f.vertices)for f in weapon.data.polygons]
R=[n for n in names if n in ['upper_arm_R','elbow_R','forearm_R','hand_R','blade']or n.startswith('finger_R')];L=[n for n in names if n in ['upper_arm_L','elbow_L','forearm_L','hand_L']or n.startswith('finger_L')]
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def around(p,q):return Matrix.Translation(p)@q.to_matrix().to_4x4()@Matrix.Translation(-p)
def inside(tree,p):
 nearest=tree.find_nearest(p)
 if not nearest or nearest[3]<.008:return False
 votes=0
 for d in [V((1,.013,.007)),V((.017,1,.009)),V((.011,.003,1))]:
  pos=p.copy();count=0
  for _ in range(12):
   hit=tree.ray_cast(pos,d,5)[0]
   if hit is None:break
   pos=hit+d*.0005;count+=1
  votes+=count%2
 return votes>=2
def bad_blade(tree,m):
 # Full blade geometry is checked only after the cheap centre-line probes.
 axis=(m.to_3x3()@V((0,1,0))).normalized();start=m@V((0,-.30,0));direction=axis
 for offset in [V(),m.to_3x3()@V((.025,0,0)),m.to_3x3()@V((0,0,.025))]:
  p=start+offset
  if tree.ray_cast(p,direction,2.05)[0]is not None:return True
 points=[m@p for p in weapon_points];return bool(tree.overlap(BVHTree.FromPolygons(points,weapon_faces)))
def support(mats,reference):
 upper='upper_arm_L';fore='forearm_L';hand='hand_L';b=rig.data.bones;one=b[upper].length;two=b[fore].length
 blade=mats['blade'];axis=(blade.to_3x3()@V((0,1,0))).normalized();goal=blade.translation-axis*.10;target=goal.copy();origin=reference[upper].translation.copy()
 needed=(target-origin).length-(one+two-.06);shift=(target-origin).normalized()*max(0,min(.23,needed));origin+=shift;mats['clavicle_L'].translation+=shift
 for _ in range(3):
  vec=target-origin;distance=min(vec.length,one+two-.002);direction=vec.normalized();pole=V((.8,-.7,1.5));perp=pole-origin-direction*(pole-origin).dot(direction)
  if perp.length<.001:perp=V((1,0,0))
  perp.normalize();along=(one*one+distance*distance-two*two)/(2*distance);elbow=origin+direction*along+perp*math.sqrt(max(0,one*one-along*along));wrist=origin+direction*distance
  for n,a,z,ref_end in [(upper,origin,elbow,reference[fore].translation),(fore,elbow,wrist,reference[hand].translation)]:
   q=(ref_end-reference[n].translation).rotation_difference(z-a);mats[n]=Matrix.Translation(a)@q.to_matrix().to_4x4()@reference[n].to_3x3().to_4x4()
  q=mats[fore].to_quaternion()@reference[fore].to_quaternion().inverted();delta=Matrix.Translation(wrist)@q.to_matrix().to_4x4()@Matrix.Translation(-reference[hand].translation)
  for n in L:
   if n not in [upper,fore,'elbow_L']:mats[n]=delta@reference[n]
  mats['elbow_L']=mats[fore].copy();target+=goal-(mats[hand]@V((0,.05,0)))
def put(mats):
 for n in names:rig.pose.bones[n].matrix=mats[n];bpy.context.view_layer.update()
guide_path=ROOT/'output/sarumai-clearance-corrections.json';guides=json.loads(guide_path.read_text())if guide_path.exists()else {}
report={};two={'Overhead','BuriedOverhead','RisingLeft','RisingRight','Extract'};order=['CrossLeft','CrossRight','Overhead','BuriedOverhead','Extract','Rising','RisingLeft','RisingRight','ShortThrust','LongThrust','RoundSweep','Death']
for name in order:
 action=bpy.data.actions[name];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0];samples=[]
 for k in range(121):
  frame=k/2;bpy.context.scene.frame_set(int(frame),subframe=frame%1);samples.append({n:rig.pose.bones[n].matrix.copy()for n in names})
 previous=(0,0,0);changes=[];failed=[];previous_quaternions={}
 for k,base in enumerate(samples):
  frame=k/2;bpy.context.scene.frame_set(int(frame),subframe=frame%1);e=body.evaluated_get(deps);mesh=e.to_mesh();tree=BVHTree.FromPolygons([e.matrix_world@v.co for v in mesh.vertices],core,epsilon=.0001);e.to_mesh_clear();t=frame/60;weight=smooth(t/.18)*(1-smooth((t-.84)/.16))
  if name=='BuriedOverhead':weight=smooth(t/.18)
  if name=='Extract':weight=1-smooth((t-.8)/.2)
  if name=='Death':weight=0
  raise_by=.10*weight;origin=base['upper_arm_R'].translation
  # Search a shoulder-driven swing arc, not a wrist flip. Favor neighboring frames.
  raw=guides.get(name,{}).get('changes',[(0,0,0)]*61);weights=[(max(0,min(60,frame+k)),math.exp(-k*k/18))for k in range(-6,7)];guide=tuple(sum(raw[round(i*(len(raw)-1)/60)][j]*w for i,w in weights)/sum(w for i,w in weights)for j in range(3))
  parameters={(0,0,0),previous,guide}
  for dx in [-10,-5,0,5,10]:
   for dz in [-10,-5,0,5,10]:
    for df in [-.025,0,.025]:parameters.add((max(-85,min(85,previous[0]+dx)),max(-85,min(85,previous[1]+dz)),max(0,min(.35,previous[2]+df))))
  for pitch in [-75,-50,-25,0,25,50,75]:
   for yaw in [-75,-50,-25,0,25,50,75]:
    for forward in [0,.10,.20,.30,.40]:parameters.add((pitch,yaw,forward))
  if name=='CrossLeft':parameters={p for p in parameters if p[1]>=0}
  if name=='Rising':parameters={p for p in parameters if p[0]<=0 and p[1]<=0}
  if name=='BuriedOverhead':parameters={p for p in parameters if p[1]<=0}
  if frame in [0,60]and name not in ['BuriedOverhead','Extract']:parameters={(0,0,0)}
  def cost(p):
   jump=max(abs(p[0]-previous[0]),abs(p[1]-previous[1]))
   return .0005*(p[0]*p[0]+p[1]*p[1])+12*p[2]*p[2]+.001*((p[0]-previous[0])**2+(p[1]-previous[1])**2)+8*(p[2]-previous[2])**2+.003*((p[0]-guide[0])**2+(p[1]-guide[1])**2)+12*(p[2]-guide[2])**2+(100 if jump>10.01 else 0)
  winner=None
  for p in sorted(parameters,key=cost):
   q=Euler((math.radians(p[0]),0,math.radians(p[1]))).to_quaternion();move=Matrix.Translation(V((0,-p[2],raise_by)))@around(origin,q);blade=move@base['blade'];hand=move@base['hand_R']
   if hand.translation.z<base['hand_R'].translation.z+.04*weight:continue
   if inside(tree,hand@V((0,.045,0)))or bad_blade(tree,blade):continue
   mats={n:m.copy()for n,m in base.items()}
   for n in R:mats[n]=move@base[n]
   mats['clavicle_R'].translation+=V((0,-p[2],raise_by))
   if name in two:support(mats,base)
   if inside(tree,mats['hand_L']@V((0,.045,0))):continue
   # Recheck the actually deformed shirt/armor after shoulder compensation.
   put(mats);deformed=body.evaluated_get(deps);surface=deformed.to_mesh();actual_points=[deformed.matrix_world@v.co for v in surface.vertices];actual=BVHTree.FromPolygons(actual_points,core,epsilon=.0001);hand_overlap=actual.overlap(BVHTree.FromPolygons(actual_points,hand_faces));deformed.to_mesh_clear()
   if hand_overlap or bad_blade(actual,mats['blade'])or any(inside(actual,mats['hand_'+side]@V((0,.045,0)))for side in 'LR'):continue
   winner=(p,mats);break
  if winner is None:failed.append(frame);winner=(previous,{n:m.copy()for n,m in base.items()})
  previous,mats=winner;put(mats)
  for bone in rig.pose.bones:
   q=bone.rotation_quaternion;last=previous_quaternions.get(bone.name)
   if last is not None and q.dot(last)<0:q.negate()
   previous_quaternions[bone.name]=q.copy()
   for prop in ['location','rotation_quaternion','scale']:bone.keyframe_insert(data_path=prop,frame=frame,group=bone.name)
  changes.append(previous)
 report[name]={'failed':failed,'changes':changes};print('CLEARANCE',name,'failed',failed,flush=True)
 for layer in action.layers:
  for strip in layer.strips:
   bag=strip.channelbag(action.slots[0])
   if bag:
    for curve in bag.fcurves:
     for k in curve.keyframe_points:k.interpolation='LINEAR'
(ROOT/'output/sarumai-clearance-corrections.json').write_text(json.dumps(report,indent=2));rig.animation_data.action=bpy.data.actions['Idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];bpy.context.scene.frame_set(0);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));shutil.copy2(src,ROOT/'assets-source/blender/rigged/sarumai.blend')
