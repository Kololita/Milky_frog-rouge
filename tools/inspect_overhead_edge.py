import bpy,math
from pathlib import Path
from mathutils import Vector as V
bpy.ops.wm.open_mainfile(filepath=str(Path.cwd()/'assets-source/blender/sarumai.blend'));r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rest=r.data.bones['blade'];a=bpy.data.actions['Overhead'];r.animation_data.action=a;r.animation_data.action_slot=a.slots[0];end=float(a.frame_range[1])
def sample(p):
 f=p*end;bpy.context.scene.frame_set(int(f),subframe=f%1);return r.pose.bones['blade'].matrix.copy()
for k in range(51,69):
 p=k/100;before=sample(p-.003);after=sample(p+.003);m=sample(p);axis=(m.to_3x3()@V((0,1,0))).normalized();v=after@V((0,.8,0))-before@V((0,.8,0));v-=axis*v.dot(axis);v.normalize();edge=(m@rest.matrix_local.inverted()).to_3x3()@V(rest['cutting_edge_rest']);print(k,edge.normalized().dot(v))
