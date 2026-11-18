"""Verify a genuine mouth opening, connected inner walls, and a solid tongue."""
import bpy,bmesh,json,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[1];source=root/'assets-source/blender/frog.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
mesh=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');scene=bpy.context.scene
ids=json.loads(mesh['mouth_vertex_ids']);controls=json.loads(mesh['mouth_controls']);rim=[i for i,c in zip(ids,controls) if c[0]==4]
bm=bmesh.new();bm.from_mesh(mesh.data);bm.verts.ensure_lookup_table()
assert all(e.is_manifold for i in ids for e in bm.verts[i].link_edges),'Mouth patch has an unwelded edge';bm.free()
tongue=bpy.data.objects['Frog laugh tongue'];bm=bmesh.new();bm.from_mesh(tongue.data);assert all(e.is_manifold for e in bm.edges),'Tongue is not a solid closed mesh';bm.free()
teeth=bpy.data.objects.get('Frog laugh teeth')
if teeth:
 bm=bmesh.new();bm.from_mesh(teeth.data);assert all(e.is_manifold for e in bm.edges),'Teeth are not closed crowns';bm.free()
objects=[o for o in scene.objects if o.type=='MESH' and o.data.shape_keys];action=bpy.data.actions['Laugh'];rig.animation_data.action=action
for obj in objects:
 sk=obj.data.shape_keys;sk.animation_data.action=action;sk.animation_data.action_slot=next(s for s in action.slots if s.target_id_type=='KEY' and s.name_display==sk.name)
def evaluated(obj,transform):
 ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());data=ev.to_mesh();v=[transform@ev.matrix_world@p.co for p in data.vertices];f=[tuple(p.vertices) for p in data.polygons];ev.to_mesh_clear();return v,f
depths=[];heights=[];tongue_clearances=[];closed_tongue_hidden=True;closed_teeth_hidden=True;minimum_visible_teeth=20;minimum_dental_tongue_gap=1
end=int(action.frame_range[1])
for step in range((end-1)*2+1):
 f=1+step*.5;scene.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update()
 b=rig.data.bones['face'];deform=rig.matrix_world@rig.pose.bones['face'].matrix@b.matrix_local.inverted()@rig.matrix_world.inverted();transform=mesh.matrix_world.inverted()@deform.inverted()
 verts,polys=evaluated(mesh,transform);tree=BVHTree.FromPolygons(verts,polys);lip=[verts[i] for i in rim];opening=mesh.data.shape_keys.key_blocks['LaughOpen'].value
 near=[p for p in lip if abs(p.x-.001)<.025];top=max(p.z for p in near);bottom=min(p.z for p in near);height=top-bottom
 tv,tf=evaluated(tongue,transform);clearance=min(p.y for p in tv)-min(p.y for p in lip);tongue_clearances.append(clearance);assert clearance>.005,'Tongue projects in front of lips'
 if teeth:
  dental,df=evaluated(teeth,transform)
  assert min(p.y for p in dental)-min(p.y for p in lip)>.006,'Teeth project out of the mouth'
  tongue_left=min(p.x for p in tv);tongue_right=max(p.x for p in tv)
  nearby=[]
  for tooth in range(20):
   points=dental[tooth*16:tooth*16+16]
   if min(p.x for p in points)<=tongue_right and max(p.x for p in points)>=tongue_left:nearby.extend(points)
  gap=min(p.y for p in tv)-max(p.y for p in nearby)
  minimum_dental_tongue_gap=min(minimum_dental_tongue_gap,gap)
  assert gap>.002,('Tongue intersects a dental crown',f,gap)
  visible=0
  for tooth in range(20):
   crown=dental[tooth*16:tooth*16+8]
   exposed=False
   for p in crown:
    hit=tree.ray_cast(Vector((p.x,-1,p.z)),Vector((0,1,0)),2)[0]
    if hit and hit.y>p.y+.001:exposed=True
   visible+=int(exposed)
   if opening<.001 and exposed:closed_teeth_hidden=False
  if opening>.75:minimum_visible_teeth=min(minimum_visible_teeth,visible)
 if opening>.35:
  hit=tree.ray_cast(Vector((.001,-1,(top+bottom)/2)),Vector((0,1,0)),2)[0];assert hit is not None
  depth=hit.y-sum(p.y for p in near)/len(near);depths.append(depth);assert depth>.015,('Opening blocked by face',f,depth)
 if opening>.9:heights.append(height);assert height>.035,('Mouth did not open',f,height)
 if opening<.001:
  for p in tv:
   hit=tree.ray_cast(Vector((p.x,-1,p.z)),Vector((0,1,0)),2)[0]
   if not hit or hit.y>p.y+.0001:closed_tongue_hidden=False
assert closed_tongue_hidden,'Tongue visible through closed face'
assert closed_teeth_hidden,'Teeth visible through closed face'
if teeth:assert minimum_visible_teeth==20,('A tooth is not visible during laughter',minimum_visible_teeth)
report={'mouth_patch_manifold':True,'volumetric_tongue_manifold':True,'samples':(end-1)*2+1,'open_mouth_depth_range':[min(depths),max(depths)],'fully_open_height_range':[min(heights),max(heights)],'minimum_tongue_distance_behind_lips':min(tongue_clearances),'tongue_hidden_when_closed':True,'minimum_tongue_teeth_depth_gap':minimum_dental_tongue_gap}
if teeth:report.update(simple_upper_teeth=10,simple_lower_teeth=10,teeth_hidden_when_closed=closed_teeth_hidden,minimum_visible_teeth_when_laughing=minimum_visible_teeth,teeth_vertices=len(teeth.data.vertices),teeth_faces=len(teeth.data.polygons))
(root/'output/animations/true-mouth-verification.json').write_text(json.dumps(report,indent=2));print('TRUE_MOUTH_VERIFIED',report)
