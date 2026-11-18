import bpy,json
from pathlib import Path
p=Path.cwd();bpy.ops.wm.open_mainfile(filepath=str(p/'assets-source/blender/sarumai.blend'))
r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');r.data.pose_position='REST'
for o in bpy.context.scene.objects:
 if o.type!='MESH':continue
 print('MESH',o.name,len(o.data.vertices),[(m.name if m else '')for m in o.data.materials],list(o.matrix_world.translation))
 print('BOUNDS',[(min(v.co[i]for v in o.data.vertices),max(v.co[i]for v in o.data.vertices))for i in range(3)])
print('BONES',[(b.name,list(b.head_local),list(b.tail_local),b.parent.name if b.parent else '')for b in r.data.bones if 'hand' in b.name or 'finger_R' in b.name or b.name=='blade'])
