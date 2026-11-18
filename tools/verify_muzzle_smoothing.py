"""Verify a bounded mouth support edit, including regeneration and old animation data."""
import bpy,json,hashlib,sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'tools'))
def snap(path):
 bpy.ops.wm.open_mainfile(filepath=str(path));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');m=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
 meshes={o.name:{'co':[v.co.copy() for v in o.data.vertices],'faces':[(tuple(p.vertices),p.material_index) for p in o.data.polygons],'weights':[[(g.group,g.weight) for g in v.groups] for v in o.data.vertices],'keys':{k.name:[v.co.copy() for v in k.data] for k in o.data.shape_keys.key_blocks} if o.data.shape_keys else {}} for o in bpy.context.scene.objects if o.type=='MESH'}
 curves=hashlib.sha256(repr([(a.name,[(c.data_path,c.array_index,[(tuple(k.co),k.interpolation,tuple(k.handle_left),tuple(k.handle_right)) for k in c.keyframe_points]) for l in a.layers for s in l.strips for bag in s.channelbags for c in bag.fcurves]) for a in sorted(bpy.data.actions,key=lambda a:a.name)]).encode()).hexdigest()
 return meshes,curves,[(b.name,tuple(b.head_local),tuple(b.tail_local),tuple(b.matrix_local.to_quaternion()),b.parent.name if b.parent else None) for b in rig.data.bones],m.name
old,oc,ob,name=snap(root/'output/animations/_before-muzzle-smoothing.blend')
new,nc,nb,_=snap(root/'assets-source/blender/frog.blend');assert oc==nc and ob==nb
main=bpy.data.objects[name];a,b=old[name],new[name];count=len(a['co']);assert len(b['co'])==count+60
error=max((p-q).length for p,q in zip(a['co'],b['co']));assert error<1e-7,error
assert a['weights']==b['weights'][:count]
for key,pts in a['keys'].items():assert max((p-q).length for p,q in zip(pts,b['keys'][key]))<1e-7
boundary=set(json.loads(main['mouth_boundary_ids']));rim={i for i,c in zip(json.loads(main['mouth_vertex_ids']),json.loads(main['mouth_controls'])) if c[0]==4}
bridge=boundary|rim
untouched=[f for f in a['faces'] if not (set(f[0])<=bridge and bool(set(f[0])&boundary) and bool(set(f[0])&rim))]
assert len(a['faces'])-len(untouched)==30
assert set(untouched)<=set(b['faces'])
assert all(sum(w for _,w in v)>.999 for v in b['weights'][count:])
assert all(len(p)==4 for p,mat in b['faces'] if max(p)>=count)
assert len(b['faces'])==len(a['faces'])+60
for obj,previous in old.items():
 if obj in [name,'Frog laugh teeth','Frog laugh tongue']:continue
 assert previous==new[obj],obj
# Every old oral morph displacement must be unchanged by the new recess fit.
for obj in ['Frog laugh teeth','Frog laugh tongue']:
 for key,pts in old[obj]['keys'].items():
  assert max(((q-new[obj]['co'][i])-(p-old[obj]['co'][i])).length for i,(p,q) in enumerate(zip(pts,new[obj]['keys'][key])))<1e-7
from frog_mouth import ensure_true_mouth
before={o.name:[[v.co.copy() for v in k.data] for k in o.data.shape_keys.key_blocks] for o in bpy.context.scene.objects if o.type=='MESH' and o.data.shape_keys};rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');ensure_true_mouth(main,rig);regen=0
for obj,keys in before.items():
 for pts,k in zip(keys,bpy.data.objects[obj].data.shape_keys.key_blocks):regen=max(regen,max((v.co-p).length for v,p in zip(k.data,pts)))
assert regen<1e-7,regen
report={'addedMouthVertices':60,'addedExteriorQuads':60,'oldVertexMaximumChange':error,'oldMouthMorphsPreserved':True,'oldWeightsAndAllRestBonesPreserved':True,'all27ActionsPreserved':True,'bodyAndEyesUntouched':True,'regenerationMaximumError':regen,'vertices':len(b['co']),'faces':len(b['faces'])}
(root/'output/animations/muzzle-smooth-source-verification.json').write_text(json.dumps(report,indent=2));print('MOUTH_SMOOTH_VERIFIED',json.dumps(report))
