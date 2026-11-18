import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {AnimationMixer,LoopOnce,Vector3,Quaternion} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ImpactFeedback} from '../src/impact-feedback.js';
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};};
const bytes=await fs.readFile(new URL('../output/frog.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const mixer=new AnimationMixer(gltf.scene),clips=Object.fromEntries(gltf.animations.map(c=>[c.name,c]));
const object=n=>gltf.scene.getObjectByName(n.replaceAll('.',''));
const point=n=>object(n).getWorldPosition(new Vector3());
function sample(name,t){mixer.stopAllAction();const a=mixer.clipAction(clips[name]).reset().setLoop(LoopOnce,1);a.clampWhenFinished=true;a.play();mixer.setTime(t);gltf.scene.updateMatrixWorld(true);}
const report={jumps:{},laugh:{},impact:{}};
for(const name of ['Jump','JumpWalk','JumpRun']) {
 let max=0;
 for(let i=0;i<=60;i++) {
  const phase=.25+.48*i/60;sample(name,clips[name].duration*phase);
  max=Math.max(max,Math.abs(point('hand.L').y-point('hand.R').y));
 }
 assert(max<.006,`${name} hand height mismatch: ${max}`);report.jumps[name]={maximumHandHeightDifference:max};
}
assert(Math.abs(clips.Laugh.duration-103/24)<1e-6,'Laugh total length changed');
sample('Idle',0);const rest=object('face').getWorldQuaternion(new Quaternion());
function look(t){sample('Laugh',t);return new Vector3(0,0,1).applyQuaternion(object('face').getWorldQuaternion(new Quaternion()).multiply(rest.clone().invert()));}
const down=look(1.25),up=look(2.95);
assert(up.y-down.y>.35,`Laugh does not transition from lowered head to raised head: ${down.y} -> ${up.y}`);
for(const t of [1,1.6,2.4,3,3.7]) {
 sample('Laugh',t);assert(point('hand.L').x>point('spine.003').x+.04);assert(point('hand.R').x<point('spine.003').x-.04,'Hands cross while laughing');
}
report.laugh={duration:clips.Laugh.duration,downLookY:down.y,upLookY:up.y,handsRemainOnTheirOwnSides:true};
const impact=new ImpactFeedback();assert.deepEqual(impact.sample(),{x:0,y:0,z:0,ringScale:1,ringOpacity:0});impact.trigger();
let maximum=0;for(let i=0;i<120;i++) {
 impact.update(1/120);const f=impact.sample();maximum=Math.max(maximum,Math.hypot(f.x,f.y,f.z));
 assert(Object.values(f).every(Number.isFinite));assert(f.ringOpacity>=0&&f.ringOpacity<=.42);
}
assert(maximum>0&&maximum<.065);assert.equal(impact.sample().ringOpacity,0);assert.equal(impact.sample().y,0);
report.impact={maximumShake:maximum,settlesWithoutOrbitDrift:true};
await fs.writeFile(new URL('../output/animations/performance-pass-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('PERFORMANCE_PASS_VERIFIED',JSON.stringify(report,null,2));
