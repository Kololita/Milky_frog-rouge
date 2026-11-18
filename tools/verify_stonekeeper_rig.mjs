import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{
 const bytes=Buffer.from(await blob.arrayBuffer());
 return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),close(){}};
};
const bytes=await fs.readFile(process.argv[2]??'public/models/enemies/stonekeeper.glb');
const g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
const mixer=new THREE.AnimationMixer(g.scene),hammer=g.scene.getObjectByName('hammer'),body=g.scene.getObjectByName('stonekeeper_body'),weapon=g.scene.getObjectByName('stonekeeper_hammer');
const hammerSurfaces=[];
weapon.traverse(object=>{if(object.isMesh)hammerSurfaces.push(object);});
assert(hammerSurfaces.length&&hammerSurfaces.every(object=>!object.isSkinnedMesh));
assert.equal(weapon.parent,hammer,'The independent hammer object should follow the weapon bone');
const fingers=body.skeleton.bones.filter(b=>b.name.startsWith('finger_'));assert.equal(fingers.length,28);assert.equal(body.skeleton.bones.length,50);
const weighted=new Set();for(let i=0;i<body.geometry.attributes.skinWeight.count;i++)for(let j=0;j<4;j++)if(body.geometry.attributes.skinWeight.array[i*4+j]>.001)weighted.add(body.skeleton.bones[body.geometry.attributes.skinIndex.array[i*4+j]].name);assert([...weighted].some(n=>n.startsWith('finger_L'))&&[...weighted].some(n=>n.startsWith('finger_R')));
const sample=(name,t)=>{
 mixer.stopAllAction();const clip=g.animations.find(c=>c.name===name);
 const a=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play();
 a.time=t*(clip.duration-1e-6);mixer.update(0);g.scene.updateMatrixWorld(true);body.skeleton.update();
 const grip=hammer.getWorldPosition(new THREE.Vector3()),head=hammer.localToWorld(new THREE.Vector3(0,.689,0));
 return {grip,head,dir:head.clone().sub(grip).normalize()};
};
const windup=sample('Smash',.45),hit=sample('Smash',.625);
assert(windup.dir.y<-.995&&hit.dir.y<-.995,'Both grips must keep the hammer inverted');
assert(windup.head.y-hit.head.y>.35,'The head must plunge vertically');
const hand=g.scene.getObjectByName('hand_L');
const neutralGrip=hand.worldToLocal(sample('Idle',0).grip);
// Half-frame interpolation of a rigid moving grip may deviate by under 6 mm.
const smooth=u=>{const x=THREE.MathUtils.clamp(u,0,1);return x*x*(3-2*x);};
for(const clip of g.animations)for(let k=0;k<=240;k++){
 const t=k/240,{grip,dir}=sample(clip.name,t);
 const offset=grip.sub(hand.localToWorld(neutralGrip.clone()));
 let travel=(clip.name==='Smash'||clip.name==='Sweep')?(clip.name==='Smash'?.55:.65)*smooth(t/(clip.name==="Smash"?.175:.25))*(1-smooth((t-.83)/.17)):0;
 if(clip.name==='Smash')travel+=.55*Math.sin(Math.PI*smooth((t-.80)/.13))+.24*Math.sin(Math.PI*smooth((t-.83)/.17));
 assert(Math.abs(offset.dot(dir)-travel)<(clip.name==="Smash"?.012:.006),`${clip.name} at ${t}: travel ${offset.dot(dir)} expected ${travel}`);
 assert(offset.clone().addScaledVector(dir,-offset.dot(dir)).length()<.006,`${clip.name}: shaft slips sideways from palm`);
}
const jointNames=['L','R'].flatMap(side=>['upper_arm','forearm','hand'].map(name=>`${name}_${side}`));
const getPosition=name=>g.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());
const metrics={};
for(const {name:clip} of g.animations){
 const previousJoints=new Map();let step=0,maxAngle=0,stepPhase=0,stepJoint;
 for(let k=0;k<=120;k++){
  const t=k/120;sample(clip,t);
  for(const name of jointNames){
   const q=g.scene.getObjectByName(name).quaternion.clone().normalize();
   if(previousJoints.has(name)&&q.angleTo(previousJoints.get(name))>step){step=q.angleTo(previousJoints.get(name));stepPhase=t;stepJoint=name;}
   previousJoints.set(name,q);
  }
  for(const side of ['L','R']){
   const wrist=getPosition(`hand_${side}`),forearm=wrist.clone().sub(getPosition(`forearm_${side}`));
   for(let digit=0;digit<5;digit++){
    const tip=getPosition(`finger_${side}_${digit}_${digit===0?1:2}`);
    maxAngle=Math.max(maxAngle,THREE.MathUtils.radToDeg(tip.sub(wrist).angleTo(forearm)));
   }
  }
 }
 metrics[clip]={maxStepDegrees:THREE.MathUtils.radToDeg(step),stepPhase,stepJoint,maxAngle};
 assert(maxAngle<=60,`${clip} over-extends a hand: ${maxAngle}°`);
}
console.log('STONEKEEPER_POSE_AUDIT',metrics);
for(const [clip,{maxStepDegrees,stepPhase}] of Object.entries(metrics)){
 assert(maxStepDegrees<30,`${clip} snaps at ${stepPhase}: ${maxStepDegrees}°`);
}
const ids=[];const p=body.geometry.attributes.position;for(let i=0;i<p.count;i++)if(new THREE.Vector3().fromBufferAttribute(p,i).distanceTo(new THREE.Vector3(.56,.94,.50))<.12)ids.push(i);assert(ids.length>10);
let maxPalmStretch=0,minPalmStretch=Infinity,maxWeaponError=0;
for(const clip of ['Smash','Sweep','Quake','RockThrow'])for(const t of [0,.2,.45,.55,.7,.85,1]){
 sample(clip,t);
 for(const surface of hammerSurfaces){
  const index=surface.geometry.index,v=surface.geometry.attributes.position;
  for(let k=0;k<index.count;k+=21){const a=index.getX(k),b=index.getX(Math.min(k+1,index.count-1)),ra=new THREE.Vector3().fromBufferAttribute(v,a),rb=new THREE.Vector3().fromBufferAttribute(v,b),d=ra.distanceTo(rb);if(d>.005){surface.localToWorld(ra);surface.localToWorld(rb);maxWeaponError=Math.max(maxWeaponError,Math.abs(ra.distanceTo(rb)/d-1));}}
 }
 for(let k=0;k<ids.length-1;k++){const a=ids[k],b=ids[k+1],ra=new THREE.Vector3().fromBufferAttribute(p,a),rb=new THREE.Vector3().fromBufferAttribute(p,b),d=ra.distanceTo(rb);if(d>.025){body.applyBoneTransform(a,ra);body.applyBoneTransform(b,rb);const ratio=ra.distanceTo(rb)/d;maxPalmStretch=Math.max(maxPalmStretch,ratio);minPalmStretch=Math.min(minPalmStretch,ratio);}}
}
assert(maxWeaponError<.001,'Weapon shaft bends');console.log({maxPalmStretch,minPalmStretch,maxWeaponError,weightedFingers:[...weighted].filter(n=>n.startsWith('finger_')).length});assert(maxPalmStretch<1.4&&minPalmStretch>.65,'Fist collapses during casting');
console.log('STONEKEEPER_RIG_VERIFIED: 50 bones with weighted finger chains, hammer-head leading strike, rigid shaft and stable closed palm across all attacks');

