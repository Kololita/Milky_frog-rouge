import bpy,math
from pathlib import Path
from mathutils import Vector as V
ROOT=Path.cwd()
for name in ['phase2','phase3','lightning']:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/'docs/sarumai.glb'));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 for track in rig.animation_data.nla_tracks:track.mute=True
 a=bpy.data.actions['PhaseShift' if name=='lightning' else 'Idle'];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0];f=.44*float(a.frame_range[1]) if name=='lightning' else 0;bpy.context.scene.frame_set(int(f),subframe=f%1)
 bpy.ops.import_scene.gltf(filepath=str(ROOT/f'output/samurai-{name}-fx.glb'))
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.render.resolution_x=760;scene.render.resolution_y=900;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('World');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.055,.07,.09,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
 center=V((0,0,1.35 if name!='lightning' else 2.4))
 for loc,power in [((3,-4,5),700),((-3,2,4),450)]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=4;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=3.8 if name!='lightning' else 6.6;cam.location=center+V((2.8,-5,.45));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(ROOT/f'output/enemy-models/samurai-{name}-review.png');bpy.ops.render.render(write_still=True)
