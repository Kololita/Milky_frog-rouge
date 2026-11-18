import bpy,math
from pathlib import Path
from mathutils import Vector as V
ROOT=Path.cwd();OUT=ROOT/'output/enemy-models'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/'docs/sarumai.glb'))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.resolution_x=620;scene.render.resolution_y=700;scene.render.resolution_percentage=100
rig=next(o for o in scene.objects if o.type=='ARMATURE')
for track in rig.animation_data.nla_tracks:track.mute=True
scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.13,.16,.20,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
center=V((0,0,1.25))
for loc,power in [((2,-3,5),650),((-3,1,3),500)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=4;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=3.5
for name,phase,offset in [('Backstep',1,(3,-4,.5)),('CounterThrust',.65,(3,-4,.5)),('DoubleLeft',.58,(3,-4,.5)),('DoubleRight',.58,(-3,-4,.5))]:
 a=bpy.data.actions[name];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0];f=phase*float(a.frame_range[1]);scene.frame_set(int(f),subframe=f%1)
 cam.location=center+V(offset);cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/f'counter-review-{name}.png');bpy.ops.render.render(write_still=True)
