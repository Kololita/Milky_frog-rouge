import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gameFixture} from './game_fixture.mjs';
const report=[];
for(const fps of [30,60,144]) {
 const game=await gameFixture(fps);const {read,reset,mouse,key,tap,tick,tickFrames,until}=game;
 read('battle.enabled=false');
 function finishFirst() {reset();mouse(0);assert(until('!activeGesture',1));assert.equal(read('combo.stage'),1);}
 for(const stage of [1,2,3,4]) {
  reset();read(`combo.enter(${stage});playAttack(${stage})`);key('KeyW');
  assert(until('!activeGesture',2));const finished=game.now,position=read('player.position.clone()');
  assert(Math.abs(read('characterState.until')-finished/1000-.05)<1e-7);
  assert(until('characterState.isFree',.15));const recovery=(game.now-finished)/1000;
  assert(recovery>=.05-1e-8&&recovery<=.05+1/fps+1e-8);
  assert(read('player.position').distanceTo(position)>.0001,'Attack recovery fails to resume held walking');
  assert.equal(read('combo.stage'),stage===4?0:stage);
  report.push({fps,stage,recovery});
 }
 finishFirst();key('KeyW');tick(.2);assert(read('characterState.isFree && combo.stage===1 && velocity>0'));
 mouse(0);assert.equal(read('activeGesture.name'),'Attack2');
 assert(until('!activeGesture',2));tick(.2);mouse(0);assert.equal(read('activeGesture.name'),'Attack3');
 assert(until('!activeGesture',2));tick(.2);mouse(0);assert.equal(read('activeGesture.name'),'Attack4');
 assert(until('!activeGesture',2));assert.equal(read('combo.stage'),0);

 finishFirst();tickFrames(Math.round(.5*fps));mouse(0);assert.equal(read('activeGesture.name'),'Attack2','Exact 0.5s boundary no longer links');
 finishFirst();tickFrames(Math.round(.5*fps)+1);mouse(0);assert.equal(read('activeGesture.name'),'Attack1','Expired combo links after 0.5s');

 finishFirst();key('KeyW');tick(.15);assert.equal(read('currentAction.getClip().name'),'Walk');
 key('ShiftLeft');tickFrames(1);assert.equal(read('combo.stage'),0,'Running preserves a combo');
 tick(.2);key('ShiftLeft',false);key('KeyW',false);mouse(0);assert.equal(read('activeGesture.name'),'Attack1');

 finishFirst();tick(.1);key('KeyW');key('ShiftLeft');mouse(0);
 assert.equal(read('activeGesture.name'),'Attack1','Same-frame sprint and attack continues old combo');
 reset();mouse(0);tick(.08);mouse(2);assert.equal(read('combo.stage'),0);tick(.02);mouse(2,false);mouse(0);assert.equal(read('activeGesture.name'),'Attack1');

 for(const code of ['KeyA','KeyD']) {
  reset();mouse(0);tick(.05);key(code);key('ShiftLeft');key('ShiftLeft',false);key(code,false);
  assert(until('Boolean(activeDodge)',1));assert.equal(read('combo.stage'),0);
  assert(until('!activeDodge',2));mouse(0);assert.equal(read('activeGesture.name'),'Attack1');
 }
 for(const code of ['Space','KeyL','KeyC','KeyX','KeyK']) {
  finishFirst();tick(.1);tap(code);assert.equal(read('combo.stage'),0,`${code} preserves a combo`);
 }
 finishFirst();tick(.1);tap('KeyB');assert.equal(read('combo.stage'),1,'Blink overlay breaks a combo');mouse(0);assert.equal(read('activeGesture.name'),'Attack2');
 // Early next-attack input is retained until the current hit completes.
 reset();mouse(0);tick(.06);mouse(0);assert(read('commandBuffer.has("Attack1")'));
 assert(until('activeGesture?.name==="Attack2"',1));
 report.push({fps,walkCanLinkAllFourStages:true,inclusiveHalfSecondBoundary:true,expiryStartsFresh:true,sprintAndOtherActionsInterrupt:true,blinkDoesNotInterrupt:true,preInputPreserved:true});
}
await fs.writeFile(new URL('../output/animations/combo-movement-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('COMBO_MOVEMENT_VERIFIED',JSON.stringify(report));
