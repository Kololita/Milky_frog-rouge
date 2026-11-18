import assert from 'node:assert/strict';
import {gameFixture} from './game_fixture.mjs';
for(const fps of [30,60,144]){
 const g=await gameFixture(fps);g.freezeEnemy=true;g.read('battle.enemy.z=30;combo.enter(2);playAttack(2,"RunAttack")');assert(g.until('runAttackRecovery()',2));const start=g.read('player.position.clone()');g.key('KeyW');g.tick(.2);assert(g.read('player.position').distanceTo(start)>.05,'Recovery blocks movement');g.tap('KeyJ');assert.equal(g.read('activeGesture.name'),'RunAttack','Attack interrupted recovery');const beforeEnd=g.read('player.position.clone()');assert(g.until('activeGesture?.name!=="RunAttack"',2));assert(g.read('player.position').distanceTo(beforeEnd)<2,'Recovery end snaps to attack origin');g.key('KeyW',false);
}
console.log('RUN_RECOVERY_MOVEMENT_VERIFIED: movement unlocked, attacks locked, no root-motion snap at completion');
