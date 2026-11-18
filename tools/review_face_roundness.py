import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];stage=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'before';out=root/'output/animations/round-face-review'/stage;out.mkdir(parents=True,exist_ok=True)
source=root/(sys.argv[sys.argv.index('--')+2] if '--' in sys.argv and len(sys.argv)>sys.argv.index('--')+2 else 'assets-source/blender/frog.blend')
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE');meshes=[o for o in scene.objects if o.type=='MESH' and o.data.shape_keys];main=max(meshes,key=lambda o:len(o.data.vertices));mw=main.matrix_world.copy()
if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
if stage=='geometric':
 interior={i for i,m in enumerate(main.data.materials) if m.name in ['Frog oral lining','Frog oral depth']};sums=[Vector() for v in main.data.vertices]
 for p in main.data.polygons:
  if p.material_index in interior:continue
  for i in p.vertices:sums[i]+=p.normal*p.area
 for n in sums:
  if n.length:n.normalize()
 normals=[n.vector[:] for n in main.data.corner_normals]
 for p in main.data.polygons:
  if p.material_index in interior:continue
  for li in p.loop_indices:normals[li]=sums[main.data.loops[li].vertex_index][:]
 main.data.normals_split_custom_set(normals)
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.render.resolution_x=500;scene.render.resolution_y=500;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Face volume inspection');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.32,.36,.4,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
base=mw@Vector((.001,.19,.96))
for pos in [(-1,-2,2.5),(1.5,-1,1.4),(.2,1,2)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=65;o.data.size=1.4;o.rotation_euler=(base-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=.31;scene.camera=cam
for name,frame in ([('Idle',1)] if stage.startswith('old-') else [('Idle',1),('Laugh',31),('Laugh',76)]):
 action=bpy.data.actions[name];rig.animation_data.action=action
 for obj in meshes:
  sk=obj.data.shape_keys;sk.animation_data.action=None
  for k in sk.key_blocks:k.value=0
  if name=='Laugh':sk.animation_data.action=action;sk.animation_data.action_slot=next(s for s in action.slots if s.target_id_type=='KEY' and s.name_display==sk.name)
 scene.frame_set(frame);bpy.context.view_layer.update();b=rig.data.bones['face'];deform=rig.matrix_world@rig.pose.bones['face'].matrix@b.matrix_local.inverted()@rig.matrix_world.inverted();target=deform@base
 for view,offset in [('front',(0,-2,.02)),('quarter',(1.25,-2,.02)),('profile',(2,0,.02)),('opposite',(-2,0,.02)),('low',(0,-2,-.5))]:
  cam.location=target+deform.to_quaternion()@Vector(offset);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/f'{name}-{frame:03}-{view}.png');bpy.ops.render.render(write_still=True)
