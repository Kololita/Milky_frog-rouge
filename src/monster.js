import {ENEMY_STATS,IMPACT_LEVELS} from './battle-values.js';
import {BACK_THROW} from './back-throw.js';
import {MONSTER_RULES,MOB_RULES,MOB_AI_DEFAULTS} from './monster-rules.js';
import {updateMonster,reactToPressure} from './monster-ai.js';
import {StatusEffects} from './status-effects.js';

/** All enemy actors share lifecycle, crowd control, buffs and controller dispatch. */
export class Monster{
 static rules=MONSTER_RULES;
 static get defaults(){const keys=['health','attackPower','bodyHeight','radius','speed','turnRate','windupTurnRate','turnResponse','turnAcceleration','noticeRange','stopDistance','approachTolerance','respawn','spawn'];return {...Object.fromEntries(keys.map(key=>[key,ENEMY_STATS[key]])),height:0,impactResistance:0,backThrowable:true,superArmor:false};}
 constructor(encounter,index=0){
  const stats=encounter.stats;
  Object.assign(this,stats.spawn,{id:index,encounterId:encounter.id,encounter,stats,height:stats.height??0,bodyHeight:stats.bodyHeight,heading:stats.spawn.heading??Math.PI,turnVelocity:0,turnRate:stats.turnRate,windupTurnRate:stats.windupTurnRate,turnResponse:stats.turnResponse,turnAcceleration:stats.turnAcceleration,health:stats.health,maxHealth:stats.health,attackPower:stats.attackPower,radius:stats.radius,uiHeight:stats.uiHeight??1.76,impactResistance:stats.impactResistance??0,bodyPlan:stats.bodyPlan??'humanoid',throwOverride:stats.throwOverride===true,backThrowable:stats.backThrowable!==false&&(stats.throwOverride===true||stats.bodyPlan!=='nonhumanoid'),superArmor:stats.superArmor,state:'idle',elapsed:0,stun:0,dazeUntil:0,flash:0,knockX:0,knockZ:0,phase:1,seed:7391,decisions:0});
  this.effects=new StatusEffects();
 }
 get isMob(){return false;}
 get superArmor(){return Boolean(this.stats?.permanentSuperArmor||this.actionSuperArmor);}
 set superArmor(value){this.actionSuperArmor=Boolean(value);}
 get alive(){return this.health>0;}
 get invulnerable(){return this.move?.invulnerable===true&&['windup','evade'].includes(this.state);}
 get throwProtected(){return this.invulnerable||this.state==='transition'&&this.move?.backThrowImmune===true;}
 get damageTakenMultiplier(){if(this.state==='recover'&&!this.linkRecovery)return this.move?.recoveryDamageTaken??1;return ['windup','transition'].includes(this.state)?Math.max(0,1-(this.move?.damageReduction??0)):1;}
 get damageable(){return this.alive&&!this.invulnerable&&!['thrown','down'].includes(this.state);}
 get damageMultiplier(){return Math.max(0,1+this.effects.value('damageIncrease'));}
 applyEffect(effect,now){return this.effects.apply(effect,now);}
 onDamaged(){}
 act(battle,dt,pose){this.encounter.update?.(battle,dt,pose);}
 update(battle,dt,pose){
  this.effects.update(battle.enemyTime);
  this.encounter.beforeUpdate?.(battle);this.flash=Math.max(0,this.flash-dt);this.elapsed+=dt;
  if(this.state==='down'){if(battle.enemyTime>=this.downUntil-1e-9){this.state='rising';this.elapsed=0;}return;}
  if(this.state==='rising'){
   if(battle.enemyTime>=this.riseUntil-1e-9){this.state='idle';this.elapsed=0;this.throwVisual=null;this.turnVelocity=0;this.heading=Math.atan2(pose.x-this.x,pose.z-this.z);this.backThrowImmuneUntil=battle.time+BACK_THROW.regrabProtection;}
   return;
  }
  if(this.state==='knockback'){
   const u=Math.max(0,Math.min(1,(battle.enemyTime-this.knockStart)/(this.knockUntil-this.knockStart))),travel=1-(1-u)**3;
   this.x=this.knockOrigin.x+(this.knockTarget.x-this.knockOrigin.x)*travel;this.z=this.knockOrigin.z+(this.knockTarget.z-this.knockOrigin.z)*travel;
   if(battle.enemyTime>=this.knockUntil-1e-9){this.state='dazed';this.elapsed=0;this.stun=IMPACT_LEVELS[3].daze;}return;
  }
  if(this.state==='dazed'){this.knockX=0;this.knockZ=0;if(battle.enemyTime>=this.dazeUntil-1e-9){this.dazeUntil=0;this.state='idle';this.elapsed=0;}return;}
  const decay=Math.exp(-MONSTER_RULES.knockDecay*dt),travel=(1-decay)/MONSTER_RULES.knockDecay;
  this.x+=this.knockX*travel;this.z+=this.knockZ*travel;this.knockX*=decay;this.knockZ*=decay;
  if(this.state==='dead'){if(this.elapsed>=this.stats.respawn){battle.spawnEnemy();battle.emit('enemyRespawned');}return;}
  this.act(battle,dt,pose);
 }
}
/** Ordinary enemies and elites share a reusable action controller and reactions. */
export class Mob extends Monster{
 static rules=MOB_RULES;
 static get defaults(){return {...super.defaults,respawn:Infinity,ai:MOB_AI_DEFAULTS};}
 get isMob(){return true;}
 onDamaged(battle,source){reactToPressure(battle,this,source);}
 reactToPlayerAttack(battle,pose){
  if(this.state!=='windup'||this.move?.kind!=='parry'||!battle.attack)return false;
  return battle.tryEnemyParry(this,pose,battle.currentAttackStats);
 }
 act(battle,dt,pose){
  if(this.reactToPlayerAttack(battle,pose))return;
  (this.encounter.update??updateMonster)(battle,dt,pose);
  this.reactToPlayerAttack(battle,pose);
 }
}
