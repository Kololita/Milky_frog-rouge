import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gameFixture} from './game_fixture.mjs';
import {CHARACTER_HEIGHT} from '../src/dodge.js';
import {AIR_SLAM,JUMP_HEIGHT,AirSlam} from '../src/combat.js';
import {GUARD_EFFECT} from '../src/guard-effect.js';

const report=[];
for(const fps of [30,60,144]) {
  const g=await gameFixture(fps),{read,reset,tick,tickFrames,mouse,tap,key,until}=g;
  g.freezeEnemy=true;
  const parry=()=>{
    mouse(2);read('battle.enemy.z=player.position.z+1.05;battle.enemy.x=player.position.x;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.elapsed=.7');
    g.freezeEnemy=false;tickFrames(1);g.freezeEnemy=true;
    assert(read('battle.player.counterReady&&guardEffect.glow.visible'));
    mouse(2,false);read('battle.enemy.z=30');
  };
  const jumps=[];
  for(const [name,codes] of [['Jump',[]],['JumpWalk',['KeyW']],['JumpRun',['KeyW','ShiftLeft']]]) {
    reset();read('battle.enemy.z=30');for(const code of codes)key(code);tick(.25);tap('Space');
    let peak=0,min=Infinity;
    while(read('Boolean(activeJump)')) {
      tickFrames(1);const height=read('floorProbe()-player.position.y');peak=Math.max(peak,height);min=Math.min(min,height);
    }
    assert(Math.abs(peak-JUMP_HEIGHT)<.006,`${name} apex ${peak}`);
    assert(min>-.02,`${name} clips ground`);
    assert.equal(read('modelPivot.position.y'),0);
    jumps.push({name,peak,target:CHARACTER_HEIGHT*.5});
  }
  // Enter at the actual first-jump apex. The additional lift remains fixed.
  reset();read('battle.enemy.z=30');tap('Space');
  const apexTime=read('MOBILITY_TIMING.Jump.startup+(MOBILITY_TIMING.Jump.contact-MOBILITY_TIMING.Jump.takeoff)*activeJump.action.getClip().duration/2');
  tickFrames(Math.round(apexTime*fps));const start=read('floorProbe()-player.position.y');mouse(0);
  assert.equal(read('activeGesture.name'),'AirAttack');let peak=start;
  while(read('activeAirAttack?.sample?.phase!=="slam"')) {tickFrames(1);peak=Math.max(peak,read('floorProbe()-player.position.y'));}
  assert(Math.abs(peak-CHARACTER_HEIGHT)<.012,`Jump+slam apex ${peak}`);
  assert(Math.abs(read('activeAirAttack.timeline.apex')-start-AIR_SLAM.lift)<1e-8);
  assert(until('!activeAirAttack',3));assert.equal(read('modelPivot.position.y'),0);
  for(const height of [0,.2,JUMP_HEIGHT])assert.equal(new AirSlam(height).apex,height+JUMP_HEIGHT);

  reset();parry();const grantedAt=read('battle.time'),untilTime=read('battle.player.counterUntil');
  assert(Math.abs(untilTime-grantedAt-3)<1e-8);
  assert.equal(read('guardEffect.face.material.opacity'),GUARD_EFFECT.faceOpacity);
  tick(.06);assert(read('guardEffect.points.visible'));
  const distance=()=>read('(()=>{const a=guardEffect.points.geometry.attributes.position;const v=new THREE.Vector3();let d=0;for(let i=0;i<a.count;i++){guardEffect.points.userData.samplePosition(i,v);d+=v.distanceTo(guardEffect.glow.position)}return d/a.count})()');
  const beforeDistance=distance();tick(.07);assert(read('guardEffect.points.visible'));
  assert(distance()<beforeDistance*.7,'Gold particles fail to converge into palm');
  tick(.1);assert(!read('guardEffect.points.visible'));assert(read('guardEffect.glow.visible&&!guardEffect.group.visible'));
  key('KeyW');key('ShiftLeft');tick(.3);key('ShiftLeft',false);key('KeyW',false);
  assert(read('battle.player.counterReady&&guardEffect.glow.visible'),'Running cancels gold');
  // The aura follows the palm when the character turns and moves.
  assert(read('guardEffect.glow.position.distanceTo(modelPivot.getObjectByName("handR").getWorldPosition(new THREE.Vector3()))<.15'));
  tap('Space');tick(.1);mouse(0);
  assert(read('Boolean(activeJump)&&commandBuffer.has(activeJump.name)&&!activeAirAttack'),'Gold airborne attack fails to queue the charged palm');
  assert(until('activeGesture?.name==="Attack4"',2));assert(read('activeGesture.counter'));
  tickFrames(1);assert(!read('battle.player.counterReady||guardEffect.glow.visible'),'Counter fails to consume gold');
  assert(until('!activeGesture',2));mouse(0);assert.equal(read('activeGesture.name'),'Attack1');

  reset();parry();while(read('battle.time')+1/fps<read('battle.player.counterUntil')-1e-9)tickFrames(1);
  assert(read('battle.player.counterReady&&guardEffect.glow.visible'));
  tickFrames(1);assert(!read('battle.player.counterReady||guardEffect.glow.visible'),'Gold outlives 3s');
  mouse(0);assert.equal(read('activeGesture.name'),'Attack1');
  reset();parry();tick(.08);tap('Home');assert(!read('battle.player.counterReady||guardEffect.points.visible||guardEffect.glow.visible'));
  report.push({fps,jumps,jumpAttackPeak:peak,totalHeightTarget:CHARACTER_HEIGHT,goldDuration:3,particlesConverge:true,persistThroughRunAndJump:true,airbornePalmQueuesForLanding:true,consumedOnce:true,expiresAndResetClears:true});
}
await fs.writeFile(new URL('../output/animations/jump-gold-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('JUMP_GOLD_VERIFIED',JSON.stringify(report));
