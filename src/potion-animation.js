import * as T from 'three';
export function createPotionModel(){
 const bottle=new T.Group();bottle.name='HealingPotion';
 const profile=[[0,0],[.045,0],[.055,.025],[.055,.10],[.025,.13],[.022,.18],[.014,.18],[.014,.14],[.040,.10],[.040,.02],[0,.02]].map(p=>new T.Vector2(...p));
 bottle.add(new T.Mesh(new T.LatheGeometry(profile,20),new T.MeshStandardMaterial({color:'#c9e0d7',transparent:true,opacity:.55,roughness:.2,metalness:.1,side:T.DoubleSide})));
 const liquid=new T.Mesh(new T.CylinderGeometry(.04,.04,.085,16),new T.MeshStandardMaterial({color:'#be253d',roughness:.3}));liquid.position.y=.058;bottle.add(liquid);
 return bottle;
}
export function createPotionAnimation(model,clips=[]){
 const bone=n=>model.getObjectByName(T.PropertyBinding.sanitizeNodeName(n));
 const hand=bone('hand.R'),head=bone('lip.T.L'),arm=['upper_arm.R','forearm.R'].map(bone).filter(Boolean);
 if(!hand||!head||arm.length!==2)throw Error('喝药动画缺少手臂或嘴部骨骼');
 const grip=new T.Object3D();grip.name='PotionGrip';model.updateWorldMatrix(true,true);const knuckle=bone('f_middle.01.R');if(knuckle){grip.position.copy(hand.worldToLocal(knuckle.getWorldPosition(new T.Vector3()))).multiplyScalar(.75);}grip.position.x+=.025;hand.add(grip);
 const fist=clips.find(c=>c.name==='Attack1'),fingerTargets=[];for(const track of fist?.tracks??[]){const name=track.name.split('.')[0];if(!/^(f_|thumb)/.test(name)||!name.endsWith('R')||!track.name.endsWith('.quaternion'))continue;const b=model.getObjectByName(name);if(b)fingerTargets.push([b,new T.Quaternion().fromArray(track.createInterpolant().evaluate(Math.min(.24,fist.duration)))]);}
 const bottle=createPotionModel();
 model.add(bottle);
 bottle.visible=false;
 const controlledBones=[...arm,...fingerTargets.map(([bone])=>bone)];
 const saved=controlledBones.map(()=>new T.Quaternion());
 const solveOrder=[...arm].reverse();
 const target=new T.Vector3(),point=new T.Vector3(),origin=new T.Vector3(),direction=new T.Vector3();
 const scale=new T.Vector3(),offset=new T.Vector3(),xAxis=new T.Vector3(1,0,0);
 const worldRotation=new T.Quaternion(),bottleRotation=new T.Quaternion(),tiltRotation=new T.Quaternion();
 const correction=new T.Quaternion(),parentRotation=new T.Quaternion(),localCorrection=new T.Quaternion();
 let applied=false;
 return {prepare(){
  if(!applied)return;
  for(let i=0;i<controlledBones.length;i++)controlledBones[i].quaternion.copy(saved[i]);
  applied=false;
 },update(battle){
  bottle.visible=Boolean(battle.drinking&&hand&&head);if(!bottle.visible)return;
  const t=battle.time-battle.drinking.start,w=T.MathUtils.smoothstep(t,0,.5)*(1-T.MathUtils.smoothstep(t,1.65,2));
  for(let i=0;i<controlledBones.length;i++)saved[i].copy(controlledBones[i].quaternion);
  applied=true;
  head.getWorldPosition(target);
  model.getWorldQuaternion(worldRotation);
  const tilt=-2.5*T.MathUtils.smoothstep(t,.55,1.35);
  bottleRotation.copy(worldRotation).multiply(tiltRotation.setFromAxisAngle(xAxis,tilt));
  target.sub(offset.set(0,.105,0).applyQuaternion(bottleRotation));

  // The world-space getters update the altered ancestor chain on demand.
  for(let k=0;k<12;k++)for(const b of solveOrder){
   b.getWorldPosition(origin);
   grip.getWorldPosition(point);
   correction.setFromUnitVectors(point.sub(origin).normalize(),direction.copy(target).sub(origin).normalize());
   b.parent.getWorldQuaternion(parentRotation);
   localCorrection.copy(parentRotation).invert().multiply(correction).multiply(parentRotation);
   b.quaternion.premultiply(localCorrection);
  }
  for(let i=0;i<arm.length;i++){
   correction.copy(arm[i].quaternion);
   arm[i].quaternion.slerpQuaternions(saved[i],correction,w);
  }
  for(const [bone,pose] of fingerTargets)bone.quaternion.slerp(pose,w);
  grip.getWorldPosition(point);
  point.sub(offset.set(0,.065,0).applyQuaternion(bottleRotation));
  bottle.position.copy(model.worldToLocal(point));
  bottle.quaternion.copy(worldRotation.invert().multiply(bottleRotation));
  bottle.scale.setScalar(1/model.getWorldScale(scale).y);
 }};
}
