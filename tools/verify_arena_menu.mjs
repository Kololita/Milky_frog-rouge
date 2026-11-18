import assert from 'node:assert/strict';
import {ENCOUNTERS} from '../src/encounters.js';
import {FORMATIONS} from '../src/encounter-formations.js';
import {gameFixture} from './game_fixture.mjs';
const g=await gameFixture(60,{home:true,equipment:true,run:true});
assert.equal(g.read('arenaMenu.entries.length'),17);
const ids=g.read('arenaMenu.entries.map(e=>e.id)');
for(const id of Object.keys(FORMATIONS))assert(ids.includes(id),`Missing formation: ${id}`);
assert.equal(g.hud.get('arena-encounters').children.length,3);
assert(g.read('arenaMenu.entries.every(e=>!e.button.disabled)'));
for(const id of ids){
 g.hud.get('home-arena').listeners.get('click')();assert(g.hud.get('boss-arena-dialog').open);
 g.read(`arenaMenu.entries.find(e=>e.id===${JSON.stringify(id)}).button.listeners.get('click')()`);
 assert(!g.hud.get('boss-arena-dialog').open);assert(g.read('equipmentMenu.opened'));assert(!g.read('inPractice'));
 assert(!g.hud.get('equipment-start').hidden);g.hud.get('equipment-start').listeners.get('click')();
 assert.equal(g.read('battle.mode'),id);assert.equal(g.read('battle.enemies.length'),ENCOUNTERS.get(id).members?.length??1);assert.equal(g.read('battle.player.potions'),6);assert(g.read('inPractice'));
 g.tickFrames(1);g.tap('KeyI');assert(!g.read('equipmentMenu.opened'),'Formal arena allows combat equipment swaps');
 g.read('showHome()');assert(!g.read('inPractice'));assert.equal(g.read('runGame.run'),null);
}
console.log('ARENA_MENU_VERIFIED: samurai + 8 formations + 5 solo monsters + 3 elites, shared registry, prebattle equipment, matching spawns, 6 potions and home navigation');
