import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {TargetLock,worldCameraPose,targetLockAngle} from '../src/world-camera.js';
import {CAMERA,TARGET_LOCK} from '../src/control-tuning.js';
const rad=d=>d*Math.PI/180,delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const player={x:0,y:0,z:0},enemy={x:0,z:3.6,health:160};
const makeOrbit=yaw=>({yaw,pitch:CAMERA.pitch,distance:5.5});
const report={thresholds:[],recenter:[]};
function yawForEnemyAngle(degrees) {
 let lo=0,hi=Math.PI;
 for(let i=0;i<70;i++){const mid=(lo+hi)/2,angle=targetLockAngle(player,enemy,worldCameraPose(makeOrbit(mid),player).position);if(angle>rad(degrees))hi=mid;else lo=mid;}
 return (lo+hi)/2;
}
assert(Math.abs(TARGET_LOCK.tolerance-rad(20))<1e-12);
for(const angle of [19.99,20,20.01]) {
 const lock=new TargetLock(),orbit=makeOrbit(yawForEnemyAngle(angle)),before=orbit.yaw;
 lock.toggle(enemy);lock.update(orbit,player,1/60,{aspect:3});
 assert.equal(orbit.yaw!==before,angle>20,`Incorrect 20° triangle threshold at ${angle}`);
 report.thresholds.push({angle,corrects:orbit.yaw!==before});
}
for(const fps of [30,60,144]) {
 const lock=new TargetLock(),orbit=makeOrbit(rad(125));lock.toggle(enemy);
 let last=Math.abs(delta(0,orbit.yaw)),continuesInsideDeadZone=false;
 for(let i=0;i<fps;i++) {
  const previous=orbit.yaw;lock.update(orbit,player,1/fps);
  const error=Math.abs(delta(0,orbit.yaw));assert(error<=last+1e-9,'Recenter overshoots');
  assert(Math.abs(orbit.yaw-previous)<=TARGET_LOCK.maxYawRate/fps+1e-8,'Camera snaps instead of smoothing');
  if(targetLockAngle(player,enemy,worldCameraPose(orbit,player).position)<rad(20)&&lock.correcting)continuesInsideDeadZone=true;
  last=error;
 }
 assert(last<1e-8);assert(!lock.correcting);assert(continuesInsideDeadZone,'Camera stops as soon as angle falls below 20°');
 const aligned=orbit.yaw;lock.update(orbit,player,1/fps);assert.equal(orbit.yaw,aligned);
 lock.toggle(enemy);orbit.yaw=.3;lock.update(orbit,player,1/fps);assert.equal(orbit.yaw,.3);
 report.recenter.push({fps,settledYawError:last,continuedToZero:true,maxRateRespected:true});
}
{
 const lock=new TargetLock(),orbit=makeOrbit(0),behind={x:0,z:-12,health:1};lock.toggle(behind);
 assert(targetLockAngle(player,behind,worldCameraPose(orbit,player).position)<1e-10);
 lock.update(orbit,player,1/60);assert(lock.correcting,'Collinear target behind camera is never brought in front');
 for(let i=0;i<80;i++)lock.update(orbit,player,1/60);
 assert(Math.abs(delta(Math.PI,orbit.yaw))<1e-8);
 behind.health=0;const before=orbit.yaw;lock.update(orbit,player,.016);assert.equal(lock.target,null);assert.equal(orbit.yaw,before);
 assert(!lock.toggle(behind));
 lock.toggle(enemy);lock.update(orbit,player,.016,{playerAlive:false});assert.equal(lock.target,null);
 const close={x:.01,z:.01,health:1};lock.toggle(close);for(let i=0;i<10;i++)lock.update(orbit,player,.016);assert(Number.isFinite(orbit.yaw));
}
{
 const target={x:Math.sin(rad(-179))*3.6,z:Math.cos(rad(-179))*3.6,health:1};
 const lock=new TargetLock(),orbit=makeOrbit(rad(170));lock.toggle(target);lock.correcting=true;
 lock.update(orbit,player,1/60);assert(orbit.yaw>rad(170),'Camera takes the 349° route around the yaw seam');
 for(let i=0;i<60;i++)lock.update(orbit,player,1/60);assert(Math.abs(delta(rad(-179),orbit.yaw))<1e-8);
}
report.ignoresHeading=true;report.behindCameraRecovered=true;report.deadTargetUnlocks=true;report.closeTargetFinite=true;report.shortestArc=true;
await fs.writeFile(new URL('../output/animations/target-lock-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('TARGET_LOCK_VERIFIED',JSON.stringify(report));
