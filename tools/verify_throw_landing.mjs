import assert from 'node:assert/strict';
import {gameFixture} from './game_fixture.mjs';
import {BACK_THROW,backThrowLandingTime,sampleBackThrow} from '../src/back-throw.js';
const state={origin:{x:0,z:0},targetOrigin:{x:0,z:1},heading:0};
const landing=backThrowLandingTime();assert(Math.abs(landing-2.85)<1e-9);assert(landing<BACK_THROW.duration);
assert(!sampleBackThrow(state,landing-.001).hero.landed);assert(sampleBackThrow(state,landing).hero.landed);
assert(sampleBackThrow(state,landing).hero.height<1e-8);
for(const fps of [30,60,144]){
 const g=await gameFixture(fps);g.freezeEnemy=true;
 g.read('battle.enemy.z=1.05;battle.enemy.heading=0');g.tap('KeyJ');
 assert(g.read('Boolean(battle.backThrow)'));g.key('KeyW');
 while(g.read('battle.backThrow?.elapsed??Infinity')<landing-1/fps)g.tickFrames(1);
 assert(g.read('Boolean(battle.backThrow)'),'Unlocked before landing');
 assert(g.until('!battle.backThrow',.1));assert(g.read('characterState.isFree'));
 assert(g.read('battle.time')<3,'Still waits for whole clip after landing');
 const recovery=g.read('battle.enemy.riseUntil'),before=g.read('player.position.clone()');g.tick(.1);
 assert(g.read('player.position.clone()').distanceTo(before)>.03,'Held movement does not resume after landing');
 assert.equal(g.read('battle.enemy.riseUntil'),recovery,'Player unlock changed target recovery');
}
console.log('THROW_LANDING_VERIFIED: immediate landing unlock, held movement and unchanged enemy recovery at 30/60/144FPS');
