import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Battle} from '../src/battle.js';
import {beginBossSequence,SAMURAI_RECOVERY,SAMURAI_AIM} from '../src/samurai.js';
import {canBackThrow} from '../src/back-throw.js';
import {createEnemyView} from '../src/enemy-view.js';
import {attackWarningActive,attackWarningColor,attackWarningStart} from '../src/attack-warning.js';
const pose={x:0,z:-1.4,heading:0,height:0,invulnerable:true};
const waits=[];
for(const fps of [30,60,144])for(const phase of [1,2]){
 const b=new Battle();b.reset('samurai');const e=b.enemy;e.x=e.z=e.heading=0;e.phase=phase;beginBossSequence(b,'heavy');
 assert.equal(e.telegraph,3);
 const warningAt=attackWarningStart(e.hitAt);
 assert(!attackWarningActive(warningAt-.001,e.hitAt));
 assert(attackWarningActive(warningAt,e.hitAt));
 assert.equal(attackWarningColor(e.move),'#ff3030');
 let swings=0;
 while(e.state==='windup'){
  const previous=e.heading;b.update(1/fps,pose);
  const turn=Math.atan2(Math.sin(e.heading-previous),Math.cos(e.heading-previous));
  assert(Math.abs(turn)<=SAMURAI_AIM['buried-overhead'].rate/fps+1e-8);
  swings+=b.takeEvents().filter(event=>event.type==='bossSwing').length;
 }
 assert.equal(swings,1);assert(e.extracting&&e.state==='recover');assert(e.recovery>=1&&e.recovery<=2);assert(!e.superArmor);
 const rear={x:e.x-Math.sin(e.heading),z:e.z-Math.cos(e.heading),height:0};assert(canBackThrow(rear,e,b.time));
 const scene=new THREE.Scene(),view=createEnemyView(scene),camera=new THREE.PerspectiveCamera();
 e.elapsed=e.recovery*.2;view.update(b,camera,1/fps);scene.updateMatrixWorld(true);
 const tip1=view.sword.localToWorld(new THREE.Vector3(0,-.4,0));assert(Math.abs(tip1.y+.035)<1e-6,'Sword is not planted at ground');
 e.elapsed=e.recovery*.6;view.update(b,camera,1/fps);scene.updateMatrixWorld(true);
 const tip2=view.sword.localToWorld(new THREE.Vector3(0,-.4,0));assert(tip1.distanceTo(tip2)<1e-6,'Sword slides during extraction');
 assert.equal(view.sword.material.color.getHexString(),'529fff');
 while(e.state==='recover'){b.update(1/fps,pose);assert(!b.takeEvents().some(event=>event.type==='bossSwing'),'Extraction deals repeated damage');}
 assert.equal(e.state,'circle');assert(e.circleDuration>=2&&e.circleDuration<=6);waits.push(e.circleDuration);
}
for(const name of ['quick','delay','mixed','thrust','sweep']){
 const b=new Battle();b.reset('samurai');const e=b.enemy;e.x=e.z=0;beginBossSequence(b,name);
 for(const t of [.01,e.telegraph+.05]){
  e.elapsed=t;const p={...pose,x:2,z:1};const expected=Math.atan2(p.x-e.x,p.z-e.z);b.update(.001,p);assert(Math.abs(e.heading-expected)<1e-9);
 }
 assert.equal(attackWarningColor(e.move),'#ffffff');
}
for(let seed=1;seed<15;seed++){
 const b=new Battle();b.reset('samurai');const e=b.enemy;e.seed=seed*7281;e.x=e.z=0;beginBossSequence(b,'quick');
 e.moveIndex=1;e.move=e.sequence[1];e.state='recover';e.linkRecovery=false;e.recovery=SAMURAI_RECOVERY.settle;e.elapsed=e.recovery;
 b.update(.001,pose);assert(e.circleDuration>=2&&e.circleDuration<=6);waits.push(e.circleDuration);
}
assert(new Set(waits).size>10);
{
 const b=new Battle();b.reset('samurai');beginBossSequence(b,'heavy');
 const scene=new THREE.Scene(),v=createEnemyView(scene),camera=new THREE.PerspectiveCamera(),heights=[];
 for(const t of [.48,.9,1.8,2.94,3.1,3.3]){
  b.enemy.elapsed=t;v.update(b,camera,1/60);scene.updateMatrixWorld(true);
  const hand=v.arms[1].elbow.localToWorld(new THREE.Vector3(0,-.26,0)),handle=v.sword.localToWorld(new THREE.Vector3(0,.65,0));
  assert(hand.distanceTo(handle)<.06,'Support fist detached from hilt');heights.push(handle.y);
 }
 assert(heights[2]>heights[1]+.15&&heights[3]>heights[2]+.05,'Charge stops raising the sword');
 assert(heights[5]<heights[3]-.7,'Downstroke lacks amplitude');
}
console.log('BOSS_HEAVY_VERIFIED: 3s cue, limited heavy tracking, planted sword opening, live attack tracking and 800ms warning');
