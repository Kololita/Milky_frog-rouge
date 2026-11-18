import assert from 'node:assert/strict';
import {MONSTER_STATS} from '../src/monster-catalog.js';
import {updateMonster} from '../src/monster-ai.js';
import {enemyAnimationSample} from '../src/enemy-models.js';
const stats=MONSTER_STATS.stonekeeper,move=stats.moves[0],pose={x:0,z:1,heading:0};
for(const fps of [30,60,144]){
 const e={stats,move,state:'recover',elapsed:0,recovery:move.comboRecovery,heading:0,x:0,z:0,health:900,telegraph:move.prepare,swingDuration:move.swing,hitResolved:true};
 const hits=[],battle={enemy:e,enemyStats:stats,enemyTime:0,enemies:[e],emit(){},strikePlayer(p,a,lag,origin){hits.push({time:e.elapsed,a,origin});}};
 assert.equal(enemyAnimationSample('stonekeeper',e,0).phase,.7);
 const remainingSwing=move.swing*.3;
 assert(Math.abs(remainingSwing+move.recoveryAnimation.hold-1)<1e-9);
 for(let i=0;i<Math.floor(1.65*fps);i++){
  e.elapsed=i/fps;battle.enemyTime=e.elapsed;updateMonster(battle,1/fps,pose);
  if(e.elapsed<=move.recoveryAnimation.hold)assert.equal(enemyAnimationSample('stonekeeper',e,0).phase,.7);
 }
 assert.equal(hits.length,1);assert(hits[0].time>=move.recoveryStrike.at&&hits[0].time<move.recoveryStrike.at+1/fps);
 assert.equal(hits[0].a.motionMultiplier,1.5);assert.equal(hits[0].origin.z,move.recoveryStrike.forward);
 assert(move.comboRecovery>move.recoveryAnimation.hold+move.recoveryAnimation.duration);
 // An interruption cancels the extraction strike rather than delaying it until the next recover.
 e.state='hurt';e.elapsed=0;e.stun=2;e.recoveryStrikeResolved=false;hits.length=0;
 updateMonster(battle,1/fps,pose);assert.equal(hits.length,0);
}
console.log('Stonekeeper extraction: one second embedded, one local hit, no combo skip, interruption cancels.');
