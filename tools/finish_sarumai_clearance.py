import bpy,json,math,shutil
from pathlib import Path
from mathutils import Vector as V
from mathutils.bvhtree import BVHTree
ROOT=Path.cwd();src=ROOT/'assets-source/blender/sarumai.blend';bpy.ops.wm.open_mainfile(filepath=str(src));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');body=bpy.data.objects['samurai_body'];weapon=bpy.data.objects['samurai_blade'];deps=bpy.context.evaluated_depsgraph_get();report=json.loads((ROOT/'output/sarumai-body-collision-audit.json').read_text());names=list(rig.pose.bones.keys());idle_root=rig.pose.bones['root'].matrix.to_quaternion().inverted();groups={g.index:g.name for g in body.vertex_groups};core=[];hands=[]
for f in body.data.polygons:
 p=sum((body.data.vertices[i].co for i in f.vertices),V())/len(f.vertices);w=sum(sum(g.weight for g in body.data.vertices[i].groups if groups[g.group]in ['root','pelvis','spine','chest','neck','head']or groups[g.group].startswith('leg_'))for i in f.vertices)/len(f.vertices)
 if abs(p.x)<.46 and p.z>.05 and w>.55:core.append(tuple(f.vertices))
 w=sum(sum(g.weight for g in body.data.vertices[i].groups if groups[g.group].startswith('hand_')or groups[g.group].startswith('finger_'))for i in f.vertices)/len(f.vertices)
 if w>.65:hands.append(tuple(f.vertices))
R=[n for n in names if n in ['clavicle_R','upper_arm_R','elbow_R','forearm_R','hand_R','blade']or n.startswith('finger_R')];L=[n for n in names if n in ['clavicle_L','upper_arm_L','elbow_L','forearm_L','hand_L']or n.startswith('finger_L')];two={'Overhead','BuriedOverhead','RisingLeft','RisingRight','Extract','DoubleLeft','DoubleRight','CounterThrust','Backstep'}
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def envelope(name,t):return (1 if name=='Extract'else smooth(t/.20))*(1 if name=='BuriedOverhead'else 1-smooth((t-.80)/.20))
def apply(base,v,n,f):
 shift=v*envelope(n,f/60)
 if n=='RoundSweep':shift=(base['root'].to_quaternion()@idle_root)@shift
 for name in names:
  m=base[name].copy()
  if name in R or(n in two and name in L):m.translation+=shift
  rig.pose.bones[name].matrix=m;bpy.context.view_layer.update()
def collision():
 e=body.evaluated_get(deps);m=e.to_mesh();points=[e.matrix_world@v.co for v in m.vertices];tree=BVHTree.FromPolygons(points,core,epsilon=.0001);ht=BVHTree.FromPolygons(points,hands);hand_collision=bool(tree.overlap(ht));e.to_mesh_clear()
 if hand_collision:return True
 e=weapon.evaluated_get(deps);m=e.to_mesh();b=BVHTree.FromPolygons([e.matrix_world@v.co for v in m.vertices],[tuple(f.vertices)for f in m.polygons]);bad=bool(tree.overlap(b));e.to_mesh_clear();return bad
out={}
for name,hits in report.items():
 if not hits:continue
 a=bpy.data.actions[name];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0];poses={};time_factor=float(a.frame_range[1])/60
 for k in range(121):
  f=k/2;sample_frame=f*time_factor;bpy.context.scene.frame_set(int(sample_frame),subframe=sample_frame%1);poses[f]={b.name:b.matrix.copy()for b in rig.pose.bones}
 priority=sorted({max(0,min(60,h['frame']+d))for h in hits for d in [-1,-.5,0,.5,1]}|{0,60});checks=priority+[k/2 for k in range(121)if k/2 not in priority];directions=[V(v).normalized()for v in [(0,0,1),(0,-1,0),(-1,0,0),(1,0,0),(0,1,0),(0,0,-1),(0,-1,1),(-1,-1,0),(1,-1,0),(-1,0,1),(1,0,1),(0,1,1)]];winner=None
 for length in [.02,.04,.06,.08,.10,.12,.16,.20,.24,.28,.32]:
  for d in directions:
   v=d*length;okay=True
   for f in checks:
    apply(poses[f],v,name,f)
    if collision():okay=False;break
   if okay:winner=v;break
  if winner is not None:break
 if winner is None:print('NO_FINISH',name,flush=True);out[name]=None;continue
 previous={}
 for f,base in poses.items():
  apply(base,winner,name,f)
  for b in rig.pose.bones:
   q=b.rotation_quaternion;old=previous.get(b.name)
   if old is not None and q.dot(old)<0:q.negate()
   previous[b.name]=q.copy()
   for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(data_path=prop,frame=f*time_factor,group=b.name)
 out[name]=list(winner);print('FINISHED',name,list(winner),flush=True)
(ROOT/'output/sarumai-clearance-finishing.json').write_text(json.dumps(out,indent=2));rig.animation_data.action=bpy.data.actions['Idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];bpy.context.scene.frame_set(0);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));shutil.copy2(src,ROOT/'assets-source/blender/rigged/sarumai.blend')
