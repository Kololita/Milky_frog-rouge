import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { CharacterState, CharacterMode, CHAIN_WINDOWS } from '../src/character-state.js';
import { AttackCombo } from '../src/attack-combo.js';
import { movementInput, advanceMovement } from '../src/movement.js';
import { planDodge } from '../src/dodge.js';
import { attackHeading } from '../src/direction.js';
const camera={x:0,z:1},close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const state=new CharacterState();
assert.equal(state.mode,CharacterMode.FREE);
for (const name of ['Attack1','Attack2','Attack3','Attack4','DodgeRoll','DodgeBackflip','DodgeSideL','DodgeSideR','Block']) {
 state.reset();state.begin(name);
 assert(!state.isFree);assert.equal(state.until,Infinity);
 state.update(1000);assert(!state.isFree,'Window counted from command start');
 const input=movementInput(new Set(['KeyS','ShiftLeft']),camera);
 const locked=advanceMovement({heading:0,velocity:2.8},input,.1,!state.isFree);
 close(locked.heading,0);close(locked.dx,0);close(locked.dz,0);close(locked.velocity,0);
 assert(state.finish(name,1000));
 const duration=name==='Block'?.5:.05;
 close(state.until,1000+duration);assert(!state.command);
 state.update(1000+duration-.001);assert(!state.isFree,'Link window ended early');
 assert.equal(planDodge(new Set(['KeyS']),camera,0,state.isFree).name,'DodgeBackflip');
 state.update(1000+duration);assert.equal(state.isFree,name!=='Block','Short deadline adds an extra frame');
 state.update(1000+duration+.001);assert(state.isFree);
 let resumed=locked;
 for(let i=0;i<18;i++) resumed=advanceMovement(resumed,input,1/60,!state.isFree);
 close(Math.cos(resumed.heading),-1);assert(resumed.dz<0,'Held direction did not resume after timeout');
}
// The user's exact sequence: finish attack, press S without rotating, then dodge.
state.reset();state.begin('Attack1');state.finish('Attack1',.75);
state.update(.78);
const sKeys=new Set(['KeyS']);
const waiting=advanceMovement({heading:0,velocity:0},movementInput(sKeys,camera),.1,!state.isFree);
close(waiting.heading,0);close(waiting.dz,0);
const back=planDodge(sKeys,camera,waiting.heading,state.isFree);
assert.equal(back.name,'DodgeBackflip');close(back.heading,0);
state.begin(back.name);assert.equal(state.until,Infinity,'Previous attack deadline survived a new command');
assert(!state.finish('Attack1',1.2),'Old finish event overwrites a newer command');
state.finish(back.name,2.2);state.update(2.249);assert(!state.isFree);
state.update(2.251);assert(state.isFree);
// Every free-state input rolls towards its selected direction, including a same-frame keyup.
for(const heading of [0,1,3,5]) for(const codes of [[],['KeyW'],['KeyS'],['KeyA'],['KeyD'],['KeyW','KeyD'],['KeyS','KeyA']]) {
 const plan=planDodge(new Set(codes),camera,heading,true);
 assert.equal(plan.name,'DodgeRoll');close(Math.sin(plan.heading),plan.direction.x);close(Math.cos(plan.heading),plan.direction.z);
}
for(const [code,name] of [['KeyW','DodgeRoll'],['KeyS','DodgeBackflip'],['KeyA','DodgeSideL'],['KeyD','DodgeSideR']]) {
 const plan=planDodge(new Set([code]),camera,0,false);assert.equal(plan.name,name);close(plan.heading,0);
}
// Finisher still gets its recovery window even though the attack sequence resets.
const combo=new AttackCombo();state.reset();
for(let stage=1;stage<=4;stage++) {
 assert.equal(combo.press(stage),stage);state.begin(`Attack${stage}`);
 const next=combo.finish(stage+.75);state.finish(`Attack${stage}`,stage+.75);
 assert.equal(next,stage===4?-1:0);assert(!state.isFree);
}
assert.equal(combo.stage,0);close(state.until,4.8);
state.update(4.799);assert(!state.isFree);state.update(4.8);assert(state.isFree);
// Subsequent attacks turn at most 90 degrees along the shortest arc.
const aim=d=>({x:Math.sin(d*Math.PI/180),z:Math.cos(d*Math.PI/180)});
for(const stage of [2,3,4]) {
 close(attackHeading(0,aim(180),stage),Math.PI/2);
 close(attackHeading(0,aim(-160),stage),-Math.PI/2);
 close(attackHeading(0,aim(45),stage),Math.PI/4);
}
state.begin('Block');state.update(1e6);assert(!state.isFree,'Held block must remain locked until released');
state.finish('Block',1e6);close(state.until,1e6+.5);
state.reset();assert(state.isFree);assert.equal(state.command,null);
const report={modes:Object.values(CharacterMode),windows:CHAIN_WINDOWS,windowsStartAtFinish:true,finisherHasRecovery:true,heldKeysResumeOnExpiry:true,attackThenBackwardDodge:'DodgeBackflip',freeDodge:'DodgeRoll',laterAttackTurnDegrees:90};
await fs.writeFile(new URL('../output/animations/character-state-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('CHARACTER_STATE_VERIFIED',report);
