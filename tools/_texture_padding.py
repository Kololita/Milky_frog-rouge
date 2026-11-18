import bpy,numpy as np
from pathlib import Path
r=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(r/'assets-source/blender/frog.blend'));m=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));im=bpy.data.images['Frog_Low_CleanColor_2048'];w,h=im.size[:];a=np.array(im.pixels[:],dtype=np.float32).reshape(h,w,4);mask=np.zeros((h,w),bool);m.data.calc_loop_triangles();uv=m.data.uv_layers.active.data
for t in m.data.loop_triangles:
 if m.data.polygons[t.polygon_index].material_index!=0:continue
 p=np.array([uv[i].uv[:] for i in t.loops])*[w,h];lo=np.maximum(np.floor(p.min(0)).astype(int),0);hi=np.minimum(np.ceil(p.max(0)).astype(int),[w-1,h-1])
 if np.any(hi<lo):continue
 yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];q=np.stack([xx+.5,yy+.5],-1);cross=[]
 for i in range(3):
  v=p[(i+1)%3]-p[i];d=q-p[i];cross.append(v[0]*d[:,:,1]-v[1]*d[:,:,0])
 c=np.array(cross);mask[lo[1]:hi[1]+1,lo[0]:hi[0]+1]|=np.all(c>=-1e-5,0)|np.all(c<=1e-5,0)
np.save(r/'output/animations/_texture_pixels.npy',a);np.save(r/'output/animations/_uv_mask.npy',mask)
