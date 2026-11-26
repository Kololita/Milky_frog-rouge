import * as THREE from 'three';
import {createEnemyView} from '../src/enemy-view.js';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Monster,Mob} from '../src/monster.js';
import {EnemyMove,AttackMove,StanceMove,BuffMove,MovementMove,isDamagingMove,defaultLifeDamage} from '../src/enemy-move.js';
import {MONSTER_STATS} from '../src/monster-catalog.js';
import {MOB_RULES} from '../src/monster-rules.js';
import {ENCOUNTERS} from '../src/encounters.js';
import {Battle} from '../src/battle.js';
import {ATTACK_STATS} from '../src/battle-values.js';
import {tuningFields,applyTuning} from '../src/tuning-registry.js';
import {gameFixture} from './game_fixture.mjs';
import {parseMoveTables} from './enemy-design-tables.mjs';

for(const id of [...Object.keys(MONSTER_STATS),'practice','samurai']){
 const b=new Battle();b.reset(id);assert(b.enemy instanceof Monster);
 const view=createEnemyView(new THREE.Scene());view.update(b,new THREE.PerspectiveCamera(),0);
 assert([...view.warning.geometry.attributes.position.array].every(Number.isFinite),'Idle actor without an attack creates invalid warning geometry');
 assert.equal(b.enemy instanceof Mob,Object.hasOwn(MONSTER_STATS,id));
 for(const move of b.enemy.stats.moves??[]){
  assert(move instanceof EnemyMove);
  if(!isDamagingMove(move)){
   for(const key of ['motionMultiplier','poseDamage','impactLevel']){assert.equal(move[key],-1);assert(!Object.hasOwn(move,key));}
   assert.equal(defaultLifeDamage(move,999),-1);
   const health=b.player.health,pose=b.player.pose;b.debugHitboxes=true;b.takeEvents();b.strikePlayer({x:0,z:0,height:0},move);
   assert.equal(b.player.health,health);assert.equal(b.player.pose,pose);assert.equal(b.takeEvents().length,0,'Utility skill produces a hitbox or damage');
  }
 }
}
const utilityPaths=tuningFields().filter(field=>field.group==='MONSTER_STATS'&&['motionMultiplier','poseDamage','impactLevel'].includes(field.path.at(-1))&&MONSTER_STATS[field.path[0]].moves[field.path[2]] instanceof StanceMove);
assert.equal(utilityPaths.length,0);
applyTuning({});assert(MONSTER_STATS.mirrorGuard.moves[1] instanceof StanceMove,'Tuning clone loses skill prototype');

// A new identity reuses the same policy and reactive stance without adding any ID branches.
const identity='test_configured_mob';
ENCOUNTERS.set(identity,{id:identity,kind:'monster',stats:{...MONSTER_STATS.mirrorGuard,name:'配置测试怪',visual:undefined,ai:{startAnywhere:true,cycle:[1]}}});
try{
 for(const fps of [30,60,144])for(const incoming of ['Attack1','Attack4']){
  const b=new Battle();b.reset(identity);const e=b.enemy;e.x=0;e.z=1.9;e.heading=Math.PI;
  const pose={x:0,z:0,height:0,heading:0};b.beginAttack(incoming);b.update(1/fps,pose);
  assert.equal(e.move.startupResilience,2);
  assert(!b.takeEvents().some(event=>event.type==='enemyParry'),'Cannot parry while the window is arming');
  while(e.elapsed<.5&&e.state==='windup')b.update(1/fps,pose);
  assert(b.takeEvents().some(event=>event.type==='enemyParry'));
  assert(!b.attack);assert.equal(e.counterPending,2);assert.equal(b.player.health,100);
 }
 // Same class lifecycle handles knockdown and wake-up for every configured mob.
 const b=new Battle();b.reset(identity);b.enemy.state='down';b.enemy.downUntil=.02;b.enemy.riseUntil=.04;b.enemy.riseDuration=.02;
 b.update(.025,{x:1,z:0,height:0});assert.equal(b.enemy.state,'rising');b.update(.025,{x:1,z:0,height:0});assert.equal(b.enemy.state,'idle');assert(b.enemy.backThrowImmuneUntil>b.time);
}finally{ENCOUNTERS.delete(identity);}

for(const fps of [30,60,144]){
 const g=await gameFixture(fps);g.freezeEnemy=true;
 g.read('battle.reset("mirrorGuard");battle.enemy.x=0;battle.enemy.z=1.9;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.move=battle.enemy.stats.moves[1];battle.enemy.elapsed=.5;battle.enemy.telegraph=.5;battle.enemy.swingDuration=1.2;battle.enemy.windup=1.7');
 // Freeze would force hurt, so this check runs a real controller frame with AI enabled.
 g.freezeEnemy=false;g.mouse(0);g.tickFrames(1);assert.equal(g.read('activeGesture?.name'),'Hit');assert.equal(g.read('battle.player.health'),100);
}
// Preserve progress-based release timing as a class-wide configurable rule.
const jab=MONSTER_STATS.raider.moves[0],before=jab.lockLead,old=MOB_RULES.lockLead;MOB_RULES.lockLead=.12;assert.equal(jab.lockLead,.12);MOB_RULES.lockLead=old;assert.equal(jab.lockLead,before);

for(const stats of Object.values(MONSTER_STATS)){
 const text=await fs.readFile(new URL(`../docs/monsters/${stats.name}.md`,import.meta.url),'utf8'),rows=parseMoveTables(text);
 assert(text.includes('怪物通则.md'));assert(!text.includes('### 交付与绑定要求'));assert(!text.includes('自由移动限速转向，'));
 for(const move of stats.moves){const row=rows.get(move.label);assert(row);if(!isDamagingMove(move)){assert(!('默认生命伤害' in row));assert(!('冲击力' in row));}}
}
const controller=await fs.readFile(new URL('../src/monster-ai.js',import.meta.url),'utf8');assert(!controller.includes('stats.visual'));assert(!controller.includes('encounterId'));assert(!controller.includes("==='spitter'"));
assert(new BuffMove({label:'增幅',swing:.2}) instanceof EnemyMove);assert(new MovementMove({label:'位移',swing:.2,retreat:1}) instanceof EnemyMove);assert(new AttackMove({label:'攻击',swing:.2,motionMultiplier:1}).dealsDamage);
console.log('MONSTER_ARCHITECTURE_VERIFIED: Monster/Mob inheritance, shared lifecycle, identity-independent data policies, typed skills/-1 semantics, tuning prototypes, immediate 2m stance response at 30/60/144FPS and categorized docs');
