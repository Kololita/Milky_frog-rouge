import bpy,math,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path.cwd();OUT=ROOT/'output/enemy-models'
for name in (['stonekeeper'] if '--stone' in sys.argv else ['lantern','stonekeeper']):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/f'public/models/enemies/{name}.glb'))
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.resolution_x=700;scene.render.resolution_y=700;scene.render.resolution_percentage=100
 rig=next(o for o in scene.objects if o.type=='ARMATURE')
 for t in rig.animation_data.nla_tracks:t.mute=True
 scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.14,.17,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
 bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;mat=bpy.data.materials.new('Floor');mat.diffuse_color=(.16,.19,.22,1);floor.data.materials.append(mat)
 center=Vector((0,0,.5 if name=='lantern' else 1.07))
 for loc,power in [((2,-3,5),500),((-3,1,3),350)]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=4;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=3.8
 for action,frame in ([('Smash',t*30) for t in [.45,.50,.55,.60,.625,.70]] if '--arc' in sys.argv else [(a,14 if a!='Idle' else 0) for a in (['Idle','Walk','Pulse','Empower','Firebolt','Death'] if name=='lantern' else ['Idle','Walk','Smash','Sweep','Quake','RockThrow','Death'])]):
  if '--contact' in sys.argv:
   if action not in ['Smash','Sweep','Quake','RockThrow']:continue
   frame=21
  if '--final' in sys.argv and action not in ['Idle','Death']:continue
  rig.animation_data.action=next(a for a in bpy.data.actions if a.name==action);rig.animation_data.action_slot=rig.animation_data.action.slots[0];scene.frame_set(int(frame*scene.render.fps/30),subframe=(frame*scene.render.fps/30)%1)
  for view,loc in [('front',(2,-4,1.3)),('side',(4,-.3,1.0))]+([('back',(-3,3,1.2))] if '--contact' in sys.argv else []):
   cam.location=center+Vector(loc);cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/f'{name}-{action}-{view}{"-contact" if "--contact" in sys.argv else ("-arc-"+str(round(frame,2)) if "--arc" in sys.argv else "")}.png');bpy.ops.render.render(write_still=True)
