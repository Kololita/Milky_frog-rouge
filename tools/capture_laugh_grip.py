import bpy,json
from pathlib import Path
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'output/animations/_before-laugh-stability.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rw=rig.matrix_world;rig.animation_data.action=bpy.data.actions['Laugh'];result={}
mesh=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));names={g.index:g.name for g in mesh.vertex_groups}
weights=[sum(g.weight for g in v.groups if names[g.group].startswith(('upper_arm','forearm','hand','f_','thumb','shoulder'))) for v in mesh.data.vertices]
faces=[tuple(p.vertices) for p in mesh.data.polygons if max(weights[i] for i in p.vertices)<.05]
for label,frame in [('down',31),('up',76)]:
 bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();body=rw@rig.pose.bones['spine.001'].matrix;inv=body.inverted();result[label]={}
 ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=ev.to_mesh();pts=[ev.matrix_world@v.co for v in data.vertices];ev.to_mesh_clear();tree=BVHTree.FromPolygons(pts,faces)
 for side in ['L','R']:
  hand=rw@rig.pose.bones['hand.'+side].matrix
  a=rw@rig.pose.bones['upper_arm.'+side].head;elbow=rw@rig.pose.bones['forearm.'+side].head
  result[label][side]={'outward':list(inv.to_3x3()@tree.find_nearest(hand.translation)[1]),'wrist':list(inv@hand.translation),'rotation':list(body.to_quaternion().inverted()@hand.to_quaternion()),'pole':list(inv.to_3x3()@(elbow-a)),'fingers':{p.name:list(p.rotation_quaternion) for p in rig.pose.bones if p.name.endswith('.'+side) and p.name.startswith(('f_','thumb.'))}}
(root/'tools/frog_laugh_grip.json').write_text(json.dumps(result,indent=2))
