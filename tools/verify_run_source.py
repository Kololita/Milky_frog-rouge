"""Protect the model and other clips; compare old/new arm ranges and leg phases."""
import bpy, math, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def snapshot(path):
 bpy.ops.wm.open_mainfile(filepath=str(path))
 rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 def curves(a):return sorted([(c.data_path,c.array_index,[(tuple(p.co),p.interpolation) for p in c.keyframe_points]) for l in a.layers for s in l.strips for bag in s.channelbags for c in bag.fcurves],key=str)
 meshes={o.name:([tuple(v.co) for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons],[[(g.group,g.weight) for g in v.groups] for v in o.data.vertices]) for o in bpy.context.scene.objects if o.type=='MESH'}
 preserved={'meshes':meshes,'bones':[(b.name,tuple(b.head_local),tuple(b.tail_local),tuple(b.matrix_local.to_quaternion()),b.parent.name if b.parent else None) for b in rig.data.bones], 'other_actions':{a.name:curves(a) for a in bpy.data.actions if a.name!='Run'}}
 action=bpy.data.actions['Run'];rig.animation_data.action=action;end=action.frame_range[1];samples=[]
 point=lambda n:rig.matrix_world@rig.pose.bones[n].head
 for i in range(121):
  frame=1+(end-1)*i/120;bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()
  samples.append({n:list(point(n)) for n in ['spine','foot.L','foot.R','hand.L','hand.R','shin.L','shin.R']})
 return preserved,{'duration':(end-1)/24,'samples':samples}
before,old=snapshot(root/'output/animations/_before-run-stride.blend')
after,new=snapshot(root/'assets-source/blender/frog.blend')
for key in before:assert before[key]==after[key],f'Unrelated {key} changed'
assert new['duration']<=old['duration']/1.19
ranges=lambda data:{s:max(p['hand.'+s][1] for p in data['samples'])-min(p['hand.'+s][1] for p in data['samples']) for s in ['L','R']}
old_arms,new_arms=ranges(old),ranges(new)
for side in ['L','R']:
 assert new_arms[side]>old_arms[side]*1.35,(side,'Arm swing did not increase',old_arms,new_arms)
 shift=0 if side=='L' else .5
 def sample(phase):return new['samples'][round(((phase-shift)%1)*120)]
 contact,push,recovery,advance=map(sample,[0,.30,.55,.90])
 assert push['foot.'+side][1]>contact['foot.'+side][1]+.24,'Missing forward-to-back support stride'
 assert recovery['foot.'+side][2]>push['foot.'+side][2]+.045,'Heel did not lift after pushing off'
 assert advance['foot.'+side][1]<recovery['foot.'+side][1]-.18,'Recovering foot did not return forward'
assert new['samples'][0]['foot.L'][1]<new['samples'][0]['foot.R'][1]-.18
assert new['samples'][60]['foot.R'][1]<new['samples'][60]['foot.L'][1]-.18
report={'mesh_weights_rest_rig_other_clips_preserved':True,'old_duration':old['duration'],'new_duration':new['duration'],'speed_ratio':old['duration']/new['duration'],'old_arm_range':old_arms,'new_arm_range':new_arms,'phases':'front contact -> backward push -> lifted heel -> forward recovery','opposite_leg_phase':True}
(root/'output/animations/run-source-verification.json').write_text(json.dumps(report,indent=2));print('RUN_SOURCE_VERIFIED',json.dumps(report))
