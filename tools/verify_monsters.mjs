import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Battle} from '../src/battle.js';
import {MONSTER_STATS} from '../src/monster-catalog.js';
import {ENCOUNTER_POOLS} from '../src/encounter-formations.js';
import {generateRunMap,NODE_LABELS} from '../src/run-map.js';
import {createEnemyView} from '../src/enemy-view.js';
const pose={x:0,z:0,heading:0,height:0,invulnerable:true};
for(const fps of [30,60,144])for(const id of ['shellbug','lantern','stonekeeper','scythemoth']){
 const b=new Battle();b.reset(id);const e=b.enemy;e.x=0;e.z=b.enemyStats.stopDistance;e.heading=Math.PI;
 const camera=new THREE.PerspectiveCamera(),view=createEnemyView(new THREE.Scene());
 let swings=0,lastState=e.state,seenArmor=false;
 for(let i=0;i<fps*14;i++){
  const previous=e.heading;b.update(1/fps,pose);view.update(b,camera,1/fps);swings+=b.takeEvents().filter(event=>event.type==='monsterSwing').length;
  assert(Number.isFinite(e.x+e.z+e.heading));assert(Math.hypot(e.x,e.z)>=e.radius+.4-1e-6,'Lunge tunnels through player');
  seenArmor ||= e.superArmor;
  assert.equal(view.body.visible,false);assert(view.monsterVisuals.entries[id].root.visible);
  if(e.state==='recover')assert(!e.superArmor,'Recovery incorrectly armored');
  lastState=e.state;
 }
 assert(swings>=2,`${id} never attacks`);assert.equal(b.player.health,100);
 assert.equal(seenArmor,b.enemyStats.moves.some(m=>m.startupResilience>=3));
 assert.equal(e.backThrowable,MONSTER_STATS[id].bodyPlan!=='nonhumanoid'&&MONSTER_STATS[id].backThrowable!==false);
}
for(const id of ['shellbug','lantern','stonekeeper','scythemoth']){
 const b=new Battle();b.reset(id);const e=b.enemy;e.z=b.enemyStats.stopDistance;e.heading=Math.PI;
 for(let i=0;i<600&&e.state!=='windup';i++)b.update(1/60,pose);
 assert.equal(e.state,'windup');b.impactEnemy(e.move.startupResilience+1,pose);assert(['hurt','knockback'].includes(e.state),'Impact above startup resilience cannot interrupt');
 const before=e.health;e.z=1;b.enemy.superArmor=false;b.beginAttack('AirAttack');b.resolveAttack(.5,{...pose,invulnerable:false,landed:true});assert(e.health<before);
}
for(let seed=0;seed<100;seed++){
 const map=generateRunMap(seed);
 assert(map.rows[0].every(node=>node.encounter===null));
 assert.deepEqual(new Set(map.rows[3].map(node=>node.encounter)),new Set(ENCOUNTER_POOLS.elite));
 assert.equal(map.rows[14][0].encounter,'samurai');
 for(const node of map.nodes)assert.equal(node.name,NODE_LABELS[node.type]);
}
console.log('MONSTERS_VERIFIED: 4 distinctive models/controllers at 30/60/144FPS, attacks, no tunneling, armor openings, impact/backthrow rules and diverse seeded maps');
