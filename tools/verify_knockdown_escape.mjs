import assert from 'node:assert/strict';
import {gameFixture} from './game_fixture.mjs';
for(const [level,duration,unlock] of [[2,3,1],[3,6,3]]){
 const g=await gameFixture();g.freezeEnemy=true;g.read('battle.enemy.z=30');
 g.read(`receiveBattleHit({type:'playerHit',impactLevel:${level},stun:${duration},knockback:.1,heading:0})`);
 g.tick(unlock-.15);
 g.read("triggerGesture(gestures.find(s=>s.name==='Dodge'),{x:0,z:1})");
 assert.equal(g.read('activeDodge'),undefined,'Early input must wait for recovery');
 assert.equal(g.read('activeGesture.name'),'Hit');
 g.tick(.25);
 assert(g.read('Boolean(activeDodge)'),'Buffered dodge must cancel recovery at threshold');
 assert.notEqual(g.read('activeGesture.name'),'Hit');
}
for(const [level,duration,unlock] of [[2,3,1],[3,6,3]]){
 const g=await gameFixture();g.freezeEnemy=true;g.read('battle.enemy.z=30');
 g.read(`receiveBattleHit({type:'playerHit',impactLevel:${level},stun:${duration},knockback:.1,heading:0})`);
 g.tick(unlock+.05);
 g.read("triggerGesture(gestures.find(s=>s.name==='Dodge'),{x:0,z:1})");
 assert(g.read('Boolean(activeDodge)'),'Recovery dodge should start immediately');
}
console.log('KNOCKDOWN_ESCAPE_VERIFIED: 3s / 6s duration, early input waits, buffered and direct dodge cancel at 1s / 3s');
