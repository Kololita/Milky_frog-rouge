import assert from 'node:assert/strict';
import {gameFixture} from './game_fixture.mjs';
for(const fps of [30,60,144])for(const rate of [10,20,50]){
 const g=await gameFixture(fps),{read,tick,tickFrames,until}=g;g.freezeEnemy=true;
 read(`battle.player.poseRegenRate=${rate};battle.player.pose=10;battle.enemy.z=1;battle.enemy.heading=Math.PI;battle.strikePlayer(battlePose());`);
 tickFrames(1);
 assert(read('Boolean(battle.breakLaugh)&&activeGesture.forced&&activeGesture.name==="Laugh"'));
 assert.equal(read('battle.breakLaugh.duration'),1+100/rate);
 const before=read('battle.player.health');
 read('battle.player.invulnerableUntil=0;battle.enemy.z=player.position.z+1;battle.enemy.heading=Math.PI;battle.strikePlayer(battlePose());');
 const poseBefore=read('battle.player.pose');assert.equal(read('battle.player.health'),before-6);
 assert.equal(read('battle.player.pose'),poseBefore);
 tickFrames(1);g.mouse(0);g.mouse(2);g.tap('Space');g.tap('KeyR');
 assert(read('activeGesture.forced&&activeGesture.name==="Laugh"'));
 read('battle.enemy.z=30');tick((1+100/rate)/2);
 assert(read('battle.player.pose>40&&battle.player.pose<65'));
 assert(until('!battle.breakLaugh',1+100/rate));
 assert.equal(read('battle.player.pose'),100);assert(read('characterState.isFree&&!activeGesture'));
}
console.log('BREAK_LAUGH_VERIFIED: forced animation, rate-based duration, half damage, protected bar and exact full recovery');
