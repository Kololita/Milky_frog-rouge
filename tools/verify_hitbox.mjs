import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Battle} from '../src/battle.js';
import {ATTACK_STATS} from '../src/battle-values.js';
import {SAMURAI_MOVES} from '../src/samurai.js';
import {hitboxPoints,createHitboxView} from '../src/hitbox-view.js';
const pose={x:0,z:0,heading:.5,height:0,landed:true,invulnerable:true};
const b=new Battle();b.debugHitboxes=true;b.enemy.z=1;
b.applyEquipment({skill:'longarm'});b.player.energy=33;b.beginSkill();b.beginAttack('Attack3');b.resolveAttack(.8,pose);
let events=b.takeEvents().filter(e=>e.type==='debugHitbox');assert.equal(events.length,3);
for(const event of events){assert.equal(event.owner,'player');assert.equal(event.range,ATTACK_STATS.Attack3.range*1.2);const points=hitboxPoints(event);assert.equal(points.length,67);assert(Math.abs(Math.hypot(points[1].x-event.x,points[1].z-event.z)-event.range)<1e-8);}
for(const move of Object.values(SAMURAI_MOVES).flat()){
 b.player.invulnerableUntil=100;b.strikePlayer(pose,move);const event=b.takeEvents().find(e=>e.type==='debugHitbox');assert.equal(event.owner,'enemy');assert.equal(event.range,move.reach);assert.equal(event.halfAngle,move.halfAngle);
}
b.launchWave(pose);b.updateWaves(.1);const wave=b.takeEvents().find(e=>e.shape==='capsule');assert(wave);assert.equal(hitboxPoints(wave).length,51);
const view=createHitboxView(new THREE.Scene());view.update(b,[...events,wave],true);assert.equal(view.group.children.length,4);assert.equal(view.group.children[0].material.color.getHexString(),'298bff');
b.time+=.2;view.update(b,[],true);assert.equal(view.group.children.length,0);view.update(b,events,true);view.update(b,[],false);assert.equal(view.group.children.length,0);
b.debugHitboxes=false;b.strikePlayer(pose);assert(!b.takeEvents().some(e=>e.type==='debugHitbox'));
console.log('HITBOX_VERIFIED: real attack parameters, longarm range, each triple hit, all boss moves even on immunity, wave sweep and overlay cleanup');
