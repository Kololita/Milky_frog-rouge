import bpy,json
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path.cwd()/'assets-source/blender/sarumai.blend'));r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for n in ['forearm_L','hand_L','finger_L_0_0','finger_L_0_1','finger_L_1_0','blade']:
 b=r.data.bones[n];print(n,list(b.head_local),list(b.tail_local))
o=bpy.data.objects['samurai_blade'];axis=(r.data.bones['blade'].tail_local-r.data.bones['blade'].head_local).normalized();p=r.data.bones['blade'].head_local
# Width direction from PCA in the middle blade section.
from mathutils import Vector as V
import numpy as np
ps=np.array([list(v.co-p-axis*(v.co-p).dot(axis))for v in o.data.vertices if .3<(v.co-p).dot(axis)<1.1]);val,vec=np.linalg.eigh(ps.T@ps);print('BLADE_CROSS_AXES',val.tolist(),vec[:,-1].tolist());print('MESHES',[(x.name,len(x.data.vertices))for x in bpy.context.scene.objects if x.type=='MESH'])
