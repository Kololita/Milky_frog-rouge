import {parseMoveTables,moveDurationColumn} from './enemy-design-tables.mjs';
import {isDamagingMove,defaultLifeDamage} from '../src/enemy-move.js';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {MONSTER_STATS} from '../src/monster-catalog.js';
import {ATTACK_STATS} from '../src/battle-values.js';
import {Battle} from '../src/battle.js';
import {createEnemyView} from '../src/enemy-view.js';
import {gameFixture} from './game_fixture.mjs';

// Read every authored monster table; verification must never rewrite the designs.
for(const stats of Object.values(MONSTER_STATS)){
 const text=await fs.readFile(new URL(`../docs/monsters/${stats.name}.md`,import.meta.url),'utf8'),lines=text.split('\n');
 const cells=line=>line.split('|').slice(1,-1).map(s=>s.trim());
 for(const [label,value] of [['生命',stats.health],['攻击力',stats.attackPower],['移动速度',stats.speed],['自由转向上限',Math.round(stats.turnRate*180/Math.PI)],['碰撞半径',stats.radius],['受击体高度',stats.bodyHeight],['基础韧性（冲击耐受）',stats.impactResistance??0]]){
  const line=lines.find(line=>line.startsWith(`| ${label} |`));if(!line){assert(label==='冲击耐受'&&value===0);continue;}
  const authored=Number.parseFloat(cells(line)[1]);
  if(label==='自由转向上限')assert(Math.abs(authored-value)<=1,`${stats.name}: ${label}`); // prose rounds radians to whole degrees
  else assert.equal(authored,value,`${stats.name}: ${label}`);
 }
 const throwRow=lines.find(line=>line.startsWith('| 能否背摔 |'));if(throwRow)assert.equal(cells(throwRow)[1],stats.backThrowable===false||stats.bodyPlan==='nonhumanoid'?'否':'是');else assert.notEqual(stats.backThrowable,false);
 const rows=parseMoveTables(text);
 for(const move of stats.moves){
  const row=rows.get(move.label);assert(row);
  for(const [label,value] of [['蓄势/准备',move.prepare],[moveDurationColumn(move),move.swing],['刀后恢复',move.link??move.recovery],['出手韧性',move.startupResilience]])assert.equal(Number.parseFloat(row[label]),value,stats.name+'/'+move.label+': '+label);
  if(isDamagingMove(move)){
   for(const [label,value] of [['动作倍率',move.motionMultiplier],['基础破绷',move.poseDamage],['默认生命伤害',defaultLifeDamage(move,stats.attackPower)],['冲击力',move.impactLevel]])assert.equal(Number.parseFloat(row[label]),value,stats.name+'/'+move.label+': '+label);
  }else{assert(!('默认生命伤害' in row));assert(!('冲击力' in row));assert.equal(move.defaultLifeDamage(stats.attackPower),-1);}
 }

}
function stance(elapsed=.3,angle=0){
 const b=new Battle();b.reset('mirrorGuard');const e=b.enemy;e.x=0;e.z=0;e.heading=0;e.state='windup';e.move=e.stats.moves[1];e.moveIndex=1;e.elapsed=elapsed;e.telegraph=e.move.prepare;e.swingDuration=e.move.swing;e.windup=e.telegraph+e.swingDuration;
 return {b,e,pose:{x:Math.sin(angle),z:Math.cos(angle),height:0,heading:angle+Math.PI,invulnerable:false}};
}
for(const [elapsed,valid] of [[0,true],[.001,true],[.3,true],[.6,true],[.601,false]]){
 const {b,e,pose}=stance(elapsed);assert.equal(b.tryEnemyParry(e,pose,ATTACK_STATS.Attack1),valid,`Parry time ${elapsed}`);
}
for(const angle of [-180,-131,-129,0,129,131,180]){
 const {b,e,pose}=stance(.4,angle*Math.PI/180);assert.equal(b.tryEnemyParry(e,pose,ATTACK_STATS.Attack1),Math.abs(angle)<=130,`Parry angle ${angle}`);
}
for(const fps of [30,60,144]){
 const {b,e,pose}=stance(.4,110*Math.PI/180);b.beginAttack('Attack1');const health=b.player.health,guard=b.player.pose;
 assert(b.tryEnemyParry(e,pose,ATTACK_STATS.Attack1));assert.equal(b.player.health,health);assert.equal(b.player.pose,guard);assert(!b.attack);
 assert.equal(b.takeEvents().find(event=>event.type==='playerHit').stun,1);
 let hitTime=null,damage=0;
 for(let i=0;i<fps*.8;i++){
  b.update(1/fps,pose);
  for(const event of b.takeEvents())if(event.type==='playerHit'&&event.damage>0){hitTime=b.enemyTime;damage+=event.damage;}
 }
 assert(hitTime!==null&&hitTime<.5,'Fast riposte misses the parried attacker or starts too late');
 assert.equal(damage,19.6);assert.equal(e.move.motion,'riposte');assert.equal(e.recovery,2);
 assert(Math.abs(e.heading-Math.atan2(pose.x,pose.z))<1e-8);
 const c=new Battle();c.reset('shellbug');const bug=c.enemy;bug.x=0;bug.z=1;bug.state='windup';bug.move=bug.stats.moves[1];bug.telegraph=bug.move.prepare;bug.swingDuration=bug.move.swing;bug.elapsed=.4;
 c.impactEnemy(1,pose);assert.equal(bug.state,'windup','Ring spikes interrupted by impact1');c.impactEnemy(2,pose);assert.notEqual(bug.state,'windup','Ring spikes cannot be interrupted by impact2');
}
{
 const {b,e,pose}=stance();const view=createEnemyView(new THREE.Scene());assert(b.tryEnemyParry(e,pose,ATTACK_STATS.Attack1));b.takeEvents();
 b.enemyTime=.175;view.update(b,new THREE.PerspectiveCamera(),0);
 const root=view.monsterVisuals.entries.mirrorGuard.root,halo=root.getObjectByName('mirror_parry_halo'),shield=root.getObjectByName('mirror_shield');
 assert.equal(halo.material.color.getHex(),0xffd35a);assert(shield.position.y<-.33);assert.equal(b.takeEvents().length,0,'Visual shield push emits gameplay effects');assert.equal(e.x,0);assert.equal(e.z,0);
 b.enemyTime=.36;e.state='windup';e.elapsed=.3;view.update(b,new THREE.PerspectiveCamera(),0);assert.equal(halo.material.color.getHex(),0xa5f4ff);assert.equal(shield.position.y,-.2);
}
{
 const {b,e,pose}=stance();b.player.rageUntil=10;b.beginAttack('Attack1');assert(b.tryEnemyParry(e,pose,ATTACK_STATS.Attack1));assert(b.attack);assert(b.takeEvents().find(event=>event.type==='playerHit').armored);
}
{
 const g=await gameFixture(60);g.freezeEnemy=true;
 g.read('battle.reset("mirrorGuard");battle.enemy.x=0;battle.enemy.z=1;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.move=battle.enemy.stats.moves[1];battle.enemy.moveIndex=1;battle.enemy.elapsed=.4;battle.enemy.telegraph=0;battle.enemy.swingDuration=.6;battle.enemy.windup=.6;battle.tryEnemyParry(battle.enemy,battlePose(),ATTACK_STATS.Attack1)');
 g.tickFrames(1);assert.equal(g.read('activeGesture?.name'),'Hit');g.tick(.7);assert.equal(g.read('activeGesture?.name'),'Hit');g.tick(.4);assert.notEqual(g.read('activeGesture?.name'),'Hit');
}
console.log('AUTHORED_DESIGNS_VERIFIED: all 8 monster tables, spike resilience1, mirror 130-degree half-angle/0–0.6s window/1s recoil/fast 0.1s riposte/2s recovery, golden shield push and native player reaction');
