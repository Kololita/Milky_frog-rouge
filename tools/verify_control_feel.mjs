import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {AnimationMixer} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {advanceMovement,angleDelta} from '../src/movement.js';
import {MOVEMENT,ANIMATION,CAMERA} from '../src/control-tuning.js';
import {advanceZoom,pointerYaw} from '../src/world-camera.js';
import {gaitTransitionPhase,locomotionName,locomotionRate,transitionDuration} from '../src/locomotion-animation.js';
import {ActionBlend} from '../src/action-blend.js';
import {ShiftTap} from '../src/shift-tap.js';
const close=(a,b,eps=1e-8)=>assert(Math.abs(a-b)<eps,`${a} != ${b}`);
const input=(angle=0,sprint=false)=>({move:1,sprint,direction:{x:Math.sin(angle),z:Math.cos(angle)}});
const released={move:0,sprint:false,direction:null};
const report={frameRates:[30,60,144],movement:[],animation:{},camera:{}};
for(const fps of report.frameRates) {
 const dt=1/fps;
 for(const sprint of [false,true]) {
  const speed=sprint?MOVEMENT.runSpeed:MOVEMENT.walkSpeed;
  let state={heading:0,velocity:0},distance=0,reach90=0;
  for(let i=1;i<=fps;i++) {
   state=advanceMovement(state,input(0,sprint),dt);distance+=state.dz;
   if(!reach90&&state.velocity>=speed*.9) reach90=i*dt;
  }
  close(distance,speed*(1-(1-Math.exp(-MOVEMENT.acceleration))/MOVEMENT.acceleration));
  assert(reach90<=.167,'Start feels delayed');
  let stoppedAt=0,stopDistance=0;
  for(let i=1;i<=fps;i++) {
   state=advanceMovement(state,released,dt);stopDistance+=state.dz;
   if(!state.velocity) {stoppedAt=i*dt;break;}
  }
  assert(stoppedAt>0&&stoppedAt<=.167,'Stop keeps coasting');
  assert(stopDistance<=speed/MOVEMENT.braking+1e-6);
  report.movement.push({fps,sprint,reach90Seconds:reach90,stopSeconds:stoppedAt,stopDistance});
  // Starting from rest towards the back must not accidentally trigger a pivot
  // as acceleration overtakes the fast initial steering.
  state={heading:0,velocity:0};
  for(let i=0;i<fps;i++) {state=advanceMovement(state,input(Math.PI,sprint),dt);assert(!state.pivot);}
  close(angleDelta(state.heading,Math.PI),0);
 }
 for(const duration of [.2,.3])for(const initial of [0,MOVEMENT.walkSpeed]){
  let state={heading:0,velocity:initial},elapsed=0,distance=0;
  const initialDt=.003; // A partial first frame makes the window end fall between ticks.
  for(let frame=0;elapsed<duration+.04;frame++){
   const span=frame===0?initialDt:dt;
   elapsed+=span;
   state=advanceMovement(state,{...input(0,elapsed>duration),sprintRamp:{elapsed,duration}},span);
   distance+=state.dz;
   const inside=Math.min(elapsed,duration);
   const acceleration=(MOVEMENT.runSpeed-initial)/duration;
   close(state.velocity,initial+acceleration*inside);
   close(distance,initial*inside+.5*acceleration*inside**2+MOVEMENT.runSpeed*Math.max(0,elapsed-duration));
  }
 }
 let distance=5.5,target=8,previous=distance;
 for(let i=0;i<fps;i++) {
  distance=advanceZoom(distance,target,dt);
  assert(distance>=previous&&distance<=target);previous=distance;
 }
 close(distance,target);
 const yaw=pointerYaw(.3,80);close(pointerYaw(yaw,0),yaw);
}
const shift=new ShiftTap(),held=new Set(['ShiftLeft','KeyW']);
shift.updateWalk(0,held);
shift.press('ShiftLeft',0,held);
const afterStall=shift.sprintTiming(400,held);
const stalledStep=advanceMovement({heading:0,velocity:1.8},{...input(0,afterStall.sprint),sprintRamp:afterStall.ramp},.05);
close(stalledStep.velocity,MOVEMENT.runSpeed);
close(stalledStep.dz,MOVEMENT.runSpeed*.05);
shift.reset();held.delete('KeyW');shift.press('ShiftLeft',0,held);held.add('KeyW');
const lateWalk=shift.sprintTiming(400,held);
assert(lateWalk.sprint&&lateWalk.ramp===null,'Holding Shift at rest must not move the character until a direction is pressed');
assert.equal(locomotionName(input(0,true),0,'Idle'),'Run');
assert.equal(locomotionName(input(),2.4,'Run'),'Run');
assert.equal(locomotionName(input(),1.8,'Run'),'Walk');
assert.equal(locomotionName(released,2.8,'Run'),'Idle');
assert.equal(locomotionName(input(),0,'PivotLeft'),'Walk','Pivot completion inserts Idle');
assert.equal(locomotionName(input(),0,'Walk',true),'Idle','Chain state starts moving');
close(locomotionRate('Walk',1.2),1.1);close(locomotionRate('Run',2.8),1.2);
assert(locomotionRate('Run',.1)<1.2);

globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};};
const data=await fs.readFile(new URL('../output/frog.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
const mixer=new AnimationMixer(gltf.scene),blend=new ActionBlend();
const actions=Object.fromEntries(['Idle','Walk','Run','Attack1','Block'].map(n=>[n,mixer.clipAction(gltf.animations.find(c=>c.name===n))]));
let current;
function change(name) {
 const next=actions[name],phase=gaitTransitionPhase(current,name);
 const weights=new Map(blend.weights);
 next.reset().setEffectiveWeight(1).play();
 if(phase!==null) next.time=phase*next.getClip().duration;
 blend.to(next,transitionDuration(current?.getClip().name,name));
 // Retargeting before the previous fade finishes keeps the actual contribution.
 if(current) for(const [action,w] of weights) close(action.getEffectiveWeight(),w);
 current=next;
 return phase;
}
change('Walk');current.time=.437*current.getClip().duration;
close(change('Run'),.437);close(current.time/current.getClip().duration,.437);
let maximumWeightError=0;
for(let i=0;i<180;i++) {
 if(i%5===0) change(['Idle','Walk','Run','Attack1','Block'][Math.floor(i/5)%5]);
 blend.update(1/120);mixer.update(1/120);
 const sum=[...blend.weights.values()].reduce((a,b)=>a+b,0);
 maximumWeightError=Math.max(maximumWeightError,Math.abs(sum-1));
 close(sum,1);
 gltf.scene.traverse(o=>{if(o.isBone) assert([...o.quaternion].every(Number.isFinite));});
}
blend.update(1);close([...blend.weights.values()][0],1);assert.equal(blend.weights.size,1);
report.animation={phasePreserved:true,interruptedBlendsContinuous:true,maximumWeightError,noIdleOnPivotExit:true,rateMatchesSpeed:true,parameters:ANIMATION};
report.camera={settingsDistance:8,sensitivity:CAMERA.yawSensitivity,noYawDrift:true,zoomNoOvershoot:true};
await fs.writeFile(new URL('../output/animations/control-feel-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('CONTROL_FEEL_VERIFIED',JSON.stringify(report,null,2));
