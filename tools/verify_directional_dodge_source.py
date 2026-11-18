"""Check unrelated work is preserved and inspect the authored lateral foot sequence."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]

def snapshot(path):
 bpy.ops.wm.open_mainfile(filepath=str(path))
 rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 def curves(action):
  return sorted([(c.data_path,c.array_index,[(tuple(p.co),p.interpolation) for p in c.keyframe_points]) for l in action.layers for s in l.strips for b in s.channelbags for c in b.fcurves],key=str)
 meshes={o.name:{'vertices':[tuple(v.co) for v in o.data.vertices],'faces':[tuple(p.vertices) for p in o.data.polygons],'weights':[[(g.group,g.weight) for g in v.groups] for v in o.data.vertices]} for o in bpy.context.scene.objects if o.type=='MESH'}
 return {'meshes':meshes,'bones':[(b.name,tuple(b.head_local),tuple(b.tail_local),b.roll if hasattr(b,'roll') else tuple(b.matrix_local.to_quaternion()),b.parent.name if b.parent else None) for b in rig.data.bones],
         'actions':{a.name:curves(a) for a in bpy.data.actions if not a.name.startswith('Dodge')}}

before=snapshot(root/'output/animations/_before-directional-dodge.blend')
after=snapshot(root/'assets-source/blender/frog.blend')
for key in before: assert before[key]==after[key],f'Unrelated {key} changed'
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');scene=bpy.context.scene
point=lambda n:rig.matrix_world@rig.pose.bones[n].head
report={'mesh_weights_rig_other_animations_preserved':True,'sideSteps':{}}
for side in ['L','R']:
 name='DodgeSide'+side;other='R' if side=='L' else 'L';rig.animation_data.action=bpy.data.actions[name]
 rows=[]
 for frame in [1,6,10,14,17,20,25]:
  scene.frame_set(frame);bpy.context.view_layer.update()
  rows.append({'frame':frame,'lead':list(point('foot.'+side)),'trail':list(point('foot.'+other)),'root':list(point('spine'))})
 final=rows[-1];contact=rows[3]
 assert abs(contact['lead'][2]-final['lead'][2])<.005,(side,'Leading foot has not landed',rows)
 assert contact['trail'][2]>final['trail'][2]+.015,(side,'Trailing foot should still be lifted',rows)
 assert abs(rows[5]['trail'][2]-final['trail'][2])<.006,(side,'Trailing foot has not landed',rows)
 assert abs(contact['lead'][0]-final['lead'][0])<.015,(side,'Leading foot not at target',rows)
 assert abs(final['root'][0]-rows[0]['root'][0])>1,(side,'Missing one body length of authored travel')
 report['sideSteps'][side]=rows
(root/'output/animations/directional-dodge-source-verification.json').write_text(json.dumps(report,indent=2))
print('DIRECTIONAL_DODGE_SOURCE_VERIFIED',json.dumps(report))
