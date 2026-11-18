import bpy,shutil,math
from pathlib import Path
from mathutils import Quaternion
root=Path(__file__).resolve().parents[1];src=root/'assets-source/blender/sarumai.blend';backup=root/'assets-source/blender/reference/sarumai-before-binding-repair.blend'
if not backup.exists():shutil.copy2(src,backup)
bpy.ops.wm.open_mainfile(filepath=str(backup));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');bpy.context.view_layer.objects.active=rig;rig.data.pose_position='POSE'
# Old world-space rebakes contain per-joint translations that bypass the edited rest skeleton.
actions=list(bpy.data.actions);samples={}
for a in actions:
 rig.animation_data.action=a
 if a.slots:rig.animation_data.action_slot=a.slots[0]
 frames=[]
 for frame in range(61):
  bpy.context.scene.frame_set(frame);frames.append({b.name:b.rotation_quaternion.copy()for b in rig.pose.bones})
 samples[a.name]=frames
rig.animation_data_clear()
for b in rig.pose.bones:b.location=(0,0,0);b.rotation_quaternion=Quaternion();b.scale=(1,1,1)
bpy.context.view_layer.update()
# Rebind body skin against the edited rest skeleton. Rigid sword and scabbard stay rigid.
for mesh in [o for o in bpy.data.objects if o.type=='MESH' and 'blade'not in o.name and 'scabbard'not in o.name]:
 bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
 original=[{mesh.vertex_groups[g.group].name:g.weight for g in v.groups}for v in mesh.data.vertices]
 mesh.vertex_groups.clear();bpy.ops.object.parent_set(type='ARMATURE_AUTO')
 groups={g.name:g for g in mesh.vertex_groups}
 for v,old in zip(mesh.data.vertices,original):
  if not v.groups:
   for n,w in old.items():
    if n not in groups:groups[n]=mesh.vertex_groups.new(name=n)
    groups[n].add([v.index],w,'REPLACE')
 mods=[m for m in mesh.modifiers if m.type=='ARMATURE']
 for m in mods[1:]:mesh.modifiers.remove(m)
for a in actions:bpy.data.actions.remove(a)
for name,frames in samples.items():
 a=bpy.data.actions.new(name);a.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=a
 for frame,poses in enumerate(frames):
  for b in rig.pose.bones:
   b.rotation_mode='QUATERNION';b.location=(0,0,0);b.scale=(1,1,1)
   b.rotation_quaternion=Quaternion()if b.name.startswith('finger')or b.name in ['blade','scabbard'] else poses[b.name]
   for prop in ['rotation_quaternion','location','scale']:b.keyframe_insert(data_path=prop,frame=frame,group=b.name)
rig.data.pose_position='REST';bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(src));print('REST_BINDING_REPAIRED',len(samples))
