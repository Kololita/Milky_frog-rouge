import bpy,shutil,math
from pathlib import Path
from mathutils import Matrix,Vector
root=Path(__file__).resolve().parents[1];src=root/'assets-source/blender/sarumai.blend';backup=root/'assets-source/blender/reference/sarumai-before-upper-mirror.blend'
if not backup.exists():shutil.copy2(src,backup)
bpy.ops.wm.open_mainfile(filepath=str(backup));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');bpy.context.view_layer.objects.active=rig
if rig.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
S=Matrix.Diagonal((-1,1,1,1));upper={b.name for b in rig.data.bones if b.name not in ['root','pelvis','scabbard'] and not b.name.startswith('leg_')}
# Capture existing authored poses before changing the rest skeleton.
rig.data.pose_position='POSE'
with bpy.data.libraries.load(str(root/'assets-source/blender/rigged/samurai.blend'),link=False) as (source,target):
 target.actions=[n for n in source.actions if n in ['RisingLeft','RisingRight'] and n not in bpy.data.actions]
actions=list(bpy.data.actions);samples={}
for track in rig.animation_data.nla_tracks:track.mute=True
for action in actions:
 rig.animation_data.action=action
 if action.slots:rig.animation_data.action_slot=action.slots[0]
 frames=[]
 for frame in range(61):
  bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();frames.append({b.name:b.matrix.copy()for b in rig.pose.bones})
 samples[action.name]=frames
rig.animation_data_clear();rig.data.pose_position='REST'
for obj in [o for o in bpy.data.objects if o.type=='MESH']:
 if 'scabbard' in obj.name:continue
 blade='blade' in obj.name
 for v in obj.data.vertices:
  if blade or v.co.z>=1.10:v.co.x=-v.co.x
 for poly in obj.data.polygons:
  if blade or all(obj.data.vertices[i].co.z>=1.10 for i in poly.vertices):poly.flip()
 obj.data.update()
bpy.ops.object.mode_set(mode='EDIT')
for b in rig.data.edit_bones:
 if b.name in upper:
  length=b.length;b.matrix=S@b.matrix@S;b.length=length
bpy.ops.object.mode_set(mode='OBJECT')
# Repair the sword hand's skin assignment using its newly placed finger segments.
def segment_distance(p,a,b):
 d=b-a;t=max(0,min(1,(p-a).dot(d)/max(1e-9,d.length_squared)));return (p-a-t*d).length
handbones=[b for b in rig.data.bones if b.name.startswith('finger_R_')or b.name=='hand_R']
for obj in [o for o in bpy.data.objects if o.type=='MESH' and 'blade'not in o.name and 'scabbard'not in o.name]:
 groups={g.name:g for g in obj.vertex_groups}
 for v in obj.data.vertices:
  if not(-.79<v.co.x<-.53 and -.26<v.co.y<-.08 and 1.1<v.co.z<1.37):continue
  nearest=sorted([(segment_distance(v.co,b.head_local,b.tail_local),b.name)for b in handbones])[:3]
  weights=[1/(d+.012)**3 for d,n in nearest];total=sum(weights)
  for g in obj.vertex_groups:g.remove([v.index])
  for (d,n),w in zip(nearest,weights):
   if n not in groups:groups[n]=obj.vertex_groups.new(name=n)
   groups[n].add([v.index],w/total,'REPLACE')
rig.data.pose_position='POSE'
for action in actions:bpy.data.actions.remove(action)
for name,frames in samples.items():
 action=bpy.data.actions.new(name);action.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=action
 for frame,poses in enumerate(frames):
  for b in rig.pose.bones:
   b.rotation_mode='QUATERNION';b.matrix=S@poses[b.name]@S if b.name in upper else poses[b.name];bpy.context.view_layer.update()
  if name in ['Overhead','BuriedOverhead','Extract','RisingLeft','RisingRight']:
   blade=rig.pose.bones['blade'];hand=rig.pose.bones['hand_L'];direction=(blade.tail-blade.head).normalized();target=blade.head-direction*.14;matrix=hand.matrix.copy();matrix.translation+=target-(matrix@Vector((0,.123,0)));hand.matrix=matrix;bpy.context.view_layer.update()
  for b in rig.pose.bones:
   for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(data_path=prop,frame=frame,group=b.name)
rig.show_in_front=True;rig.data.pose_position='REST';bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(src))
# Editable file stays in rest view; game export uses pose animation.
rig.data.pose_position='POSE';bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in bpy.data.objects:
 if o.type=='MESH':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'public/models/enemies/samurai.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_skins=True)
print('MIRRORED_UPPER_BODY; SCABBARD_UNCHANGED; ANIMATIONS_REBAKED')
