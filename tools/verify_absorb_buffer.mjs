import assert from 'node:assert/strict';
import {gameFixture} from './game_fixture.mjs';
import {Battle} from '../src/battle.js';
for(const fps of [30,60,144]){
 const g=await gameFixture(fps);g.freezeEnemy=true;g.tap('KeyQ');g.mouse(2);g.tick(.2);
 g.read('battle.player.counterReady=true;battle.player.counterUntil=battle.time+3');g.mouse(2,false);g.tick(.05);
 g.key('KeyS');g.key('ShiftLeft');g.tick(.05);g.key('ShiftLeft',false);g.key('KeyS',false);
 assert.equal(g.read('activeDodge?.name'),'DodgeBackflip');
 g.mouse(1);assert.equal(g.read('commandBuffer.pending?.name'),'Absorb');assert(!g.read('battle.absorption'));
 assert(g.until('Boolean(battle.absorption)',2),'Buffered conversion did not fire on landing');
 assert(!g.read('activeDodge'));assert(g.read('battle.time-battle.absorption.start')<=1/fps+1e-6);
 g.tick(1.3);assert.equal(g.read('battle.player.energy'),33);
 g.reset();g.read('battle.player.counterReady=true;battle.player.counterUntil=battle.time+.05;characterState.begin("Attack1");startDodge({x:0,z:-1})');
 g.mouse(1);g.tick(1.4);assert(!g.read('battle.absorption'));assert.equal(g.read('battle.player.energy'),0);
}
{
 const b=new Battle();b.reset('samurai');const e=b.enemy,origin={x:0,z:0,heading:0,height:0,invulnerable:true};
 b.impactEnemy(1,origin,'parry');b.impactEnemy(1,origin,'parry');b.impactEnemy(1,origin,'parry');
 assert.equal(e.state,'idle');assert.equal(e.stun,0);assert(!('parryPoise' in e));
}
console.log('ABSORB_BUFFER_VERIFIED: locked backflip pre-input, immediate landing conversion, expired gold rejection and no forced parry stun');
