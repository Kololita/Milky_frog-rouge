import assert from 'node:assert/strict';
import {EQUIPMENT,equipmentBonuses,equipmentEffectSummary} from '../src/equipment.js';
import {Battle} from '../src/battle.js';
import {EQUIPMENT_PASSIVES,passiveLevels} from '../src/equipment-passives.js';
import {shapePoolFor} from '../src/equipment-shapes.js';
import {AssemblyLoadout} from '../src/assembly-board.js';
assert.equal(new Set(EQUIPMENT.map(i=>i.id)).size,EQUIPMENT.length);assert(EQUIPMENT.every(i=>i.id&&i.name&&!/待命名|未命名|品质：/.test(i.name)));
for(const item of EQUIPMENT.filter(i=>!['skill','ultimate'].includes(i.slot))){const keys=['health','pose','attack','regen','gold','range','energyGain','potionHeal','physicalResistance'].filter(k=>item[k]);if(item.rarity==='white')assert.equal(keys.length,1);if(item.rarity==='green'&&item.id!=='fist-hunter'){assert.equal(keys.length,item.id==='charm-gold'?1:2);assert(keys.every(k=>item[k]>0));}for(const [id,l]of Object.entries(item.passives))assert(l>0&&l<=EQUIPMENT_PASSIVES[id].max);for(const shape of shapePoolFor(item)){const m=new AssemblyLoadout({rolls:{[item.id]:{shapeId:shape.id}}});m.upgrade('rage');m.upgrade('rage');assert(m.firstFit(item.id),shape.id);}}
assert.equal(passiveLevels(Array(8).fill({passives:{flasks:1,comeback:1}})).flasks,5);assert.equal(passiveLevels(Array(8).fill({passives:{comeback:1}})).comeback,3);
let b=new Battle();b.applyEquipment({installed:['armor-chain','armor-scale'],ultimate:'rage'});assert.equal(b.potionCapacity,7);assert.equal(b.passives.comeback,1);b.player.health=10;const low=b.playerDamage(1);b.player.health=100;assert(Math.abs(low/b.playerDamage(1)-1.1)<.01);b.player.health=10;b.player.potions=1;b.usePotion();assert.equal(b.player.health,76);assert(equipmentEffectSummary(b.loadout).some(r=>r.key==='passive-comeback'&&r.tooltip));b.applyEquipment({ultimate:'rage'});assert.equal(b.potionCapacity,6);assert.deepEqual(b.passives,{});
const bonus=equipmentBonuses({installed:['armor-heavy','armor-soft']});assert(Math.abs(bonus.resistances.normal/100-(1-.96*.95))<1e-8);
console.log('EQUIPMENT_PASSIVES_VERIFIED: authored values, identifiers, rarity rules, shapes fit, level caps, potion capacity/healing, low-health damage, multiplicative reduction, summary tooltips and removal');

assert(EQUIPMENT.every(item=>item.gold===undefined));const glow=new Battle();glow.applyEquipment({installed:['fist-oath','charm-gold','charm-star']});assert.equal(glow.passives.goldDuration,3);glow.enemy.z=1;glow.enemy.heading=Math.PI;glow.strikePlayer({x:0,z:0,heading:0,height:0,guarding:true,guardElapsed:0});assert.equal(glow.player.counterUntil-glow.time,8);assert(equipmentEffectSummary(glow.loadout).some(r=>r.key==='passive-goldDuration'&&r.value==='等级 3/3'));