const locked=JSON.parse(await fs.readFile('assets-source/blender/rigged/stonekeeper-locked-fist.json','utf8')),key=p=>p.map(n=>n.toFixed(5)).join(','),wanted=new Set(locked.restPositions.map(key)),selected=[];
for(let i=0;i<p.count;i++)if(wanted.has(key(new THREE.Vector3().fromBufferAttribute(p,i).toArray())))selected.push(i);
assert(selected.length>=locked.sourceVertices,'Full fist selection was lost during export');
const lockedBones=body.skeleton.bones.filter(b=>b.name==='hand_R'||b.name.startsWith('finger_R_'));
sample('Idle',0);const baseline=new Map(lockedBones.map(b=>[b.name,{q:b.quaternion.clone(),p:b.position.clone(),s:b.scale.clone()}]));
let fullFistError=0;const anchor=selected[0],reference=new THREE.Vector3().fromBufferAttribute(p,anchor);
for(const action of ['Quake','RockThrow'])for(let k=0;k<=60;k++){
 sample(action,k/60);for(const b of lockedBones){const rest=baseline.get(b.name);assert(b.quaternion.clone().normalize().angleTo(rest.q.clone().normalize())<1e-5&&b.position.distanceTo(rest.p)<1e-5&&b.scale.distanceTo(rest.s)<1e-5,`${action}: wrist/finger moved independently`);}
 const posedReference=body.applyBoneTransform(anchor,reference.clone());
 for(const i of selected){const restPoint=new THREE.Vector3().fromBufferAttribute(p,i),before=restPoint.distanceTo(reference);if(before<.02)continue;const posed=body.applyBoneTransform(i,restPoint);fullFistError=Math.max(fullFistError,Math.abs(posed.distanceTo(posedReference)/before-1));}
}
assert(fullFistError<.0001,'The full fist deforms despite locked wrist/fingers');
console.log('LOCKED_FIST_VERIFIED:',{sourceVertices:locked.sourceVertices,exportVertices:selected.length,fullFistError});


