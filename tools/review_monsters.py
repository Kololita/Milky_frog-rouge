import bpy
import sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
specials='--specials' in sys.argv
moves=specials or '--moves' in sys.argv
output='monster-specials' if specials else 'monster-moves' if moves else 'monster-lineup'
bpy.ops.import_scene.gltf(filepath=str(root/f'output/{output}.glb'))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1200 if moves else 1500;scene.render.resolution_y=1050 if moves else 500;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.17,.22,.24,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
bpy.ops.mesh.primitive_plane_add(size=200);mat=bpy.data.materials.new('Ground');mat.diffuse_color=(.19,.25,.27,1);bpy.context.object.data.materials.append(mat)
target=Vector((0,1.5,1)) if specials else Vector((0,3,1)) if moves else Vector((0,0,1))
for location,power,size in [((0,-6,7),1700,9),((-5,3,5),950,7)]:
 bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object;light.data.energy=power;light.data.size=size;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3,-15,14) if moves else (3,-15,6));camera=bpy.context.object;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=10 if specials else 11 if moves else 18;scene.camera=camera
scene.render.filepath=str(root/f'output/{output}.png');bpy.ops.render.render(write_still=True)
