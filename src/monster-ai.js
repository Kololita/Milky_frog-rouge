import {MOB_RULES,MOB_AI_DEFAULTS} from './monster-rules.js';
import {steerEnemy} from './enemy-steering.js';
import {PLAYER_STATS} from './battle-values.js';
import {launchEnemyProjectiles} from './enemy-projectiles.js';
import {moveActorMotion} from './actor-collision.js';
import {ATTACK_PREVIEW_LEAD,recoveryStrikeTime} from './attack-warning.js';
const smooth=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
function decisionRoll(enemy){
 enemy.decisionSeed=(Math.imul(enemy.decisionSeed??(enemy.seed^Math.imul((enemy.id??0)+1,0x9e3779b9)),1664525)+1013904223)>>>0;
 return enemy.decisionSeed/4294967296;
}
function moveAvailable(battle,index,distance){
 const enemy=battle.enemy,move=battle.enemyStats.moves[index];
 return Boolean(move&&(!move.requiresMeleeBeat||enemy.hasMeleeBeat)
  &&(!battle.canEnemyAttack||battle.canEnemyAttack(enemy,move,distance)));
}
function beginMove(battle,index,repeated=false){
 const e=battle.enemy,move=battle.enemyStats.moves[index];
 if(!moveAvailable(battle,index)){e.state='idle';e.elapsed=0;e.move=null;e.linkRecovery=false;e.repeatQueued=null;e.counterPending=null;e.plannedMove=null;return;}
 if(move.requiresMeleeBeat)e.hasMeleeBeat=false;
 if(move.kind==='aura')e.auraCasting=move;
 e.moveIndex=index;e.move=move;
 e.recoveryStrikeResolved=false;e.repeatQueued=null;e.repeatRemaining=!repeated&&e.move.repeatBelowRatio&&e.health<=battle.enemyStats.health*e.move.repeatBelowRatio?1:0;
 e.swingDuration=move.swing;
 const contactOffset=move.kind==='channel'?0:e.swingDuration*MOB_RULES.hitProgress;
 const needsWarning=!move.skipWarning&&(move.dealsDamage||move.kind==='aura');
 e.telegraph=needsWarning?Math.max(move.prepare,ATTACK_PREVIEW_LEAD-contactOffset):move.prepare;
 e.hitAt=e.telegraph+contactOffset;
 e.nextChannelHit=e.hitAt;
 e.windup=e.telegraph+e.swingDuration;
 e.retreatHeading=e.heading;
 e.state='windup';e.elapsed=0;e.hitResolved=false;e.lungeDone=0;e.retreatDone=0;e.superArmor=e.move.startupResilience>=3;e.moving=false;
 battle.emit('monsterMove',{label:e.move.label});
}
function selectMove(battle,distance){
 const e=battle.enemy,stats=battle.enemyStats,policy=stats.ai??MOB_AI_DEFAULTS;
 const value=x=>typeof x==='string'?x.split('.').reduce((o,k)=>o?.[k],stats):x;
 const inReach=distance<=stats.stopDistance+MOB_RULES.approachTolerance||
  (battle.canEnemyChase?.(e)===false&&stats.moves.some((move,index)=>move.kind==='melee'&&moveAvailable(battle,index,distance)));
 for(const rule of policy.rules??[]){
  if(!inReach&&!policy.startAnywhere&&!rule.atDistance)continue;
  if(rule.min!=null&&(rule.inclusive?distance<value(rule.min):distance<=value(rule.min)))continue;
  if(rule.max!=null&&distance>value(rule.max))continue;
  if(rule.ready&&battle.enemyTime<(e[rule.ready]??0))continue;
  if(rule.respectRecovery&&battle.enemyTime<(e.actionReadyAt??0))continue;
  if(rule.attackingOrCadence&&!battle.attack){const c=rule.attackingOrCadence;if(e.decisions++%c.period!==c.index)continue;}
  if(rule.chance!=null&&decisionRoll(e)>=value(rule.chance))continue;
  let index=rule.move;
  if(rule.weighted){const roll=decisionRoll(e);let total=0;index=rule.weighted.at(-1).move;for(const choice of rule.weighted){total+=value(choice.chance)??1;if(roll<total){index=choice.move;break;}}}
  if(!moveAvailable(battle,index,distance))continue;
  if(rule.ready&&rule.cooldown)e[rule.ready]=battle.enemyTime+value(rule.cooldown);
  return {index,priority:true};
 }
 if(!inReach&&!policy.startAnywhere)return null;
 const available=policy.cycle??stats.moves.map((_,i)=>i).filter(i=>!stats.moves[i].reaction);
 const cycle=available.filter(i=>moveAvailable(battle,Array.isArray(i)?i[0]:i,distance));
 if(!cycle.length)return null;
 const entry=cycle[cycle.length>1?e.decisions++%cycle.length:0];
 return {index:Array.isArray(entry)?entry[0]:entry,sequence:Array.isArray(entry)?entry.slice(1):[],priority:false};
}
function adjustSpacing(battle,pose,dt,target=battle.enemy.stats.ai?.preferredDistance){
 const e=battle.enemy;if(target==null)return false;
 const dx=pose.x-e.x,dz=pose.z-e.z,d=Math.hypot(dx,dz),error=d-target;if(d<1e-6||Math.abs(error)<Math.min(.08,MOB_RULES.approachTolerance))return true;
 if(error>0&&battle.canEnemyChase?.(e)===false)return false;
 const step=Math.sign(error)*Math.min(Math.abs(error),e.stats.speed*dt),result=moveActorMotion(e,{x:e.x+dx/d*step,z:e.z+dz/d*step},[{...pose,radius:PLAYER_STATS.radius,health:1},...battle.enemies.filter(a=>a!==e)],e.radius);
 e.moving=Math.hypot(result.x-e.x,result.z-e.z)>1e-6;e.x=result.x;e.z=result.z;return true;
}
export function updateMonster(battle,dt,pose){
 const e=battle.enemy,stats=battle.enemyStats;e.moving=false;
 const previous=e.playerSample,elapsed=previous?battle.enemyTime-previous.time:0;
 e.playerVelocity=elapsed>0?{x:Math.max(-MOB_RULES.maxPlayerSpeed,Math.min(MOB_RULES.maxPlayerSpeed,(pose.x-previous.x)/elapsed)),z:Math.max(-MOB_RULES.maxPlayerSpeed,Math.min(MOB_RULES.maxPlayerSpeed,(pose.z-previous.z)/elapsed))}:{x:0,z:0};
 e.playerSample={x:pose.x,z:pose.z,time:battle.enemyTime};
 if(e.auraCasting&&(e.state!=='windup'||e.move!==e.auraCasting)){e.nextAuraAt=battle.enemyTime+e.auraCasting.aura.cooldown;e.auraCasting=null;}
 const auraIndex=stats.ai?.auraMove;
 if(auraIndex!=null&&!e.activeAura&&!e.auraCasting&&battle.enemyTime>=(e.nextAuraAt??0)&&['idle','chase','circle'].includes(e.state)&&!e.plannedMove?.combo&&!e.comboQueue?.length){beginMove(battle,auraIndex);return;}
 if(e.state==='hurt'){
  e.superArmor=false;e.turnVelocity=0;e.repeatQueued=null;e.comboQueue=null;e.plannedMove=null;
  if(e.elapsed>=e.stun){e.state='recover';e.elapsed=0;e.recovery=Math.max(MOB_RULES.hurtRecovery,(e.actionReadyAt??0)-battle.enemyTime);e.linkRecovery=false;e.counterPending=null;e.counterTargetHeading=null;e.move=null;}
  return;
 }
 if(e.state==='windup'){
  const trackingEnd=Math.max(0,e.telegraph-e.move.lockLead),trackDt=Math.max(0,Math.min(dt,trackingEnd-(e.elapsed-dt)));
  const shot=e.move.projectile,lead=shot?Math.min(MOB_RULES.maxPrediction,shot.lead+Math.hypot(pose.x-e.x,pose.z-e.z)/shot.speed):0;
  const aim={x:pose.x+e.playerVelocity.x*lead,z:pose.z+e.playerVelocity.z*lead};
  if(e.move.kind==='parry'||e.move.aimThroughout)steerEnemy(e,pose,dt,e.move.trackingTurnRate??e.windupTurnRate);else if(trackDt)steerEnemy(e,aim,trackDt,e.windupTurnRate);else e.turnVelocity=0;
  if(e.move.retreat){
   const travel=e.move.retreat*smooth(e.elapsed/Math.max(e.telegraph,e.swingDuration)),step=Math.max(0,travel-e.retreatDone);
   const target={x:e.x-Math.sin(e.retreatHeading)*step,z:e.z-Math.cos(e.retreatHeading)*step};
   const result=moveActorMotion(e,target,[{...pose,radius:PLAYER_STATS.radius,health:1},...battle.enemies.filter(other=>other!==e)],e.radius);
   e.x=result.x;e.z=result.z;e.retreatDone=travel;e.moving=step>0;
  }
  e.superArmor=e.move.startupResilience>=3;
  const travel=e.move.lunge*smooth((e.elapsed-e.telegraph)/Math.max(.001,e.swingDuration)),fx=Math.sin(e.heading),fz=Math.cos(e.heading);
  const dx=pose.x-e.x,dz=pose.z-e.z,along=dx*fx+dz*fz,side=dx*fz-dz*fx,clearance=e.radius+PLAYER_STATS.radius;
  let step=Math.max(0,travel-e.lungeDone);
  if(along>0&&Math.abs(side)<clearance)step=Math.min(step,Math.max(0,along-Math.sqrt(clearance*clearance-side*side)));
  e.x+=fx*step;e.z+=fz*step;e.lungeDone=travel;
  if(e.move.kind==='channel'&&e.elapsed>=e.nextChannelHit-1e-9&&e.elapsed<e.windup-1e-9){
   e.nextChannelHit+=e.move.hitInterval;
   if(!battle.canEnemyAttack||battle.canEnemyAttack(e,e.move))battle.strikePlayer(pose,e.move);
  }
  const hitAt=e.hitAt??e.telegraph+e.swingDuration*MOB_RULES.hitProgress;
  if(e.move.kind!=='channel'&&!e.hitResolved&&e.elapsed>=hitAt-1e-9){
   const canRelease=e.move.kind!=='projectile'||!battle.canEnemyAttack||battle.canEnemyAttack(e,e.move);
   e.hitResolved=true;if(e.move.dealsDamage&&canRelease)battle.emit('monsterSwing',{label:e.move.label,x:e.x,z:e.z});
   if(e.move.kind==='melee')e.hasMeleeBeat=true;
   if(e.move.lockRecovery??stats.ai?.lockRecovery)e.actionReadyAt=battle.enemyTime+Math.max(0,e.windup-e.elapsed)+e.move.recovery;
   if(e.move.kind==='aura'){
    e.activeAura={...e.move.aura,until:battle.enemyTime+e.move.aura.duration,nextHit:battle.enemyTime};e.auraCasting=null;battle.emit('enemyAuraStarted',{enemy:e});
   }else if(e.move.kind==='buff'){
    battle.applyEffect(e.move.effect);
    if(e.move.cooldownKey)e[e.move.cooldownKey]=battle.enemyTime+e.move.effect.duration;
   }else if(e.move.kind==='projectile'){
    if(canRelease)launchEnemyProjectiles(battle,e.move);
   }
   else if(!['parry','movement'].includes(e.move.kind))battle.strikePlayer(pose,e.move,Math.max(0,(e.elapsed-hitAt)/(battle.worldTimeScale||1)));
   if(e.state!=='windup')return;
  }
  if(e.elapsed>=e.windup-1e-9){
   e.state='recover';e.elapsed=0;e.superArmor=false;
   e.linkRecovery=Number.isFinite(e.move.link)&&e.moveIndex+1<stats.moves.length;
   e.recovery=e.linkRecovery?e.move.link*(e.health<=stats.health*(stats.lowHealthThreshold??0)?stats.lowHealthLinkScale??1:1):e.move.recovery;
   if(e.comboQueue?.length)e.recovery=e.move.comboRecovery??Math.min(.25,e.move.recovery);
   if(e.repeatRemaining){e.repeatRemaining=0;e.repeatQueued=e.moveIndex;e.recovery=e.move.repeatGap;}
   if(e.move.recoveryStrike)e.recovery=Math.max(e.recovery,recoveryStrikeTime(e.move.recoveryStrike));
   if(e.move.lockRecovery??stats.ai?.lockRecovery)e.actionReadyAt=Math.max(e.actionReadyAt??0,battle.enemyTime+e.recovery);
  }
  return;
 }
 if(e.state==='recover'){
  e.turnVelocity=0;e.superArmor=false;
  const release=e.move?.recoveryStrike;
  if(release&&!e.recoveryStrikeResolved&&e.elapsed>=recoveryStrikeTime(release)-1e-9){
   e.recoveryStrikeResolved=true;
   const forward=release.forward??0,side=release.side??0;
   const origin={...e,x:e.x+Math.sin(e.heading)*forward+Math.cos(e.heading)*side,z:e.z+Math.cos(e.heading)*forward-Math.sin(e.heading)*side};
   battle.emit('monsterSwing',{label:release.attack.label,x:origin.x,z:origin.z});
   battle.strikePlayer(pose,release.attack,0,origin);
   if(e.state!=='recover')return;
  }
  if(e.move?.recoveryMovement&&e.elapsed>e.recovery*e.move.recoveryMovement.start&&e.elapsed<e.recovery){
   const dx=pose.x-e.x,dz=pose.z-e.z,d=Math.hypot(dx,dz);
   if(d>1e-5){
    steerEnemy(e,pose,dt);const radial=d>stats.stopDistance&&battle.canEnemyChase?.(e)!==false?e.move.recoveryMovement.forward:0,side=(e.id%2?1:-1)*e.move.recoveryMovement.side;
    const result=moveActorMotion(e,{x:e.x+(dx/d*radial-dz/d*side)*dt,z:e.z+(dz/d*radial+dx/d*side)*dt},[{...pose,radius:PLAYER_STATS.radius,health:1},...battle.enemies.filter(other=>other!==e)],e.radius);
    e.x=result.x;e.z=result.z;e.moving=true;
   }
  }
  if(e.elapsed<e.recovery)return;
  if(e.repeatQueued!=null){const index=e.repeatQueued;beginMove(battle,index,true);return;}
  if(e.counterPending!=null){const index=e.counterPending;e.counterPending=null;if(Number.isFinite(e.counterTargetHeading)){e.heading=e.counterTargetHeading;e.turnVelocity=0;e.counterTargetHeading=null;}beginMove(battle,index);return;}
  if(e.linkRecovery){beginMove(battle,e.move.followUp??e.moveIndex+1);return;}
  if(e.comboQueue?.length){e.plannedMove={index:e.comboQueue.shift(),priority:true,combo:true};e.state='idle';e.elapsed=0;e.move=null;}
  else if(e.move)e.freeMoveUntil=battle.enemyTime+MOB_RULES.freeMovementMin;
  e.state='idle';e.elapsed=0;e.move=null;
 }
 const dx=pose.x-e.x,dz=pose.z-e.z,distance=Math.hypot(dx,dz);steerEnemy(e,pose,dt);
 if(distance>stats.noticeRange)return;
 const canChase=battle.canEnemyChase?.(e)!==false;
 if(e.plannedMove&&!moveAvailable(battle,e.plannedMove.index,distance))e.plannedMove=null;
 if(stats.ai?.preferredDistance!=null&&!e.plannedMove)e.plannedMove=selectMove(battle,distance);
 const preferredDistance=e.plannedMove?stats.moves[e.plannedMove.index].preferredDistance??stats.ai?.preferredDistance:stats.ai?.preferredDistance;
 const spacingTarget=stats.ai?.closeWhenBreathLocked&&!e.hasMeleeBeat&&preferredDistance!=null
  ?Math.min(distance,preferredDistance):preferredDistance;
 if(battle.enemyTime<(e.freeMoveUntil??0)-1e-9){
  if(adjustSpacing(battle,pose,dt,spacingTarget))return;
  const radial=canChase&&distance>stats.stopDistance+MOB_RULES.approachTolerance?Math.min(stats.speed,(distance-stats.stopDistance)/Math.max(dt,1e-6)):0;
  const side=(e.id%2?1:-1)*stats.speed*.35;
  if(distance>1e-5){const result=moveActorMotion(e,{x:e.x+(dx/distance*radial-dz/distance*side)*dt,z:e.z+(dz/distance*radial+dx/distance*side)*dt},[{...pose,radius:PLAYER_STATS.radius,health:1},...battle.enemies.filter(other=>other!==e)],e.radius);e.moving=Math.hypot(result.x-e.x,result.z-e.z)>1e-6;e.x=result.x;e.z=result.z;}
  e.state=radial?'chase':'circle';return;
 }
 const choice=e.plannedMove??selectMove(battle,distance);
 const spaced=choice?.combo?false:adjustSpacing(battle,pose,dt,spacingTarget);
 if(!choice){
  if(spaced){e.state=e.moving?(canChase?'chase':'circle'):'idle';return;}
  if(!canChase||distance<=stats.stopDistance+MOB_RULES.approachTolerance){e.state='idle';return;}
  e.state='chase';e.elapsed=0;const step=Math.min(distance-stats.stopDistance,stats.speed*dt);
  if(distance>1e-5){e.x+=dx/distance*step;e.z+=dz/distance*step;e.moving=step>0;}return;
 }
 const policy=stats.ai??MOB_AI_DEFAULTS;
 if(!choice.priority&&policy.orbitDuration>0&&e.elapsed<policy.orbitDuration){
  e.state='circle';const step=stats.orbitSpeed*dt/Math.max(.1,distance);e.x-=dz*step;e.z+=dx*step;e.moving=true;return;
 }
 e.plannedMove=null;if(choice.sequence)e.comboQueue=choice.sequence;
 beginMove(battle,choice.index);
}

export function reactToPressure(battle,enemy,source){
 const rules=enemy.stats?.pressureBreak;
 if(battle.enemyTime<(enemy.freeMoveUntil??0)-1e-9)return;
 if(!rules||source!=='attack'||enemy.health<=0||!['hurt','recover','idle','chase','circle'].includes(enemy.state)||battle.enemyTime<(enemy.nextPressureBreak??0))return;
 enemy.pressureHits=battle.enemyTime-(enemy.lastPressureHit??-Infinity)<=rules.window?(enemy.pressureHits??0)+1:1;
 enemy.lastPressureHit=battle.enemyTime;
 if(enemy.pressureHits<rules.hits)return;
 const index=enemy.stats.moves.findIndex(m=>m.reaction==='pressure-breakout');if(index<0)return;
 enemy.pressureHits=0;enemy.nextPressureBreak=battle.enemyTime+rules.cooldown;
 battle.withEnemy(enemy,()=>beginMove(battle,index));battle.emit('eliteBreakout',{enemy});
}

