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
        'actions':{a.name:curves(a) for a in bpy.data.actions if a.name not in ['Laugh']},
    }
before=snapshot(root/'output/animations/_before-laugh-stability.blend')
after=snapshot(root/'assets-source/blender/frog.blend')
changes={}
for name,(verts,polys,weights) in before['meshes'].items():
 new_verts,new_polys,new_weights=after['meshes'][name]
 assert polys==new_polys and weights==new_weights,f'{name} topology or weights changed'
 maximum=max((sum((a-b)**2 for a,b in zip(v,w))**.5 for v,w in zip(verts,new_verts)),default=0)
 if maximum:changes[name]=maximum
for key in ['bones','actions']:assert before[key]==after[key],f'Unrelated {key} changed'
print('SURFACE_CORRECTIONS',json.dumps(changes))
assert all(name.startswith('Frog eyelid') and delta<1e-6 for name,delta in changes.items()),changes
for name in ['Laugh']:assert bpy.data.actions.get(name)
report={'bodyMeshWeightsRestRigAndOther26ClipsPreserved':True,'changedActions':['Laugh'],'eyelidClearanceCorrections':changes}
(root/'output/animations/laugh-stability-source-verification.json').write_text(json.dumps(report,indent=2))
print('PUSH_CONTACT_SOURCE_VERIFIED',json.dumps(report))
