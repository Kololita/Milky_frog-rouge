import * as T from 'three';
export function groundedWeaponPose(model){
 model.updateWorldMatrix(true,true);
 for(const side of ['L','R']){
  const hand=model.getObjectByName('hand_'+side),arm=['upper_arm_','forearm_'].map(n=>model.getObjectByName(n+side));if(!hand||arm.some(b=>!b))continue;
  const target=model.localToWorld(new T.Vector3(side==='L'?-.56:.56,1.12,-.28));
  for(let i=0;i<10;i++)for(const b of [...arm].reverse()){
   const origin=b.getWorldPosition(new T.Vector3()),a=hand.getWorldPosition(new T.Vector3()).sub(origin).normalize(),c=target.clone().sub(origin).normalize(),q=new T.Quaternion().setFromUnitVectors(a,c),parent=b.parent.getWorldQuaternion(new T.Quaternion());b.quaternion.premultiply(parent.clone().invert().multiply(q).multiply(parent));model.updateWorldMatrix(true,true);
  }
 }
 const blade=model.getObjectByName('blade');if(blade){const desired=new T.Vector3(0,1,0).transformDirection(model.matrixWorld),direction=new T.Vector3(0,1,0).applyQuaternion(blade.getWorldQuaternion(new T.Quaternion())),q=new T.Quaternion().setFromUnitVectors(direction,desired),parent=blade.parent.getWorldQuaternion(new T.Quaternion());blade.quaternion.premultiply(parent.clone().invert().multiply(q).multiply(parent));}
 model.updateWorldMatrix(true,true);
}

