import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {AnimationMixer,LoopOnce,Vector3,Quaternion} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {screenDodgeDirection,dodgeProgress,dodgeVisualTurn,classifyDodge,DODGE_NAMES,CHARACTER_HEIGHT} from '../src/dodge.js';
import {extractAttackRootMotion} from '../src/attack-root-motion.js';
import {movementInput} from '../src/movement.js';
const eps=1e-7;
for(const yaw of [0,.4,Math.PI/2,Math.PI,4.9]) {
 const forward={x:Math.sin(yaw),z:Math.cos(yaw)};
 for(const [codes,f,r] of [[['KeyW'],1,0],[['KeyS'],-1,0],[['KeyA'],0,-1],[['KeyD'],0,1],[['KeyW','KeyD'],1,1],[['KeyS','KeyA'],-1,-1],[[], -1,0]]) {
  const d=screenDodgeDirection(new Set(codes),forward),n=Math.hypot(f,r);
  assert(Math.abs(d.x-(forward.x*f-forward.z*r)/n)<eps);
  assert(Math.abs(d.z-(forward.z*f+forward.x*r)/n)<eps);
 }
}
for(const heading of [0,1,-2,3,5,Math.PI*7]) {
 for(const [degrees,name,units] of [[0,'DodgeRoll',1.5],[60,'DodgeRoll',1.5],[60.001,'DodgeSideL',1],[90,'DodgeSideL',1],[119.999,'DodgeSideL',1],[120,'DodgeBackflip',2],[180,'DodgeBackflip',2],[-60,'DodgeRoll',1.5],[-60.001,'DodgeSideR',1],[-90,'DodgeSideR',1],[-119.999,'DodgeSideR',1],[-120,'DodgeBackflip',2]]) {
  const yaw=heading+degrees*Math.PI/180,dir={x:Math.sin(yaw),z:Math.cos(yaw)};
  const result=classifyDodge(dir,heading);
  assert.equal(result.name,name,`${heading}, ${degrees}`);assert.equal(result.distance,CHARACTER_HEIGHT*units);
  assert(Math.abs(dodgeVisualTurn(result.facing,heading,0,1))<eps);
  assert(Math.abs(dodgeVisualTurn(result.facing,heading,1,1))<eps);
  assert(Math.abs(dodgeVisualTurn(result.facing,heading,.5,1))<=Math.PI/3+eps);
 }
}
assert.equal(dodgeProgress(0,1),0);assert.equal(dodgeProgress(99,1),1);
assert.equal(movementInput(new Set(['KeyW','ShiftLeft'])).sprint,true);
globalThis.self=globalThis;globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};};
const data=await fs.readFile(new URL('../output/frog.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
const mixer=new AnimationMixer(gltf.scene),hips=gltf.scene.getObjectByName('spine'),skins=[];
gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);});
gltf.scene.updateMatrixWorld(true);
const skinnedMinimum=()=>{
 let minimum=Infinity;
 for(const skin of skins){skin.skeleton.update();for(let i=0;i<skin.geometry.attributes.position.count;i++){const p=skin.getVertexPosition(i,new Vector3()).applyMatrix4(skin.matrixWorld);minimum=Math.min(minimum,p.y);}}
 return minimum;
};
const floor=skinnedMinimum(),report={classificationBoundaries:true,cameraRelativeDirections:true,clips:{}};
for(const name of DODGE_NAMES) {
 const clip=gltf.animations.find(c=>c.name===name);assert(clip,`Missing ${name}`);
 mixer.stopAllAction();const action=mixer.clipAction(clip).reset().setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
 let previous,turn=0,firstY,firstX,lastY,low=Infinity,high=-Infinity,groundLow=Infinity,groundHigh=-Infinity;
 for(let i=0;i<=120;i++) {
  if(i)mixer.update(clip.duration/120);else mixer.update(0);
  gltf.scene.updateMatrixWorld(true);const q=hips.getWorldQuaternion(new Quaternion());
  if(previous){const d=q.clone().multiply(previous.clone().invert());if(d.w<0)d.set(-d.x,-d.y,-d.z,-d.w);turn+=2*Math.atan2(d.x,d.w);}
  previous=q.clone();const p=hips.getWorldPosition(new Vector3());
  if(!i){firstY=p.y;firstX=p.x;}lastY=p.y;low=Math.min(low,p.y);high=Math.max(high,p.y);
  const bottom=skinnedMinimum();groundLow=Math.min(groundLow,bottom);groundHigh=Math.max(groundHigh,bottom);
 }
 assert(groundLow>floor-.008,`${name} penetrates floor: ${groundLow-floor}`);
 assert(Math.abs(lastY-firstY)<.002,`${name} does not return to standing height`);
 // Allow a few centimeters for clearance between contact samples, never a jump arc.
 if(name==='DodgeRoll') {assert(Math.abs(turn-2*Math.PI)<.03);assert(groundHigh-floor<.035,`Ground roll becomes airborne: ${groundHigh-floor}`);}
 if(name==='DodgeBackflip') {assert(Math.abs(turn+2*Math.PI)<.03);assert(high-firstY>.35);}
 if(name.startsWith('DodgeSide')) {assert(Math.abs(turn)<.01);assert(Math.abs(hips.getWorldPosition(new Vector3()).x-firstX)>.8);}
 report.clips[name]={duration:clip.duration,turnDegrees:turn*180/Math.PI,rootHeight:[low,high],floorClearance:[groundLow-floor,groundHigh-floor]};
}
mixer.stopAllAction();mixer.update(0);gltf.scene.updateMatrixWorld(true);
const motions=extractAttackRootMotion(gltf.animations,gltf.scene,/^DodgeSide[LR]$/);
for(const name of ['DodgeSideL','DodgeSideR']) {
 const clip=gltf.animations.find(c=>c.name===name),motion=motions[name];
 const end=Array.from(motion.evaluate(clip.duration)),start=Array.from(motion.evaluate(0));
 assert(Math.hypot(start[0],start[2])<1e-6);assert(Math.hypot(end[0],end[2])>.8);
 let previous=-Infinity;
 for(let i=0;i<=100;i++) {
  const v=motion.evaluate(clip.duration*i/100),fraction=(v[0]*end[0]+v[2]*end[2])/(end[0]**2+end[2]**2);
  assert(fraction>=previous-1e-5 && fraction>=-1e-5 && fraction<=1+1e-5,'Side travel overshoots or reverses');previous=fraction;
 }
 assert(Math.abs(previous-1)<1e-6);
 const track=clip.tracks.find(t=>t.name==='spine.position');
 const parent=hips.parent.matrixWorld,first=new Vector3().fromArray(track.values).applyMatrix4(parent);
 for(let i=0;i<track.times.length;i++){const p=new Vector3().fromArray(track.values,i*3).applyMatrix4(parent);assert(Math.hypot(p.x-first.x,p.z-first.z)<1e-5,'Side movement applied twice');}
}
await fs.writeFile(new URL('../output/animations/dodge-verification.json',import.meta.url),JSON.stringify(report,null,2));console.log('DODGE_VERIFIED',JSON.stringify(report,null,2));
