import bpy,math,json,shutil
from pathlib import Path
from mathutils import Vector as V,Quaternion
ROOT=Path.cwd();src=ROOT/'assets-source/blender/sarumai.blend';bpy.ops.wm.open_mainfile(filepath=str(src));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
# Calibrate the cutting edge from the original blade section; preserve its style.
# The thinner (+width) side is the cutting edge, not the thicker spine.
edge_rest=V((-.39807494,.06585597,-.91498597));blade_rest=rig.data.bones['blade'];blade_rest['cutting_edge_rest']=list(edge_rest)
edge_report={}
for name in ['CrossLeft','CrossRight','Overhead','BuriedOverhead','Rising','RisingLeft','RisingRight','RoundSweep']:
 action=bpy.data.actions[name];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
 contact=.62 if 'Overhead'in name else .59
 def blade_at(t):
  f=t*60;bpy.context.scene.frame_set(int(f),subframe=f%1);return rig.pose.bones['blade'].matrix.copy()
 before=blade_at(contact-.006);after=blade_at(contact+.006);at=blade_at(contact);local_axis=V((0,1,0));point=V((0,.8,0));velocity=(after@point-before@point).normalized();axis_world=(at.to_3x3()@local_axis).normalized();cut=(at@blade_rest.matrix_local.inverted()).to_3x3()@edge_rest;cut-=axis_world*cut.dot(axis_world);cut.normalize();velocity-=axis_world*velocity.dot(axis_world);velocity.normalize();roll=math.atan2(axis_world.dot(cut.cross(velocity)),cut.dot(velocity))
 for k in range(121):
  frame=k/2;bpy.context.scene.frame_set(int(frame),subframe=frame%1);b=rig.pose.bones['blade'];weight=smooth(min(1,(frame/60)/.4))*(1-smooth(max(0,min(1,(frame/60-.74)/.26))))
  if name=='BuriedOverhead':weight=smooth(min(1,(frame/60)/.4))
  b.rotation_quaternion=b.rotation_quaternion@Quaternion(V((0,1,0)),roll*weight);b.keyframe_insert(data_path='rotation_quaternion',frame=frame,group='blade')
 at=blade_at(contact);facing=((at@blade_rest.matrix_local.inverted()).to_3x3()@edge_rest).normalized().dot(velocity);edge_report[name]={'roll_degrees':math.degrees(roll),'edge_velocity_dot':facing};assert facing>.95,(name,facing)
(ROOT/'output/sarumai-cutting-edge-validation.json').write_text(json.dumps(edge_report,indent=2))
rig.animation_data.action=bpy.data.actions['Idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];bpy.context.scene.frame_set(0);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));shutil.copy2(src,ROOT/'assets-source/blender/rigged/sarumai.blend')
