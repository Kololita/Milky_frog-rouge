"""Repair the right wrist/finger frames and preserve existing skin animation."""
import bpy, hashlib, json, numpy as np
from pathlib import Path
from mathutils import Matrix

root=Path(__file__).resolve().parents[1]
source=root/'assets-source/blender/frog.blend'
source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source))
if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
scene=bpy.context.scene
geometry=np.array([tuple(v.co) for v in mesh.data.vertices])
mapping={'hand.R':'hand.L','palm.01.R':'palm.01.L','palm.01.R.001':'palm.01.L','palm.02.R':'palm.03.L','palm.03.R':'palm.04.L'}
for digit,left in [('f_index','f_index'),('f_middle','f_ring'),('f_ring','f_pinky'),('thumb','thumb')]:
 for segment in ['01','02','03']:mapping[f'{digit}.{segment}.R']=f'{left}.{segment}.L'
affected=[p.name for p in rig.pose.bones if p.name=='hand.R' or any(b.name=='hand.R' for b in p.bone.parent_recursive)]
affected.sort(key=lambda name:len(rig.data.bones[name].parent_recursive))
old_rest={name:rig.data.bones[name].matrix_local.copy() for name in affected}
bone_snapshot={b.name:(tuple(b.head_local),tuple(b.tail_local),tuple(b.matrix_local.to_quaternion()),b.parent.name if b.parent else None) for b in rig.data.bones}

def vertices():
 bpy.context.view_layer.update()
 obj=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=obj.to_mesh()
 result=np.array([tuple(obj.matrix_world@v.co) for v in data.vertices])
 obj.to_mesh_clear();return result

# Cache the existing deformation, including actions edited by the user.
cache={}
for action in list(bpy.data.actions):
 rig.animation_data.action=action
 start,end=map(lambda x:int(round(x)),action.frame_range)
 samples=[]
 for frame in range(start,end+1):
  scene.frame_set(frame);bpy.context.view_layer.update()
  deform={name:rig.pose.bones[name].matrix@old_rest[name].inverted() for name in affected}
  samples.append((frame,deform,vertices()))
 cache[action.name]=samples

rig.animation_data.action=None
for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
reflect=rig.matrix_world.to_3x3().inverted()@Matrix.Diagonal((-1,1,1))@rig.matrix_world.to_3x3()
left=rig.data.edit_bones['hand.L'];right=rig.data.edit_bones['hand.R']
# Keep the wrist connection and all finger heads in place. Correct the skewed
# tail direction and match mirrored local roll axes across corresponding digits.
right.tail=right.head+reflect@(left.tail-left.head)
for name,left_name in mapping.items():
 rig.data.edit_bones[name].align_roll(reflect@rig.data.edit_bones[left_name].matrix.to_3x3().col[2])
bpy.ops.object.mode_set(mode='OBJECT')
new_rest={name:rig.data.bones[name].matrix_local.copy() for name in affected}
assert len(rig.data.bones)==141
for b in rig.data.bones:
 if b.name not in mapping:
  old=bone_snapshot[b.name]
  assert np.allclose(old[0],b.head_local,atol=1e-7) and np.allclose(old[1],b.tail_local,atol=1e-7),b.name
  assert old[3]==(b.parent.name if b.parent else None),b.name

# Rebase old actions onto the repaired rest frames, so the edit does not
# rotate pre-existing wave/belly-contact poses or alter the legs.
maximum_error=0
for name,samples in cache.items():
 rig.animation_data.action=bpy.data.actions[name]
 for frame,deform,old_vertices in samples:
  scene.frame_set(frame);bpy.context.view_layer.update()
  for bone in affected:
   p=rig.pose.bones[bone];p.rotation_mode='QUATERNION'
   p.matrix=deform[bone]@new_rest[bone]
   bpy.context.view_layer.update()
  maximum_error=max(maximum_error,float(np.max(np.linalg.norm(vertices()-old_vertices,axis=1))))
  for bone in affected:
   p=rig.pose.bones[bone]
   for channel in ['rotation_quaternion','location','scale']:p.keyframe_insert(data_path=channel,frame=frame,group=bone)
assert maximum_error<5e-5,maximum_error
assert np.array_equal(geometry,np.array([tuple(v.co) for v in mesh.data.vertices]))
assert hashlib.sha256(source.read_bytes()).hexdigest()==source_hash,'Source changed concurrently'
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(source))
report={'right_hand_bones_repaired':list(mapping),'wrist_head_and_finger_heads_preserved':True,'mesh_geometry_unchanged':True,'bone_count':141,'existing_actions_preserved':list(cache),'maximum_skin_preservation_error':maximum_error}
(root/'output/animations/hand-rig-repair.json').write_text(json.dumps(report,indent=2))
print('HAND_RIG_REPAIRED',json.dumps(report),flush=True)
