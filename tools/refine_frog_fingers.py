"""Add real weighted distal joints; preserve the source mesh and old animation."""
import bpy,json,hashlib,math,sys
from pathlib import Path
from mathutils import Matrix,Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from frog_hand_pose import hand_pose
root=Path(__file__).resolve().parents[1];source=root/'assets-source/blender/frog.blend'
digest=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
mesh=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
if rig.get('four_segment_fingers') and '--repose-only' not in sys.argv:raise RuntimeError('Finger refinement already applied')
records=json.loads((root/'output/animations/finger-refinement.json').read_text())['new_joints'] if rig.get('four_segment_fingers') else []
if not rig.get('four_segment_fingers'):
 rig.animation_data.action=None
 for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
 records=[]
 bpy.ops.object.mode_set(mode='EDIT')
 for side,prefixes in [('L',['f_index','f_ring','f_pinky','thumb']),('R',['f_index','f_middle','f_ring','thumb'])]:
  for prefix in prefixes:
   old=rig.data.edit_bones[f'{prefix}.03.{side}'];head=old.head.copy();tail=old.tail.copy()
   split=head.lerp(tail,.48)
   new=rig.data.edit_bones.new(f'{prefix}.04.{side}')
   new.head=split;new.tail=tail;new.roll=old.roll;new.parent=old;new.use_connect=True;new.use_deform=True
   old.tail=split
   records.append({'old':old.name,'new':new.name,'head':list(head),'tail':list(tail)})
 bpy.ops.object.mode_set(mode='OBJECT')
 # Transfer distal influence smoothly; with identity new joints this reproduces
 # the previous skin exactly, since parent and child have the same deformation.
 rig_to_mesh=mesh.matrix_world.inverted()@rig.matrix_world
 for item in records:
  old=mesh.vertex_groups.get(item['old']);new=mesh.vertex_groups.new(name=item['new'])
  h=rig_to_mesh@Vector(item['head']);tail=rig_to_mesh@Vector(item['tail']);axis=tail-h
  transferred=0
  for vertex in mesh.data.vertices:
   weight=next((g.weight for g in vertex.groups if g.group==old.index),0)
   if not weight:continue
   t=max(0,min(1,((vertex.co-h).dot(axis)/axis.length_squared-.28)/.5));t=t*t*(3-2*t)
   if t>0:
    old.add([vertex.index],weight*(1-t),'REPLACE');new.add([vertex.index],weight*t,'REPLACE');transferred+=1
  item['weighted_vertices']=transferred
  assert transferred>5,item
 rig['four_segment_fingers']=True
# Re-author only finger rotations in every existing action. Retain all body,
# wrist and face channels; each old fist/relaxed blend drives the new profile.
for action in list(bpy.data.actions):
 if action.name=='Blink':continue
 rig.animation_data.action=action
 for frame in range(round(action.frame_range[0]),round(action.frame_range[1])+1):
  bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
  for side in ['L','R']:
   if action.name in ['Walk','WalkBack','Run','JumpWalk','JumpRun']:closed=1
   elif action.name.startswith('Attack'):closed=0 if action.name=='Attack4' and side=='R' else 1
   elif action.name=='Block':closed=1 if side=='R' else 0
   else:closed=0
   hand_pose(rig,side,closed)
   for p in rig.pose.bones:
    if p.name.endswith('.'+side) and p.name.startswith(('f_','thumb.')):
     p.keyframe_insert('rotation_quaternion',frame=frame,group=p.name)
rig.animation_data.action=bpy.data.actions['Idle'];bpy.context.scene.frame_set(1)
assert hashlib.sha256(source.read_bytes()).hexdigest()==digest,'Source changed concurrently'
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(source))
(root/'output/animations/finger-refinement.json').write_text(json.dumps({'bones':len(rig.data.bones),'new_joints':records,'mesh_topology_unchanged':True},indent=2))
print('FINGER_REFINEMENT_READY',len(rig.data.bones),records,flush=True)
