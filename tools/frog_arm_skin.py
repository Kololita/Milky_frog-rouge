"""Fast FK and linear skinning for evaluating palm fits without changing Blender."""
import numpy as np
from mathutils import Vector,Matrix

def arm_skin_predictor(rig,mesh,side,ids):
 rw,mw=rig.matrix_world,mesh.matrix_world
 upper,lower,hand=['upper_arm.'+side,'forearm.'+side,'hand.'+side]
 rest={b.name:rw@b.matrix_local for b in rig.data.bones}
 world={p.name:rw@p.matrix for p in rig.pose.bones}
 a=world[upper].translation.copy();hand_inverse=world[hand].inverted()
 finger_rel={n:hand_inverse@m for n,m in world.items() if n.endswith('.'+side) and n.startswith(('f_','thumb'))}
 relative_lower=rest[upper].inverted()@rest[lower];relative_hand=rest[lower].inverted()@rest[hand]
 lengths={n:(rw.to_3x3()@(rig.data.bones[n].tail_local-rig.data.bones[n].head_local)).length for n in [upper,lower]}
 ru=(rw.to_3x3()@(rig.data.bones[upper].tail_local-rig.data.bones[upper].head_local)).normalized()
 rv=(rw.to_3x3()@(rig.data.bones[lower].tail_local-rig.data.bones[lower].head_local)).normalized();rn=ru.cross(rv).normalized()
 sources={n:Matrix((v.cross(rn).normalized(),v,rn)).transposed().transposed()@rest[n].to_3x3().normalized() for n,v in [(upper,ru),(lower,rv)]}
 group_names={g.index:g.name for g in mesh.vertex_groups};changed={upper,lower,hand,*finger_rel}
 weighted={};fixed=np.zeros((len(ids),3))
 for j,i in enumerate(ids):
  v=mesh.data.vertices[i];co=mw@v.co
  total=sum(g.weight for g in v.groups if group_names[g.group] in rest and rig.data.bones[group_names[g.group]].use_deform)
  for g in v.groups:
   name=group_names[g.group]
   if name not in rest or not g.weight or not rig.data.bones[name].use_deform:continue
   weight=g.weight/total
   local=rest[name].inverted()@co
   if name in changed:
    weighted.setdefault(name,[]).append((j,tuple(local)+ (1,),weight))
   else:fixed[j]+=np.array(tuple(world[name]@local))*weight
 data={n:(np.array([v[0] for v in values]),np.array([v[1] for v in values])*np.array([v[2] for v in values])[:,None]) for n,values in weighted.items()}
 def predict(target,rotation,pole):
  delta=target-a;l1,l2=lengths[upper],lengths[lower]
  d=max(abs(l1-l2)+.001,min(delta.length,l1+l2-.002));axis=delta.normalized();bend=(pole-axis*pole.dot(axis)).normalized()
  along=(l1*l1-l2*l2+d*d)/(2*d);joint=a+axis*along+bend*max(0,l1*l1-along*along)**.5
  u,v=(joint-a).normalized(),(a+axis*d-joint).normalized();normal=u.cross(v).normalized()
  mats={}
  for n,direction in [(upper,u),(lower,v)]:
   dest=Matrix((direction.cross(normal).normalized(),direction,normal)).transposed()
   mat=(dest@sources[n]).to_4x4()@Matrix.Diagonal((*world[n].to_scale(),1))
   mat.translation=a if n==upper else mats[upper]@relative_lower.translation
   mats[n]=mat
  mat=rotation.to_matrix().to_4x4()@Matrix.Diagonal((*world[hand].to_scale(),1));mat.translation=mats[lower]@relative_hand.translation;mats[hand]=mat
  for n,relative in finger_rel.items():mats[n]=mat@relative
  result=fixed.copy()
  for name,(indices,local) in data.items():result[indices]+=local@np.array(mats[name])[:3,:].T
  predict.mats=mats
  return [Vector(p) for p in result]
 return predict
