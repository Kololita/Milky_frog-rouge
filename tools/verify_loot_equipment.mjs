import assert from 'node:assert/strict';
import {EQUIPMENT,RARITIES,EQUIPMENT_SLOTS} from '../src/equipment.js';
import {resolveEquipment,equipmentDescription} from '../src/equipment-rolls.js';
import {rollLoot} from '../src/loot.js';
import {Battle} from '../src/battle.js';
import {RunProgress} from '../src/run-map.js';
import {gameFixture} from './game_fixture.mjs';
import {STARTING_LOADOUT,STARTING_ITEMS} from '../src/equipment-catalog.js';
assert.equal(new Set(EQUIPMENT.map(item=>item.id)).size,EQUIPMENT.length);
for(const item of EQUIPMENT)assert(RARITIES[item.rarity]);
let seed=78531;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(const kind of ['monster','elite']){
 const counts={white:0,green:0,blue:0,purple:0,gold:0};
 for(let n=0;n<10000;n++){
  const choices=rollLoot(kind,random);assert.equal(choices.length,2);assert.notEqual(choices[0],choices[1]);
  for(const id of choices){const item=EQUIPMENT.find(item=>item.id===id);counts[item.rarity]++;assert.notEqual(id,'rage');assert((kind==='monster'?['white','green','blue']:['green','blue','purple','gold']).includes(item.rarity));}
 }
 if(kind==='monster')assert(counts.white>counts.green&&counts.green>counts.blue);
 else assert(counts.green>counts.blue&&counts.blue>counts.purple&&counts.purple>counts.gold);
}
for(const kind of ['monster','elite']){
 const blueRoll=kind==='monster'?.99:.6,draws=[blueRoll,0,blueRoll,0];
 assert.deepEqual(rollLoot(kind,()=>draws.shift(),STARTING_ITEMS),['longarm','drain']);
 for(const id of ['longarm','drain'])assert.equal(EQUIPMENT.find(item=>item.id===id).rarity,'blue');
}
const b=new Battle();assert.deepEqual(b.loadout,STARTING_LOADOUT);b.player.energy=99;assert(b.beginRage());b.applyEquipment({armor:'armor-chain'});assert.equal(b.maxHealth,130);assert.equal(b.maxPose,100);assert.equal(b.player.pose,100);
b.reset();assert.equal(b.player.pose,100);b.beginBreakLaugh();assert.equal(b.breakLaugh.duration,6);b.time=5.99;b.update(.01,{x:20,z:20,heading:0,height:0,invulnerable:true});assert.equal(b.player.pose,100);assert.equal(b.breakLaugh,null);
const run=new RunProgress(83);assert.deepEqual(run.inventory,STARTING_ITEMS);run.select(run.available()[0].id);run.begin();run.finish(true);assert.equal(run.status,'reward');assert(!run.advance());const id=run.lootChoices[0];assert(run.claimReward(id));assert(!run.claimReward(id));assert.deepEqual(run.inventory,[...STARTING_ITEMS,id]);
const g=await gameFixture(60,{home:true,equipment:true,run:true});g.freezeEnemy=true;
g.read('battle.applyEquipment({armor:"armor-sun",ultimate:"rage"})');g.hud.get('home-new-game').listeners.get('click')();
assert.deepEqual(g.read('equipmentMenu.ownedIds'),['rage']);assert.deepEqual(g.read('battle.loadout'),STARTING_LOADOUT);assert.equal(g.read('battle.maxHealth'),100);
g.hud.get('run-map-canvas').children.find(button=>!button.disabled).listeners.get('click')();
g.hud.get('equipment-start').listeners.get('click')();g.read('battle.enemy.health=0;battle.enemy.state="dead"');g.tickFrames(1);assert.equal(g.read('runGame.run.status'),'reward');
assert.equal(g.hud.get('loot-choices').children.length,2);for(const [i,id]of g.read('runGame.run.lootChoices').entries()){const roll=g.read('runGame.run.lootRolls')[id];assert.equal(g.hud.get('loot-choices').children[i].children[3].textContent,equipmentDescription(resolveEquipment(id,roll)),'Reward card shows unscaled base values');}const choice=g.read('runGame.run.lootChoices[0]'),awardedRoll=g.read('runGame.run.lootRolls[runGame.run.lootChoices[0]]');g.hud.get('loot-choices').children[0].listeners.get('click')();g.hud.get('loot-confirm').listeners.get('click')();
assert.deepEqual(g.read('equipmentMenu.ownedIds'),['rage',choice]);assert.deepEqual(g.read('equipmentMenu.assembly.rolls')[choice],awardedRoll,'Reward shape changed on claim');assert.deepEqual(g.read('battle.loadout'),STARTING_LOADOUT,'Loot auto-equips without selection');
g.hud.get('run-result-next').listeners.get('click')();g.hud.get('run-map-canvas').children.find(button=>!button.disabled).listeners.get('click')();
const item=EQUIPMENT.find(item=>item.id===choice);
g.read(`equipmentMenu.place(${JSON.stringify(choice)},1,1)`);assert(g.read('battle.loadout.installed').includes(choice));
assert.equal(g.hud.get('assembly-pieces').children[0].attributes['data-rarity'],item.rarity);
g.read('equipmentMenu.close();runGame.start(35)');assert.deepEqual(g.read('equipmentMenu.ownedIds'),['rage']);assert.deepEqual(g.read('battle.loadout'),STARTING_LOADOUT);
g.hud.get('run-map-canvas').children.find(button=>!button.disabled).listeners.get('click')();
g.read('equipmentMenu.grant("longarm");equipmentMenu.place("longarm",1,1)');
assert.equal(g.hud.get('assembly-pieces').children[0].attributes['data-rarity'],'blue');
g.hud.get('equipment-start').listeners.get('click')();g.read('battle.player.energy=33');g.tap('KeyE');assert(g.read('battle.attackRangeMultiplier')>1.2);
g.read('battle.player.energy=99');g.tap('KeyF');assert(g.read('battle.isRaging()'));assert.equal(g.read('battle.player.energy'),0);
console.log('LOOT_EQUIPMENT_VERIFIED: default owned/equipped rage, starter excluded from loot, both blue skills in normal/elite rewards, skill equip/E, ultimate F, rarity distribution, reset and gear stats');
