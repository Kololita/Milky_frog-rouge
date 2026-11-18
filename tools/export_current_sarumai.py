import bpy,json,shutil,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets-source/blender/sarumai.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
expected={'Idle','Walk','Hurt','Death','CrossLeft','CrossRight','Overhead','Rising','RisingLeft','RisingRight','ShortThrust','LongThrust','RoundSweep','BuriedOverhead','Extract','DoubleLeft','DoubleRight','Backstep','CounterThrust','PhaseShift'}
assert expected.issubset({a.name for a in bpy.data.actions})
rig.data.pose_position='POSE'
for bone in rig.data.bones:
 bone['source_rest_head']=list(bone.head_local);bone['source_rest_tail']=list(bone.tail_local);bone['source_rest_roll_matrix']=[v for row in bone.matrix_local for v in row]
rig['source_blend']='assets-source/blender/sarumai.blend'
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in bpy.context.scene.objects:
 if o.type=='MESH':o.select_set(True)
output=root/'public/models/enemies/sarumai.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_leaf_bone=False,export_extras=True)
shutil.copy2(output,root/'public/models/enemies/samurai.glb')
shutil.copy2(output,root/'docs/sarumai.glb')
manifest={'source':'assets-source/blender/sarumai.blend','source_sha256':hashlib.sha256((root/'assets-source/blender/sarumai.blend').read_bytes()).hexdigest(),'glb_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bones':len(rig.data.bones),'animations':sorted(expected)}
(root/'output/sarumai-export-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('EXPORTED_CURRENT_BLEND',output,len(expected),'animations')
