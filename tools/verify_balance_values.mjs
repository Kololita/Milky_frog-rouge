import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Battle} from '../src/battle.js';
import {ATTACK_STATS,PLAYER_STATS,ENEMY_STATS,WAVE_STATS,energyDamageMultiplier} from '../src/battle-values.js';
import {MONSTER_STATS} from '../src/monster-catalog.js';
import {SAMURAI_STATS,updateSamuraiPhase} from '../src/samurai.js';
import {BACK_THROW} from '../src/back-throw.js';
const read=path=>fs.readFile(new URL(`../${path}`,import.meta.url),'utf8');
const doc=await read('docs/战斗数值.md');
const multipliers={Attack1:1,Attack2:1.2,Attack3:.8,Attack4:4,CounterWave:4,RunAttack:1.2,AirAttack:3};
const labels={Attack1:'左直拳',Attack2:'跨步右直拳',Attack3:'左右左三连拳',Attack4:'蓄力重推掌 / 金光反击近身推掌',RunAttack:'跑步双掌',AirAttack:'跳跃下砸'};
assert.equal(PLAYER_STATS.attackPower,10);assert.equal(BACK_THROW.motionMultiplier,7.5);assert.equal(WAVE_STATS.motionMultiplier,3.6);
for(const [name,value] of Object.entries(multipliers)){
 assert.equal(ATTACK_STATS[name].motionMultiplier,value,`Wrong player multiplier: ${name}`);
 if(labels[name]){const line=doc.split('\n').find(line=>line.startsWith(`| ${labels[name]} |`));assert(line);assert.equal(Number.parseFloat(line.split('|')[2]),value);}
}
assert(doc.includes('| 背摔坐砸 | 7.5 |'));
const baseline={raider:[240,6],shellbug:[280,7],lantern:[180,5],spitter:[300,6],mirrorGuard:[420,7],raiderElite:[650,8],stonekeeper:[900,9],scythemoth:[560,7]};
for(const [id,[health,power]] of Object.entries(baseline)){
 const s=MONSTER_STATS[id];assert.equal(s.health,health);assert.equal(s.attackPower,power);
 const design=await read(`docs/monsters/${s.name}.md`);
 assert(design.includes(`| 生命 | ${health} |`),`${s.name}: HP document differs`);
 assert(design.includes(`| 攻击力 | ${power} |`),`${s.name}: attack document differs`);
 const b=new Battle();b.reset(id);assert.equal(b.enemy.maxHealth,health);assert.equal(b.enemy.health,health);assert.equal(b.enemy.attackPower,power);
 assert(health>PLAYER_STATS.attackPower*BACK_THROW.motionMultiplier*2,'A single backthrow still deletes the enemy');
}
assert.equal(ENEMY_STATS.health,600);assert.equal(SAMURAI_STATS.health,2200);assert.equal(SAMURAI_STATS.attackPower,6);
const bossDoc=await read('docs/monsters/武士.md');assert(bossDoc.includes('| 最大生命 | 2200 |'));assert(bossDoc.includes('生命≤1100'));
const pose={x:0,z:0,heading:0,height:0,landed:true};
for(const energy of [0,99]){
 const b=new Battle();b.player.energy=energy;b.enemy.z=.8;b.enemy.superArmor=true;
 for(const name of ['Attack1','Attack2','Attack3','Attack4']){b.beginAttack(name);b.resolveAttack(1,pose);}
 const damage=Math.round((b.enemy.maxHealth-b.enemy.health)*100)/100;
 assert.equal(damage,Math.round(86*energyDamageMultiplier(energy)*100)/100);
 assert.equal(b.takeEvents().filter(e=>e.type==='enemyHit').length,6);
}
{
 const b=new Battle();b.enemy.z=.8;b.enemy.superArmor=true;b.beginAttack('CounterWave');b.resolveAttack(.54,pose);b.updateWaves(.2);
 assert.equal(b.enemy.maxHealth-b.enemy.health,70,'Counter must be 40 melee + 30 wave');
 b.reset('samurai');b.enemy.health=1100.01;updateSamuraiPhase(b);assert.equal(b.enemy.phase,1);b.enemy.health=1100;updateSamuraiPhase(b);assert.equal(b.enemy.phase,2);
}
console.log('BALANCE_VALUES_VERIFIED: user-authored multipliers, full combo 86/103.2, counter 40+30, all eight enemy HP baselines, boss phase and synchronized monster docs');
