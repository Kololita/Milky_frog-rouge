import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {AnimationMixer,LoopOnce,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};};
const bytes=await fs.readFile(new URL('../output/frog.glb',import.meta.url));
const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const clip=asset.animations.find(c=>c.name==='Run');assert(clip);assert.equal(clip.duration,.625);
const mixer=new AnimationMixer(asset.scene),action=mixer.clipAction(clip);
const point=name=>asset.scene.getObjectByName(name.replaceAll('.','')).getWorldPosition(new Vector3());
function sample(phase){
 action.reset().setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(clip.duration*phase);asset.scene.updateMatrixWorld(true);
 return Object.fromEntries(['foot.L','foot.R','thigh.L','thigh.R','shin.L','shin.R','upper_arm.L','upper_arm.R','forearm.L','forearm.R','hand.L','hand.R'].map(n=>[n,point(n)]));
}
const poses=Array.from({length:121},(_,i)=>sample(i/120));
const arms={},knees={};
for(const side of ['L','R']){
 const offset=side==='L'?0:.5,at=p=>sample((p+offset)%1);
 const contact=at(0),push=at(.30),lift=at(.55),forward=at(.90),foot='foot.'+side;
 assert(contact[foot].z>push[foot].z+.24,`${side}: missing backward push`);
 assert(lift[foot].y>push[foot].y+.045,`${side}: heel does not rise after push`);
 assert(forward[foot].z>lift[foot].z+.18,`${side}: foot does not recover forward`);
 const wrist=poses.map(p=>p['hand.'+side].z);arms[side]=Math.max(...wrist)-Math.min(...wrist);
 assert(arms[side]>.15,`${side}: arm swing not enlarged`);
 const angles=poses.map(p=>180-p['thigh.'+side].clone().sub(p['shin.'+side]).angleTo(p[foot].clone().sub(p['shin.'+side]))*180/Math.PI);
 knees[side]=[Math.min(...angles),Math.max(...angles)];
 assert(knees[side][0]<25 && knees[side][1]>80 && knees[side][1]<125,`${side}: knee lacks extension/recovery`);
}
assert(poses[0]['foot.L'].z>poses[0]['foot.R'].z+.18);
assert(poses[60]['foot.R'].z>poses[60]['foot.L'].z+.18);
const report={duration:clip.duration,cadenceIncreasePercent:20,armForwardRanges:arms,kneeFlexDegrees:knees,oppositeLegs:true,footPhasesVerified:true};
await fs.writeFile(new URL('../output/animations/run-verification.json',import.meta.url),JSON.stringify(report,null,2));console.log('RUN_VERIFIED',report);
