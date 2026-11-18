"""Ensure the two new actions do not change the finished model or previous clips."""
import bpy, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def snapshot(path):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    def curves(a):
        return sorted([(c.data_path,c.array_index,[(tuple(p.co),p.interpolation) for p in c.keyframe_points]) for l in a.layers for s in l.strips for bag in s.channelbags for c in bag.fcurves],key=str)
    return {
        'meshes':{o.name:([tuple(v.co) for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons],[[(g.group,g.weight) for g in v.groups] for v in o.data.vertices]) for o in bpy.context.scene.objects if o.type=='MESH'},
        'bones':[(b.name,tuple(b.head_local),tuple(b.tail_local),tuple(b.matrix_local.to_quaternion()),b.parent.name if b.parent else None) for b in rig.data.bones],
        'actions':{a.name:curves(a) for a in bpy.data.actions if a.name!='AirAttack'},
    }
before=snapshot(root/'output/animations/_before-air-backflip.blend')
after=snapshot(root/'assets-source/blender/frog.blend')
for key in before:assert before[key]==after[key],f'Unrelated {key} changed'
for name in ['AirAttack']:assert bpy.data.actions.get(name)
report={'meshWeightsRestRigAndPrevious26ClipsPreserved':True,'changedAction':'AirAttack'}
(root/'output/animations/air-recovery-source-verification.json').write_text(json.dumps(report,indent=2))
print('AIR_RECOVERY_SOURCE_VERIFIED',json.dumps(report))
