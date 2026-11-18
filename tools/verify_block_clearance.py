import bpy,json
from pathlib import Path
from mathutils.kdtree import KDTree
r=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(r/'assets-source/blender/frog.blend'));m=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rig.animation_data.action=bpy.data.actions['Block'];bpy.context.scene.frame_set(17);bpy.context.view_layer.update()
e=m.evaluated_get(bpy.context.evaluated_depsgraph_get());d=e.to_mesh();T=m.matrix_world.inverted()@e.matrix_world;pts=[T@v.co for v in d.vertices];e.to_mesh_clear()
def weight(v,names):return sum(g.weight for g in v.groups if names(m.vertex_groups[g.group].name))
arm=[pts[v.index] for v in m.data.vertices if weight(v,lambda n:n=='forearm.R')>.55]
hand=[pts[v.index] for v in m.data.vertices if weight(v,lambda n:n.endswith('.R') and n.startswith(('hand.','f_','thumb.','palm.')))>.6]
neck=[pts[v.index] for v in m.data.vertices if .82<v.co.z<.90 and abs(v.co.x)<.075 and v.co.y<.28 and weight(v,lambda n:n.endswith('.R') and n.startswith(('forearm.','upper_arm.','hand.')))<.1]
tree=KDTree(len(arm))
for i,p in enumerate(arm):tree.insert(p,i)
tree.balance();gap=min(tree.find(p)[2] for p in neck);dimensions=[max(p[i] for p in hand)-min(p[i] for p in hand) for i in range(3)];size=dimensions[1]  # Use the fist thickness along the forward/backward clearance axis.
assert 1.6<gap/size<2.4,('Guard needs about two fists of clearance',gap/size)
report={'neck_to_forearm_surface_gap':gap,'fist_dimensions':dimensions,'fist_size':size,'clearance_in_fists':gap/size};print('GUARD_CLEARANCE',report);(r/'output/animations/block-clearance.json').write_text(json.dumps(report,indent=2))
