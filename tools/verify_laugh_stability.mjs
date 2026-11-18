import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {AnimationMixer,LoopOnce,Vector3,Quaternion} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};};
const bytes=await fs.readFile(new URL('../output/frog.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const mixer=new AnimationMixer(gltf.scene),clip=gltf.animations.find(c=>c.name==='Laugh');
const action=mixer.clipAction(clip).setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
const bones=[];gltf.scene.traverse(o=>{if(o.isBone&&/^(upper_arm|forearm|hand|f_|thumb)/.test(o.name))bones.push(o);});
const samples=new Map(bones.map(b=>[b.name,[]])),wrists={L:[],R:[]};
for(let frame=0;frame<104;frame++) {
 mixer.setTime(Math.min(frame/24,clip.duration));gltf.scene.updateMatrixWorld(true);
 for(const b of bones)samples.get(b.name).push(b.quaternion.clone());
 const inv=gltf.scene.getObjectByName('spine001').matrixWorld.clone().invert();
 for(const side of ['L','R'])wrists[side].push(gltf.scene.getObjectByName('hand'+side).getWorldPosition(new Vector3()).applyMatrix4(inv));
}
const report={bones:{},wristLocalSecondDifference:{}};
for(const [name,qs] of samples) {
 let maxStep=0,maxJitter=0;
 for(let i=16;i<91;i++) {
  maxStep=Math.max(maxStep,qs[i].angleTo(qs[i+1])*180/Math.PI);
  maxJitter=Math.max(maxJitter,qs[i-1].clone().slerp(qs[i+1],.5).angleTo(qs[i])*360/Math.PI);
 }
 assert(maxStep<8,`${name} has a sudden rotation: ${maxStep}`);
 assert(maxJitter<4,`${name} jitters between frames: ${maxJitter}`);
 report.bones[name]={maxStep,maxJitter};
}
for(const [side,pts] of Object.entries(wrists)) {
 const max=Math.max(...pts.slice(16,91).map((p,k)=>pts[k+17].clone().add(pts[k+15]).addScaledVector(p,-2).length()));
 assert(max<.01,`${side} wrist snaps in belly coordinates: ${max}`);report.wristLocalSecondDifference[side]=max;
}
report.maximumStep=Math.max(...Object.values(report.bones).map(v=>v.maxStep));
report.maximumJitter=Math.max(...Object.values(report.bones).map(v=>v.maxJitter));
await fs.writeFile(new URL('../output/animations/laugh-stability-glb-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('LAUGH_STABILITY_VERIFIED',JSON.stringify({maximumStep:report.maximumStep,maximumJitter:report.maximumJitter,wrist:report.wristLocalSecondDifference}));
