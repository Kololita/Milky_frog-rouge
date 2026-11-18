import {parseMoveTables} from './enemy-design-tables.mjs';
import {isDamagingMove} from '../src/enemy-move.js';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Battle} from '../src/battle.js';
import {ENEMY_STATS,IMPACT_LEVELS,currentImpactResistance,effectiveImpactLevel,playerImpactReaction} from '../src/battle-values.js';
import {MONSTER_STATS} from '../src/monster-catalog.js';
import {SAMURAI_MOVES} from '../src/samurai.js';
import {tuningFields,tuningRange,applyTuning} from '../src/tuning-registry.js';
import {launchEnemyProjectiles} from '../src/enemy-projectiles.js';
import {gameFixture} from './game_fixture.mjs';
const authored=[['practice',[ENEMY_STATS]],...Object.entries(MONSTER_STATS).map(([id,s])=>[id,s.moves]),['samurai',Object.values(SAMURAI_MOVES).flat()]];
const pose={x:0,z:0,height:0,heading:0};let count=0;
for(const [id,moves] of authored)for(const move of moves){
 count++;assert(Number.isInteger(move.startupResilience)&&move.startupResilience>=0);assert(Number.isInteger(move.impactLevel)&&(isDamagingMove(move)?move.impactLevel>=0&&move.impactLevel<=3:move.impactLevel===-1));
 if(['buff','parry','movement'].includes(move.kind))assert.equal(move.impactLevel,-1);
 for(const incoming of [1,2,3]){
  const b=new Battle();b.reset(id);const e=b.enemy;e.state='windup';e.move=move;e.superArmor=move.startupResilience>=3;
  const expected=Math.max(0,incoming-move.startupResilience);assert.equal(currentImpactResistance(e),move.startupResilience);assert.equal(effectiveImpactLevel(e,incoming),expected);
  assert.equal(b.impactEnemy(incoming,pose),expected>0,`${id} ${move.label}: startup resistance ignored`);
 }
 const b=new Battle();b.reset(id);b.enemy.move=move;b.enemy.state='recover';assert.equal(currentImpactResistance(b.enemy),b.enemy.impactResistance);
}
// Base resistance is replaced during the move, not added a second time.
{
 const b=new Battle();b.reset('raiderElite');const e=b.enemy;e.move={...e.stats.moves[0],startupResilience:2};e.state='windup';assert.equal(effectiveImpactLevel(e,3),1);e.state='idle';assert.equal(effectiveImpactLevel(e,3),2);
 e.state='windup';e.move.startupResilience=0;assert.equal(effectiveImpactLevel(e,1),1);
}
for(const level of [0,1,2,3]){
 const b=new Battle();b.enemy.z=1;b.enemy.heading=Math.PI;b.beginAttack('Attack1');b.strikePlayer(pose,{...ENEMY_STATS,impactLevel:level});
 const hit=b.takeEvents().find(e=>e.type==='playerHit'),reaction=playerImpactReaction(level);assert(hit);assert.equal(b.player.health,88);assert.equal(b.player.pose,80);
 assert.equal(hit.stun,reaction.stun);assert.equal(hit.knockback,reaction.knockback);assert.equal(Boolean(b.attack),level===0);
 const guard=new Battle();guard.enemy.z=1;guard.enemy.heading=Math.PI;guard.strikePlayer({...pose,guarding:true,guardElapsed:0},{...ENEMY_STATS,impactLevel:level});assert.equal(guard.player.health,100);assert(!guard.takeEvents().some(e=>e.type==='playerHit'));
 const rage=new Battle();rage.enemy.z=1;rage.enemy.heading=Math.PI;rage.player.rageUntil=9;rage.beginAttack('Attack1');rage.strikePlayer(pose,{...ENEMY_STATS,impactLevel:level});assert(rage.attack);assert(rage.takeEvents().find(e=>e.type==='playerHit').armored);
}
{
 const b=new Battle();b.reset('spitter');b.enemy.z=5;b.enemy.heading=Math.PI;
 const move={...b.enemy.stats.moves[0],impactLevel:2};launchEnemyProjectiles(b,move);move.impactLevel=3;assert.equal(b.enemyProjectiles[0].move.impactLevel,2);
 b.enemy.state='hurt';b.enemy.stun=100;let hit;
 for(let i=0;i<60&&!hit;i++){b.update(1/60,pose);hit=b.takeEvents().find(e=>e.type==='playerHit');}
 assert(hit);assert.equal(hit.impactLevel,2);assert.equal(hit.stun,1.65);
}
const fields=tuningFields();assert(fields.some(f=>f.id==='ENEMY_STATS.startupResilience'));assert(fields.some(f=>f.id==='MONSTER_STATS.spitter.moves.0.impactLevel'));assert(fields.some(f=>f.id==='SAMURAI_MOVES.heavy.0.startupResilience'));
assert.equal(tuningRange(fields.find(f=>f.id==='MONSTER_STATS.spitter.moves.0.impactLevel')).step,1);assert.throws(()=>applyTuning({'ENEMY_STATS.startupResilience':.5}));assert.throws(()=>applyTuning({'ENEMY_STATS.impactLevel':4}));
// Repeat generation must preserve every pre-existing column and handwritten text.
const docs=await Promise.all(Object.values(MONSTER_STATS).map(async s=>({stats:s,path:new URL(`../docs/monsters/${s.name}.md`,import.meta.url),text:await fs.readFile(new URL(`../docs/monsters/${s.name}.md`,import.meta.url),'utf8')})));
const outputRoot=fileURLToPath(new URL('../output/',import.meta.url));
await fs.mkdir(outputRoot,{recursive:true});
const scratch=await fs.mkdtemp(path.join(outputRoot,'impact-docs-'));
try{
 await fs.mkdir(path.join(scratch,'docs/monsters'),{recursive:true});
 for(const doc of docs)await fs.writeFile(path.join(scratch,'docs/monsters',path.basename(fileURLToPath(doc.path))),doc.text);
 await fs.copyFile(new URL('../docs/monsters/武士.md',import.meta.url),path.join(scratch,'docs/monsters/武士.md'));
 execFileSync(process.execPath,[fileURLToPath(new URL('./write-enemy-impact-docs.mjs',import.meta.url))],{stdio:'pipe',cwd:scratch});
for(const doc of docs){
 const text=await fs.readFile(path.join(scratch,'docs/monsters',path.basename(fileURLToPath(doc.path))),'utf8');assert.equal(text,doc.text,'Repeated generation damages handwritten design');
 const rows=parseMoveTables(text);
 for(const move of doc.stats.moves){const row=rows.get(move.label);assert(row);assert.equal(Number(row['出手韧性']),move.startupResilience);if(isDamagingMove(move))assert.equal(Number(row['冲击力']),move.impactLevel);else assert(!('冲击力' in row));assert.equal(Number.parseFloat(row['刀后恢复']),move.link??move.recovery);}

}
}finally{
 const resolved=path.resolve(scratch);
 assert(resolved.startsWith(path.resolve(outputRoot)+path.sep)&&path.basename(resolved).startsWith('impact-docs-'));
 await fs.rm(resolved,{recursive:true,force:true});
}
for(const level of [0,3]){
 const g=await gameFixture(60);g.freezeEnemy=true;g.read('battle.enemy.z=1;battle.enemy.heading=Math.PI');g.tap('KeyJ');
 g.read(`battle.strikePlayer(battlePose(),{...ENEMY_STATS,impactLevel:${level}})`);g.tickFrames(1);
 assert.equal(g.read('activeGesture?.name'),level===0?'Attack1':'Hit');
 if(level===3){g.tick(.9);assert.equal(g.read('activeGesture?.name'),'Hit');g.tick(2.4);assert.notEqual(g.read('activeGesture?.name'),'Hit');}
}
console.log(`ENEMY_IMPACT_PARAMS_VERIFIED: ${count} authored moves, startup-only total resilience, player levels0–3, guard/rage, projectile snapshot, integer tuning and real GLB reaction`);
