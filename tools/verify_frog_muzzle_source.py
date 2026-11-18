"""Compare the fitted source with its backup; limit geometry changes to the muzzle."""
import bpy,json,hashlib,sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'tools'))
def snapshot(path):
 bpy.ops.wm.open_mainfile(filepath=str(path));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 meshes={o.name:{'co':[tuple(v.co) for v in o.data.vertices],'polys':[tuple(p.vertices) for p in o.data.polygons],'weights':[[(g.group,g.weight) for g in v.groups] for v in o.data.vertices],'keys':{k.name:[tuple(v.co) for v in k.data] for k in o.data.shape_keys.key_blocks} if o.data.shape_keys else {}} for o in bpy.context.scene.objects if o.type=='MESH'}
 actions=hashlib.sha256(repr([(a.name,[(c.data_path,c.array_index,[(tuple(k.co),k.interpolation,tuple(k.handle_left),tuple(k.handle_right)) for k in c.keyframe_points]) for l in a.layers for s in l.strips for b in s.channelbags for c in b.fcurves]) for a in sorted(bpy.data.actions,key=lambda a:a.name)]).encode()).hexdigest()
 return meshes,actions,[(b.name,tuple(b.head_local),tuple(b.tail_local),tuple(b.matrix_local.to_quaternion()),b.parent.name if b.parent else None) for b in rig.data.bones]
a,aa,ar=snapshot(root/'output/animations/_before-protruding-mouth.blend');b,ba,br=snapshot(root/'assets-source/blender/frog.blend');assert aa==ba and ar==br
report={};main=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
for name,old in a.items():
 new=b[name];assert old['polys']==new['polys'] and old['weights']==new['weights']
 delta=[Vector(q)-Vector(p) for p,q in zip(old['co'],new['co'])];changed=[i for i,d in enumerate(delta) if d.length>1e-8]
 assert not changed or name in [main.name,'Frog laugh teeth','Frog laugh tongue']
 for i in changed:
  assert abs(delta[i].x)<1e-7 and abs(delta[i].z)<1e-7
  if name==main.name:
   x,y,z=old['co'][i];assert abs(x-.001)<.108 and .831<z<.942 and y<.325
   assert -.02601<delta[i].y<0
 for key,points in old['keys'].items():
  for i,(p,q) in enumerate(zip(points,new['keys'][key])):assert (Vector(q)-Vector(p)-delta[i]).length<1e-7,(name,key,i,'changed morph motion')
 report[name]={'changedVertices':len(changed),'maxOffset':max((d.length for d in delta),default=0)}
# Regenerating mouth helpers must neither remove nor apply the muzzle twice.
from frog_mouth import ensure_true_mouth
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');before={o.name:[[v.co.copy() for v in k.data] for k in o.data.shape_keys.key_blocks] for o in bpy.context.scene.objects if o.type=='MESH' and o.data.shape_keys}
ensure_true_mouth(main,rig);error=0
for name,keys in before.items():
 for old,key in zip(keys,bpy.data.objects[name].data.shape_keys.key_blocks):
  error=max(error,max(((v.co-p).length for v,p in zip(key.data,old)),default=0))
assert error<1e-7,('Muzzle regeneration changed coordinates',error)
result={'parts':report,'topologyWeightsAndRestBonesPreserved':True,'all27AnimationCurvesPreserved':True,'allMorphDisplacementsPreserved':True,'eyesAndRemainingHeadUnchanged':True,'mouthRegenerationMaximumError':error}
(root/'output/animations/muzzle-source-verification.json').write_text(json.dumps(result,indent=2));print('MUZZLE_SOURCE_VERIFIED',json.dumps(result))
