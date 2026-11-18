import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gameFixture} from './game_fixture.mjs';
import {GUARD_EFFECT} from '../src/guard-effect.js';

const report=[];
for(const fps of [30,60,144]) {
  const game=await gameFixture(fps),{read,reset,mouse,tick,tickFrames,key,tap,events}=game;
  game.freezeEnemy=true;
  reset();mouse(2);tick(.2);mouse(2,false);
  const released=game.now/1000,deadline=read('blockReleaseUntil');
  assert(Math.abs(deadline-released-4/60)<1e-9);
  assert(read('battlePose().guarding'));
  while(game.now/1000+1/fps<deadline-1e-9) {
    tickFrames(1);assert(read('battlePose().guarding'),'Guard expired early');
  }
  tickFrames(1);assert(!read('battlePose().guarding'),'Guard extends beyond the first frame at its deadline');
  assert(!read('guardEffect.group.visible'),'Releasing guard shows a hit shield');

  // A real incoming strike in the release window is blocked, retaining its age.
  reset();mouse(2);tick(.4);mouse(2,false);
  read('battle.enemy.z=1.05;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.elapsed=.7');
  game.freezeEnemy=false;tickFrames(1);game.freezeEnemy=true;
  assert(events.some(e=>e.type==='blocked'&&e.grade==='normal'));
  assert.equal(read('battle.player.health'),100);
  assert(read('guardEffect.group.visible'));
  assert.equal(read('guardEffect.face.material.color.getHexString()'),GUARD_EFFECT.silver.slice(1));
  assert(read('guardEffect.face.material.opacity>0&&guardEffect.face.material.opacity<=GUARD_EFFECT.faceOpacity'));
  assert(read('guardEffect.rim.material.opacity<1&&!guardEffect.face.material.depthWrite'));
  assert(read('guardEffect.group.position.distanceTo(modelPivot.getObjectByName("handR").getWorldPosition(new THREE.Vector3()))>.17'));
  tickFrames(1);
  assert(read('guardEffect.face.material.opacity')<GUARD_EFFECT.faceOpacity);
  tick(.4);assert(!read('guardEffect.group.visible'),'Shield failed to fade out');

  // A perfect strike at the release edge uses the same impact callback.
  reset();mouse(2);mouse(2,false);
  read('battle.enemy.z=1.05;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.elapsed=.7');
  game.freezeEnemy=false;tickFrames(1);game.freezeEnemy=true;
  assert(events.some(e=>e.type==='blocked'&&e.grade==='perfect'));
  assert.equal(read('guardEffect.face.material.color.getHexString()'),GUARD_EFFECT.gold.slice(1));
  mouse(0);assert.equal(read('activeGesture.name'),'Attack4','Release grace blocks the counter');

  for(const command of ['attack','jump','direction','dodge','laugh']) {
    reset();mouse(2);tick(.2);mouse(2,false);
    if(command==='attack')mouse(0);
    if(command==='jump')tap('Space');
    if(command==='direction')key('KeyW');
    if(command==='dodge'){key('ShiftLeft');key('ShiftLeft',false);}
    if(command==='laugh')tap('KeyL');
    assert(!read('battlePose().guarding'),`${command} waits out release grace`);
    assert.equal(read('blockReleaseUntil'),null);
    if(command==='attack')assert.equal(read('activeGesture.name'),'Attack1');
    if(command==='jump')assert(read('Boolean(activeJump)'));
    if(command==='dodge')assert(read('Boolean(activeDodge)'));
  }
  reset();mouse(2);tick(.2);mouse(2,false);mouse(2);tick(.2);
  assert(read('battlePose().guarding&&blockReleaseUntil===null'),'Re-press leaves an old release deadline');
  game.listeners.get('blur')();assert(!read('battlePose().guarding'));
  assert(!read('guardEffect.group.visible'));
  // Hits without a successful block must not produce a shield.
  reset();read('battle.enemy.z=1.05;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.elapsed=.7');
  game.freezeEnemy=false;tickFrames(1);game.freezeEnemy=true;
  assert.equal(read('battle.player.health'),88);assert(!read('guardEffect.group.visible'));
  reset();mouse(2);tick(.4);read('battle.player.guard=1;battle.enemy.z=1.05;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.elapsed=.7');
  game.freezeEnemy=false;tickFrames(1);game.freezeEnemy=true;
  assert(events.some(e=>e.type==='guardBroken'));assert(!read('guardEffect.group.visible'));
  report.push({fps,releaseGrace:4/60,guardAgeNotReset:true,immediateOtherCommands:true,repressAndBlur:true,goldAndSilverOnActualBlocks:true,handFrontOffset:.18,shieldDuration:GUARD_EFFECT.duration,transparentFade:true,noShieldOnDamageOrBreak:true});
}
await fs.writeFile(new URL('../output/animations/guard-effect-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('GUARD_EFFECT_VERIFIED',JSON.stringify(report));
