import bpy,math,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path.cwd();OUT=ROOT/'output/enemy-models'
for name in ['raider','shellbug']:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/f'public/models/enemies/{name}.glb'))
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.resolution_x=700;scene.render.resolution_y=700;scene.render.resolution_percentage=100
 rig=next(o for o in scene.objects if o.type=='ARMATURE')
 for t in rig.animation_data.nla_tracks:t.mute=True
 scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.14,.17,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
 bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;mat=bpy.data.materials.new('Floor');mat.diffuse_color=(.16,.19,.22,1);floor.data.materials.append(mat)
 center=Vector((0,0,.78 if name=='raider' else .3))
 for loc,power in [((2,-3,5),500),((-3,1,3),350)]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=4;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=1.95
 for action,frame in [('Idle',0),('Walk',8),('Jab' if name=='raider' else 'Charge',20),('Hook' if name=='raider' else 'Spikes',20),('Death',30)]:
  if '--final' in sys.argv and action not in ['Idle','Death']:continue
  rig.animation_data.action=next(a for a in bpy.data.actions if a.name==action);scene.frame_set(frame)
  for view,loc in [('front',(2,-4,1.3)),('side',(4,-.3,1.0))]:
   cam.location=center+Vector(loc);cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/f'{name}-{action}-{view}.png');bpy.ops.render.render(write_still=True)
