import {Vector3,Quaternion} from 'three';
// Solve the support hand against the actual hilt, including torso and sword motion.
export function createBossGrip(shoulder,elbow,sword){
  const origin=new Vector3(),target=new Vector3(),direction=new Vector3(),bend=new Vector3(),joint=new Vector3(),end=new Vector3(),down=new Vector3(0,-1,0);
  const parentRotation=new Quaternion(),upperRotation=new Quaternion(),localRotation=new Quaternion(),baseUpper=new Quaternion(),baseLower=new Quaternion();
  return function update(weight=1){
    if(weight<=0)return;
    shoulder.updateWorldMatrix(true,true);sword.updateWorldMatrix(true,false);
    baseUpper.copy(shoulder.quaternion);baseLower.copy(elbow.quaternion);
    shoulder.getWorldPosition(origin);target.set(0,.65,0);sword.localToWorld(target);
    const scale=shoulder.getWorldScale(end).x,a=.30*scale,b=.26*scale;
    direction.subVectors(target,origin);const distance=Math.max(.0001,Math.min(a+b-.00001,direction.length()));direction.normalize();
    bend.set(1,-.15,0).transformDirection(shoulder.parent.matrixWorld);bend.addScaledVector(direction,-bend.dot(direction)).normalize();
    const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
    joint.copy(origin).addScaledVector(direction,along).addScaledVector(bend,height);
    upperRotation.setFromUnitVectors(down,end.subVectors(joint,origin).normalize());
    shoulder.parent.getWorldQuaternion(parentRotation).invert();localRotation.copy(parentRotation).multiply(upperRotation);shoulder.quaternion.copy(baseUpper).slerp(localRotation,weight);
    shoulder.updateWorldMatrix(true,true);elbow.getWorldPosition(joint);
    localRotation.setFromUnitVectors(down,end.subVectors(target,joint).normalize());
    shoulder.getWorldQuaternion(parentRotation).invert();localRotation.premultiply(parentRotation);elbow.quaternion.copy(baseLower).slerp(localRotation,weight);
  };
}
