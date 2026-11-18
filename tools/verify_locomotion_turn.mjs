import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {advanceMovement,angleDelta,TURN_RATE} from '../src/movement.js';
import {MOVEMENT} from '../src/control-tuning.js';

const aim=d=>({move:1,sprint:false,direction:{x:Math.sin(d*Math.PI/180),z:Math.cos(d*Math.PI/180)}});
const close=(a,b,eps=1e-8)=>assert(Math.abs(a-b)<eps,`${a} != ${b}`);
for(const fps of [30,60,144]) {
 const dt=1/fps;
 for(const start of [0,179,-179,540]) for(const offset of [-135,-90,-45,45,90,135]) {
  let state={heading:start*Math.PI/180,velocity:1.2};
  const input=aim(start+offset);
  const first=advanceMovement(state,input,dt);
  assert(!first.pivot,'Ordinary steering started a U-turn');
  assert(Math.abs(first.heading-state.heading)<=TURN_RATE*dt+1e-9);
  assert(Math.abs(angleDelta(first.heading,state.heading))>0);
  for(let i=0;i<Math.ceil(.24*fps);i++) {
   const old=state;state=advanceMovement(state,input,dt);
   assert(Math.abs(state.heading-old.heading)<=TURN_RATE*dt+1e-9);
   close(Math.hypot(state.dx,state.dz),state.velocity*dt);
   close(state.dx,Math.sin(state.heading)*state.velocity*dt);
  }
  close(angleDelta(state.heading,Math.atan2(input.direction.x,input.direction.z)),0);
 }
 for(const speed of [1.2,2.8]) for(const degrees of [-180,-165,150,165,180]) {
  let state={heading:0,velocity:speed},x=0,z=0,turnFrames=0;
  const input={...aim(degrees),sprint:speed>2};
  let step=advanceMovement(state,input,dt);
  assert(step.pivot);const duration=step.pivot.duration;
  assert.equal(step.pivot.name,degrees<0?'PivotRight':'PivotLeft');
  close(step.heading,0);
  do {
   state=step;x+=state.dx;z+=state.dz;turnFrames++;
   if(state.pivot?.elapsed>duration*.20) {
    close(state.velocity,0);
    if(state.pivot.elapsed>duration*.20+dt) close(Math.hypot(state.dx,state.dz),0);
   }
   if(!state.pivot) break;
   assert(turnFrames<fps,'Pivot never completes');
   step=advanceMovement(state,input,dt);
  } while(true);
  const remaining=Math.max(0,turnFrames*dt-duration);
  const resumedDistance=speed*(remaining-(1-Math.exp(-MOVEMENT.acceleration*remaining))/MOVEMENT.acceleration);
  close(x,Math.sin(degrees*Math.PI/180)*resumedDistance);
  close(z,speed*duration*.20/3+Math.cos(degrees*Math.PI/180)*resumedDistance);
  close(angleDelta(state.heading,degrees*Math.PI/180),0);
  close(state.velocity,speed*(1-Math.exp(-MOVEMENT.acceleration*remaining)));
  assert(state.pivotCompleted);
  state=advanceMovement(state,input,dt);
  assert(!state.pivot);assert(state.velocity>0);
  assert(state.dz<0,'Does not travel in the reversed direction');
 }
}
// A stopped character and an airborne character must never enter a grounded pivot.
for(const speed of [0,.2,1.2,2.8]) {
 const airborne=advanceMovement({heading:0,velocity:speed},aim(180),1/60,false,{airborne:true});
 assert(!airborne.pivot);
 if(speed<=.2) assert(!advanceMovement({heading:0,velocity:speed},aim(180),1/60).pivot);
}
const started=advanceMovement({heading:0,velocity:2.8},aim(180),1/60);
const locked=advanceMovement(started,aim(90),1/60,true);
assert(!locked.pivot);close(locked.heading,started.heading);close(locked.dx,0);close(locked.velocity,0);
// Releasing/changing direction does not whip the character around in mid-step.
let active=started;
for(let i=0;i<60&&active.pivot;i++) active=advanceMovement(active,{move:0,direction:null,sprint:false},1/60);
assert(!active.pivot);close(angleDelta(active.heading,Math.PI),0);
const report={turnDegreesPerSecond:TURN_RATE*180/Math.PI,reverseThresholdDegrees:150,walkPivotSeconds:MOVEMENT.walkPivotDuration,runPivotSeconds:MOVEMENT.runPivotDuration,brakeBeforeTurn:true,stationaryFootwork:true,noIdleFrameOnCompletion:true,frameRates:[30,60,144],chainAndAirbornePreserved:true};
await fs.writeFile(new URL('../output/animations/locomotion-turn-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('LOCOMOTION_TURN_VERIFIED',report);
