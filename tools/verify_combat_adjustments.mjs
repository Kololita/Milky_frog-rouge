import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {canBackThrow} from '../src/back-throw.js';
import {MONSTER_STATS} from '../src/monster-catalog.js';
import {createEquipmentMenu} from '../src/equipment.js';
const pose={x:0,z:-.5,height:0,heading:0,guarding:true,guardElapsed:0};
for(const id of ['scythemoth','lantern','shellbug','spitter']){const b=new Battle();b.reset(id);b.enemy.x=0;b.enemy.z=0;b.enemy.heading=0;assert(!canBackThrow(pose,b.enemy));}
const b=new Battle();b.reset('raider',{floor:15});assert.equal(b.enemy.maxHealth,MONSTER_STATS.raider.health*1.42);assert(Math.abs(b.enemy.attackPower-MONSTER_STATS.raider.attackPower*1.14)<1e-8);b.player.energy=90;b.clearBattleEffects();assert.equal(b.player.energy,0);b.reset('practice',{floor:15});assert.equal(b.enemy.maxHealth,b.enemy.stats.health);
const m=createEquipmentMenu({getElementById:()=>null},{},{});m.sandbox({maxLevel:true});assert.equal(m.assembly.boards.rage.level,2);m.startRun();assert.equal(m.assembly.boards.rage.level,0);
for(const stats of Object.values(MONSTER_STATS))for(const move of stats.moves)if(move.dealsDamage)assert(move.startupResilience>=1);
console.log('COMBAT_ADJUSTMENTS_VERIFIED: energy clearing, anatomy, floor scaling, arena upgrade and attack resilience');
