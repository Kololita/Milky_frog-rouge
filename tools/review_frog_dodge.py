"""Render takeoff, inversion and landing, with a visible floor for clearance."""
import bpy
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];out=root/'output/animations/dodge-review';out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');main=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));scene=bpy.context.scene
for o in scene.objects:
 if o.type=='MESH' and o.data.shape_keys:
  o.data.shape_keys.animation_data.action=None
  for k in o.data.shape_keys.key_blocks:k.value=0
scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True
scene.render.resolution_x=340;scene.render.resolution_y=390;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Dodge review');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.55,.61,.65,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
target=main.matrix_world@Vector((0,.22,.7))
for pos in [(-1,-1.5,3),(1,-.7,2),(.2,1.5,2.7)]:
 bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=85;l.data.size=1.5;l.rotation_euler=(target-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.030));floor=bpy.context.object;mat=bpy.data.materials.new('Review floor');mat.diffuse_color=(.30,.40,.36,1);floor.data.materials.append(mat)
bpy.ops.object.camera_add(location=target+Vector((-2.5,-2.7,.2)));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=2.0;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
for name in ['DodgeRoll','DodgeBackflip','DodgeSideL','DodgeSideR']:
 rig.animation_data.action=bpy.data.actions[name];scene.frame_set(1);bpy.context.view_layer.update()
 start=rig.matrix_world@rig.pose.bones['spine'].head
 offset=Vector((-3,-.7,.15)) if name in ['DodgeRoll','DodgeBackflip'] else Vector((.4,-3,.15))
 for frame in ([1,6,11,16,22,29] if name in ['DodgeRoll','DodgeBackflip'] else [1,6,10,14,20,25]):
  scene.frame_set(frame);bpy.context.view_layer.update();now=rig.matrix_world@rig.pose.bones['spine'].head
  follow=Vector((now.x-start.x,0,0)) if name.startswith('DodgeSide') else Vector((0,0,0))
  aim=target+follow;cam.location=aim+offset;cam.rotation_euler=(aim-cam.location).to_track_quat('-Z','Y').to_euler()
  cam.data.ortho_scale=1.55 if name.startswith('DodgeSide') else 2.1
  scene.render.filepath=str(out/f'{name}-{frame:02}.png');bpy.ops.render.render(write_still=True)
