import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { AnimationMixer, LoopOnce, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AttackCombo } from '../src/attack-combo.js';
import { extractAttackRootMotion } from '../src/attack-root-motion.js';
import { createModelActions } from '../src/assets.js';

const c = new AttackCombo();
assert.equal(c.press(0),1);
assert.equal(c.press(.2),0);assert.equal(c.press(.3),0); // Playback does not queue stages internally.
assert.equal(c.finish(.75),0);assert.equal(c.stage,1);
assert.equal(c.press(.8),2);assert.equal(c.finish(1.76),0);
assert.equal(c.press(1.8),3);assert.equal(c.finish(2.85),0);
assert.equal(c.press(2.9),4);assert.equal(c.press(3),0);
assert.equal(c.finish(4.32),-1); assert.equal(c.stage,0);
assert.equal(c.press(5),1); assert.equal(c.finish(5.75),0);
assert.equal(c.expire(6.1),0); // Timing starts at animation completion, not input.
assert.equal(c.press(6.25),2); // Inclusive boundary: exactly 0.5s after animation ends.
assert.equal(c.finish(7.708333),0); assert.equal(c.press(8.1),3);
assert.equal(c.finish(9.641667),0); assert.equal(c.press(10.1),4);
assert.equal(c.finish(12.016667),-1); // Finisher ends the combo immediately.
c.reset(); c.press(20); c.finish(20.75);
assert.equal(c.expire(21.25),0); assert.equal(c.expire(21.251),-1);
c.press(22);c.finish(22.75);assert.equal(c.press(23.251),1); // Late click starts fresh between render frames.
assert.equal(c.expire(23.8),0);
c.reset(); c.press(30);
assert.equal(c.press(31.2),0); // Unified short pre-inputs are handled outside the combo.
assert.equal(c.finish(31.5),0);assert.equal(c.press(31.5),2);
c.finish(34); assert.equal(c.expire(34.4),0); // Slow playback still gets 0.5s after completion.
assert.equal(c.press(34.5),3);
c.reset();
assert.equal(c.press(12),1); c.reset(); assert.equal(c.stage,0);
c.press(0);c.finish(.5);c.reset();assert.equal(c.press(.6),1,'Interruption must start a fresh combo');

globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};};
const b=await fs.readFile(new URL('../output/frog.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
const clips=gltf.animations.map(clip=>clip.clone());
const mixer=new AnimationMixer(gltf.scene);
const bones=[];gltf.scene.traverse(o=>{if(o.isBone)bones.push(o);});
const point=name=>gltf.scene.getObjectByName(name.replaceAll('.','')).getWorldPosition(new Vector3());
const before={};
for(const clip of clips.filter(c=>/^Attack\d$/.test(c.name))){
  const action=mixer.clipAction(clip).reset().setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
  before[clip.name]=[];
  for(let i=0;i<=24;i++){
    if(i) mixer.update(clip.duration/24);
    else mixer.update(0);
    gltf.scene.updateMatrixWorld(true);
    before[clip.name].push(bones.map(b=>b.getWorldPosition(new Vector3())));
  }
  mixer.stopAllAction();
}
const motions=extractAttackRootMotion(clips,gltf.scene);
const {actions}=createModelActions(clips,mixer);
const report={inputWindowSeconds:.5,windowStartsAt:'animation-finished',bufferHandledBy:'CommandBuffer',stages:{}};
for(const name of ['Attack1','Attack2','Attack3','Attack4']){
  const action=actions[name].reset().setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
  let maxError=0;const samples=[];
  for(let i=0;i<=24;i++){
    if(i)mixer.update(action.getClip().duration/24);else mixer.update(0);
    gltf.scene.updateMatrixWorld(true);
    const delta=new Vector3().fromArray(motions[name].evaluate(action.time));
    bones.forEach((b,j)=>{maxError=Math.max(maxError,b.getWorldPosition(new Vector3()).add(delta).distanceTo(before[name][i][j]));});
    samples.push({left:point('hand.L').z,right:point('hand.R').z,time:action.time});
  }
  assert(maxError<2e-6,`${name}: root extraction alters the authored pose: ${maxError}`);
  const final=Array.from(motions[name].evaluate(action.getClip().duration));
  assert(final[2]>=0,`${name} steps backwards`);
  report.stages[name]={duration:action.getClip().duration,rootExtractionMaximumError:maxError,travel:final};
  if(name==='Attack2')assert(final[2]>.07);
  if(name==='Attack3')assert(final[2]>.11,'Stage 3 must advance with the left step');
  if(name==='Attack4')assert(final[2]>.12);
  if(name==='Attack4'){
    assert(action.getClip().duration>1.4,'Longer charge must extend the clip');
    assert(motions[name].evaluate(.33)[2]<.001,'Palm drive starts before the .35-second charge');
    assert(motions[name].evaluate(.48)[2]>.08,'Palm does not drive after charging');
  }
  mixer.stopAllAction();
}
await fs.writeFile(new URL('../output/animations/attack-combo-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('Four-stage input, expiry, reset, complete clips and lossless root motion verified.',JSON.stringify(report));
