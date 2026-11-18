import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Battle} from '../src/battle.js';
import {ATTACK_STATS,ENEMY_STATS} from '../src/battle-values.js';
import {SAMURAI_MOVES,SAMURAI_STATS,beginBossSequence} from '../src/samurai.js';
import {gameFixture} from './game_fixture.mjs';
const neutral={x:0,z:0,heading:0,height:0,guarding:false,guardElapsed:0,invulnerable:false};
const originals=[.96,1.04,1.02,1.17];
for(let i=0;i<4;i++){
 const name=`Attack${i+1}`,stats=ATTACK_STATS[name];assert(Math.abs(stats.range/originals[i]-1.2)<1e-9);
 const b=new Battle();b.enemy.z=originals[i]*1.1+ENEMY_STATS.radius;b.beginAttack(name);b.resolveAttack(stats.times.at(-1),neutral);assert(b.enemy.health<b.enemy.maxHealth,'Extended front range did not hit');
 b.spawnEnemy();b.enemy.z=stats.range+ENEMY_STATS.radius+.01;b.beginAttack(name);b.resolveAttack(stats.times.at(-1),neutral);assert.equal(b.enemy.health,b.enemy.maxHealth,'Attack extends beyond new boundary');
}
assert.equal(ATTACK_STATS.RunAttack.range,1.2);assert.equal(ATTACK_STATS.AirAttack.range,1.85);
const report=[];
for(const phase of [1,2])for(const [pattern,moves] of Object.entries(SAMURAI_MOVES))for(let index=0;index<moves.length;index++){
 const b=new Battle();b.reset('samurai');b.enemy.phase=phase;b.enemy.x=0;b.enemy.z=1.5;beginBossSequence(b,pattern);
 for(let frame=0;frame<1000&&!(b.enemy.moveIndex===index&&b.enemy.state==='windup');frame++)b.update(1/60,{...neutral,invulnerable:true});
 const e=b.enemy,fast=moves[index].label.startsWith('快刀');assert.equal(e.superArmor,!fast);
 if(fast){
  e.elapsed=e.telegraph+.01;b.impactEnemy(1,neutral);assert.equal(e.state,'windup','Boss resistance does not suppress level-one impact');
  b.impactEnemy(2,neutral);assert.equal(e.state,'hurt','Level-two strike cannot interrupt unarmored quick strike');
  b.takeEvents();b.update(.05,{...neutral,invulnerable:true});assert(!b.takeEvents().some(event=>event.type==='bossSwing'),'Interrupted quick strike still lands');
 }
}
for(const fps of [30,60,144]){
 for(const [name,moves] of Object.entries(SAMURAI_MOVES)){
  const b=new Battle();b.reset('samurai');b.enemy.x=0;b.enemy.z=1.7;b.enemy.heading=Math.PI;
  beginBossSequence(b,name);let elapsed=0;const swings=[];
  while(elapsed<8){
   const pose={...neutral,x:b.enemy.x+Math.sin(b.enemy.heading)*1.4,z:b.enemy.z+Math.cos(b.enemy.heading)*1.4,invulnerable:true};
   b.update(1/fps,pose);elapsed+=1/fps;
   for(const event of b.takeEvents())if(event.type==='bossSwing')swings.push({time:elapsed,label:event.label});
   if(swings.length===moves.length&&b.enemy.state==='recover')break;
  }
  assert.equal(swings.length,moves.length,`${fps}FPS ${name}: missing or repeated swing`);
  assert(Math.abs(swings[0].time-moves[0].windup)<=1/fps+1e-8,'Boss timing depends on FPS');
  assert.equal(b.player.health,100,'Dodge immunity ignored by boss');report.push({fps,name,swings});
 }
 const b=new Battle();b.reset('samurai');b.enemy.z=1.5;b.enemy.heading=Math.PI;beginBossSequence(b,'delay');
 b.impactEnemy(3,neutral);assert.equal(b.enemy.state,'windup','Ordinary impact cancels armored attack');
 for(let n=0;n<6;n++)b.impactEnemy(1,neutral,'parry');
 assert.equal(b.enemy.state,'windup');assert(!('parryPoise' in b.enemy));
 b.enemy.health=b.enemy.maxHealth*.5;b.update(1/fps,{...neutral,invulnerable:true});assert.equal(b.enemy.pendingPhase,2);
 b.enemy.state='dead';b.enemy.health=0;b.enemy.elapsed=5;b.update(1/fps,neutral);assert.equal(b.enemy.maxHealth,SAMURAI_STATS.health);
 b.player.health=0;b.player.deadTime=3;b.update(1/fps,neutral);assert.equal(b.mode,'samurai');assert.equal(b.enemy.health,SAMURAI_STATS.health);
}
const g=await gameFixture(60,{home:true});g.freezeEnemy=true;
g.read('enterArena("samurai")');g.tick(.1);assert.equal(g.read('battle.mode'),'samurai');assert(g.read('arenaView.group.visible'));
g.tap('Home');assert.equal(g.read('battle.mode'),'samurai');assert.equal(g.read('battle.enemy.health'),SAMURAI_STATS.health);
g.read('enterArena("practice")');assert.equal(g.read('battle.enemy.health'),ENEMY_STATS.health);assert(!g.read('arenaView.group.visible'));
await fs.writeFile(new URL('../output/samurai-verification.json',import.meta.url),JSON.stringify({extendedFourAttackRanges:true,report},null,2));
console.log('SAMURAI_VERIFIED: range boundaries, five moves at 30/60/144FPS, armor/parry, second phase, respawn and isolated arena switching');
