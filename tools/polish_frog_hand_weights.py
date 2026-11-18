"""Localize finger hinges and bake the same four influences glTF will use."""
import bpy,hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[1];source=root/'assets-source/blender/frog.blend';digest=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');mesh=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
if rig.get('finger_weights_localized'):raise RuntimeError('Already localized')
changed=0
for side,prefixes in [('L',['f_index','f_ring','f_pinky']),('R',['f_index','f_middle','f_ring'])]:
 wrist=rig.matrix_world@rig.data.bones['hand.'+side].head_local
 first=rig.matrix_world@rig.data.bones['f_index.01.'+side].head_local
 outer=rig.matrix_world@rig.data.bones[('f_pinky.01.' if side=='L' else 'f_ring.01.')+side].head_local
 forward=((first+outer)*.5-wrist).normalized()
 related={g.index:g.name for g in mesh.vertex_groups if g.name.endswith('.'+side) and g.name.startswith(('hand.','palm.','f_','thumb.'))}
 hand=mesh.vertex_groups['hand.'+side].index
 thresholds={prefix:(rig.matrix_world@rig.data.bones[prefix+'.01.'+side].head_local-wrist).dot(forward) for prefix in prefixes}
 for v in mesh.data.vertices:
  weights={g.group:g.weight for g in v.groups if g.weight>1e-8}
  if sum(w for i,w in weights.items() if i in related)<.08:continue
  along=(mesh.matrix_world@v.co-wrist).dot(forward)
  for prefix,base in thresholds.items():
   u=max(0,min(1,(along-base+.018)/.022));mask=u*u*(3-2*u)
   for i in list(weights):
    if related.get(i,'').startswith(prefix+'.'):
     removed=weights[i]*(1-mask);weights[i]-=removed;weights[hand]=weights.get(hand,0)+removed
  largest=sorted(weights.items(),key=lambda item:item[1],reverse=True)[:4];total=sum(w for _,w in largest)
  for g in list(v.groups):mesh.vertex_groups[g.group].remove([v.index])
  for i,w in largest:
   if w>1e-8:mesh.vertex_groups[i].add([v.index],w/total,'REPLACE')
  changed+=1
rig['finger_weights_localized']=True
assert hashlib.sha256(source.read_bytes()).hexdigest()==digest
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(source))
(root/'output/animations/hand-weight-polish.json').write_text(json.dumps({'hand_vertices':changed,'maximum_influences':4,'proximal_finger_influence_transferred_to_hand':True},indent=2))
print('HAND_WEIGHTS_POLISHED',changed)
