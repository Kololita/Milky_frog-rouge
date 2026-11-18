import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Battle} from '../src/battle.js';
import {guardTier,dodgeInvulnerable} from '../src/defense.js';
import {DODGE_DEFENSE,COMBAT_FPS,GUARD_STATS} from '../src/battle-values.js';

const pose={x:0,z:0,heading:0,height:0,guarding:false,invulnerable:false};
const report={dodgeWindows:[],guardGrades:[]};
for(const [name,{startFrame,frames}] of Object.entries(DODGE_DEFENSE)) {
 const start=startFrame/60,end=(startFrame+frames)/60;
 assert(!dodgeInvulnerable(name,start-1e-5));assert(dodgeInvulnerable(name,start));
 assert(dodgeInvulnerable(name,end-1e-5));assert(!dodgeInvulnerable(name,end));
 let count=0;for(let frame=0;frame<60;frame++)if(dodgeInvulnerable(name,frame/60))count++;
 assert.equal(count,frames,`${name}: wrong 60Hz frame count`);
 for(const fps of [30,60,144]) {
  let samples=0;
  for(let i=0;i<fps;i++) {
   const elapsed=i/fps,immune=dodgeInvulnerable(name,elapsed),b=new Battle();b.enemy.z=1;b.enemy.heading=Math.PI;
   b.strikePlayer({...pose,invulnerable:immune});assert.equal(b.player.health,immune?100:88);
   if(immune)samples++;
  }
  assert(Math.abs(samples/fps-frames/COMBAT_FPS)<=1/fps+1e-8,'FPS changes the invulnerability duration');
 }
 report.dodgeWindows.push({name,startFrame,frames,start,end});
}
assert(!dodgeInvulnerable('Idle',.1));assert(!dodgeInvulnerable('DodgeRoll',NaN));
const cases=[
 [0,'perfect',5,0],[8,'perfect',5,0],[8.001,'precise',10,0],
 [14,'precise',10,0],[14.001,'good',16,0],[20,'good',16,0],
 [20.001,'normal',24,0],[30,'normal',24,0],[30.001,'late',24,3.6],[120,'late',24,3.6],
];
for(const [frame,grade,cost,damage] of cases) {
 assert.equal(guardTier(frame/60).name,grade);
 const b=new Battle();b.enemy.z=1;b.enemy.heading=Math.PI;
 b.strikePlayer({...pose,guarding:true,guardElapsed:frame/60});
 assert.equal(b.player.health,100-damage);assert.equal(b.player.guard,100-cost);
 const hit=b.takeEvents().find(e=>e.type==='blocked');assert.equal(hit.grade,grade);assert.equal(hit.guardSpent,cost);assert.equal(hit.damage,damage);
 report.guardGrades.push({frame,grade,cost,damage});
}
for(const [frame,grade] of [[6,'perfect'],[6.001,'precise'],[8,'precise']]) {
 assert.equal(guardTier(frame/60,.75).name,grade);
 const b=new Battle();b.enemy.z=1;b.enemy.heading=Math.PI;
 b.strikePlayer({...pose,guarding:true,guardElapsed:frame/60,guardPerfectScale:.75});
 assert.equal(b.takeEvents().find(e=>e.type==='blocked').grade,grade);
}
for(const initial of [0,1,3,5,6,100]) {
 const b=new Battle();b.enemy.z=1;b.enemy.heading=Math.PI;b.player.guard=initial;
 for(let i=0;i<25;i++)b.strikePlayer({...pose,guarding:true,guardElapsed:4/60});
 assert.equal(b.player.guard,1);assert.equal(b.player.health,100);assert(!b.takeEvents().some(e=>e.type==='guardBroken'));
}
for(const [elapsed,expected] of [[20/60,6],[31/60,9.6]]) {
 const b=new Battle();b.enemy.z=1;b.enemy.heading=Math.PI;b.player.guard=10;
 b.strikePlayer({...pose,guarding:true,guardElapsed:elapsed});
 assert.equal(b.player.guard,0);assert.equal(b.player.health,100-expected);assert(b.takeEvents().some(e=>e.type==='guardBroken'));
}
{
 const late=new Battle();late.enemy.z=1;late.enemy.heading=Math.PI;
 for(let i=0;i<3;i++)late.strikePlayer({...pose,guarding:true,guardElapsed:1});
 assert.equal(late.player.health,89.2);assert.equal(late.player.guard,28,'Late chip damage incorrectly grants invulnerability');
 const b=new Battle();b.enemy.z=1;b.enemy.heading=Math.PI;b.player.lateGuardDamageRatio=.15;
 b.strikePlayer({...pose,guarding:true,guardElapsed:1});assert.equal(b.player.health,98.2);assert.equal(GUARD_STATS.lateDamageRatio,.3);
 b.reset();assert.equal(b.player.lateGuardDamageRatio,.3);
 b.enemy.z=-1;b.enemy.heading=0;b.strikePlayer({...pose,guarding:true,guardElapsed:0});assert.equal(b.player.health,88,'Perfect guard incorrectly protects the back');
}
report.repeatPerfectFrames=6;report.perfectGuardMinimumOne=true;report.buffRatioIndependent=true;report.insufficientGuardStillBreaks=true;report.rearStillVulnerable=true;
await fs.writeFile(new URL('../output/animations/defense-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('DEFENSE_RULES_VERIFIED',JSON.stringify(report));
