import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {ENERGY_STATS} from '../src/battle-values.js';
import {SKILL_STATS} from '../src/skills.js';
import {canBackThrow} from '../src/back-throw.js';
import {EQUIPMENT} from '../src/equipment.js';
import {gameFixture} from './game_fixture.mjs';
const pose={x:0,z:0,heading:0,height:0,landed:true,invulnerable:true};
assert.equal(ENERGY_STATS.max,100);assert.equal(ENERGY_STATS.gain,25);assert.equal(SKILL_STATS.longarm.energyCost,30);assert.equal(EQUIPMENT.length,55);
for(const fps of [30,60,144]){const b=new Battle();b.enemy.z=1;b.enemy.heading=Math.PI;b.beginAttack('Attack1');b.resolveAttack(.3,pose);assert.equal(b.player.energy,2);b.beginAttack('AirAttack');b.resolveAttack(.6,pose);assert.equal(b.player.energy,2);b.damageEnemy(b.enemy,1,{label:'波',impactLevel:0,origin:pose,source:'wave'});assert.equal(b.player.energy,2);
 b.reset();b.applyEquipment({skill:'drain'});b.player.health=100;assert(b.beginSkill());b.enemy.z=30;for(let i=0;i<fps;i++)b.update(1/fps,pose);assert(Math.abs(b.player.energy-3)<1e-8);assert.equal(b.player.health,70);
}
const b=new Battle();b.applyEquipment({ultimate:'fistwind'});b.player.energy=100;assert(b.beginRage());assert.equal(b.player.energy,0);assert.equal(b.player.fistwindUntil,30);b.enemy.z=1;b.enemy.heading=Math.PI;b.beginAttack('Attack1');b.resolveAttack(.3,pose);const health=b.enemy.health;b.update(.05,pose);assert.equal(b.enemy.health,health);b.update(.05,pose);assert.equal(b.enemy.health,health-3);assert.equal(b.player.energy,2);assert.equal(b.windQueue.length,0);assert(b.takeEvents().some(e=>e.type==='windShot'));
for(const [ids,level,immune]of [[['armor-impact'],1,true],[['armor-impact'],2,false],[['armor-impact-heavy'],2,true],[['armor-impact-heavy'],3,false]]){const c=new Battle();c.applyEquipment({installed:ids});c.enemy.z=1;c.enemy.heading=Math.PI;c.strikePlayer({...pose,invulnerable:false},{...c.enemy.stats,impactLevel:level});const hit=c.takeEvents().find(e=>e.type==='playerHit');assert(hit);assert.equal(hit.armored,immune);assert.equal(hit.impactLevel,level);}
b.reset('lantern');b.enemy.x=0;b.enemy.z=0;b.enemy.heading=0;assert(canBackThrow({...pose,z:-.5},b.enemy));
const g=await gameFixture();g.freezeEnemy=true;g.read('battle.applyEquipment({ultimate:"fistwind"});battle.player.energy=100;battle.enemy.z=30');g.tap('KeyF');assert(g.read('battle.player.fistwindUntil')>0);g.tick(.2);assert(g.read('fistWindEffects')!==undefined);
console.log('ENERGY_WIND_IMMUNITY_VERIFIED: lantern throw, 18 added items, exact immunity tiers, hit/source rewards, continuous 0.1s drain, wind cost/duration/delay/damage, no energy recursion and real F input/effect lifecycle');
