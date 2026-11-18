import {Vector3,Quaternion} from 'three';
const ease=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
/** Visual-only elbow pulse, applied after the mixer and restored before its next update. */
export function createParryRecoil(model,owner){
  const upper=model.getObjectByName('upper_armR'),lower=model.getObjectByName('forearmR'),hand=model.getObjectByName('handR');
  const saved=new Map(),start=new Vector3(),end=new Vector3(),from=new Vector3(),to=new Vector3(),elbow=new Vector3(),wrist=new Vector3();
  const forward=new Vector3(),outward=new Vector3(),upperPosition=new Vector3(),delta=new Quaternion(),world=new Quaternion(),parent=new Quaternion(),handWorld=new Quaternion();
  let elapsed=1,weight=0,initial=0,applied=false;
  function prepare(){if(applied){for(const [bone,q] of saved)bone.quaternion.copy(q);upper.position.copy(upperPosition);applied=false;}}
  function aim(bone,child,target){
    bone.getWorldPosition(start);child.getWorldPosition(end);from.copy(end).sub(start).normalize();to.copy(target).sub(start).normalize();
    delta.setFromUnitVectors(from,to);bone.getWorldQuaternion(world);world.premultiply(delta);bone.parent.getWorldQuaternion(parent);
    bone.quaternion.copy(parent.invert().multiply(world));bone.updateWorldMatrix(false,true);
  }
  return {prepare,clear(){prepare();elapsed=1;weight=0;initial=0;},get weight(){return weight;},
    update(dt,events,allowed){
      if(events.some(e=>e.type==='blocked'&&e.grade==='perfect')){initial=weight;elapsed=0;}else elapsed+=dt;
      weight=elapsed<.075?initial+(1-initial)*ease(elapsed/.075):1-ease((elapsed-.075)/.20);
      if(!allowed||weight<=0||!upper||!lower||!hand)return;
      for(const bone of [upper,lower,hand]){if(!saved.has(bone))saved.set(bone,new Quaternion());saved.get(bone).copy(bone.quaternion);}
      owner.updateWorldMatrix(true,true);owner.getWorldQuaternion(parent);
      forward.set(0,0,1).applyQuaternion(parent);outward.set(-1,0,0).applyQuaternion(parent);
      lower.getWorldPosition(elbow);elbow.addScaledVector(forward,.16*weight).addScaledVector(outward,.10*weight);
      hand.getWorldPosition(wrist);wrist.addScaledVector(forward,.07*weight);hand.getWorldQuaternion(handWorld);
      // A small shoulder protraction makes the elbow drive forward rather than
      // simply rotating an already extended upper arm outward.
      upperPosition.copy(upper.position);upper.parent.getWorldQuaternion(parent);
      from.copy(forward).multiplyScalar(.075*weight).applyQuaternion(parent.invert());upper.position.add(from);upper.updateWorldMatrix(false,true);
      aim(upper,lower,elbow);aim(lower,hand,wrist);
      hand.parent.getWorldQuaternion(parent);hand.quaternion.copy(parent.invert().multiply(handWorld));applied=true;
    }};
}
