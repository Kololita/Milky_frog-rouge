import bpy
# Run after importing sarumai.glb to restore Blender's source bone display.
for rig in [o for o in bpy.context.scene.objects if o.type=='ARMATURE']:
 bpy.context.view_layer.objects.active=rig
 bpy.ops.object.mode_set(mode='EDIT')
 for b in rig.data.edit_bones:
  original=rig.data.bones.get(b.name)
  if original and 'source_rest_head'in original:
   b.use_connect=False;b.head=original['source_rest_head'];b.tail=original['source_rest_tail']
 bpy.ops.object.mode_set(mode='OBJECT')
