"""Render the exported runtime enemy, without modifying any model sources."""
import bpy,math,sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
for state in (sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['idle','windup']):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(root/f'output/animations/enemy-{state}-review.glb'))
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
 scene.render.resolution_x=600;scene.render.resolution_y=650;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.36,.42,.43,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
 bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;mat=bpy.data.materials.new('Ground');mat.diffuse_color=(.44,.54,.49,1);ground.data.materials.append(mat)
 target=Vector((0,0,1.1 if state.startswith('samurai') else .75))
 for position,energy,size in [((2,-3,4),230,3),((-3,-1,2.5),170,2)]:
  bpy.ops.object.light_add(type='AREA',location=position);lamp=bpy.context.object;lamp.data.energy=energy;lamp.data.shape='DISK';lamp.data.size=size;lamp.rotation_euler=(target-lamp.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add(location=(2.6,-5,3.2));camera=bpy.context.object;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=3.8 if state.startswith('samurai') else 2.8;scene.camera=camera
 scene.render.filepath=str(root/f'output/animations/enemy-{state}-review.png');bpy.ops.render.render(write_still=True)
