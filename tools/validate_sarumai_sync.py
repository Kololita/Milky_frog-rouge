import bpy,json,hashlib,math
from pathlib import Path
from mathutils import Vector
root=Path.cwd()
def capture():
 rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rig.data.pose_position='POSE';result={'rest':{b.name:list(rig.matrix_world@b.head_local)for b in rig.data.bones},'poses':{}}
 if rig.animation_data:
  for t in rig.animation_data.nla_tracks:t.mute=True
 for action in bpy.data.actions:
  if action.name not in ['Idle','Walk','Hurt','Death','CrossLeft','CrossRight','Overhead','Rising','RisingLeft','RisingRight','ShortThrust','LongThrust','RoundSweep','BuriedOverhead','Extract','DoubleLeft','DoubleRight','Backstep','CounterThrust','PhaseShift']:continue
  rig.animation_data.action=action
  if action.slots:rig.animation_data.action_slot=action.slots[0]
  out=[]
  for seconds in [0,.25,.5,1,1.5,2]:
   frame=seconds*bpy.context.scene.render.fps;bpy.context.scene.frame_set(int(frame),subframe=frame%1);bpy.context.view_layer.update();out.append({b.name:list(rig.matrix_world@b.head)for b in rig.pose.bones})
  result['poses'][action.name]=out
 return result
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/sarumai.blend'));a=capture();fps=bpy.context.scene.render.fps
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=fps;bpy.ops.import_scene.gltf(filepath=str(root/'docs/sarumai.glb'));b=capture()
rest=max((Vector(v)-Vector(b['rest'][n])).length for n,v in a['rest'].items());errors={}
for name,frames in a['poses'].items():errors[name]=max((Vector(v)-Vector(b['poses'][name][i][n])).length for i,f in enumerate(frames)for n,v in f.items())
report={'bones':len(a['rest']),'rest_max_error':rest,'action_joint_max_errors':errors,'same_export':len({hashlib.sha256((root/p).read_bytes()).hexdigest()for p in ['docs/sarumai.glb','public/models/enemies/sarumai.glb','public/models/enemies/samurai.glb']})==1}
(root/'output/sarumai-sync-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report));assert rest<1e-5;assert max(errors.values())<1e-4;assert report['same_export']
