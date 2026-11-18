"""Front and side review of the laugh sequence and matched jump hands."""
import bpy,math,sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];out=root/('output/animations/push-contact-review' if '--push-contact' in sys.argv else 'output/animations/performance-review');out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'))
scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE')
main=max((o for o in scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
meshes=[o for o in scene.objects if o.type=='MESH']
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
scene.render.resolution_x=380;scene.render.resolution_y=460;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Performance review');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.55,.61,.65,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
target=main.matrix_world@Vector((0,.24,.57))
for pos in [(-1,-1.5,3),(1,-.7,2),(.2,1.5,2.7)]:
 bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=85;light.data.size=1.5;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.030));floor=bpy.context.object;mat=bpy.data.materials.new('Review floor');mat.diffuse_color=(.30,.40,.36,1);floor.data.materials.append(mat)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=1.55;scene.camera=cam
for view,offset in [('front',(.3,-3,.32)),('side',(-3,-.35,.25))]:
 if '--laugh-gif' in sys.argv and view!='front':continue
 cam.location=target+Vector(offset);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
 for name,frames in ([('Laugh',[25,31,61,76,91]),('RunAttack',[1,4,6,9,13,19])] if '--push-contact' in sys.argv else [('Laugh',[1,16,31,46,61,76,91,104]),('JumpWalk',[16]),('JumpRun',[13])]):
  if '--laugh-gif' in sys.argv:
   if name!='Laugh':continue
   frames=list(range(1,104,2))+[104]
  action=bpy.data.actions[name];rig.animation_data.action=action
  for obj in meshes:
   if not obj.data.shape_keys:continue
   sk=obj.data.shape_keys;sk.animation_data_create();sk.animation_data.action=None
   for key in sk.key_blocks:key.value=0
   slot=next((s for s in action.slots if s.target_id_type=='KEY' and s.name_display==sk.name),None)
   if slot:sk.animation_data.action=action;sk.animation_data.action_slot=slot
  for frame in frames:
   scene.frame_set(frame);scene.render.filepath=str(out/f'{name}-{view}-{frame:03}.png');bpy.ops.render.render(write_still=True)
