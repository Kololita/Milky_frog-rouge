"""Constrain mouth normal blending, keeping every mesh coordinate and animation."""
import bpy,sys,hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'tools'))
from frog_surface import smooth_skin_normals
source=root/'assets-source/blender/frog.blend';bpy.ops.wm.open_mainfile(filepath=str(source))
if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
m=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
def fingerprint():
 shapes={o.name:([tuple(v.co) for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons],{k.name:[tuple(v.co) for v in k.data] for k in o.data.shape_keys.key_blocks} if o.data.shape_keys else {}) for o in bpy.context.scene.objects if o.type=='MESH'}
 return hashlib.sha256(repr(shapes).encode()).hexdigest()
before=fingerprint();smooth_skin_normals(m);assert fingerprint()==before
rig.animation_data.action=bpy.data.actions['Idle'];bpy.context.scene.frame_set(1)
for o in bpy.context.scene.objects:
 if o.type=='MESH' and o.data.shape_keys:
  o.data.shape_keys.animation_data.action=None
  for key in o.data.shape_keys.key_blocks:key.value=0
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(source))
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
for o in bpy.context.scene.objects:
 if o.type=='MESH':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'output/frog.glb'),export_format='GLB',export_vertex_color='NONE',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_merge_animation='ACTION',export_frame_range=False,export_force_sampling=True,export_anim_single_armature=True,export_anim_slide_to_zero=True,export_morph=True,export_morph_animation=True)
print('LOCAL_FACE_SHADING_ONLY',before)
