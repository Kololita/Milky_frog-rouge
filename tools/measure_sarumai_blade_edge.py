import bpy,numpy as np
from mathutils import Vector as V
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path.cwd()/'assets-source/blender/sarumai.blend'));r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');o=bpy.data.objects['samurai_blade'];b=r.data.bones['blade'];axis=(b.tail_local-b.head_local).normalized();ps=np.array([list(v.co-b.head_local-axis*(v.co-b.head_local).dot(axis))for v in o.data.vertices if .3<(v.co-b.head_local).dot(axis)<1.1]);ps-=ps.mean(axis=0);ev,vec=np.linalg.eigh(ps.T@ps);width=vec[:,-1];normal=np.cross(np.array(axis),width);w=ps@width;h=ps@normal
for sign in [-1,1]:
 ids=w*sign>max(w*sign)*.65;print('SIDE',sign,'width',np.max(w*sign),'thickness',float(np.ptp(h[ids])),'samples',int(ids.sum()))
print('WIDTH',width.tolist(),'NORMAL',normal.tolist())
