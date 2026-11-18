import {parseMoveTables,moveDurationColumn} from './enemy-design-tables.mjs';
import {isDamagingMove} from '../src/enemy-move.js';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {Battle} from '../src/battle.js';
import {MONSTER_STATS} from '../src/monster-catalog.js';
import {FORMATIONS,ENCOUNTER_POOLS} from '../src/encounter-formations.js';
import {launchEnemyProjectiles} from '../src/enemy-projectiles.js';
import {createEnemyView,createEnemyProjectileView} from '../src/enemy-view.js';
const pose={x:0,z:0,height:0,heading:0,invulnerable:true};
for(const id of ENCOUNTER_POOLS.strong){
 const members=FORMATIONS[id]??[id];assert(members.some(id=>MONSTER_STATS[id].moves.some(m=>m.kind==='projectile')),'Kiteable strong formation');
 const b=new Battle();b.reset(id);assert.equal(b.enemies.length,members.length);
 assert(b.enemies.every(e=>!Object.hasOwn(e,'weak')&&!Object.hasOwn(e,'strong')));
}
assert(Object.values(FORMATIONS).filter(ids=>ids.length===2).length>=8);
for(const fps of [30,60,144])for(const id of ['spitter','mirrorGuard']){
 const b=new Battle();b.reset(id);const e=b.enemy;e.z=6;e.heading=Math.PI;
 const view=createEnemyView(new THREE.Scene()),projectiles=createEnemyProjectileView(new THREE.Scene()),camera=new THREE.PerspectiveCamera();let shots=0;
 for(let i=0;i<fps*8;i++){
  b.update(1/fps,pose);view.update(b,camera,1/fps);projectiles.update(b);
  shots+=b.takeEvents().filter(e=>e.type==='enemyProjectileReleased').length;
  assert(Number.isFinite(e.x+e.z+e.heading));assert(view.monsterVisuals.entries[id].root.visible);assert(!view.body.visible);
 }
 assert(shots>=2,`${id} never pressures a distant player`);assert.equal(b.player.health,100);
 b.clearBattleEffects();projectiles.update(b);assert.equal(projectiles.root.children.length,0);
}
function launched(){const b=new Battle();b.reset('spitter');b.enemy.x=0;b.enemy.z=5;b.enemy.heading=Math.PI;launchEnemyProjectiles(b,b.enemyStats.moves[0]);b.enemy.state='hurt';b.enemy.stun=100;return b;}
for(const fps of [30,60,144])for(const mode of ['normal','guard','backGuard','air','dodge']){
 const b=launched(),p={...pose,invulnerable:false};
 if(mode==='guard')Object.assign(p,{guarding:true,guardElapsed:.05});
 if(mode==='backGuard')Object.assign(p,{guarding:true,guardElapsed:.05,heading:Math.PI});
 if(mode==='air')p.height=2;
 if(mode==='dodge')Object.assign(p,{dodgeName:'DodgeSideL',dodgeElapsed:.1});
 for(let i=0;i<fps;i++)b.update(1/fps,p);
 if(['normal','backGuard'].includes(mode))assert.equal(b.player.health,89.2,'Swept projectile misses or repeats damage');
 else assert.equal(b.player.health,100);
 if(mode==='guard'){assert(!b.player.counterReady);assert.equal(b.enemy.health,b.enemy.maxHealth);assert(!b.takeEvents().some(e=>e.type==='enemyImpact'),'Distant caster incorrectly receives parry recoil');}
}
{
 const b=launched(),shot=b.enemyProjectiles[0];b.update(.05,pose,.8);assert(Math.abs(shot.travel-.4)<1e-8,'Projectile ignores world slow');
 const c=new Battle();c.reset('spitter');c.enemy.z=5;c.enemy.heading=Math.PI;c.enemy.applyEffect({type:"damageIncrease",amount:.2,duration:30},c.enemyTime);launchEnemyProjectiles(c,c.enemyStats.moves[0]);
 c.enemy.attackPower=99;c.enemy.state='hurt';c.enemy.stun=100;for(let i=0;i<60;i++)c.update(1/60,{...pose,invulnerable:false});assert.equal(c.player.health,87.04,'Projectile fails to snapshot launch power');
}

assert.deepEqual(MONSTER_STATS.spitter.moves.map(m=>m.label),['晶矢三射','回身甩尾','后撤步']);
assert.equal(MONSTER_STATS.spitter.backThrowable,false);assert.equal(MONSTER_STATS.spitter.retreatCooldown,10);
const spitterDesign=await fs.readFile(new URL('../docs/monsters/弩尾蜥.md',import.meta.url),'utf8');assert(spitterDesign.includes('| 能否背摔 | 否 |'));
for(const move of MONSTER_STATS.spitter.moves){
 const row=parseMoveTables(spitterDesign).get(move.label);assert(row);
 for(const [label,value] of [['蓄势/准备',move.prepare],[moveDurationColumn(move),move.swing],['刀后恢复',move.recovery]])assert.equal(Number.parseFloat(row[label]),value);
 if(isDamagingMove(move)){assert.equal(Number(row['动作倍率']),move.motionMultiplier);assert.equal(Number(row['基础破绷']),move.poseDamage);}
}

