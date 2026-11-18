import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gameFixture} from './game_fixture.mjs';
import {ATTACK_STATS,ENEMY_STATS} from '../src/battle-values.js';

const report=[];
for(const fps of [30,60,144]) {
 const game=await gameFixture(fps);const {read,tap,mouse,tick,until,reset,events,hud}=game;
 game.freezeEnemy=true;
 for(let stage=1;stage<=4;stage++) {
  reset();read(`battle.enemy.z=1.05;combo.enter(${stage});playAttack(${stage});`);
  assert(until('!activeGesture',2));
  const expected=ATTACK_STATS['Attack'+stage];
  assert.equal(read('battle.enemy.health'),160-expected.damage*expected.times.length,`Attack${stage} fails in live loop at ${fps}FPS`);
  assert.equal(events.filter(e=>e.type==='enemyHit').length,expected.times.length);
  assert.equal(hud.get('enemy-value').textContent,`目标 ${160-expected.damage*expected.times.length} / 160`);
 }
 reset();read('battle.enemy.z=1.05');mouse(0);tick(.05);mouse(2);tick(.4);
 assert.equal(read('battle.enemy.health'),160,'Guard-cancelled punch still causes damage');
 mouse(2,false);mouse(0);assert.equal(read('activeGesture.name'),'Attack1');
 assert(until('!activeGesture',2));assert.equal(read('battle.enemy.health'),150);

 reset();read('battle.enemy.z=30');game.key('KeyW');game.key('ShiftLeft');tick(.4);mouse(0);
 assert.equal(read('activeGesture.name'),'RunAttack');read('battle.enemy.x=player.position.x;battle.enemy.z=player.position.z+1.05');
 assert(until('!activeGesture',2));assert.equal(read('battle.enemy.health'),138,'Sprint palm has no live damage');

 reset();read('battle.enemy.z=30');tap('Space');tick(.3);mouse(0);read('battle.enemy.x=player.position.x;battle.enemy.z=player.position.z+1.1');
 assert.equal(read('activeGesture.name'),'AirAttack');tick(.25);
 assert.equal(read('battle.enemy.health'),160,'Air slam damages before landing');
 assert(until('Boolean(activeAirAttack?.impacted)',2));assert.equal(read('battle.enemy.health'),120,'Landing does not apply slam damage');
 tick(.15);assert.equal(events.filter(e=>e.type==='enemyHit').length,1,'Slam impact repeats on every grounded frame');

 game.freezeEnemy=false;reset();mouse(2);
 read('battle.enemy.z=1.05;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.elapsed=.7;');tick(1/fps);
 assert.equal(read('battle.player.health'),100);assert.equal(read('battle.player.guard'),95);
 assert.equal(hud.get('health-value').textContent,'100 / 100');assert.equal(hud.get('guard-value').textContent,'95 / 100');
 assert(events.some(e=>e.type==='blocked'&&e.grade==='perfect'));
 assert.equal(read('activeGesture.name'),'Block');
 read('battle.enemy.z=-1.05;battle.enemy.heading=0;battle.enemy.state="windup";battle.enemy.elapsed=.7;');tick(1/fps);
 assert.equal(read('battle.player.health'),88);assert.equal(read('activeGesture.name'),'Hit');
 assert.equal(read('combo.stage'),0);assert.equal(hud.get('health-value').textContent,'88 / 100');

 reset();mouse(2);tick(.26);read('battle.player.guard=10;battle.enemy.z=1.05;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.elapsed=.7');tick(1/fps);
 assert.equal(read('battle.player.health'),94);assert.equal(read('battle.player.guard'),0);assert.equal(read('activeGesture.name'),'Hit');
 tick(.4);assert.equal(read('activeGesture.name'),'Hit','Guard break stun ended too early');
 tick(.5);assert.notEqual(read('activeGesture?.name'),'Hit');

 reset();read('battle.player.health=12;battle.enemy.z=1.05;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.elapsed=.7');tick(1/fps);
 assert.equal(read('battle.player.health'),0);assert.equal(read('activeGesture.name'),'Defeated');mouse(0);assert.equal(read('activeGesture.name'),'Defeated');
 tick(3.1);assert.equal(read('battle.player.health'),100);assert.equal(read('battle.enemy.health'),160);assert(read('characterState.isFree'));
 assert.equal(read('player.position.lengthSq()'),0);

 reset();tick(6);
 assert(read('battle.player.health<100'),'Enemy never approaches and attacks naturally');
 assert(read('enemyView.group.children.length>=3'),'Enemy visual missing');
 assert(read('Number.isFinite(enemyView.group.position.z)'));
 report.push({fps,allFourAttacks:true,tripleHitCount:3,guardCancelStopsDamage:true,sprintPalmDamage:22,slamDamage:40,slamHitsOnceOnLanding:true,frontGuard:true,rearVulnerable:true,guardBreakStun:.8,playerKOAndRespawn:true,enemyChasesAndAttacks:true,hudValuesVerified:true});
}
await fs.writeFile(new URL('../output/animations/live-battle-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('LIVE_BATTLE_VERIFIED',JSON.stringify(report));
