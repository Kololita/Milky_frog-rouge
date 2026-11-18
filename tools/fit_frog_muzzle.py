"""Fit the muzzle locally; keep topology, rig, weights and animation curves."""
import bpy,sys,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'tools'))
from frog_muzzle import apply,restore
from frog_surface import smooth_skin_normals
from frog_muzzle_support import ensure_support_rings
source=root/'assets-source/blender/frog.blend';bpy.ops.wm.open_mainfile(filepath=str(source))
if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');main=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));objects=[main,*[bpy.data.objects[n] for n in ['Frog laugh tongue','Frog laugh teeth']]]
restore(objects);ensure_support_rings(main);report=apply(objects);smooth_skin_normals(main)
for obj in bpy.context.scene.objects:
 if obj.type=='MESH' and obj.data.shape_keys:
  if obj.data.shape_keys.animation_data:obj.data.shape_keys.animation_data.action=None
  for key in obj.data.shape_keys.key_blocks:key.value=0
rig.animation_data.action=bpy.data.actions['Idle'];bpy.context.scene.frame_set(1);bpy.context.preferences.filepaths.save_version=0
probe='--probe' in sys.argv;target=root/'output/animations/_muzzle-probe.blend' if probe else source
bpy.ops.wm.save_as_mainfile(filepath=str(target));print('MUZZLE_FIT',json.dumps(report))
(root/'output/animations/muzzle-fit-info.json').write_text(json.dumps(report,indent=2))
if probe:sys.exit(0)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
for obj in bpy.context.scene.objects:
 if obj.type=='MESH':obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'output/frog.glb'),export_format='GLB',export_vertex_color='NONE',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_merge_animation='ACTION',export_frame_range=False,export_force_sampling=True,export_anim_single_armature=True,export_anim_slide_to_zero=True,export_morph=True,export_morph_animation=True)
