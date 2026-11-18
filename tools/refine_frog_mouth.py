"""Flatten the mouth skin while preserving the original action data."""
import bpy,sys,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'tools'))
from frog_mouth import refine_flat_mouth,ensure_true_mouth
source=root/'assets-source/blender/frog.blend';digest=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source))
if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
mesh=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
refine_flat_mouth(mesh,rig);ensure_true_mouth(mesh,rig)
rig.animation_data.action=bpy.data.actions['Idle'];bpy.context.scene.frame_set(1)
assert hashlib.sha256(source.read_bytes()).hexdigest()==digest
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(source))
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
for obj in bpy.context.scene.objects:
 if obj.type=='MESH':obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'output/frog.glb'),export_format='GLB',export_vertex_color='NONE',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_merge_animation='ACTION',export_frame_range=False,export_force_sampling=True,export_anim_single_armature=True,export_anim_slide_to_zero=True,export_morph=True,export_morph_animation=True)
