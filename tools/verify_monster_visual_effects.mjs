import assert from 'node:assert/strict';
import * as THREE from 'three';
import {gameFixture} from './game_fixture.mjs';
import {Battle} from '../src/battle.js';
import {createEnemyView} from '../src/enemy-view.js';

await gameFixture(); // Register the real textured and skinned model assets.
const camera=new THREE.PerspectiveCamera();
for(const [id,motion,node] of [
 ['shellbug','spikes','shellbug_spike_effect'],
 ['lantern','pulse','lantern_attack_pulse'],
 ['lantern','empower','lantern_attack_pulse'],
 ['lantern','firebolt','lantern_attack_pulse'],
 ['stonekeeper','quake','stonekeeper_quake_effect'],
]){
 const battle=new Battle();battle.reset(id);
 const view=createEnemyView(new THREE.Scene()),other=createEnemyView(new THREE.Scene());
 const e=battle.enemy;e.move=battle.enemyStats.moves.find(m=>m.motion===motion);assert(e.move);
 Object.assign(e,{state:'windup',telegraph:e.move.prepare,swingDuration:e.move.swing,windup:e.move.windup,elapsed:e.move.prepare*.9,flash:0});
 view.update(battle,camera,1/60);other.update(battle,camera,1/60);
 const entry=view.monsterVisuals.entries[id],fx=entry.root.getObjectByName(node),second=other.monsterVisuals.entries[id].root.getObjectByName(node);
 assert(entry.rigged&&entry.ready&&entry.root.visible,'New rigged body was lost');
 assert(fx?.visible,`${id}/${motion}: feedback missing after model replacement`);
 assert.notEqual(fx,second,'Effects shared by simultaneous enemies');
 if(fx.material)assert.notEqual(fx.material,second.material);
 if(motion==='spikes'){
  assert.equal(fx.children.length,12);
  const before=fx.children[0].scale.y;e.elapsed=0;view.update(battle,camera,1/60);
  assert(fx.children[0].scale.y<before,'Spikes do not extend with preparation');
 }
 if(id==='lantern'){
  assert(entry.root.getObjectByName('lantern_charge_glow').visible);
  assert.equal(fx.material.color.getHex(),motion==='empower'?0xc9aa68:0xd4c49a);
 }
 for(const state of ['idle','hurt','dazed','dead','down']){
  e.state=state;e.elapsed=0;view.update(battle,camera,1/60);assert(!fx.visible,`${id}: effect leaked into ${state}`);
 }
}
console.log('MONSTER_VISUAL_EFFECTS_VERIFIED: real imported bodies retain spikes, pulse, buff, casting glow and quake; independent instances and interruption cleanup');
