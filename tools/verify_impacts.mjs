import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Battle} from '../src/battle.js';
import {IMPACT_LEVELS,ATTACK_STATS} from '../src/battle-values.js';
const pose={x:0,z:0,heading:0,height:0,landed:true,guarding:false,invulnerable:false};
const report={levels:IMPACT_LEVELS,attacks:[],daze:[]};
for(const [name,level] of Object.entries({Attack1:1,Attack2:1,Attack3:0,Attack4:2,RunAttack:2,AirAttack:3})) {
 const b=new Battle();b.enemy.z=1;b.enemy.state='windup';b.enemy.elapsed=.3;
 b.beginAttack(name);b.resolveAttack(ATTACK_STATS[name].times.at(-1),pose);
 assert.equal(b.enemy.health,160-ATTACK_STATS[name].damage*ATTACK_STATS[name].times.length);
 if(level===0) {
  assert.equal(b.enemy.state,'windup');assert.equal(b.enemy.elapsed,.3);assert.equal(b.enemy.knockX,0);assert.equal(b.enemy.knockZ,0);
 } else if(level===3){assert.equal(b.enemy.state,'knockback');assert.equal(b.enemy.dazeUntil,1.2);assert.equal(b.enemy.knockZ,0);}
 else {assert.equal(b.enemy.state,'hurt');assert.equal(b.enemy.stun,IMPACT_LEVELS[level].stun);assert.equal(b.enemy.knockZ,IMPACT_LEVELS[level].knockback*9);}
 report.attacks.push({name,level,health:b.enemy.health,state:b.enemy.state});
}
for(const fps of [30,60,144]) {
 const b=new Battle();b.enemy.z=1;b.enemy.knockX=3;b.enemy.knockZ=4;
 b.beginAttack('AirAttack');b.resolveAttack(.5,pose);const originZ=b.enemy.z;while(b.enemy.state==='knockback')b.update(1/fps,pose);assert(Math.abs(b.enemy.z-originZ-1.2)<1e-8);const {x,z,dazeUntil}=b.enemy;
 let elapsed=0;
 while(b.time+1/fps<dazeUntil-1e-9) {
  b.update(1/fps,pose);elapsed+=1/fps;
  assert.equal(b.enemy.state,'dazed');assert.equal(b.enemy.x,x);assert.equal(b.enemy.z,z);assert.equal(b.player.health,100);
  if(elapsed>.1&&elapsed<.2) {b.beginAttack('Attack3');b.resolveAttack(.2,pose);assert.equal(b.enemy.dazeUntil,dazeUntil);}
 }
 b.update(1/fps,pose);elapsed+=1/fps;
 assert.equal(b.enemy.state,'idle');assert(Math.abs(elapsed-1)<1/fps+1e-8);
 report.daze.push({fps,duration:elapsed,knockbackFirst:1.2,positionFixed:true,extraHitsDoNotExtend:true});
}
{
 const b=new Battle();b.enemy.z=1;b.enemy.state='windup';b.enemy.elapsed=.7;
 b.update(1/60,{...pose,guarding:true,guardElapsed:8/60});
 assert.equal(b.player.health,100);assert.equal(b.player.guard,95);assert(b.player.counterReady);
 assert.equal(b.enemy.state,'hurt','AI overwrote the perfect-guard stagger');assert.equal(b.enemy.stun,IMPACT_LEVELS[1].stun);
 assert.equal(b.enemy.health,160,'Parry should not add free health damage');assert.equal(b.enemy.knockZ,IMPACT_LEVELS[1].knockback*9);
 assert(b.takeEvents().some(e=>e.type==='enemyImpact'&&e.source==='parry'&&e.level===1));
 const armored=new Battle();armored.enemy.z=1;armored.enemy.superArmor=true;armored.enemy.state='windup';armored.enemy.elapsed=.3;
 for(const name of ['AirAttack','Attack4','Attack1']) {armored.beginAttack(name);armored.resolveAttack(.6,pose);assert.equal(armored.enemy.state,'windup');assert.equal(armored.enemy.elapsed,.3);assert.equal(armored.enemy.knockZ,0);assert.equal(armored.enemy.dazeUntil,0);}
 assert.equal(armored.enemy.health,78,'Armor must not prevent health damage');
 b.enemy.z=-1;b.enemy.heading=0;b.strikePlayer(pose);assert(b.player.counterReady,'Damage clears timed counter');b.time=b.player.counterUntil;b.expireCounter();assert(!b.player.counterReady,'Counter outlives 3s');
 const death=new Battle();death.enemy.z=1;death.enemy.health=40;death.beginAttack('AirAttack');death.resolveAttack(.5,pose);assert.equal(death.enemy.state,'dead');assert.equal(death.enemy.dazeUntil,0);
}
report.parryLevelOne=true;report.parryNotOverwrittenByAI=true;report.armorIgnoresImpactButTakesDamage=true;report.deathClearsDaze=true;
await fs.writeFile(new URL('../output/animations/impact-level-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('IMPACT_LEVELS_VERIFIED',JSON.stringify(report));
