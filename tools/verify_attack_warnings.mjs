import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ATTACK_PREVIEW_LEAD,attackWarningColor,attackWarningPulse,attackWarningStart} from '../src/attack-warning.js';
import {Battle} from '../src/battle.js';
import {ATTACK_STATS} from '../src/battle-values.js';
import {enemyAnimationSample} from '../src/enemy-models.js';
import {createEnemyView} from '../src/enemy-view.js';
import {MONSTER_STATS} from '../src/monster-catalog.js';
import {beginBossSequence,SAMURAI_MOVES} from '../src/samurai.js';
import {createSamuraiPhaseEffects} from '../src/samurai-phase-effects.js';

const pose={x:0,z:0,height:0,heading:0,landed:true,invulnerable:true};
const camera=new THREE.PerspectiveCamera();
const view=createEnemyView(new THREE.Scene());
const bossWarning=view.group.getObjectByName('boss_attack_warning');
const newBattle=id=>{const battle=new Battle();battle.reset(id);return battle;};
function startMove(battle,index){
 const enemy=battle.enemy;
 Object.assign(enemy,{state:'recover',elapsed:0,recovery:0,counterPending:index,hasMeleeBeat:true,x:0,z:1,heading:Math.PI});
 battle.update(1/60,pose);
 assert.equal(enemy.state,'windup');
 return enemy;
}
assert.equal(ATTACK_PREVIEW_LEAD,1);
function verifyWindow(enemy,impactAt,readVisibility){
 const before=enemy.elapsed,start=attackWarningStart(impactAt);
 assert(Math.abs(impactAt-start-1)<1e-9,enemy.move.label);
 for(const [elapsed,visible] of [[start-.001,false],[start,true],[impactAt-.001,true],[impactAt,false]]){
  enemy.elapsed=elapsed;
  assert.equal(readVisibility(),visible,`${enemy.move.label} at ${elapsed}`);
 }
 enemy.elapsed=before;
}
function verifySector(battle,mesh,impactAt=battle.enemy.hitAt){
 verifyWindow(battle.enemy,impactAt,()=>{
  view.update(battle,camera,0);
  return mesh.visible;
 });
}

let mobMoves=0,bossStrikes=0;
for(const [id,stats] of Object.entries(MONSTER_STATS)){
 for(const [index,move] of stats.moves.entries()){
  const battle=newBattle(id),enemy=startMove(battle,index);
  view.update(battle,camera,0);
  const hasSector=move.dealsDamage&&!move.skipWarning;
  if(!hasSector)assert(!view.warning.visible,move.label);
  if(['aura','channel'].includes(move.kind)){
   const warning=view.group.getObjectByName('boiler_pressure_warning');
   verifySector(battle,warning);
  }
  if(hasSector){
   verifySector(battle,view.warning);
   enemy.elapsed=enemy.hitAt-.275;
   assert(attackWarningPulse(enemy)>.99,move.label);
   for(const remaining of [.36,.19,.075]){
    enemy.elapsed=enemy.hitAt-remaining;
    assert.equal(attackWarningPulse(enemy),0,move.label);
   }
  }
  mobMoves++;
 }
}
for(const fps of [30,60,144]){
 const dt=1/fps;
 for(const phase of [1,2,3])for(const pattern of Object.keys(SAMURAI_MOVES)){
  const battle=newBattle('samurai'),enemy=battle.enemy;
  Object.assign(enemy,{phase,z:1.5});
  beginBossSequence(battle,pattern);
  for(let i=0;i<fps*20&&['windup','recover'].includes(enemy.state);i++){
   if(enemy.state==='windup'&&enemy.elapsed===0){
    verifySector(battle,bossWarning);
    assert.equal(bossWarning.material.color.getHexString(),attackWarningColor(enemy.move).slice(1));
    assert.equal(view.sword.material.color.getHexString(),'529fff');
    bossStrikes++;
   }
   battle.update(dt,pose);
  }
  assert.equal(enemy.state,'circle',pattern);
 }
 const dummy=newBattle('practice');
 dummy.enemy.z=1.3;dummy.update(dt,pose);
 verifySector(dummy,view.warning);
}
const samurai=newBattle('samurai');
samurai.enemy.pendingPhase=2;beginBossSequence(samurai,'double');
verifySector(samurai,bossWarning,samurai.enemy.transitionStrikeAt);
const effectsRoot=new THREE.Group(),phaseEffects=createSamuraiPhaseEffects(effectsRoot);
verifyWindow(samurai.enemy,samurai.enemy.transitionStrikeAt,()=>{
 phaseEffects.update(samurai.enemy,samurai.enemyTime);
 return effectsRoot.getObjectByName('samurai_lightning_radius').visible;
});

const stone=newBattle('stonekeeper'),stoneEnemy=startMove(stone,0);
const releaseAt=stoneEnemy.move.recoveryStrike.at;
stoneEnemy.state='recover';
verifySector(stone,view.warning,releaseAt);

for(const name of Object.keys(ATTACK_STATS)){
 const battle=newBattle('mirrorGuard'),enemy=startMove(battle,1);
 assert.equal(enemyAnimationSample('mirrorGuard',enemy,0).name,'Parry');
 enemy.elapsed=.499;
 assert(!battle.tryEnemyParry(enemy,pose,ATTACK_STATS[name],{contact:true}));
 enemy.elapsed=.5;
 battle.beginAttack(name);battle.resolveAttack(3,pose);
 assert.equal(enemy.health,enemy.maxHealth,name);
 assert(battle.takeEvents().some(event=>event.type==='enemyParry'),name);
 if(name==='CounterWave'){
  assert.equal(battle.waves.length,1,'The ranged wave remains independent of the palm strike');
  battle.waves=[];
 }
 for(let i=0;i<10;i++)battle.update(1/60,pose);
 assert.equal(enemy.move.motion,'riposte');
 assert(enemy.hitAt<ATTACK_PREVIEW_LEAD);
 view.update(battle,camera,0);
 assert(!view.warning.visible);
}
console.log(`ATTACK_WARNINGS_VERIFIED: ${mobMoves} mob moves, ${bossStrikes} boss strikes across 30/60/144 FPS, lightning, extraction, dummy and all direct melee parries`);
