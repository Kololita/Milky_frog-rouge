"""Match Blender's subframe interpolation to the verified GLB palm poses."""
import bpy,hashlib,json
from pathlib import Path
from mathutils import Quaternion
root=Path(__file__).resolve().parents[1];path=root/'assets-source/blender/frog.blend';digest=hashlib.sha256(path.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(path))
action=bpy.data.actions['Laugh'];groups={};flips=0
for layer in action.layers:
 for strip in layer.strips:
  for bag in strip.channelbags:
   for curve in bag.fcurves:
    if curve.data_path.startswith('pose.bones'):
     for point in curve.keyframe_points:point.interpolation='LINEAR'
    if curve.data_path.endswith('rotation_quaternion'):groups.setdefault(curve.data_path,{})[curve.array_index]=curve
for channels in groups.values():
 previous=None
 for i in range(len(channels[0].keyframe_points)):
  q=Quaternion([channels[j].keyframe_points[i].co.y for j in range(4)])
  if previous is not None and previous.dot(q)<0:
   q.negate();flips+=1
   for j in range(4):channels[j].keyframe_points[i].co.y=q[j]
  previous=q.copy()
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rig.animation_data.action=bpy.data.actions['Idle']
bpy.context.scene.frame_set(1)
assert hashlib.sha256(path.read_bytes()).hexdigest()==digest,'Source changed concurrently'
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(path))
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
 if obj.type in ['MESH','ARMATURE']:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(root/'output/frog.glb'),export_format='GLB',export_vertex_color='NONE',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_merge_animation='ACTION',export_frame_range=False,export_force_sampling=True,export_anim_single_armature=True,export_anim_slide_to_zero=True,export_morph=True,export_morph_animation=True)
print('LAUGH_CONTACT_INTERPOLATION_FIXED',json.dumps({'quaternionSignCorrections':flips,'boneTracks':len(groups)}))
