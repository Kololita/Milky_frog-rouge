import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {PLAYER_STATS,ENERGY_STATS,POTION_STATS} from '../src/battle-values.js';
import {gameFixture} from './game_fixture.mjs';
assert.equal(PLAYER_STATS.attackPower,10);assert.equal(ENERGY_STATS.healRatio,.1);assert.equal(ENERGY_STATS.fullHealRatio,.15);
assert.deepEqual({...POTION_STATS},{capacity:6,healRatio:.5,restGain:3});
const b=new Battle();assert.equal(b.player.potions,6);assert(!b.usePotion());
b.player.health=20;assert(b.usePotion());assert.equal(b.player.health,70);assert.equal(b.player.potions,5);
assert(b.usePotion());assert.equal(b.player.health,100);assert.equal(b.player.potions,4);assert(!b.usePotion());
for(let i=0;i<4;i++){b.player.health=1;assert(b.usePotion());assert.equal(b.player.health,51);}
assert.equal(b.player.potions,0);b.player.health=20;assert(!b.usePotion());
b.refillPotions();assert.equal(b.player.potions,3);assert.equal(b.player.health,20);b.refillPotions();assert.equal(b.player.potions,6);b.refillPotions();assert.equal(b.player.potions,6);
b.applyEquipment({armor:'armor-light'});b.player.health=20;assert(b.usePotion());assert.equal(b.player.health,72.5);
for(const full of [false,true]){
 const e=new Battle();e.player.health=40;e.player.counterReady=true;e.player.counterUntil=5;e.player.energy=full?99:0;e.enemy.z=30;e.beginAbsorption();
 for(let i=0;i<80;i++)e.update(1/60,{x:0,z:0,heading:0,height:0,invulnerable:true});assert.equal(e.player.health,full?55:50);
}
const g=await gameFixture(60,{home:true,equipment:true,run:true});g.freezeEnemy=true;
g.read('enterArena("practice");battle.player.health=25');g.tap('KeyR');assert.equal(g.read('battle.player.health'),75);assert.equal(g.read('battle.player.potions'),5);
g.read('runGame.start(21);battle.player.potions=0;battle.player.health=60;openRestSite(()=>{})');
assert(g.read('restSite.opened&&restSite.group.visible'));assert(g.read('restSite.seat.name')==='休息凳');assert(g.read('actions.Sit.paused'));assert(g.read('modelPivot.position.y')>.2);
const before=g.read('battle.time');g.tick(.5);assert.equal(g.read('battle.time'),before);assert.equal(g.hud.get('rest-options').children.length,2);
const rest=g.hud.get('rest-options').children[0];rest.listeners.get('click')();assert.equal(g.read('battle.player.potions'),3);assert.equal(g.read('battle.player.health'),60);rest.listeners.get('click')();assert.equal(g.read('battle.player.potions'),3,'Repeated rest refills again');
g.read('restSite.close();battle.player.potions=4;openRestSite(()=>{})');g.hud.get('rest-options').children[0].listeners.get('click')();assert.equal(g.read('battle.player.potions'),6);assert.equal(g.read('battle.player.health'),60);
console.log('POTIONS_REST_VERIFIED: 6 charges, half maximum heal including gear, no waste, rest +3 once per visit/cap6, seated scene, paused combat and unchanged energy healing');