{
 const b=new Battle();b.reset('spitter');b.enemy.z=1;b.enemy.heading=0;assert(!b.beginBackThrow(pose),'Spitter still allows backthrow');
}
for(const fps of [30,60,144]){
 const b=new Battle();b.reset('spitter');b.enemy.z=1.6;b.enemy.heading=Math.PI;b.enemy.decisionSeed=0;let maxStep=0,previous=b.enemy.z;
 for(let i=0;i<Math.ceil(fps*.7);i++){b.update(1/fps,pose);maxStep=Math.max(maxStep,Math.abs(b.enemy.z-previous));previous=b.enemy.z;}
 assert(b.enemy.z>2.9,'Retreat never moves away');assert(maxStep<=4,'Retreat exceeds authored displacement');assert(Math.abs(b.enemy.z-5.6)<1e-6,'Instant retreat must travel 4m');
 assert.equal(b.enemy.move.kind,'movement');assert.equal(b.enemy.recovery,1);assert(!b.enemy.move.projectile);assert.equal(b.enemyProjectiles.length,0);
 assert(!b.takeEvents().some(e=>e.type==='monsterSwing'||e.type==='enemyProjectileReleased'),'Retreat has an attack hit');
 assert(b.enemy.nextRetreatAt>=10);
}
for(const fps of [30,60,144]){
 const b=new Battle();b.reset('spitter');const e=b.enemy;e.z=1.6;e.heading=Math.PI;e.decisionSeed=1024;b.update(1/fps,pose);
 assert.equal(e.move.motion,'shoot');assert.equal(e.telegraph,1.85);const x=e.x,z=e.z;let releases=0,releaseAt=0;
 while(e.state!=='recover'){
  b.update(1/fps,pose);for(const event of b.takeEvents())if(event.type==='enemyProjectileReleased'){releases++;releaseAt=b.enemyTime;assert.equal(b.enemyProjectiles.length,3);}
  assert.equal(e.x,x);assert.equal(e.z,z,'Triple shot retreats during preparation');
 }
 assert.equal(releases,1);assert(Math.abs(releaseAt-(1.85+.25*.7))<=2/fps);assert.equal(e.recovery,2.1);
 const ready=e.actionReadyAt,stats=e.stats,oldChance=stats.retreatChance;stats.retreatChance=1;e.nextRetreatAt=0;let moved=false,turned=false;const heading=e.heading;
 try{
  const close={...pose,x:x+1,z:z-.9},move=e.move;
  while(b.enemyTime+1/fps<ready-1e-9){
   b.update(1/fps,close);assert.equal(e.state,'recover');assert.equal(e.move,move);
   moved ||= Math.hypot(e.x-x,e.z-z)>.05;turned ||= Math.abs(e.heading-heading)>.05;
   assert(!b.takeEvents().some(event=>event.type==='monsterMove'||event.type==='enemyProjectileReleased'),'Recovery starts an attack/retreat');
  }
  assert(moved&&turned,'Triple shot recovery does not allow movement and turning');
 }finally{stats.retreatChance=oldChance;}
 // Hurt cannot cancel the original shot recovery into an early new attack.
 const c=new Battle();c.reset('spitter');c.enemy.z=1.6;c.enemy.heading=Math.PI;c.enemy.decisionSeed=1024;
 do{c.update(1/fps,pose);}while(c.enemy.state!=='recover');c.takeEvents();const until=c.enemy.actionReadyAt;c.impactEnemy(1,pose);
 while(c.enemyTime+1/fps<until-1e-9){c.update(1/fps,pose);assert(!c.takeEvents().some(e=>e.type==='monsterMove'),'Hurt bypasses action recovery');}
}
{
 const choices=new Map();
 for(let seed=0;seed<1000;seed++){
  const b=new Battle();b.reset('spitter');const e=b.enemy;e.z=2.4;e.heading=Math.PI;e.decisionSeed=Math.imul(seed,7919)>>>0;b.update(.01,pose);choices.set(e.move.motion,(choices.get(e.move.motion)??0)+1);
 }
 assert(choices.get('retreat')>250&&choices.get('retreat')<450);assert(choices.get('shoot')>150);assert(choices.get('tail-sweep')>150,'Close range never chooses melee');
 const b=new Battle();b.reset('spitter');b.enemy.z=1.6;b.enemy.decisionSeed=0;b.enemy.nextRetreatAt=100;b.update(.01,pose);assert.notEqual(b.enemy.move.kind,'movement','Retreat ignores cooldown');
}
function stance(heading=Math.PI,elapsed=.3){const b=new Battle();b.reset('mirrorGuard');const e=b.enemy;e.z=1;e.heading=heading;e.state='windup';e.move=e.stats.moves[1];e.moveIndex=1;e.elapsed=elapsed;e.telegraph=e.move.prepare;e.swingDuration=e.move.swing;e.windup=e.telegraph+e.swingDuration;return b;}
{
 const b=stance();b.beginAttack('Attack1');b.resolveAttack(.27,pose);assert.equal(b.enemy.health,b.enemy.maxHealth);assert.equal(b.enemy.counterPending,2);assert(!b.attack);assert(b.takeEvents().some(e=>e.type==='enemyParry'));
 for(let i=0;i<10;i++)b.update(1/60,pose);assert.equal(b.enemy.move.label,'弹反回斩');assert.equal(b.enemy.state,'windup');
}
for(const [attack,heading,elapsed] of [['Attack4',Math.PI,.3],['Attack1',0,.3],['Attack1',Math.PI,.83],['AirAttack',Math.PI,.3]]){
 const b=stance(heading,elapsed);b.beginAttack(attack);b.resolveAttack(1,{...pose,landed:true});assert(b.enemy.health<b.enemy.maxHealth,`${attack} cannot punish stance`);assert(!b.takeEvents().some(e=>e.type==='enemyParry'));
}
console.log('ENEMY_SPECIALS_VERIFIED: ranged pressure in every strong formation, 30/60/144FPS dual visuals, swept 3D projectiles/guard/dodge/height, slow time/snapshot, retreat motion and directional light-parry/heavy punish');
