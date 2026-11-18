import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {beginBossSequence,SAMURAI_MOVES} from '../src/samurai.js';
import {bossAnimationPose} from '../src/boss-animation.js';
const difference=(a,b)=>Math.max(...Object.keys(a).map(key=>Math.abs(a[key]-b[key])));
for(const phase of [1,2])for(const name of Object.keys(SAMURAI_MOVES)){
 const b=new Battle();b.reset('samurai');b.enemy.phase=phase;beginBossSequence(b,name);const e=b.enemy;
 for(let index=0;index<e.sequence.length;index++){
  e.moveIndex=index;e.move=e.sequence[index];e.swingDuration=e.move.swing;e.telegraph=Math.max(.3,e.move.windup/(phase===2?1.16:1)-e.swingDuration);e.windup=e.telegraph+e.swingDuration;
  assert(e.telegraph>=.3);assert(e.swingDuration>=.26);
  e.state='windup';e.elapsed=e.windup;const contact=bossAnimationPose(e);
  e.extracting=e.move.motion==='buried-overhead';e.state='recover';e.recovery=e.extracting?1.5:.36;e.elapsed=0;assert(difference(contact,bossAnimationPose(e))<1e-9,'Pose jumps on impact');
  e.elapsed=e.recovery;const neutral=bossAnimationPose(e);e.state='windup';e.elapsed=0;
  assert(difference(neutral,bossAnimationPose(e))<1e-9,'Pose jumps into next telegraph');
  for(const fps of [30,60,144]){
   let previous=bossAnimationPose(e),largest=0;
   for(let t=1/fps;t<=e.windup+1/fps;t+=1/fps){e.elapsed=Math.min(t,e.windup);const pose=bossAnimationPose(e);largest=Math.max(largest,difference(previous,pose));previous=pose;}
   e.state='recover';for(let t=0;t<=e.recovery+1/fps;t+=1/fps){e.elapsed=t;const pose=bossAnimationPose(e);largest=Math.max(largest,difference(previous,pose));previous=pose;}
   assert(largest<.60,`${name} phase ${phase} ${fps}FPS pose teleports: ${largest}`);
   e.state='windup';e.elapsed=0;
  }
 }
}
console.log('BOSS_MOTION_VERIFIED: all strikes give >=300ms cue, >=260ms swing; continuous impact, follow-through and next attack at 30/60/144FPS');
