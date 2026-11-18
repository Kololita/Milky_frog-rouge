import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CharacterState,reconcileGesture} from '../src/character-state.js';
import {movementInput,advanceMovement} from '../src/movement.js';
import {locomotionName} from '../src/locomotion-animation.js';
const results=[];
for(const fps of [30,60,144]) for(const name of ['Attack1','Attack4','RunAttack','AirAttack','DodgeRoll','DodgeBackflip','DodgeSideL','Block']) {
 const state=new CharacterState(),keys=new Set(['KeyS','ShiftLeft']),input=movementInput(keys,{x:0,z:1});
 state.begin(name);let gesture={name},motion={heading:0,velocity:0};
 gesture=reconcileGesture(state,gesture,10);
 motion=advanceMovement(motion,input,1/fps,!state.isFree);assert.equal(motion.dz,0);
 assert(state.finish(name,10));
 const deadline=state.until;
 if(!state.isFree) {
  // Reproduce an orphaned animation handle: the UI says free but the old
  // Boolean(activeGesture) gate would still prevent all locomotion.
  gesture={name};state.update(deadline+1/fps);assert(state.isFree);
 }
 gesture=reconcileGesture(state,gesture,deadline+1/fps);
 assert.equal(gesture,undefined,'Completed gesture still blocks free control');
 const resumed=advanceMovement(motion,input,1/fps,!state.isFree);
 assert(Math.hypot(resumed.dx,resumed.dz)>0,'Held input requires a second keydown');
 assert.equal(locomotionName(input,resumed.velocity,'Idle',!state.isFree),'Run');
 assert(keys.has('KeyS')&&keys.has('ShiftLeft'),'Unlock cleared held input');
 results.push({fps,name,resumedOnFirstFreeFrame:true});
}
await fs.writeFile(new URL('../output/animations/held-movement-verification.json',import.meta.url),JSON.stringify(results,null,2));
console.log('HELD_MOVEMENT_VERIFIED',results.length,'cases: stale gestures released, held directions resume on first free frame');
