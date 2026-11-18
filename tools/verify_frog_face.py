"""Check evaluated skin surfaces throughout Blink/Laugh, including transitions."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/frog.blend'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.shape_keys]
main=max(meshes,key=lambda o:len(o.data.vertices));scene=bpy.context.scene
def evaluated(obj,transform):
 ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());data=ev.to_mesh()
 pts=[transform@ev.matrix_world@v.co for v in data.vertices];faces=[tuple(p.vertices) for p in data.polygons];ev.to_mesh_clear();return pts,faces
report={}
for name,end in [('Blink',13),('Laugh',int(bpy.data.actions['Laugh'].frame_range[1]))]:
 action=bpy.data.actions[name];rig.animation_data.action=action if name=='Laugh' else bpy.data.actions['Idle']
 for obj in meshes:
  sk=obj.data.shape_keys;sk.animation_data.action=action;sk.animation_data.action_slot=next(s for s in action.slots if s.target_id_type=='KEY' and s.name_display==sk.name)
 minima={obj.name:1 for obj in meshes if obj!=main};checked=0
 for f in [1+i*.5 for i in range((end-1)*2+1)]:
  scene.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update()
  b=rig.data.bones['face'];deform=rig.matrix_world@rig.pose.bones['face'].matrix@b.matrix_local.inverted()@rig.matrix_world.inverted()
  transform=main.matrix_world.inverted()@deform.inverted();pts,faces=evaluated(main,transform);tree=BVHTree.FromPolygons(pts,faces)
  for obj in meshes:
   if obj==main:continue
   if main.get('mouth_topology_version') and obj.name in ['Frog laugh tongue','Frog laugh teeth']:continue
   keys=obj.data.shape_keys.key_blocks
   amount=sum(k.value for k in keys if k.name!='Basis')
   if amount<.01:continue
   verts,polys=evaluated(obj,transform)
   for ids in polys:
    if len(ids)!=3:continue
    a,b,c=[verts[i] for i in ids]
    if (b-a).cross(c-a).length<1e-10:continue
    for p in [a,b,c,(a+b+c)/3,(a+b)/2,(b+c)/2,(c+a)/2]:
     hit=tree.ray_cast(Vector((p.x,-1,p.z)),Vector((0,1,0)),2)[0]
     assert hit is not None,(name,f,obj.name,'surface missed')
     distance=hit.y-p.y;minima[obj.name]=min(minima[obj.name],distance);checked+=1
     assert distance>-.00005,(name,f,obj.name,'skin penetration',distance)
  # Tongue must also remain in front of the mouth's visible interior surface.
  if name=='Laugh' and not main.get('mouth_topology_version'):
   tongue=bpy.data.objects['Frog laugh tongue'];mouth=bpy.data.objects['Frog mouth interior']
   if sum(k.value for k in tongue.data.shape_keys.key_blocks if k.name!='Basis')>.02:
    mv,mf=evaluated(mouth,transform);mt=BVHTree.FromPolygons(mv,mf);tv,tf=evaluated(tongue,transform)
    for p in tv:
     hit=mt.ray_cast(Vector((p.x,-1,p.z)),Vector((0,1,0)),2)[0]
     if hit:assert hit.y-p.y>-.00005,(name,f,'tongue occluded by mouth',hit.y-p.y)
 report[name]={'samples':(end-1)*2+1,'surface_points_checked':checked,'minimum_face_clearance':minima}
(root/'output/animations/face-surface-verification.json').write_text(json.dumps(report,indent=2));print('FACE_SURFACES_VALID',report)
