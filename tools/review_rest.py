import bpy
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'public/models/characters/frog.glb'))
materials={m.name:m for m in bpy.data.materials}
for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(root/'output/rest-site-review.glb'))
for obj in bpy.context.scene.objects:
 if obj.type=='MESH':
  for slot in obj.material_slots:
   if slot.material and slot.material.name.startswith('SourceMaterial::'):slot.material=materials[slot.material.name.removeprefix('SourceMaterial::')]
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=650;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Forest sky');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.35,.43,.35,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
bpy.ops.mesh.primitive_plane_add(size=200);mat=bpy.data.materials.new('Grass');mat.diffuse_color=(.28,.38,.29,1);bpy.context.object.data.materials.append(mat)
target=Vector((0,0,.9));bpy.ops.object.light_add(type='AREA',location=(2,-3,5));lamp=bpy.context.object;lamp.data.energy=500;lamp.data.size=4;lamp.rotation_euler=(target-lamp.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2.5,-4.3,1.9));camera=bpy.context.object;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=38;scene.camera=camera
scene.render.filepath=str(root/'output/rest-site-review.png');bpy.ops.render.render(write_still=True)
