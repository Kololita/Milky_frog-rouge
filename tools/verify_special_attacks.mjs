import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {AnimationMixer,LoopOnce,Vector3,Quaternion,Box3,Group} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AirSlam,AIR_SLAM,airDriftDistance,ATTACK_TIMING,attackRate,attackCanFinish,dodgeRate} from '../src/combat.js';
import {AttackCombo} from '../src/attack-combo.js';
import {CharacterState} from '../src/character-state.js';
import {dodgeEndHeading,dodgeVisualTurn} from '../src/dodge.js';
import {ActionBlend} from '../src/action-blend.js';
import {createFloorProbe} from '../src/floor-probe.js';
const close=(a,b,e=1e-7)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
const report={timings:{},entryStages:{RunAttack:2,AirAttack:'free-after-recovery'},airHeights:[],backflipLandingFacing:true};
for(const [name,stage,next] of [['RunAttack',2,3]]) {
 const combo=new AttackCombo(),state=new CharacterState();combo.enter(stage,{x:0,z:1});state.begin(name);
 combo.finish(1);state.finish(name,1);assert(!state.isFree);close(state.until,1.05);
 assert.equal(combo.press(1.01),next);
}
{
 const combo=new AttackCombo(),state=new CharacterState();combo.enter(1);state.begin('AirAttack');
 state.update(100);assert(!state.isFree);combo.reset();state.finish('AirAttack',100);
 assert(state.isFree);assert.equal(combo.press(100.01),1);
 assert(!attackCanFinish('AirAttack',1.6,true),'Pre-input skips the recovery backflip');
}
for(const name of ['Attack1','Attack2','Attack3','Attack4','RunAttack']) {
 let t=0,elapsed=0,linkTime;
 for(let i=0;i<300;i++) {
  t+=attackRate(name,t)/120;elapsed+=1/120;
  if(!linkTime&&attackCanFinish(name,t,true)) linkTime=elapsed;
  if(attackCanFinish(name,t,false))break;
 }
 assert(linkTime<=elapsed);report.timings[name]={full:elapsed,bufferedLink:linkTime};
 assert(elapsed<({Attack1:.75,Attack2:.96,Attack3:1.05,Attack4:1.42,RunAttack:.75}[name]));
 assert(!attackCanFinish(name,ATTACK_TIMING[name].link-.01,true),'Link cancels before contact/recovery');
}
close(attackRate('Attack4',.34),1);
for(const start of [-3,0,1.5,3]) {
 const direction={x:Math.sin(start+Math.PI),z:Math.cos(start+Math.PI)};
 const end=dodgeEndHeading('DodgeBackflip',direction,start);
 const visual=dodgeVisualTurn(start,start,1,1,end);
 close(Math.sin(start+visual),-direction.x);close(Math.cos(start+visual),-direction.z);
 close(dodgeEndHeading('DodgeRoll',direction,start),start);
}
close(airDriftDistance(0),.18);close(airDriftDistance(1.2),.264);close(airDriftDistance(2.8),.6);
close(.78/new AirSlam(0).recoveryRate,.819);
for(const height of [0,.13,.4,.8]) {
 const flight=new AirSlam(height);
 close(flight.sample(0).height,height);close(flight.sample(flight.charge).height,height+AIR_SLAM.lift);
 close(flight.fallStart,.525);close(flight.recoveryStart-flight.landTime,.21);
 let last=flight.sample(0);
 for(const t of [.1,.25,.4,.499999]) {
  const charge=flight.sample(t);
  assert.equal(charge.phase,'charge');
  for(const key of ['height','drift','clipTime']) assert(charge[key]>last[key],`${key} freezes during the charge`);
  last=charge;
 }
 for(const offset of [0,.1,.199999]) {
  const impact=flight.sample(flight.landTime+offset);
  close(impact.height,0);close(impact.clipTime,.5);close(impact.drift,1);assert.equal(impact.phase,'impact');
 }
 close(flight.sample(flight.landTime).height,0);
 for(const fps of [30,60,144]) for(let i=0;i<Math.ceil(flight.duration*fps);i++) assert(flight.sample(i/fps).height>=0);
 report.airHeights.push({start:height,apex:flight.apex,landing:flight.landTime,duration:flight.duration});
}
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};};
const bytes=await fs.readFile(new URL('../output/frog.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const mixer=new AnimationMixer(gltf.scene),point=n=>gltf.scene.getObjectByName(n.replaceAll('.','')).getWorldPosition(new Vector3());
const clips=Object.fromEntries(gltf.animations.map(c=>[c.name,c])),bones=[];gltf.scene.traverse(o=>{if(o.isBone)bones.push(o);});
function sample(name,time) {
 mixer.stopAllAction();const a=mixer.clipAction(clips[name]).reset().setLoop(LoopOnce,1);a.clampWhenFinished=true;a.play();mixer.setTime(time);gltf.scene.updateMatrixWorld(true);
 return bones.map(b=>b.getWorldPosition(new Vector3()));
}
for(const [name,base] of [['RunAttack','Attack2'],['AirAttack','Idle']]) {
 assert(clips[name]);const special=sample(name,clips[name].duration),standard=sample(base,clips[base].duration);
 const offset=name==='RunAttack' ? special[0].clone().sub(standard[0]) : new Vector3();
 const error=Math.max(...special.map((v,i)=>v.clone().sub(offset).distanceTo(standard[i])));
 assert(error<.0025,`${name} does not join ${base}: ${error}`);report[name]={endpointError:error};
 if(name==='RunAttack')report[name].preservedTravelOffset=offset.toArray();
}
sample('RunAttack',.27);
for(const s of ['L','R']) assert(point('hand.'+s).z>point('upper_arm.'+s).z+.15,'Both palms must push forwards');
sample('RunAttack',0);const startRoot=point('spine');
sample('RunAttack',clips.RunAttack.duration);const rootTravel=point('spine').sub(startRoot);
assert(rootTravel.z>.25,'Running push loses the gained ground');report.RunAttack.rootTravel=rootTravel.toArray();
const handRise=[];
for(const t of [0,.11,.22]) {
 sample('AirAttack',t);handRise.push(['L','R'].map(s=>point('hand.'+s).y));
}
for(let i=1;i<handRise.length;i++)for(let side=0;side<2;side++) assert(handRise[i][side]>handRise[i-1][side]+.01,'Hands do not rise gradually during charge');
report.AirAttack.handRise=handRise;
sample('AirAttack',.22);
for(const s of ['L','R']) {
 assert(point('hand.'+s).y>point('spine.005').y+.05,'Fists not raised');
 assert(point('foot.'+s).z>point('thigh.'+s).z+.18,'Legs not extended forward');
 const flex=180-point('thigh.'+s).sub(point('shin.'+s)).angleTo(point('foot.'+s).sub(point('shin.'+s)))*180/Math.PI;
 assert(flex<15,`Air leg bent: ${flex}`);
}
let previous,total=0;
for(let i=0;i<=72;i++) {
 sample('AirAttack',.70+.78*i/72);
 const up=point('spine.001').sub(point('spine'));
 const pitch=Math.atan2(up.z,up.y);
 if(previous!==undefined)total+=Math.atan2(Math.sin(pitch-previous),Math.cos(pitch-previous));
 previous=pitch;
}
assert(Math.abs(total*180/Math.PI)>350,'Recovery does not complete a backflip');report.AirAttack.backflipDegrees=total*180/Math.PI;
// Exercise the real jump -> slam blend and compare the cheap probe with all skin.
sample('Idle',0);
const group=new Group(),pivot=new Group();group.add(pivot);pivot.add(gltf.scene);
const initial=new Box3().setFromObject(gltf.scene,true),scale=1.55/(initial.max.y-initial.min.y);
gltf.scene.scale.setScalar(scale);gltf.scene.position.y=-initial.min.y*scale;group.updateMatrixWorld(true);
const probe=createFloorProbe(gltf.scene,{fullBody:true});let maxHeightError=0;
for(const fraction of [.18,.40,.68]) {
 pivot.position.y=0;sample('JumpRun',clips.JumpRun.duration*fraction);group.updateMatrixWorld(true);
 const start=probe(),flight=new AirSlam(start),blend=new ActionBlend();
 const jump=mixer.clipAction(clips.JumpRun),air=mixer.clipAction(clips.AirAttack);
 blend.to(jump,.055);air.reset().setLoop(LoopOnce,1).play();air.paused=true;blend.to(air,.055);
 for(let i=0;i<=Math.ceil(flight.duration*60);i++) {
  const phase=flight.sample(i/60);air.time=phase.clipTime;blend.update(1/60);mixer.update(1/60);
  pivot.position.y+=phase.height-probe();group.updateMatrixWorld(true);
  const actual=new Box3().setFromObject(gltf.scene,true).min.y;
  maxHeightError=Math.max(maxHeightError,Math.abs(actual-phase.height));
  assert(Math.abs(actual-phase.height)<.003,'Slam height jumps or pierces the ground');
 }
 mixer.stopAllAction();
}
report.AirAttack.maximumRenderedHeightError=maxHeightError;
await fs.writeFile(new URL('../output/animations/special-attacks-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('SPECIAL_ATTACKS_VERIFIED',JSON.stringify(report,null,2));
