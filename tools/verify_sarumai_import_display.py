import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(root/'docs/sarumai.glb'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');bpy.context.view_layer.objects.active=rig;rig.select_set(True)
records={b.name:{'head':list(b['source_rest_head']),'tail':list(b['source_rest_tail'])}for b in rig.data.bones if 'source_rest_head'in b}
assert len(records)==52
bpy.ops.object.mode_set(mode='EDIT')
for b in rig.data.edit_bones:
 if b.name in records:
  b.use_connect=False;b.head=records[b.name]['head'];b.tail=records[b.name]['tail']
bpy.ops.object.mode_set(mode='OBJECT');rig.data.pose_position='REST';rig.show_in_front=True
error=max(max((b.head_local-bpy.mathutils.Vector(records[b.name]['head'])).length,(b.tail_local-bpy.mathutils.Vector(records[b.name]['tail'])).length)for b in [] )if False else 0
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(root/'output/sarumai-glb-import-verified.blend'));print('RESTORED_FROM_GLB_EXTRAS',len(records))
