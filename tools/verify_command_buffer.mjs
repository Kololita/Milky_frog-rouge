import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CommandBuffer} from '../src/command-buffer.js';
import {CharacterState} from '../src/character-state.js';
import {AttackCombo} from '../src/attack-combo.js';
import {planDirectionalDodge} from '../src/dodge.js';
import {advanceMovement,movementInput} from '../src/movement.js';
const b=new CommandBuffer();
for(const name of ['Attack','Block','Dodge','Jump']) {
 b.push(name,'Attack1',{x:0,z:-1});
 assert(b.has('Attack1'));assert(!b.has('Attack2'));
 assert.equal(b.take('Attack1').name,name);
 assert.equal(b.take('Attack1'),null,'A pre-input fired more than once');
 b.push(name,'DodgeRoll');assert.equal(b.take('Attack2'),null,'Input leaked to another action');
 b.push(name,'Attack1');b.clear();assert.equal(b.take('Attack1'),null,'Cancellation leaves a ghost input');
}
const aim={x:0,z:-1};
b.push('Attack','Attack1',{x:1,z:0});b.push('Block','Attack1');b.push('Dodge','Attack1',aim);
aim.x=1;aim.z=0;
const latest=b.take('Attack1');assert.equal(latest.name,'Dodge');assert.deepEqual(latest.aim,{x:0,z:-1});
const state=new CharacterState(),combo=new AttackCombo();
// Pressing again immediately after a punch starts must survive until it finishes,
// including slow playback; the running punch is not interrupted.
combo.press(0);state.begin('Attack1');b.push('Attack','Attack1',{x:1,z:0});
assert.equal(state.command,'Attack1');assert.equal(combo.stage,1);
combo.finish(3);state.finish('Attack1',3);
const next=b.take('Attack1');assert.equal(next.name,'Attack');assert.equal(combo.press(3,next.aim),2);
assert.equal(b.take('Attack1'),null,'Multiple presses queued more than one future punch');
// Early backward intent is retained while the character stays locked.
state.begin('Attack2');b.push('Dodge','Attack2',{x:0,z:-1});
const locked=advanceMovement({heading:0,velocity:1.2},movementInput(new Set(['KeyS'])),.1,!state.isFree);
assert.equal(locked.heading,0);assert.equal(locked.dz,0);
state.finish('Attack2',10);
const dodge=b.take('Attack2'),plan=planDirectionalDodge(dodge.aim,locked.heading,state.isFree);
assert.equal(plan.name,'DodgeBackflip');state.begin(plan.name);combo.reset();
b.push('Attack',plan.name,{x:1,z:0});b.push('Block',plan.name,{x:-1,z:0});
state.finish(plan.name,12);
const guard=b.take(plan.name);assert.equal(guard.name,'Block');state.begin(guard.name);
b.push('Attack','Block',{x:0,z:1});state.finish('Block',14);
const attack=b.take('Block');assert.equal(combo.press(14,attack.aim),1);
// One early press per playing action can chain four complete stages.
combo.reset();let now=20;assert.equal(combo.press(now),1);
for(const [stage,duration] of [[1,.75],[2,23/24],[3,25/24],[4,34/24]]) {
 const owner=`Attack${stage}`;state.begin(owner);
 if(stage<4)for(let press=0;press<3;press++)b.push('Attack',owner,{x:stage%2?1:-1,z:0});
 combo.finish(now+duration);state.finish(owner,now+duration);
 const command=b.take(owner);
 if(stage<4){assert.equal(command.name,'Attack');assert.equal(combo.press(now+duration,command.aim),stage+1);}
 else {assert.equal(command,null);assert.equal(combo.stage,0);assert(!state.isFree);}
 assert.equal(b.take(owner),null);now+=duration;
}
const report={scope:'current-action-until-completion',commands:['Attack','Block','Dodge','Jump'],earlyInputRetained:true,latestInputWins:true,inputDirectionCaptured:true,ownerIsolation:true,consumedOnce:true,attackToBackflip:true,dodgeToGuard:true,guardToAttack:true,oneNextActionPerInput:true};
await fs.writeFile(new URL('../output/animations/command-buffer-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('COMMAND_BUFFER_VERIFIED',report);
