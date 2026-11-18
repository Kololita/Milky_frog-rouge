import assert from 'node:assert/strict';
import {gameFixture} from './game_fixture.mjs';
import {AirSlam,airSlamRate,ATTACK_RATE} from '../src/combat.js';
const slam=new AirSlam(.6);assert.equal(airSlamRate(.1,slam),1);assert.equal(airSlamRate(slam.landTime+.1,slam,2),1);assert.equal(airSlamRate(.1,slam,1.2),1.2);
for(const fps of [30,60,144]){
 const g=await gameFixture(fps);g.freezeEnemy=true;g.read('battle.enemy.z=30');g.tap('KeyJ');assert(g.until('activeGesture?.gapStartedAt!==undefined',2));const start=g.read('battle.time');g.tick(.05);assert.equal(g.read('activeGesture.name'),'Attack1');assert(g.until('activeGesture?.name!=="Attack1"',1));assert(g.read('battle.time')-start>=ATTACK_RATE.normalGap-1/fps-1e-8);
 g.reset();g.read('battle.enemy.z=30');g.tap('Space');g.tick(.12);g.tap('KeyJ');assert(g.read('activeAirAttack'));const time=g.read('battle.time'),expected=g.read('activeAirAttack.timeline.duration');assert(g.until('!activeAirAttack',5));assert(Math.abs(g.read('battle.time')-time-expected)<3/fps,'Air slam inherited interval multiplier');
}
console.log('ATTACK_FEEL_VERIFIED: normal attacks add 0.1s, air slam timing independent of interval, impact/get-up not accelerated, tested at 30/60/144fps');
