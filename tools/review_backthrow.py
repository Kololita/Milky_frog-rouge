"""Render paired runtime poses with the actual source materials; no source edits."""
import bpy,math,sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
for name in (sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['grab','carry','throw','sit','flip','rise']):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(root/'public/models/characters/frog.glb'))
 materials={m.name:m for m in bpy.data.materials}
 for obj in list(bpy.data.objects):bpy.data.objects.remove(obj,do_unlink=True)
 pose_name=name.removesuffix('-side')
 bpy.ops.import_scene.gltf(filepath=str(root/f'output/animations/backthrow-{pose_name}-review.glb'))
 for obj in bpy.context.scene.objects:
  if obj.type!='MESH':continue
  for slot in obj.material_slots:
   if slot.material and slot.material.name.startswith('SourceMaterial::'):
    key=slot.material.name.removeprefix('SourceMaterial::')
    if key not in materials and key[-4:-3]=='.':key=key[:-4]
    slot.material=materials[key]
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
 scene.render.resolution_x=720;scene.render.resolution_y=650;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.3,.38,.4,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
 bpy.ops.mesh.primitive_plane_add(size=200);mat=bpy.data.materials.new('Ground');mat.diffuse_color=(.36,.46,.4,1);bpy.context.object.data.materials.append(mat)
 target=Vector((0,.0,1.0))
 bpy.ops.object.light_add(type='AREA',location=(2,-3,5));lamp=bpy.context.object;lamp.data.energy=380;lamp.data.size=4;lamp.rotation_euler=(target-lamp.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add(location=(4,-.4,2.8) if name.endswith('-side') else (4,-5,3.0));camera=bpy.context.object;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=4.7;scene.camera=camera
 scene.render.filepath=str(root/f'output/animations/backthrow-{name}-review.png');bpy.ops.render.render(write_still=True)
