import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {ENEMY_STATS,GUARD_TIERS} from '../src/battle-values.js';
import {SAMURAI_MOVES,beginBossSequence} from '../src/samurai.js';
import {ENCOUNTERS} from '../src/encounters.js';
const pose={x:0,z:0,heading:0,height:0,guarding:true};
assert.equal(ENEMY_STATS.poseDamage,20);
for(const mode of ['practice','samurai']){
 const attacks=mode==='practice'?[ENEMY_STATS]:Object.values(SAMURAI_MOVES).flat();
 for(const attack of attacks)for(const [frames,multiplier] of [[0,.1],[11,.25],[19,.5],[31,.6],[61,.75],[null,1]]){
  const b=new Battle();b.reset(mode);b.enemy.z=1;b.enemy.heading=Math.PI;
  b.strikePlayer({...pose,guarding:frames!==null,guardElapsed:frames/60},attack);
  assert.equal(b.player.pose,Math.round((100-attack.poseDamage*multiplier)*100)/100);
 }
}
{
 const b=new Battle();b.reset('samurai');b.enemy.z=1;b.enemy.heading=Math.PI;b.player.pose=1;
 b.strikePlayer({...pose,guardElapsed:0},SAMURAI_MOVES.heavy[0]);assert.equal(b.player.pose,1);assert.equal(b.player.health,100);
}
{
 const b=new Battle();b.enemy.z=1;b.enemy.heading=Math.PI;b.player.pose=3;
 b.strikePlayer({...pose,guardElapsed:11/60});assert.equal(b.player.pose,0);assert(b.breakLaugh);
}
{
 const b=new Battle();b.enemy.z=1;b.enemy.heading=Math.PI;b.enemy.attackPower=50;
 b.strikePlayer({...pose,guardElapsed:0});assert.equal(b.player.pose,98,'Health damage must not replace independent pose damage');
}
assert.equal('cost' in GUARD_TIERS[0],false);
assert.equal(ENCOUNTERS.get('samurai').stats.name,'武士');
for(const phase of [1,2]){const b=new Battle();b.reset('samurai');b.enemy.phase=phase;beginBossSequence(b,'heavy');assert.equal(b.enemy.telegraph,3);}
assert.equal(SAMURAI_MOVES.heavy[0].poseDamage,60);
const old=ENCOUNTERS.get('samurai');
ENCOUNTERS.set('testBoss',{id:'testBoss',kind:'boss',stats:{...old.stats,name:'testBoss'},update(battle){battle.enemy.customUpdated=true;}});
const next=new Battle();next.reset('testBoss');next.update(.01,{...pose,invulnerable:true});
assert.equal(next.enemyName,'testBoss');assert(next.enemy.customUpdated);ENCOUNTERS.delete('testBoss');
console.log('POSE_DAMAGE_VERIFIED: per-move damage times guard multiplier, unguarded cost, perfect floor, guard break, independent boss registry and 3s charge');
