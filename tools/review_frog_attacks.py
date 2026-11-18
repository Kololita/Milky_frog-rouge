"""Representative attack poses from front/side and a full motion contact sheet."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];out=root/'output/animations/attack-review';out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.shape_keys]
main=max(meshes,key=lambda o:len(o.data.vertices));scene=bpy.context.scene
for obj in meshes:
 sk=obj.data.shape_keys;sk.animation_data.action=None
 for key in sk.key_blocks:key.value=0
 if obj!=main:obj.visible_shadow=False
scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True
scene.render.resolution_x=440;scene.render.resolution_y=500;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Attack review');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.7,.75,.78,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
target=main.matrix_world@Vector((0,.15,.49))
for pos in [(-1,-1.5,2),(1,-.7,1),(.2,1.5,1.7)]:
 bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=65;light.data.size=1.5;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=1.30;scene.camera=cam
for stage,frames in [(1,[1,7,12]),(2,[6,11,17]),(3,[5,11,17]),(4,[5,9,15,22])]:
 rig.animation_data.action=bpy.data.actions[f'Attack{stage}']
 for frame in frames:
  scene.frame_set(frame)
  for view,offset in [('front',(0,-2.7,.18)),('side',(-2.4,-1,.15))]:
   cam.location=target+Vector(offset);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
   scene.render.filepath=str(out/f'{stage}-{frame:02}-{view}.png');bpy.ops.render.render(write_still=True)
