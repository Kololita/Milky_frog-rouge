import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Battle} from '../src/battle.js';
import {ATTACK_STATS} from '../src/battle-values.js';
import {SAMURAI_MOVES} from '../src/samurai.js';
import {hitboxWirePoints} from '../src/hitbox-view.js';
const pose={x:0,z:0,heading:0,height:1,guarding:false};
function enemyStrike(move,height){const b=new Battle();b.reset('samurai');b.enemy.z=1;b.enemy.heading=Math.PI;b.strikePlayer({...pose,height},move);return b.player.health;}
assert.equal(enemyStrike(SAMURAI_MOVES.sweep[0],1),100,'Jump does not clear a low sweep');
assert(enemyStrike(SAMURAI_MOVES.heavy[0],1)<100,'High overhead misses an airborne player');
assert.equal(enemyStrike(SAMURAI_MOVES.heavy[0],3),100,'Attack hits above its top');
const b=new Battle();b.debugHitboxes=true;b.enemy.z=1;
b.beginAttack('Attack1');b.resolveAttack(.3,{...pose,height:2});assert.equal(b.enemy.health,b.enemy.maxHealth);
const event=b.takeEvents().find(e=>e.type==='debugHitbox'),points=hitboxWirePoints(event);
assert.equal(Math.min(...points.map(p=>p.y)),event.yMin);assert.equal(Math.max(...points.map(p=>p.y)),event.yMax);
b.enemy.height=3;b.launchWave({...pose,height:0});b.updateWaves(.2);assert.equal(b.enemy.health,b.enemy.maxHealth,'Ground wave hits a high target');
b.enemy.height=0;b.waves=[];b.launchWave({...pose,height:0});b.updateWaves(.2);assert.equal(b.enemy.health,b.enemy.maxHealth-30);
const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
// The low shell model has a taller hurtbox so grounded punches can reach it.
for(const [name,attack] of Object.entries(ATTACK_STATS)){
 const bug=new Battle();bug.reset('shellbug');bug.enemy.z=.9;bug.enemy.superArmor=true;
 const grounded={x:0,z:0,heading:0,height:0,landed:true};bug.beginAttack(name);
 let expected=bug.enemy.maxHealth;
 for(const time of attack.times){
  expected=Math.round((expected-bug.playerDamage(attack.motionMultiplier))*100)/100;
  bug.resolveAttack(time,grounded);
 }
 assert.equal(bug.enemy.health,expected,`${name} misses the shellbug's expanded hurtbox`);
 const before=bug.enemy.health;bug.resolveAttack(1,grounded);assert.equal(bug.enemy.health,before,'Expanded hurtbox repeats a hit');
}
{
 const bug=new Battle();bug.reset('shellbug');bug.enemy.z=.9;
 bug.beginAttack('Attack1');bug.resolveAttack(.3,{x:0,z:0,heading:0,height:1});assert.equal(bug.enemy.health,bug.enemy.maxHealth,'Expanded hurtbox disables height checks');
 bug.enemy.z=ATTACK_STATS.Attack1.range+bug.enemy.radius+.02;bug.beginAttack('Attack1');bug.resolveAttack(.3,{x:0,z:0,heading:0,height:0});assert.equal(bug.enemy.health,bug.enemy.maxHealth,'Vertical fix expands horizontal reach');
}
assert(html.indexOf('data-setting="hitboxes"')<html.indexOf('<section id="developer-panel"'),'Hitbox checkbox is still nested in parameter panel');
console.log('HITBOX_3D_VERIFIED: low/high enemy strikes, airborne melee, wave vertical bounds, shared wireframe heights and independent checkbox');
