"""Render the reference-inspired laugh without saving review lights/cameras."""
import bpy
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];out=root/'output/animations/block-review';out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.shape_keys];main=max(meshes,key=lambda o:len(o.data.vertices));scene=bpy.context.scene
action=bpy.data.actions['Block'];rig.animation_data.action=action
for obj in meshes:
 sk=obj.data.shape_keys;sk.animation_data.action=None
 for key in sk.key_blocks:key.value=0
scene.frame_set(1);scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True
scene.render.resolution_x=480;scene.render.resolution_y=580;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Laugh review');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.8,.82,.84,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
target=main.matrix_world@Vector((0,.20,.52))
for pos in [(-1,-1.5,2),(1,-.7,1),(.2,1.5,1.7)]:
 bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=65;light.data.size=1.5;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=target+Vector((.9,-2.7,.25)));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=1.30;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
for obj in meshes:
 if obj!=main:obj.visible_shadow=False
scene.frame_set(17)
for view,offset in [('front',(0,-2.7,.25)),('right45',(-1.4,-2.4,.25)),('left45',(1.4,-2.4,.25)),('right-side',(-2.7,0,.25))]:
 cam.location=target+Vector(offset);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(out/(view+'.png'));bpy.ops.render.render(write_still=True)
