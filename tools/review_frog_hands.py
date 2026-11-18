"""Close-up palm and side views of the actual weighted fingers."""
import bpy,bmesh
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];out=root/'output/animations/hand-review';out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');main=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));scene=bpy.context.scene
for o in scene.objects:
 if o.type=='MESH' and o.data.shape_keys:
  o.data.shape_keys.animation_data.action=None
  for k in o.data.shape_keys.key_blocks:k.value=0
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
scene.render.resolution_x=500;scene.render.resolution_y=500;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Hand review');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.16,.20,.24,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8
for pos in [(-1,-1.5,2),(1,-.7,1),(.2,1.5,1.7)]:
 bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=70;l.data.size=1.5
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=.15;scene.camera=cam
for name,frame,side in [('Attack1',7,'L'),('Attack2',11,'R'),('Attack4',19,'R'),('Idle',1,'L')]:
 rig.animation_data.action=bpy.data.actions[name];scene.frame_set(frame);bpy.context.view_layer.update()
 hand=rig.pose.bones['hand.'+side];wrist=rig.matrix_world@hand.head
 index=rig.matrix_world@rig.pose.bones['f_index.01.'+side].head;outer=rig.matrix_world@rig.pose.bones[('f_pinky.01.' if side=='L' else 'f_ring.01.')+side].head
 f=((index+outer)*.5-wrist).normalized();n=f.cross(outer-index).normalized()*(-1 if side=='L' else 1);a=f.cross(n).normalized()
 target=wrist+f*.047+n*.008
 # Isolate the evaluated hand so a palm-facing camera cannot sit inside the
 # abdomen. Retain its materials/UVs and a short forearm stub for context.
 groups={g.index for g in main.vertex_groups if g.name.endswith('.'+side) and g.name.startswith(('hand.','palm.','f_','thumb.'))}
 ids={v.index for v in main.data.vertices if sum(g.weight for g in v.groups if g.group in groups)>.32}
 evaluated=main.evaluated_get(bpy.context.evaluated_depsgraph_get())
 data=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=bpy.context.evaluated_depsgraph_get())
 bm=bmesh.new();bm.from_mesh(data);bm.verts.ensure_lookup_table()
 bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.index not in ids],context='VERTS');bm.to_mesh(data);bm.free()
 isolated=bpy.data.objects.new('Hand close-up',data);scene.collection.objects.link(isolated);isolated.matrix_world=main.matrix_world.copy();main.hide_render=True
 points=[isolated.matrix_world@v.co for v in data.vertices]
 low=Vector(tuple(min(p[j] for p in points) for j in range(3)));high=Vector(tuple(max(p[j] for p in points) for j in range(3)))
 target=(low+high)*.5;cam.data.ortho_scale=max((high-low).length*1.05,.16)
 # Use the isolated patch only to frame the camera. Render the complete skin
 # so the review does not introduce artificial cut edges or holes.
 isolated.hide_render=True;main.hide_render=False
 for l in [o for o in scene.objects if o.type=='LIGHT']:l.rotation_euler=(target-l.location).to_track_quat('-Z','Y').to_euler()
 for view,offset in [('palm',n*.5+f*.05+a*.1),('side',a*.5+n*.1)]:
  cam.location=target+offset;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
  scene.render.filepath=str(out/f'{name}-{side}-{view}.png');bpy.ops.render.render(write_still=True)
 main.hide_render=False;bpy.data.objects.remove(isolated,do_unlink=True);bpy.data.meshes.remove(data)
