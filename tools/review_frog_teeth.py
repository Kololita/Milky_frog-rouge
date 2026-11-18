"""Render representative transition frames without editing the saved model."""
import bpy,math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];out=root/'output/animations/teeth-review';out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.shape_keys]
main=max(meshes,key=lambda o:len(o.data.vertices));scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
scene.render.resolution_x=600;scene.render.resolution_y=600;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Face review studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.13,.15,.18,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
target=main.matrix_world@Vector((.001,.19,.954))
for pos in [(-1,-1.5,2),(1,-.7,1),(.2,1.5,1.7)]:
 bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=85;l.data.size=1.5;l.rotation_euler=(target-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=.43;scene.camera=cam
for obj in meshes:
 if obj!=main:obj.visible_shadow=False
end=int(bpy.data.actions['Laugh'].frame_range[1])
for name,frames in [('Laugh',[25,50])]:
 action=bpy.data.actions[name];rig.animation_data.action=action if name=='Laugh' else bpy.data.actions['Idle']
 for obj in meshes:
  sk=obj.data.shape_keys;sk.animation_data.action=action
  sk.animation_data.action_slot=next(s for s in action.slots if s.target_id_type=='KEY' and s.name_display==sk.name)
 for view,offset in [('front',(0,-2,.02)),('right45',(1.5,-1.5,.02)),('below',(0,-2,-.45))]:
  cam.location=target+Vector(offset);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
  for frame in frames:
   scene.frame_set(frame);bpy.context.view_layer.update()
   face=rig.data.bones['face'];deform=rig.matrix_world@rig.pose.bones['face'].matrix@face.matrix_local.inverted()@rig.matrix_world.inverted()
   posed_target=deform@target;cam.location=posed_target+Vector(offset);cam.rotation_euler=(posed_target-cam.location).to_track_quat('-Z','Y').to_euler()
   scene.render.filepath=str(out/f'{name}-{view}-{frame:03d}.png');bpy.ops.render.render(write_still=True)
print('FACE_REVIEW_READY',flush=True)
