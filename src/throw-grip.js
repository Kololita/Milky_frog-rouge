import {Vector3,Quaternion} from 'three';
const ease=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
export const throwGripWeight=elapsed=>ease(elapsed/.18)*(1-ease((elapsed-.8)/.18));
/** Closed-form two-bone grips, with fixed outward elbow planes (no iterative jitter). */
export function createThrowGrip(model,owner){
 const arms=['L','R'].map(side=>({upper:model.getObjectByName(`upper_arm${side}`),lower:model.getObjectByName(`forearm${side}`),hand:model.getObjectByName(`hand${side}`)}));
 const saved=new Map();let applied=false;
 const a=new Vector3(),b=new Vector3(),c=new Vector3(),target=new Vector3(),axis=new Vector3(),guide=new Vector3(),elbow=new Vector3();
 const start=new Vector3(),end=new Vector3(),from=new Vector3(),to=new Vector3(),delta=new Quaternion(),world=new Quaternion(),parent=new Quaternion();
 const xAxis=new Vector3(1,0,0),yAxis=new Vector3(0,1,0),upperQ=new Quaternion(),lowerQ=new Quaternion(),inverseOwner=new Quaternion();
 function prepare(){if(applied){for(const [bone,q] of saved)bone.quaternion.copy(q);applied=false;}}
 function aim(bone,child,point){
  bone.getWorldPosition(start);child.getWorldPosition(end);from.copy(end).sub(start).normalize();to.copy(point).sub(start).normalize();
  delta.setFromUnitVectors(from,to);bone.getWorldQuaternion(world);world.premultiply(delta);bone.parent.getWorldQuaternion(parent);
  bone.quaternion.copy(parent.invert().multiply(world));bone.updateWorldMatrix(false,true);
 }
 return {prepare,apply(state){
  if(!state)return;const weight=throwGripWeight(state.elapsed);if(weight<=0)return;
  const pose=state.sample.enemy;
  for(const {upper,lower,hand} of arms){
   if(!upper||!lower||!hand)continue;upper.updateWorldMatrix(true,true);
   upper.getWorldPosition(a);lower.getWorldPosition(b);hand.getWorldPosition(c);
   const scale=state.targetScale??1;
   // Use the side of the shoulder in the owner's frame, including the half turn.
   owner.getWorldQuaternion(parent);guide.copy(a).sub(owner.position).applyQuaternion(inverseOwner.copy(parent).invert());
   const sign=guide.x>=0?1:-1;
   target.set(sign*.26*scale,0,-.26*scale).applyAxisAngle(xAxis,pose.pitch).applyAxisAngle(yAxis,pose.heading);
   target.x+=pose.x;target.y+=pose.center;target.z+=pose.z;
   const l1=a.distanceTo(b),l2=b.distanceTo(c),d=Math.max(.02,Math.min((l1+l2)*.985,a.distanceTo(target)));
   axis.copy(target).sub(a).normalize();target.copy(a).addScaledVector(axis,d);
   guide.set(sign,0,-.2).applyQuaternion(parent);guide.addScaledVector(axis,-guide.dot(axis));
   if(guide.lengthSq()<1e-6)guide.set(0,0,1);guide.normalize();
   const projection=(l1*l1-l2*l2+d*d)/(2*d),bend=Math.sqrt(Math.max(0,l1*l1-projection*projection));
   elbow.copy(a).addScaledVector(axis,projection).addScaledVector(guide,bend);
   for(const bone of [upper,lower]){if(!saved.has(bone))saved.set(bone,new Quaternion());saved.get(bone).copy(bone.quaternion);}
   aim(upper,lower,elbow);aim(lower,hand,target);upperQ.copy(upper.quaternion);lowerQ.copy(lower.quaternion);
   upper.quaternion.slerpQuaternions(saved.get(upper),upperQ,weight);lower.quaternion.slerpQuaternions(saved.get(lower),lowerQ,weight);
   upper.updateWorldMatrix(false,true);applied=true;
  }
 }};
}
