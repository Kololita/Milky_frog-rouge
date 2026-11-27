import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {createSettings} from '../src/settings.js';
const pose={x:0,z:0,height:0,heading:0,invulnerable:true};
for(const fps of [30,60,144]){
 const step=b=>b.update(1/fps,pose);
 const setup=id=>{const b=new Battle();b.reset(id);b.enemy.x=0;b.enemy.z=b.enemyStats.stopDistance;b.enemy.heading=Math.PI;step(b);return b;};
 for(const id of ['raiderElite','stonekeeper','scythemoth']){
  const b=setup(id),e=b.enemy;assert.equal(e.state,'windup');
  b.damageEnemy(e,1,{label:'轻拳',impactLevel:1,origin:pose});assert.equal(e.state,'windup',`${id} light stun-lock`);
  assert(!e.superArmor||e.move.startupResilience>=3);
 }
 const iron=setup('raiderElite');iron.enemy.state='idle';
 for(let i=0;i<3;i++)iron.damageEnemy(iron.enemy,1,{label:'压制',impactLevel:0,origin:pose});
 assert.equal(iron.enemy.move.motion,'shoulder');assert.equal(iron.enemy.telegraph,.55);assert.equal(iron.enemy.state,'windup');
 assert.equal(iron.takeEvents().filter(e=>e.type==='eliteBreakout').length,1);
 iron.enemy.state='idle';for(let i=0;i<6;i++)iron.damageEnemy(iron.enemy,1,{label:'压制',impactLevel:0,origin:pose});
 assert(!iron.takeEvents().some(e=>e.type==='eliteBreakout'),'No breakout cooldown');
 const stone=setup('stonekeeper');stone.enemy.health=stone.enemyStats.health*.5;stone.enemy.state='idle';stone.enemy.decisions=2;step(stone);
 assert.equal(stone.enemy.move.motion,'quake');let quakes=0;
 for(let i=0;i<fps*6;i++){step(stone);quakes+=stone.takeEvents().filter(e=>e.type==='monsterSwing'&&e.label==='岩拳震地').length;}
 assert.equal(quakes,2,'Half-health quake must repeat exactly once');
 const interrupted=setup('stonekeeper');interrupted.enemy.health=1;interrupted.enemy.state='idle';interrupted.enemy.decisions=2;step(interrupted);
 interrupted.impactEnemy(4,pose);let repeats=0;for(let i=0;i<fps*3;i++){step(interrupted);repeats+=interrupted.takeEvents().filter(e=>e.type==='monsterSwing'&&e.label==='岩拳震地').length;}assert.equal(repeats,0,'Interrupted quake repeats');
 const ranged=new Battle();ranged.reset('stonekeeper');ranged.enemy.z=8;step(ranged);assert.equal(ranged.enemy.move.motion,'rock-throw');
 let launched=false;for(let i=0;i<fps*2;i++){step(ranged);launched ||= ranged.enemyProjectiles.length>0;}assert(launched,'Stone ranged pressure missing');
 const mantis=setup('scythemoth');mantis.enemy.health=mantis.enemyStats.health*.5;
 while(mantis.enemy.state==='windup')step(mantis);
 assert.equal(mantis.enemy.recovery,.32*.75);
 const labels=[];for(let i=0;i<fps*8;i++){step(mantis);labels.push(...mantis.takeEvents().filter(e=>e.type==='monsterSwing').map(e=>e.label));}
 assert(labels.includes('雷镰贯刺'));assert(!labels.includes('引雷飞镰'),'Pounce accidentally chained after third strike');
 const far=new Battle();far.reset('scythemoth');far.enemy.z=5;step(far);assert.equal(far.enemy.move.motion,'pounce');
}
for(const stored of [null,{bindings:{KeyH:'KeyH',KeyR:'KeyR'}},{bindingRevision:2,bindings:{KeyH:'KeyR',KeyR:'KeyH'}}]){
 const settings=createSettings({}, {localStorage:{getItem:()=>JSON.stringify(stored)}});
 assert.equal(settings.resolve('KeyR'),'KeyH');assert.equal(settings.resolve('KeyH'),'KeyR');
}
const custom=createSettings({}, {localStorage:{getItem:()=>JSON.stringify({bindings:{KeyH:'KeyV',KeyR:'KeyR'}})}});
assert.equal(custom.resolve('KeyV'),'KeyH','Migration overwrites custom potion binding');
console.log('ELITE_MECHANICS_VERIFIED: startup resilience, pressure-break cooldown, repeated quake/cancel, ranged rock, three-strike chain and pounce at 30/60/144FPS; potion binding migration');
