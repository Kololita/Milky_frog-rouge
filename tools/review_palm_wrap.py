"""Close-up front, both sides and elevated inspection of the belly clasp."""
import bpy,sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];stage='probe' if '--probe' in sys.argv else 'before' if '--before' in sys.argv else 'after'
out=root/'output/animations/palm-wrap-review'/stage;out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/('output/animations/_palm-wrap-probe.blend' if '--probe' in sys.argv else 'assets-source/blender/frog.blend')))
scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE');action=bpy.data.actions['Laugh'];rig.animation_data.action=action
for o in scene.objects:
 if o.type!='MESH' or not o.data.shape_keys:continue
 sk=o.data.shape_keys;sk.animation_data_create();sk.animation_data.action=None
 for key in sk.key_blocks:key.value=0
 slot=next((s for s in action.slots if s.target_id_type=='KEY' and s.name_display==sk.name),None)
 if slot:sk.animation_data.action=action;sk.animation_data.action_slot=slot
scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
scene.render.resolution_x=700;scene.render.resolution_y=550;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Hand inspection');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.45,.52,.57,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
for pos in [(-1,-2,3),(1,-1,1.7),(.2,1,2.2)]:
 bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=65;light.data.size=1.25;light.rotation_euler=(Vector((0,0,.6))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=.66;scene.camera=cam
for frame in [31,76]:
 scene.frame_set(frame);bpy.context.view_layer.update()
 center=sum((rig.matrix_world@rig.pose.bones['hand.'+s].head for s in ['L','R']),Vector())*.5+Vector((0,-.025,-.02))
 for name,offset in [('front',(0,-3,.15)),('left',(-3,-.3,.1)),('right',(3,-.3,.1)),('oblique',(-1.6,-2,.5)),('above',(.5,-2,1.7))]:
  cam.location=center+Vector(offset);cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
  scene.render.filepath=str(out/f'{frame:03}-{name}.png');bpy.ops.render.render(write_still=True)
