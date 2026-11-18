import assert from 'node:assert/strict';
import {ShiftTap} from '../src/shift-tap.js';
import {guardTier} from '../src/defense.js';
import {Battle} from '../src/battle.js';
import {gameFixture} from './game_fixture.mjs';
for(const [walkMs,window] of [[0,300],[199,300],[200,200],[900,200]])for(const delta of [0,.01]){
 const shift=new ShiftTap(),keys=new Set(['KeyW']);shift.updateWalk(0,keys);shift.press('ShiftLeft',walkMs,keys);
 assert.equal(shift.release('ShiftLeft',walkMs+window+delta,keys)!==null,delta===0);
}
const shift=new ShiftTap(),keys=new Set(['KeyW']);shift.updateWalk(0,keys);shift.press('ShiftLeft',0,keys);
assert(!shift.sprinting(300,keys));assert(shift.sprinting(300.01,keys));shift.updateWalk(600,new Set());assert(!shift.sprinting(900,new Set()));
const pose={x:0,z:0,heading:0,height:0,guarding:true};
for(const [frames,cost,grade] of [[10,2,'perfect'],[10.001,5,'precise'],[18,5,'precise'],[18.001,10,'good'],[30,10,'good'],[30.001,12,'normal'],[60,12,'normal'],[60.001,15,'late']]){
 assert.equal(guardTier(frames/60).name,grade);
 const b=new Battle();b.enemy.z=1;b.enemy.heading=Math.PI;b.strikePlayer({...pose,guardElapsed:frames/60});
 assert.equal(b.player.pose,100-cost);assert.equal(b.player.health,grade==='late'?96.4:100);
}
assert.equal(guardTier(7.5/60,.75).name,'perfect');assert.equal(guardTier(7.501/60,.75).name,'precise');
for(const fps of [30,60,144]){
 const g=await gameFixture(fps);g.freezeEnemy=true;
 g.key('ShiftLeft');g.tick(.25);g.key('ShiftLeft',false);assert(g.read('Boolean(activeDodge)'));
 g.reset();g.key('KeyW');g.tick(.25);g.key('ShiftLeft');g.tick(.18);g.key('ShiftLeft',false);assert(g.read('Boolean(activeDodge)'));
 g.reset();g.key('KeyW');g.tick(.25);g.key('ShiftLeft');g.tick(.24);assert(g.read('currentMovement().sprint&&velocity>1.6'));g.key('ShiftLeft',false);assert(!g.read('activeDodge'));
 g.reset();g.key('KeyW');g.key('ShiftLeft');g.tick(.1);assert(!g.read('currentMovement().sprint'));g.tick(.23);assert(g.read('currentMovement().sprint'));
}
console.log('NEW_CONTROLS_VERIFIED: guard tiers/costs, repeat penalty, 300/200ms tap boundaries, walking threshold and sprint');
