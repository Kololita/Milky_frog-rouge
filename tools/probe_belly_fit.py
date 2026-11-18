import bpy,sys,json
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'tools'))
from frog_hand_pose import hand_pose
from frog_belly_contact import build_belly_fit
from frog_palm_wrap import build_palm_wrap
from frog_attacks import build_attacks
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');mesh=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rw=rig.matrix_world.copy()
for o in bpy.context.scene.objects:
 if o.type=='MESH' and o.data.shape_keys:
  o.data.shape_keys.animation_data.action=None
  for k in o.data.shape_keys.key_blocks:k.value=0
def world_rotation(name,desired):
 b=rig.data.bones[name];p=rig.pose.bones[name]
 base=rw@rig.pose.bones[b.parent.name].matrix@(b.parent.matrix_local.inverted()@b.matrix_local) if b.parent else rw@b.matrix_local
 p.rotation_quaternion=base.to_quaternion().inverted()@desired;bpy.context.view_layer.update()
frames={}
for side in ['L','R']:
 wrist=rw@rig.data.bones['hand.'+side].head_local;index=rw@rig.data.bones['f_index.01.'+side].head_local;outer=rw@rig.data.bones[('f_pinky.01.' if side=='L' else 'f_ring.01.')+side].head_local
 forward=((index+outer)*.5-wrist).normalized();normal=forward.cross(outer-index).normalized()*(-1 if side=='L' else 1)
 frames[side]=Matrix((forward.cross(normal).normalized(),forward,normal)).transposed()
ops={n:lambda *a:None for n in ['reset','relax','rot','location','fist','ease']};ops.update({'world_rotation':world_rotation,'palm_frames':frames,'hand_pose':hand_pose});build_attacks(rig,mesh,ops);fit=(build_palm_wrap if '--wrap' in sys.argv else build_belly_fit)(rig,mesh,ops)
groups={g.index:g.name for g in mesh.vertex_groups}
arm=lambda n:n.startswith(('upper_arm','forearm','hand','f_','thumb','shoulder'))
weights=[sum(g.weight for g in v.groups if arm(groups[g.group])) for v in mesh.data.vertices]
faces=[tuple(p.vertices) for p in mesh.data.polygons if max(weights[i] for i in p.vertices)<.05]
def gaps():
 ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();verts=[ev.matrix_world@v.co for v in m.vertices];ev.to_mesh_clear();tree=BVHTree.FromPolygons(verts,faces);result={}
 for s in ['L','R']:
  ids=[v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups if groups[g.group]=='hand.'+s)>.5 and (mesh.matrix_world.to_3x3()@v.normal).normalized().dot(frames[s].col[2])>.55]
  values=[]
  for i in ids:
   p,n,_,_=tree.find_nearest(verts[i]);values.append((verts[i]-p).dot(n))
  result[s]=[min(values),sum(values)/len(values),max(values)]
 return result
report={}
for frame in [25,31,61,76,91]:
 rig.animation_data.action=bpy.data.actions['Laugh'];bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();before=gaps()
 if '--low-wrap' in sys.argv:
  b=rig.data.bones['spine.003'];deform=rw@rig.pose.bones[b.name].matrix@b.matrix_local.inverted()@rw.inverted()
  for side,s in [('L',1),('R',-1)]:
   desired=(rw@rig.pose.bones['hand.'+side].matrix).to_quaternion();target=rw@rig.pose.bones['hand.'+side].head+deform.to_3x3()@mesh.matrix_world.to_3x3()@Vector((0,0,-.06))
   ops['attack_helpers']['reach']('upper_arm.'+side,'forearm.'+side,target,mesh.matrix_world.to_3x3()@Vector((s,0,-.35)));world_rotation('hand.'+side,desired)
 fit(1);report[frame]={'before':before,'after':gaps()}
 if '--wrap' in sys.argv:
  report[frame]['regions']=fit.last_report
  for p in rig.pose.bones:p.keyframe_insert(data_path='rotation_quaternion',frame=frame)
 if '--lower' in sys.argv:
  b=rig.data.bones['spine.003'];deform=rw@rig.pose.bones[b.name].matrix@b.matrix_local.inverted()@rw.inverted()
  for side,s in [('L',1),('R',-1)]:
   desired=(rw@rig.pose.bones['hand.'+side].matrix).to_quaternion()
   target=rw@rig.pose.bones['hand.'+side].head+deform.to_3x3()@mesh.matrix_world.to_3x3()@Vector((-s*.02,0,-.055))
   ops['attack_helpers']['reach']('upper_arm.'+side,'forearm.'+side,target,mesh.matrix_world.to_3x3()@Vector((s,0,-.35)));world_rotation('hand.'+side,desired)
  fit(1);report[frame]['lower']=gaps()
print('BELLY_FIT_PROBE',json.dumps(report))
if '--wrap' in sys.argv:
 bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(root/'output/animations/_palm-wrap-probe.blend'))
