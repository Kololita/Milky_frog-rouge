import assert from 'node:assert/strict';
import {gameFixture} from './game_fixture.mjs';
import {playerImpactReaction} from '../src/battle-values.js';
for(const [level,name,duration]of [[1,'HitRecoil',.65],[2,'HitSit',3],[3,'HitLaunch',6]]){
 const g=await gameFixture();g.freezeEnemy=true;g.read('battle.enemy.z=30');g.tap('KeyJ');g.read(`receiveBattleHit({type:'playerHit',impactLevel:${level},stun:${duration},knockback:.1,heading:0})`);assert.equal(g.read('activeGesture.name'),'Hit');assert.equal(g.read('activeGesture.action.getClip().name'),name);assert.equal(playerImpactReaction(level).stun,duration);g.tick(duration-.1);assert.equal(g.read('activeGesture.name'),'Hit');g.tick(.2);assert.notEqual(g.read('activeGesture?.name'),'Hit');
 for(const track of g.read(`actions.${name}.getClip().tracks`))assert(Array.from(track.values).every(Number.isFinite));
}
console.log('PLAYER_HIT_REACTIONS_VERIFIED: distinct recoil/sitting/flying knockdown clips, finite tracks, interruption, duration and control recovery');
