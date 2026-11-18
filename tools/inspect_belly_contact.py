import bpy,json,sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');mesh=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
groups={g.index:g.name for g in mesh.vertex_groups}
arm=lambda n:n.startswith(('upper_arm','forearm','hand','f_','thumb','shoulder'))
weights=[sum(g.weight for g in v.groups if arm(groups[g.group])) for v in mesh.data.vertices]
body_faces=[tuple(p.vertices) for p in mesh.data.polygons if max(weights[i] for i in p.vertices)<.05]
for obj in bpy.context.scene.objects:
 if obj.type=='MESH' and obj.data.shape_keys:
  obj.data.shape_keys.animation_data.action=None
  for key in obj.data.shape_keys.key_blocks:key.value=0
report={}
for frame in [25,31,49,61,76,91]:
 rig.animation_data.action=bpy.data.actions['Laugh'];bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
 ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=ev.to_mesh();verts=[ev.matrix_world@v.co for v in data.vertices];ev.to_mesh_clear()
 tree=BVHTree.FromPolygons(verts,body_faces);report[frame]={}
 for side in ['L','R']:
  ids=[v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups if groups[g.group]=='hand.'+side)>.5]
  wrist=rig.matrix_world@rig.data.bones['hand.'+side].head_local
  index=rig.matrix_world@rig.data.bones['f_index.01.'+side].head_local
  outer=rig.matrix_world@rig.data.bones[('f_pinky.01.' if side=='L' else 'f_ring.01.')+side].head_local
  forward=((index+outer)*.5-wrist).normalized();normal=forward.cross(outer-index).normalized()*(-1 if side=='L' else 1)
  patch=[i for i in ids if (mesh.matrix_world.to_3x3()@mesh.data.vertices[i].normal).normalized().dot(normal)>.55]
  samples=[]
  for i in ids:
   hit,n,_,d=tree.find_nearest(verts[i]);samples.append((verts[i]-hit).dot(n))
  report[frame][side]={'count':len(ids),'gapRange':[min(samples),max(samples)],'mean':sum(samples)/len(samples),'wrist':tuple(rig.matrix_world@rig.pose.bones['hand.'+side].head)}
  gaps=[]
  for i in patch:
   hit,n,_,d=tree.find_nearest(verts[i]);gaps.append((verts[i]-hit).dot(n))
  report[frame][side]['patch']={'ids':patch,'gaps':[min(gaps),sum(gaps)/len(gaps),max(gaps)]}
print('CONTACT_INSPECTION',json.dumps(report))
(root/('output/animations/belly-contact-after.json' if '--after' in sys.argv else 'output/animations/belly-contact-before.json')).write_text(json.dumps(report,indent=2))
