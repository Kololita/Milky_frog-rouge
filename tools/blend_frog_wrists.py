"""Spread wrist extension across its existing mesh rings instead of one crease."""
import bpy,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];source=root/'assets-source/blender/frog.blend';digest=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');mesh=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
if rig.get('wrist_weights_blended'):raise RuntimeError('Already blended')
for side in ['L','R']:
 wrist=rig.matrix_world@rig.data.bones['hand.'+side].head_local
 elbow=rig.matrix_world@rig.data.bones['forearm.'+side].head_local
 axis=(wrist-elbow).normalized()
 hand=mesh.vertex_groups['hand.'+side].index;forearm=mesh.vertex_groups['forearm.'+side].index
 core={g.index for g in mesh.vertex_groups if (g.name in ['hand.'+side,'forearm.'+side,'thumb.01.'+side] or g.name.startswith('palm.') and g.name.endswith('.'+side))}
 for v in mesh.data.vertices:
  weights={g.group:g.weight for g in v.groups if g.weight>1e-8}
  delta=mesh.matrix_world@v.co-wrist;t=delta.dot(axis)
  if not -.06<t<.085 or (delta-axis*t).length>.065:continue
  mass=sum(w for i,w in weights.items() if i in core)
  if mass<.15:continue
  start,end=(-.045,.035) if side=='L' else (-.01,.075)
  u=max(0,min(1,(t-start)/(end-start)));u=u*u*(3-2*u)
  weights={i:w for i,w in weights.items() if i not in core};weights[hand]=mass*u;weights[forearm]=mass*(1-u)
  keep=sorted(weights.items(),key=lambda p:p[1],reverse=True)[:4];total=sum(w for _,w in keep)
  for g in list(v.groups):mesh.vertex_groups[g.group].remove([v.index])
  for i,w in keep:
   if w>1e-8:mesh.vertex_groups[i].add([v.index],w/total,'REPLACE')
rig['wrist_weights_blended']=True
assert hashlib.sha256(source.read_bytes()).hexdigest()==digest
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(source));print('WRISTS_BLENDED')
