import bpy,math,sys
from pathlib import Path
from mathutils import Vector as V
ROOT=Path.cwd();OUT=ROOT/'output/enemy-models'
ids=sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else ['raider','mirrorGuard','stonekeeper','samurai']
for name in ids:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/f'public/models/enemies/{name}.glb'));scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=4;scene.cycles.use_denoising=True;scene.render.resolution_x=280;scene.render.resolution_y=320;scene.render.resolution_percentage=100
 rig=next(o for o in scene.objects if o.type=='ARMATURE')
 for track in rig.animation_data.nla_tracks:track.mute=True
 height={'samurai':2.25,'mirrorGuard':1.65,'spitter':1.25,'scythemoth':1.95,'raider':1.65,'stonekeeper':2.1}[name];center=V((0,0,1.65 if name=='samurai' else height*.56));scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.14,.17,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
 bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;mat=bpy.data.materials.new('Floor');mat.diffuse_color=(.17,.19,.21,1);floor.data.materials.append(mat)
 for loc,power in [((2,-3,5),500),((-3,1,3),350)]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=4;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale={'samurai':4.3,'mirrorGuard':2.5,'scythemoth':3.8,'raider':2.5,'stonekeeper':3.4,'spitter':2.2}[name]
 for action in list(bpy.data.actions):
  if action.name not in ['Jab','Hook','ShieldThrust','ParryPush','Smash','Quake','LongThrust','Overhead']:continue
  for phase in [.625,.8]:
   rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0];frame=phase*scene.render.fps;scene.frame_set(int(frame),subframe=frame%1)
   for view,offset in [('front',(2,-4,1.2)),('side',(4,-.15,1.1))]:
    cam.location=center+V(offset);cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/f'audit-{name}-{action.name}-{phase}-{view}.png');bpy.ops.render.render(write_still=True)
