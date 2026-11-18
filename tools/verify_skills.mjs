import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {ATTACK_STATS,WAVE_STATS,ENERGY_STATS} from '../src/battle-values.js';
import {EQUIPMENT_SLOTS} from '../src/equipment.js';
import {gameFixture} from './game_fixture.mjs';
assert.equal(Object.keys(EQUIPMENT_SLOTS).length,5);
const pose={x:0,z:0,heading:0,height:0,landed:true};
{
 const b=new Battle();b.player.energy=99;assert(!b.beginSkill());
 b.applyEquipment({skill:'longarm'});b.player.energy=32;assert(!b.beginSkill());assert.equal(b.player.energy,32);
 b.player.energy=33;assert(b.beginSkill());assert.equal(b.player.energy,0);assert.equal(b.attackRangeMultiplier,1.2);
 assert(!b.beginSkill());
 b.enemy.z=ATTACK_STATS.Attack1.range*1.1+b.enemy.radius;b.enemy.superArmor=true;
 b.beginAttack('Attack1');b.resolveAttack(.3,pose);assert.equal(b.enemy.health,b.enemy.maxHealth-10,'Longarm does not extend melee reach');
 assert(Math.abs(b.launchWave(pose).range/WAVE_STATS.range-1.2)<1e-9);
 b.time=30;assert.equal(b.attackRangeMultiplier,1);b.player.energy=33;assert(b.beginSkill());
 b.applyEquipment({skill:'drain'});assert.equal(b.attackRangeMultiplier,1,'Unequipped skill remains active');
 b.applyEquipment({ultimate:null});assert(!b.beginRage());
}
{
 const b=new Battle();b.applyEquipment({armor:'armor-light',skill:'drain'});assert.equal(b.maxHealth,105);
 b.player.health=31.5;assert(!b.beginSkill());assert.equal(b.player.health,31.5);
 b.player.health=105;assert(b.beginSkill());assert.equal(b.player.health,73.5);assert(!b.beginSkill());
 b.enemy.z=1;b.enemy.health=1000;b.enemy.superArmor=true;b.beginAttack('Attack3');b.resolveAttack(.8,pose);assert.equal(b.player.energy,15);
 b.time=30;b.beginAttack('Attack1');b.resolveAttack(.3,pose);assert.equal(b.player.energy,15);
 b.reset();assert.equal(b.player.drainUntil,0);assert.equal(b.player.energy,0);
}
{
 const b=new Battle();b.applyEquipment({skill:'drain'});b.beginSkill();b.player.counterReady=true;b.player.counterUntil=5;b.beginAbsorption();
 b.time=.63;b.creditAbsorption();b.enemy.z=1;b.beginAttack('Attack1');b.resolveAttack(.3,pose);
 assert(Math.abs(b.player.energy-21.5)<1e-8,'Partial absorption loses skill energy');
 b.player.energy=98;b.beginAttack('Attack1');b.resolveAttack(.3,pose);assert.equal(b.player.energy,ENERGY_STATS.max);
}
for(const fps of [30,60,144]){
 const g=await gameFixture(fps);g.freezeEnemy=true;
 g.read('battle.applyEquipment({skill:"longarm"});battle.player.energy=33');g.tap('KeyE');assert.equal(g.read('battle.player.energy'),0);assert.equal(g.read('battle.attackRangeMultiplier'),1.2);
 g.tap('KeyE');assert.equal(g.read('battle.player.longarmUntil'),30);
}
console.log('SKILLS_VERIFIED: equipment slots/default ultimate, E input, affordability, no repeated charges, range/wave increase, expiry, per-hit drain and energy cap');
