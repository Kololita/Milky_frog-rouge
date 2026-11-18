import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gameFixture} from './game_fixture.mjs';
const report=[];
for(const fps of [30,60,144]) {
 const game=await gameFixture(fps);const {read,reset,mouse,tick,tap,key}=game;
 read('battle.enabled=false');
 const pose=()=>read('player.updateMatrixWorld(true);["shoulderR","upper_armR","forearmR","handR"].map(name=>{const b=modelPivot.getObjectByName(name);return {q:b.quaternion.toArray(),p:b.getWorldPosition(new THREE.Vector3()).sub(player.position).toArray()}})');
 reset();mouse(2);tick(.4);const target=pose();mouse(2,false);
 for(const state of ['Idle','Walk','Run','Attack']) {
  reset();
  if(state==='Walk'||state==='Run'){key('KeyW');if(state==='Run')key('ShiftLeft');tick(.25);}
  if(state==='Attack'){tap('KeyJ');tick(.1);}
  mouse(2);const started=game.now;tick(.1);
  const current=pose(),firstRenderedTime=(game.now-started)/1000;let positionError=0,angleError=0;
  for(let i=0;i<target.length;i++) {
   const dot=Math.abs(current[i].q.reduce((s,x,j)=>s+x*target[i].q[j],0));
   angleError=Math.max(angleError,2*Math.acos(Math.min(1,dot)));
   positionError=Math.max(positionError,Math.hypot(...current[i].p.map((v,j)=>v-target[i].p[j])));
  }
  assert(positionError<.003,`${state} guard arm not raised at 0.1s: ${positionError}m`);
  assert(angleError<.015,`${state} guard joint not settled at 0.1s: ${angleError}rad`);
  assert.equal(read('activeGesture.name'),'Block');
  tick(.65);assert.equal(read('activeGesture.name'),'Block','Faster animation releases held guard');
  assert.equal(read('combo.stage'),0,'Animation speed changed long-guard cutoff');
  mouse(2,false);tick(4/60);assert.notEqual(read('activeGesture?.name'),'Block');
  report.push({fps,from:state,firstRenderedTime,positionError,angleError});
 }
}
await fs.writeFile(new URL('../output/animations/block-timing-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('BLOCK_TIMING_VERIFIED',JSON.stringify(report));
