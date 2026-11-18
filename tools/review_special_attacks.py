"""Render the two new clips in a studio; external slam height is shown separately."""
import bpy,math,sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];out=root/'output/animations/special-attacks-review';out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'))
scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE')
main=max((o for o in scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
for obj in scene.objects:
 if obj.type=='MESH' and obj.data.shape_keys:
  obj.data.shape_keys.animation_data.action=None
  for key in obj.data.shape_keys.key_blocks:key.value=0
assets=[o for o in scene.objects if o.type in ['MESH','ARMATURE']]
root_obj=bpy.data.objects.new('Review lift',None);scene.collection.objects.link(root_obj)
for obj in assets:
 if obj.parent not in assets:
  m=obj.matrix_world.copy();obj.parent=root_obj;obj.matrix_world=m
scene.render.engine='CYCLES';scene.cycles.samples=10;scene.cycles.use_denoising=True
scene.render.resolution_x=360;scene.render.resolution_y=460;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Special attack review');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.55,.61,.65,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
target=main.matrix_world@Vector((0,.24,.65))
for pos in [(-1,-1.5,3),(1,-.7,2),(.2,1.5,2.7)]:
 bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=85;light.data.size=1.5;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.030));floor=bpy.context.object;mat=bpy.data.materials.new('Special floor');mat.diffuse_color=(.30,.40,.36,1);floor.data.materials.append(mat)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=1.8;scene.camera=cam
for view,offset in [('front',(.8,-3,.35)),('side',(-3,-.2,.3))]:
 cam.location=target+Vector(offset);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
 for name,count in ([('RunAttack',19)] if '--run-only' in sys.argv else [('AirAttack',43)] if '--air-only' in sys.argv else [('RunAttack',19),('AirAttack',43)]):
  rig.animation_data.action=bpy.data.actions[name]
  for frame in range(1,count+1,2):
   scene.frame_set(frame)
   sec=(frame-1)/24
   if name=='AirAttack':
    flight=max(0,min(1,(sec-.70)/.78))
    desired=.16+.23*(1-(1-sec/.22)**2) if sec<.22 else .39*(1-((sec-.22)/.28)**2) if sec<.5 else .27*math.sin(math.pi*flight)
    bpy.context.view_layer.update();obj=main.evaluated_get(bpy.context.evaluated_depsgraph_get());data=obj.to_mesh();lowest=min((obj.matrix_world@v.co).z for v in data.vertices);obj.to_mesh_clear()
    root_obj.location.z+=desired-(lowest+.030)
   else:root_obj.location.z=0
   scene.render.filepath=str(out/f'{name}-{view}-{frame:02}.png');bpy.ops.render.render(write_still=True)
