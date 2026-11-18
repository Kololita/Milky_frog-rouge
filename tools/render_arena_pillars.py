import bpy
from pathlib import Path
from mathutils import Vector
root=Path.cwd();bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(root/'output/arena-pillars-preview.glb'));s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True;s.render.resolution_x=900;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.world=bpy.data.worlds.new('World');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.29,.34,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.7
for loc,power in [((3,-8,6),1100),((-4,-14,4),750)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=5;o.rotation_euler=(Vector((0,-12.3,1.8))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3,-7,3.7));cam=bpy.context.object;cam.rotation_euler=(Vector((0,-12.3,1.9))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=5;s.camera=cam;s.render.filepath=str(root/'output/arena-pillars-final.png');bpy.ops.render.render(write_still=True)
