import bpy,numpy as np,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
r=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(r/'assets-source/blender/frog.blend'));m=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));m.data.calc_loop_triangles();tris=list(m.data.loop_triangles);vs=[v.co for v in m.data.shape_keys.key_blocks['Basis'].data];tree=BVHTree.FromPolygons(vs,[t.vertices for t in tris],all_triangles=True);im=bpy.data.images['Frog_Low_CleanColor_2048'];px=np.array(im.pixels[:]).reshape(im.size[1],im.size[0],4);uv=m.data.uv_layers.active.data
result={}
for side,cx in [('L',.076),('R',-.074)]:
 pts=[]
 for x in np.linspace(cx-.05,cx+.05,121):
  for z in np.linspace(.925,1.025,121):
   hit,n,idx,d=tree.ray_cast(Vector((x,-1,z)),Vector((0,1,0)),2)
   if hit is None:continue
   tri=tris[idx];a,b,c=[np.array(vs[i]) for i in tri.vertices];q=np.linalg.lstsq(np.column_stack([b-a,c-a]),np.array(hit)-a,rcond=None)[0];tex=sum(np.array(uv[l].uv)*w for l,w in zip(tri.loops,[1-q.sum(),q[0],q[1]]));rgb=px[min(int(tex[1]*im.size[1]),im.size[1]-1),min(int(tex[0]*im.size[0]),im.size[0]-1),:3]
   if rgb[1]>rgb[0]*1.12 and rgb[1]>rgb[2]*1.2 and rgb[1]>.15:pts.append([x,z])
 a=np.array(pts);lo=a.min(axis=0);hi=a.max(axis=0);result[side]={'center':((lo+hi)/2).tolist(),'radii':((hi-lo)/2).tolist()};print(side,result[side])
(r/'output/animations/eye-boundaries.json').write_text(json.dumps(result,indent=2))
