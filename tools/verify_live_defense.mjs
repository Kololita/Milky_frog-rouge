import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gameFixture} from './game_fixture.mjs';
import {DODGE_DEFENSE} from '../src/battle-values.js';

const report=[];
for(const fps of [30,60,144]) {
 const game=await gameFixture(fps);const {read,reset,mouse,key,tick,tickFrames,until,events,hud}=game;
 game.freezeEnemy=true;
 const incoming=()=>read('battle.enemy.x=player.position.x;battle.enemy.z=player.position.z+1.05;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.elapsed=.7;');
 for(const [frames,grade,cost,damage] of [[2,'perfect',5,0],[11,'precise',10,0],[17,'good',16,0],[25,'normal',24,0],[40,'late',24,3.6]]) {
  reset();mouse(2);const n=Math.max(1,Math.round(frames*fps/60));tickFrames(n-1);incoming();
  game.freezeEnemy=false;tickFrames(1);game.freezeEnemy=true;
  const block=events.find(e=>e.type==='blocked');assert(block,`No guard at ${fps}FPS, ${frames}f`);
  assert.equal(block.grade,grade);assert.equal(read('battle.player.guard'),100-cost);assert.equal(read('battle.player.health'),100-damage);
  assert(hud.get('battle-feed').textContent.includes(block.label));
  if(damage)assert(hud.get('battle-feed').textContent.includes('生命 −3.6'));
  mouse(2,false);
 }
 reset();read('battle.player.guard=3');mouse(2);incoming();game.freezeEnemy=false;tickFrames(1);game.freezeEnemy=true;
 assert.equal(read('battle.player.guard'),1);assert.equal(read('activeGesture.name'),'Block');mouse(2,false);
 reset();read('battle.player.lateGuardDamageRatio=.15');mouse(2);tickFrames(Math.ceil(.6*fps));incoming();game.freezeEnemy=false;tickFrames(1);game.freezeEnemy=true;
 assert.equal(read('battle.player.health'),98.2);mouse(2,false);

 // Repeated guard tapping keeps the four-frame release grace, then exposes a
 // full eight-frame vulnerable gap. A failed/empty attempt also contracts the
 // next perfect window from eight baseline frames to six for 0.5 seconds.
 reset();read('battle.enemy.z=30');mouse(2);tickFrames(1);mouse(2,false);
 const releaseAt=game.now/1000;
 mouse(2); // Held early: it may restart only after grace + vulnerability.
 let sawVulnerable=false;
 while(read('blockHeldAt!==null'))tickFrames(1);
 const vulnerableAt=game.now/1000;
 assert(vulnerableAt-releaseAt>=4/60-1e-8,'Release grace was shortened');
 for(let i=0;i<Math.ceil(8*fps/60)-1;i++) {
  assert(!read('battlePose().guarding'),'Repeated guard removed the vulnerable gap');
  sawVulnerable=true;tickFrames(1);
 }
 assert(until('battlePose().guarding',.25),'Held repeated guard never restarted');
 const restartedAt=read('blockHeldAt');
 assert(restartedAt-(releaseAt+4/60)>=8/60-1e-8,'Repeated guard restarted before eight vulnerable frames');
 assert.equal(read('blockPerfectScale'),.75);
 assert(sawVulnerable);
 tickFrames(Math.max(1,Math.round(7*fps/60)));incoming();game.freezeEnemy=false;tickFrames(1);game.freezeEnemy=true;
 assert.equal(events.at(-1).grade,'precise','Spam penalty still allowed an eight-frame perfect guard');
 mouse(2,false);

 // An actual non-perfect block is penalized; a prior perfect block is not.
 reset();mouse(2);tickFrames(Math.max(1,Math.round(10*fps/60)));incoming();game.freezeEnemy=false;tickFrames(1);game.freezeEnemy=true;
 assert.equal(events.at(-1).grade,'precise');mouse(2,false);mouse(2);assert(until('blockHeldAt!==null&&blockReleaseUntil===null',.4));
 assert.equal(read('blockPerfectScale'),.75);mouse(2,false);
 reset();mouse(2);incoming();game.freezeEnemy=false;tickFrames(1);game.freezeEnemy=true;
 assert.equal(events.at(-1).grade,'perfect');mouse(2,false);mouse(2);assert(until('blockHeldAt!==null&&blockReleaseUntil===null',.4));
 assert.equal(read('blockPerfectScale'),1);mouse(2,false);

 // Waiting beyond the short-repeat window restores the original eight frames.
 reset();read('battle.enemy.z=30');mouse(2);tickFrames(1);mouse(2,false);tick(.55);mouse(2);
 assert.equal(read('blockPerfectScale'),1);
 incoming();game.freezeEnemy=false;tickFrames(1);game.freezeEnemy=true;
 assert.equal(events.at(-1).grade,'perfect');mouse(2,false);

 for(const [code,name] of [['KeyW','DodgeRoll'],['KeyS','DodgeBackflip'],['KeyA','DodgeSideL'],['KeyD','DodgeSideR']]) {
  reset();read('battle.enemy.z=30');mouse(0);tick(.05);key(code);key('ShiftLeft');key('ShiftLeft',false);key(code,false);
  assert(until('Boolean(activeDodge)',1));assert.equal(read('activeDodge.name'),name);
  const window=DODGE_DEFENSE[name],samples=[];
  while(read('Boolean(activeDodge)')) {
   const elapsed=read('activeDodge.elapsed'),immune=read('battlePose().invulnerable');
   const frame=elapsed*60,expected=frame>=window.startFrame-1e-8&&frame<window.startFrame+window.frames-1e-8;
   assert.equal(immune,expected,'Live dodge reuses normalized clip invulnerability');
   // Put an incoming strike in range at every sampled dodge pose. Do not apply
   // the hurt animation here, so the complete trajectory can be measured.
   read('battle.player.health=100;battle.player.invulnerableUntil=0;battle.enemy.x=player.position.x;battle.enemy.z=player.position.z+1;battle.enemy.heading=Math.PI;battle.strikePlayer(battlePose());battle.takeEvents();');
   assert.equal(read('battle.player.health'),immune?100:88);
   read('battle.player.health=100;battle.player.invulnerableUntil=0;battle.enemy.z=30;');
   samples.push({elapsed,immune});tickFrames(1);
  }
  assert(samples.some(s=>s.immune));assert(samples.some(s=>s.elapsed>(window.startFrame+window.frames)/60&&!s.immune));
  assert(Math.abs(read('characterState.until')-game.now/1000-.05)<1e-7);
  const finishedAt=game.now,start=read('player.position.clone()');key('KeyW');
  assert(until('characterState.isFree',.2));
  const recovery=(game.now-finishedAt)/1000;
  assert(recovery>=.05-1e-8&&recovery<=.05+1/fps+1e-8,'Dodge recovery is still too long');
  assert(read('player.position').distanceTo(start)>.0001,'Held W fails to move after the 0.05s window');key('KeyW',false);
  report.push({fps,name,invulnerableFramesAt60Hz:window.frames,startFrame:window.startFrame,measuredRecovery:recovery,lateVulnerable:true,heldMovementResumes:true});
 }
 // Early pre-input must begin a fresh action on the completion frame.
 reset();read('battle.enemy.z=30');key('ShiftLeft');key('ShiftLeft',false);assert(read('Boolean(activeDodge)'));
 tick(.12);key('Space');key('Space',false);assert(read('commandBuffer.has(activeDodge.name)'));
 assert(until('Boolean(activeJump)',2));assert(!read('activeDodge'));
 report.push({fps,allGuardTiersFromMouse:true,perfectGuardFloorOne:true,lateBuffRatioApplied:true,repeatPerfectFrames:6,releaseGraceFrames:4,reblockVulnerableFrames:8,dodgeToJumpPreInput:true});
}
await fs.writeFile(new URL('../output/animations/live-defense-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('LIVE_DEFENSE_VERIFIED',JSON.stringify(report));
