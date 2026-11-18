"""Side and quarter views of the full stride, without modifying the saved source."""
import bpy
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];out=root/'output/animations/run-review';out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');main=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));scene=bpy.context.scene
for obj in scene.objects:
 if obj.type=='MESH' and obj.data.shape_keys:
  obj.data.shape_keys.animation_data.action=None
  for key in obj.data.shape_keys.key_blocks:key.value=0
rig.animation_data.action=bpy.data.actions['Run']
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
scene.render.resolution_x=420;scene.render.resolution_y=490;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Run review');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.55,.61,.65,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
target=main.matrix_world@Vector((0,.24,.53))
for pos in [(-1,-1.5,3),(1,-.7,2),(.2,1.5,2.7)]:
 bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=85;light.data.size=1.5;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.030));floor=bpy.context.object;mat=bpy.data.materials.new('Run floor');mat.diffuse_color=(.30,.40,.36,1);floor.data.materials.append(mat)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=1.45;scene.camera=cam
for view,offset in [('side',(-3,-.12,.10)),('quarter',(.9,-3,.17))]:
 cam.location=target+Vector(offset);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
 for frame in range(1,17):
  scene.frame_set(frame);scene.render.filepath=str(out/f'{view}-{frame:02}.png');bpy.ops.render.render(write_still=True)
