import bpy,math,shutil
from pathlib import Path
from mathutils import Vector as V,Quaternion
root=Path.cwd();src=root/'assets-source/blender/sarumai.blend';bpy.ops.wm.open_mainfile(filepath=str(src));r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rest=r.data.bones['blade'];edge=V(rest['cutting_edge_rest'])
for name in ['CrossLeft','CrossRight','Overhead','BuriedOverhead','Rising','RisingLeft','RisingRight','RoundSweep']:
 a=bpy.data.actions[name];r.animation_data.action=a;r.animation_data.action_slot=a.slots[0];end=float(a.frame_range[1]);qs=[];angles={}
 def pose(f):bpy.context.scene.frame_set(int(f),subframe=f%1);return r.pose.bones['blade'].matrix.copy()
 for k in range(121):pose(k/120*end);qs.append(r.pose.bones['blade'].rotation_quaternion.copy())
 previous=None
 for k in range(54,85):
  f=k/120*end;before=pose(f-.02);after=pose(f+.02);m=pose(f);axis=(m.to_3x3()@V((0,1,0))).normalized();velocity=(after@V((0,.8,0))-before@V((0,.8,0)));velocity-=axis*velocity.dot(axis);cut=(m@rest.matrix_local.inverted()).to_3x3()@edge;cut-=axis*cut.dot(axis)
  if velocity.length<1e-8:angle=previous or 0
  else:
   velocity.normalize();cut.normalize();angle=math.atan2(axis.dot(cut.cross(velocity)),cut.dot(velocity))
  if previous is not None:
   while angle-previous>math.pi:angle-=math.tau
   while angle-previous<-math.pi:angle+=math.tau
  angles[k]=angle;previous=angle
 for k in range(121):
  u=k/120
  if k<54:
   w=u/.45;value=angles[54]*w*w*(3-2*w)
  elif k>84:
   w=(u-.7)/.3;value=angles[84]*(1-w*w*(3-2*w))if name!='BuriedOverhead'else angles[84]
  else:value=angles[k]
  b=r.pose.bones['blade'];b.rotation_quaternion=qs[k]@Quaternion(V((0,1,0)),value);b.keyframe_insert(data_path='rotation_quaternion',frame=k/120*end,group='blade')
 print('ACTIVE_EDGE_ALIGNED',name)
r.animation_data.action=bpy.data.actions['Idle'];r.animation_data.action_slot=r.animation_data.action.slots[0];bpy.context.scene.frame_set(0);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));shutil.copy2(src,root/'assets-source/blender/rigged/sarumai.blend')
