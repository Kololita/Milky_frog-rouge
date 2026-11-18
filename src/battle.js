import {moveActorMotion} from './actor-collision.js';
import {createCoolingState,createFoundryColliders,damageCoolingValve,updateCooling,watered} from './cooling.js';
import {updateEnemyAuras} from './enemy-auras.js';
import {StatusEffects} from './status-effects.js';
import {passiveLevels,concentrationTimeScale} from './equipment-passives.js';
import {Monster} from './monster.js';
import {isDamagingMove} from './enemy-move.js';
import {PLAYER_STATS,POSE_STATS,LAUGH_STATS,GUARD_STATS,ENEMY_STATS,ATTACK_STATS,IMPACT_LEVELS,ENERGY_STATS,RAGE_STATS,WAVE_STATS,energyDamageMultiplier,effectiveImpactLevel,playerImpactReaction} from './battle-values.js';
import {guardTier,dodgeInvulnerable} from './defense.js';
import {equipmentBonuses,normalizeEquipmentLoadout} from './equipment.js';
import {STARTING_LOADOUT} from './equipment-catalog.js';
import {resolveEquipment,equipmentSkillStats} from './equipment-rolls.js';
import {POTION_STATS} from './battle-values.js';
import {attackHeight,overlapsHeight} from './attack-volume.js';
import {encounterFor,actorTypeFor} from './encounters.js';
import {BACK_THROW,canBackThrow,sampleBackThrow,throwRecovery} from './back-throw.js';
import {motionDamage} from './combat-damage.js';
import {updateEnemyProjectiles} from './enemy-projectiles.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const roundDamage=v=>Math.round(v*100)/100;
export function inAttackArea(origin,heading,target,range,halfAngle,targetRadius=0) {
  const dx=target.x-origin.x,dz=target.z-origin.z,distance=Math.hypot(dx,dz);
  if(distance>range+targetRadius)return false;
  if(distance<1e-8||distance<=targetRadius)return true;
  const forward=dx*Math.sin(heading)+dz*Math.cos(heading),side=dx*Math.cos(heading)-dz*Math.sin(heading);
  if(forward/distance>=Math.cos(halfAngle)-1e-9)return true;
  if(targetRadius<=0)return false;
  const edgeForward=Math.cos(halfAngle),edgeSide=Math.sin(halfAngle),projection=Math.max(0,Math.min(range,forward*edgeForward+Math.abs(side)*edgeSide));
  return Math.hypot(forward-projection*edgeForward,Math.abs(side)-projection*edgeSide)<=targetRadius+1e-9;
}

/** Renderer-independent encounter. Each authored impact can hit at most once. */
export class Battle {
  constructor(){this.enabled=true;this.reset();}
  reset(mode=this.mode??'practice',{floor=this.encounterFloor??1}={}) {
    this.tookEnemyHealthDamage=false;this.runAttackLockUntil=0;this.counterOrbOrigin=null;this.counterCharge=null;this.pendingChargeMultiplier=1;this.drinking=null;this.encounterFloor=Math.max(1,Math.floor(floor));
    this.encounter=encounterFor(mode);this.mode=this.encounter.id;this.coolingValves=createCoolingState(this.mode);this.sceneryColliders=createFoundryColliders(this.mode);this.enemyStats=this.encounter.stats;
    this.groupAggressor=null;this.groupAggroChangedAt=-Infinity;this.time=0;this.enemyTime=0;this.windQueue=[];this.events=[];this.attack=null;this.absorption=null;this.breakLaugh=null;this.backThrow=null;this.defeated=0;
    this.waves=[];this.waveHitUntil=new WeakMap();this.nextWaveId=0;this.enemyProjectiles=[];this.nextEnemyProjectileId=0;this.attackIntent=0;
    this.player={effects:new StatusEffects(),lastHealthLossAt:0,shield:0,health:PLAYER_STATS.health,attackPower:PLAYER_STATS.attackPower,energy:0,rageUntil:0,fistwindUntil:0,nextDrainTick:Infinity,counterReady:false,counterUntil:0,lateGuardDamageRatio:GUARD_STATS.lateDamageRatio,invulnerableUntil:0,lastGuardHit:-Infinity,deadTime:0};
    this.player.pose=PLAYER_STATS.pose;this.player.potions=POTION_STATS.capacity;this.player.longarmUntil=0;this.player.drainUntil=0;this.player.energyGainMultiplier=1;
    Object.defineProperty(this.player,'guard',{get(){return this.pose;},set(value){this.pose=value;}});
    this.applyEquipment(this.loadout??STARTING_LOADOUT,false);
    this.player.poseRegenRate=POSE_STATS.regenRate+this.gear.regen;this.player.lastAttackAt=-Infinity;this.player.nextPoseRegenAt=Infinity;
    const group=this.encounter;
    this.enemies=(group.members??[group.id]).map((id,index)=>{
      const encounter=encounterFor(id),e=this.createEnemy(encounter,index);
      if(group.members){e.x=(index-(group.members.length-1)/2)*2.7;e.z=3.8;}
      return e;
    });
    this.enemy=this.enemies[0];this.enemyStats=this.enemy.stats;
    this.enemyName=group.name??this.enemyStats.name??'训练人偶';
  }
  createEnemy(encounter,index=0) {
    const Actor=actorTypeFor(encounter),enemy=new Actor(encounter,index);
    const depth=encounter.kind==='training'?0:Math.min(14,this.encounterFloor-1);
    enemy.maxHealth=enemy.health=enemy.health*(1+.03*depth);enemy.attackPower*=1+.01*depth;
    return enemy;
  }
  spawnEnemy(){
    const previous=this.enemy,index=this.enemies.indexOf(previous),enemy=this.createEnemy(encounterFor(previous.encounterId),previous.id);
    if(index>=0)this.enemies[index]=enemy;this.enemy=enemy;this.enemyStats=enemy.stats;
  }
  get allDefeated(){return this.enemies.every(e=>e.health<=0);}
  focusEnemy(enemy){if(this.enemies.includes(enemy)){this.enemy=enemy;this.enemyStats=enemy.stats;}}
  nearestEnemy(pose){return this.enemies.filter(e=>e.health>0).sort((a,b)=>Math.hypot(a.x-pose.x,a.z-pose.z)-Math.hypot(b.x-pose.x,b.z-pose.z))[0];}
  withEnemy(enemy,callback){
    const previous=this.enemy,stats=this.enemyStats,encounter=this.encounter;
    this.enemy=enemy;this.enemyStats=enemy.stats;this.encounter=encounterFor(enemy.encounterId);
    try{return callback();}finally{this.enemy=previous;this.enemyStats=stats;this.encounter=encounter;}
  }
  viewOf(enemy){
    const view=Object.create(this);view.enemy=enemy;view.enemyStats=enemy.stats;view.encounter=encounterFor(enemy.encounterId);view.mode=enemy.encounterId;return view;
  }
  applyEffect(effect,Target=Monster){
    let count=0;
    for(const actor of this.enemies)if(actor instanceof Target&&actor.alive&&actor.applyEffect(effect,this.enemyTime))count++;
    this.emit('monsterEffectApplied',{enemy:this.enemy,effect,count});return count;
  }
  get potionCapacity(){return POTION_STATS.capacity+(this.passives?.flasks??0);}
  get maxPose(){return Math.max(1,PLAYER_STATS.pose+(this.gear?.pose??0));}
  get maxHealth(){return PLAYER_STATS.health+(this.gear?.health??0);}
  usePotion(){
    const p=this.player;
    if(p.health<=0||p.health>=this.maxHealth||p.potions<=0||this.breakLaugh||this.backThrow||this.drinking)return false;
    p.potions--;this.cancelAttack();this.cancelAbsorption();this.drinking={start:this.time};this.emit('potionStarted');return true;
  }
  cancelPotion(reason='self'){
    if(!this.drinking)return false;this.drinking=null;
    const refunded=reason==='self';if(refunded)this.player.potions=Math.min(this.potionCapacity,this.player.potions+1);
    this.emit('potionInterrupted',{reason,refunded});return true;
  }
  refillPotions(amount=POTION_STATS.restGain){this.player.potions=Math.min(this.potionCapacity,this.player.potions+Math.max(0,Math.floor(amount)));}
  get energyGainMultiplier(){const value=this.player.energyGainMultiplier;return (Number.isFinite(value)?Math.max(0,value):1)*(1+(this.gear?.energyGain??0)+.10*(this.passives?.energy??0));}
  clearBattleEffects(){
    this.coolingValves=createCoolingState(this.mode);this.sceneryColliders=createFoundryColliders(this.mode);this.player.effects.clear();this.drinking=null;
    this.cancelAbsorption();this.cancelAttack();this.clearCounter();this.player.energy=0;this.player.fistwindUntil=0;this.windQueue=[];
    this.player.longarmUntil=0;this.player.drainUntil=0;this.player.rageUntil=0;this.player.invulnerableUntil=0;
    this.player.energyGainMultiplier=1;this.player.shield=0;
    this.breakLaugh=null;this.waves=[];this.enemyProjectiles=[];for(const e of this.enemies){e.activeAura=null;e.auraCasting=null;e.nextAuraAt=0;e.dazeUntil=0;e.parryFlashUntil=0;e.flash=0;e.effects.clear();}
  }
  applyEquipment(loadout,preserve=true){
    const oldMax=this.maxHealth,oldPose=this.maxPose,oldSkill=this.loadout?.skill,oldUltimate=this.loadout?.ultimate;this.loadout=normalizeEquipmentLoadout(loadout);this.gear=equipmentBonuses(this.loadout);this.passives=passiveLevels((this.loadout.installed??Object.values(this.loadout).filter(id=>typeof id==='string')).map(id=>resolveEquipment(id,this.loadout.rolls?.[id],this.loadout.upgrades?.[id])).filter(Boolean));this.player.potions=Math.min(this.player.potions??POTION_STATS.capacity,this.potionCapacity);if(!preserve)this.player.potions=this.potionCapacity;this.skillUpgradePower=Object.fromEntries(['longarm','drain','shield','focus'].map(id=>[id,resolveEquipment(id,this.loadout.rolls?.[id],this.loadout.upgrades?.[id]).skillUpgradeMultiplier??1]));this.skillShapePower=Object.fromEntries(['longarm','drain'].map(id=>[id,resolveEquipment(id,this.loadout.rolls?.[id],this.loadout.upgrades?.[id]).shapeMultiplier]));
    if(oldUltimate!==this.loadout.ultimate){this.player.fistwindUntil=0;this.windQueue=[];}
    if(oldSkill!==this.loadout.skill){this.player.longarmUntil=0;this.player.drainUntil=0;}
    this.player.attackPower=PLAYER_STATS.attackPower+this.gear.attack;
    this.player.poseRegenRate=Math.max(.1,POSE_STATS.regenRate+this.gear.regen);
    this.player.pose=preserve?roundDamage(Math.min(this.maxPose,this.player.pose/oldPose*this.maxPose)):this.maxPose;
    this.player.health=preserve?roundDamage(Math.min(this.maxHealth,this.player.health/oldMax*this.maxHealth)):this.maxHealth;
  }
  emit(type,data={}) {this.events.push({type,...data});}
  takeEvents(){return this.events.splice(0);}
  noteAttackInput(){this.attackIntent++;}
  get chargeTimeScale(){return concentrationTimeScale(this.passives?.concentration);}
  get counterChargeElapsed(){return this.counterCharge?Math.max(0,(this.time-this.counterCharge.start)/(this.counterCharge.scale??1)):0;}
  beginCounterCharge(){if(!this.player.counterReady||this.player.health<=0||this.counterCharge)return false;this.counterCharge={start:this.time,scale:this.chargeTimeScale};return true;}
  releaseCounterCharge(){if(!this.counterCharge)return false;const seconds=Math.floor(Math.min(3,this.counterChargeElapsed)+1e-8);this.counterCharge=null;this.pendingChargeMultiplier=1+.2*seconds;this.player.counterReady=true;this.player.counterUntil=this.time+.2;return true;}
  cancelCounterCharge(){this.counterOrbOrigin=null;this.counterCharge=null;this.pendingChargeMultiplier=1;}
  beginAttack(name){this.cancelAbsorption();this.attack=ATTACK_STATS[name]?{name,consumed:new Set(),chargeMultiplier:name==='CounterWave'?this.pendingChargeMultiplier:1}:null;this.pendingChargeMultiplier=1;if(this.attack)this.noteAttackInput();}
  cancelAttack(){this.attack=null;}
  get laughRecoveryDuration(){
    const rate=Number.isFinite(this.player.poseRegenRate)?Math.max(LAUGH_STATS.minimumRegenRate,this.player.poseRegenRate):POSE_STATS.regenRate;
    return LAUGH_STATS.recoveryLead+this.maxPose/rate;
  }
  beginActiveLaugh(){
    if(this.breakLaugh||this.backThrow||this.player.health<=0)return false;
    this.breakLaugh={active:true,start:this.time,duration:this.laughRecoveryDuration,initialPose:this.player.pose};
    this.cancelAbsorption();this.cancelAttack();
    return true;
  }
  endActiveLaugh(){
    if(!this.breakLaugh?.active)return false;
    this.breakLaugh=null;
    this.player.nextPoseRegenAt=this.time+POSE_STATS.regenDelay;
    return true;
  }
  beginBreakLaugh(){
    if(this.breakLaugh||this.player.health<=0)return;
    this.breakLaugh={start:this.time,duration:this.laughRecoveryDuration};
    this.player.pose=0;this.cancelAbsorption();this.cancelAttack();
    this.emit('breakLaughStarted',{duration:this.breakLaugh.duration});
  }
  isRaging(now=this.time){return this.player.health>0&&this.player.rageUntil>now+1e-9;}
  skillStatsFor(id){return equipmentSkillStats({id,shapeMultiplier:this.skillShapePower?.[id]??1,skillUpgradeMultiplier:this.skillUpgradePower?.[id]??1});}
  get skillStats(){return this.skillStatsFor(this.loadout.skill);}
  get attackRangeMultiplier(){return this.player.health>0&&this.time<this.player.longarmUntil?1+this.skillStatsFor('longarm').rangeBonus+(this.gear.range??0)+.03*(this.passives?.reach??0):1+(this.gear.range??0)+.03*(this.passives?.reach??0);}
  applyPlayerStatus(effect){if(this.player.health>0&&effect&&this.player.effects.apply(effect,this.time))this.emit('statusApplied',{status:effect.type});}
  extinguishByDodge(name){if(name==='DodgeRoll'&&this.player.effects.has('burn')){this.player.effects.remove('burn');this.emit('statusRemoved',{status:'burn'});}}
  absorbPlayerDamage(damage,enemyAttack=false){const p=this.player,before=p.health,absorbed=Math.min(p.shield??0,damage);p.shield=Math.max(0,(p.shield??0)-absorbed);p.health=roundDamage(Math.max(0,p.health-(damage-absorbed)));if(p.health<before){p.lastHealthLossAt=this.time;if(enemyAttack)this.tookEnemyHealthDamage=true;}}
  beginSkill(){
    const p=this.player,id=this.loadout.skill,stats=this.skillStats;
    if(!stats||p.health<=0||this.breakLaugh||this.backThrow||this.absorption)return false;
    if(id==='focus'){
      this.expireCounter();if(p.energy<stats.energyCost||p.counterReady||this.counterCharge)return false;
      p.energy-=stats.energyCost;p.counterReady=true;p.counterUntil=this.time+GUARD_STATS.counterDuration+(this.passives?.goldDuration??0);
    }else if(id==='shield'){
      if(p.energy<stats.energyCost||p.shield>=stats.shield)return false;
      p.energy-=stats.energyCost;p.shield=stats.shield;
    }else if(id==='longarm'){
      if(this.time<p.longarmUntil||p.energy<stats.energyCost)return false;
      p.energy-=stats.energyCost;p.longarmUntil=this.time+stats.duration;
    }else if(id==='drain'){
      const cost=this.maxHealth*stats.healthRatio;
      if(this.time<p.drainUntil||p.health<=cost)return false;
      p.health=roundDamage(p.health-cost);p.lastHealthLossAt=this.time;p.drainUntil=this.time+stats.duration;p.nextDrainTick=this.time+stats.tick;
    }
    this.emit('skillStarted',{id,duration:stats.duration});return true;
  }
  beginRage() {
    if(this.loadout.ultimate==='fistwind'){const p=this.player;if(p.energy<100||p.health<=0||this.breakLaugh||this.backThrow||this.absorption||this.time<p.fistwindUntil||this.isRaging())return false;p.energy-=100;p.fistwindUntil=this.time+30;this.emit('fistwindStarted',{duration:30});return true;}
    const p=this.player;
    if(this.loadout.ultimate!=='rage'||p.health<=0||this.breakLaugh||this.absorption||this.isRaging()||p.energy<RAGE_STATS.energyCost)return false;
    p.energy-=RAGE_STATS.energyCost;p.rageUntil=this.time+RAGE_STATS.duration;
    this.emit('rageStarted',{duration:RAGE_STATS.duration});return true;
  }
  expireRage() {
    if(this.player.rageUntil&&this.time>=this.player.rageUntil-1e-9){this.player.rageUntil=0;this.emit('rageEnded');return true;}
    return false;
  }
  clearCounter(){this.counterCharge=null;this.player.counterReady=false;this.player.counterUntil=0;}
  expireCounter(now=this.time) {
    if(!this.counterCharge&&this.player.counterReady&&now>=this.player.counterUntil-1e-9)this.clearCounter();
  }
  beginAbsorption() {
    this.expireCounter();
    if(this.player.health<=0||this.breakLaugh||!this.player.counterReady||this.absorption)return false;
    this.absorption={start:this.time,baseEnergy:this.player.energy,gain:ENERGY_STATS.gain*this.energyGainMultiplier,fullEnergy:this.player.energy>=ENERGY_STATS.max};
    this.emit('energyAbsorbing');return true;
  }
  cancelAbsorption() {
    if(!this.absorption)return;
    this.creditAbsorption();this.absorption=null;this.clearCounter();this.emit('energyInterrupted');
  }
  creditAbsorption(){
    const a=this.absorption;if(!a||this.player.health<=0)return;
    const progress=clamp((this.time-a.start-ENERGY_STATS.raiseEnd)/(ENERGY_STATS.rainEnd-ENERGY_STATS.raiseEnd),0,1);
    const total=a.gain*progress;
    this.player.energy=Math.min(ENERGY_STATS.max,a.baseEnergy+total);
  }
  healRageHit(damage) {
    if(damage<=0||!this.isRaging())return;
    const before=this.player.health;
    this.player.health=roundDamage(Math.min(this.maxHealth,before+this.maxHealth*RAGE_STATS.onHitHealRatio));
    this.emit('rageHealed',{healed:roundDamage(this.player.health-before)});
  }
  get invigorated(){return this.player.health>0&&this.time-(this.player.lastHealthLossAt??0)>=10;}
  playerDamage(multiplier){
    return motionDamage(this.player,multiplier,energyDamageMultiplier(this.player.energy)*(this.invigorated?1+.05*(this.passives?.vigor??0):1)*(this.player.health<this.maxHealth*.2?1+.1*(this.passives?.comeback??0):1));
  }
  damageEnemy(enemy,damage,{label,impactLevel,origin,source='attack',strong=impactLevel>=2,credited=true}){
    damage=roundDamage(damage*(enemy.damageTakenMultiplier??1));
    if(source==='melee'&&damage>0&&enemy.health>0&&this.player.health>0){const gain=2*this.energyGainMultiplier;this.player.energy=Math.min(ENERGY_STATS.max,this.player.energy+gain);if(this.absorption)this.absorption.baseEnergy+=gain;}
    enemy.health=roundDamage(Math.max(0,enemy.health-damage));enemy.flash=.16;if(credited)this.healRageHit(damage);
    const level=origin?.ignoreImpactResistance?impactLevel:effectiveImpactLevel(enemy,impactLevel),impact=IMPACT_LEVELS[level];
    const impacted=this.impactEnemy(impactLevel,origin,source,enemy);
    this.emit(credited?'enemyHit':'environmentDamage',{enemy,damage,label,impactLevel:level,dazed:impacted&&Boolean(impact.daze),dazeDuration:impact.daze??0,x:enemy.x,z:enemy.z,strong:strong&&level>=2});
    if(!enemy.health){
      if(!this.backThrow||enemy!==this.backThrow.target){enemy.state='dead';enemy.elapsed=0;}
      enemy.dazeUntil=0;enemy.knockX=0;enemy.knockZ=0;this.defeated++;this.emit('enemyDefeated');
    }else enemy.onDamaged(this,source);
  }
  beginBackThrow(pose) {
    if(this.backThrow||this.breakLaugh||this.player.health<=0)return false;
    const target=this.enemies.find(e=>canBackThrow(pose,e,this.time));if(!target)return false;this.focusEnemy(target);
    const e=this.enemy;
    this.cancelAttack();this.cancelAbsorption();this.clearCounter();
    this.backThrow={target:e,elapsed:0,origin:{x:pose.x,z:pose.z},targetOrigin:{x:e.x,z:e.z},heading:e.heading,targetScale:e.stats.visualScale??1};
    e.state='thrown';e.elapsed=0;e.sequence=null;e.move=null;e.superArmor=false;e.knockX=0;e.knockZ=0;e.dazeUntil=0;e.turnVelocity=0;
    this.backThrow.sample=sampleBackThrow(this.backThrow,0);this.emit('backThrowStarted');return true;
  }
  cancelBackThrow() {
    if(!this.backThrow)return;
    const e=this.backThrow.target;this.backThrow=null;e.throwVisual=null;e.knockX=0;e.knockZ=0;
    e.state=e.health>0?'idle':'dead';e.elapsed=0;
  }
  updateBackThrow(dt) {
    const t=this.backThrow;if(!t)return;const e=t.target;
    t.elapsed=Math.min(BACK_THROW.duration,t.elapsed+dt);t.sample=sampleBackThrow(t,t.elapsed);
    const pose=t.sample.enemy;
    if(!t.recoveryStarted){e.x=pose.x;e.z=pose.z;e.heading=pose.heading;e.throwVisual=pose;}
    if(!t.impacted&&t.elapsed>=BACK_THROW.impact-1e-9){
      t.impacted=true;e.state='down';e.elapsed=0;
      this.damageEnemy(e,this.playerDamage(BACK_THROW.motionMultiplier*(1+.15*(this.passives?.sumo??0))),{label:'过肩背摔 · 坐砸',impactLevel:3,origin:this.backThrow.sample.hero});
    }
    if(!t.recoveryStarted&&t.elapsed>=BACK_THROW.flipStart-1e-9){
      t.recoveryStarted=true;const total=throwRecovery(e);
      const start=this.enemyTime-(t.elapsed-BACK_THROW.flipStart)*(this.worldTimeScale??1);
      e.downUntil=start+total*.75;e.riseUntil=start+total;e.riseDuration=total*.25;
    }
    if(t.sample.hero.landed){
      this.backThrow=null;
      if(e.health<=0){e.state='dead';e.elapsed=0;e.throwVisual=null;}
      this.emit('backThrowCompleted');
    }
  }
  impactEnemy(level,origin,source='attack',enemy=this.enemy) {
    if(enemy.invulnerable)return false;
    if(['thrown','down','rising'].includes(enemy.state))return false;
    level=origin?.ignoreImpactResistance?level:effectiveImpactLevel(enemy,level);const impact=IMPACT_LEVELS[level];
    if(enemy.stats?.permanentSuperArmor||!level||!impact||enemy.health<=0||(enemy.superArmor&&enemy.state!=='windup'))return false;
    const interruptStun=enemy.state==='windup'?enemy.move?.interruptStun??0:0;
    enemy.superArmor=false;
    enemy.counterPending=null;
    // Additional hits cannot move a dazed enemy or refresh its fixed duration.
    if(['dazed','knockback'].includes(enemy.state)&&this.enemyTime<enemy.dazeUntil&&level!==3)return false;
    enemy.elapsed=0;enemy.stun=Math.max(impact.stun,interruptStun);
    if(impact.daze) {
      const hitTime=Number.isFinite(origin.impactTime)?origin.impactTime:this.enemyTime;
      const dx=enemy.x-origin.x,dz=enemy.z-origin.z,d=Math.hypot(dx,dz);
      const nx=d>1e-5?dx/d:Math.sin(origin.heading??0),nz=d>1e-5?dz/d:Math.cos(origin.heading??0);
      enemy.state='knockback';enemy.knockStart=hitTime;enemy.knockUntil=hitTime+impact.knockDuration;
      enemy.knockOrigin={x:enemy.x,z:enemy.z};enemy.knockTarget={x:enemy.x+nx*impact.knockback,z:enemy.z+nz*impact.knockback};
      enemy.dazeUntil=enemy.knockUntil+impact.daze;
      enemy.knockX=0;enemy.knockZ=0;
    } else {
      const dx=enemy.x-origin.x,dz=enemy.z-origin.z,d=Math.hypot(dx,dz);
      const nx=d>1e-5?dx/d:Math.sin(origin.heading??0),nz=d>1e-5?dz/d:Math.cos(origin.heading??0);
      enemy.state='hurt';enemy.knockX+=nx*impact.knockback*9;enemy.knockZ+=nz*impact.knockback*9;
    }
    this.emit('enemyImpact',{level,source,dazed:Boolean(impact.daze),x:enemy.x,z:enemy.z});
    return true;
  }
  resolveAttack(clipTime,pose) {
    if(!this.enabled || !this.attack || this.player.health<=0)return;
    const attack=this.attack,stats=ATTACK_STATS[attack.name];
    if(attack.name==='CounterWave'&&!attack.waveReleased&&clipTime+1e-6>=stats.times[0]){attack.waveReleased=true;this.launchWave(pose);}
    for(let i=0;i<stats.times.length;i++) {
      if(clipTime+1e-6<stats.times[i] || attack.consumed.has(i))continue;
      attack.consumed.add(i); // A missed swing cannot become a delayed hit.
      const volume=attackHeight(pose,stats);
      if(this.debugHitboxes)this.emit('debugHitbox',{...volume,owner:'player',x:pose.x,z:pose.z,heading:pose.heading,range:stats.range*this.attackRangeMultiplier,halfAngle:stats.halfAngle,radial:stats.radial});
      if(stats.radial&&!pose.landed)continue;
      const damage=this.playerDamage(stats.motionMultiplier*(attack.name==='Attack1'?1+.2*(this.passives?.openingStrike??0):1));
      if(!stats.radial&&this.time<this.player.fistwindUntil)this.windQueue.push({at:this.time+.1,pose:{...pose},volume:{...volume},range:stats.range*this.attackRangeMultiplier,halfAngle:stats.halfAngle,damage:this.playerDamage(.3*(1+.1*(this.passives?.marksman??0))),hand:attack.name==='Attack1'||attack.name==='Attack3'&&i%2===0?0:1});
      for(const valve of this.coolingValves)if(valve.health>0&&overlapsHeight(volume,valve,valve.bodyHeight)&&inAttackArea(pose,pose.heading,valve,stats.range*this.attackRangeMultiplier,stats.halfAngle,valve.radius))damageCoolingValve(this,valve,damage);
      for(const enemy of this.enemies){
        if(!enemy.damageable||!overlapsHeight(volume,enemy,enemy.bodyHeight))continue;
        if(!inAttackArea(pose,pose.heading,enemy,stats.range*this.attackRangeMultiplier,stats.halfAngle,enemy.radius))continue;
        if(this.tryEnemyParry(enemy,pose,stats))return;
        this.damageEnemy(enemy,damage,{label:stats.label,impactLevel:stats.impactLevel,origin:pose,source:stats.radial?'slam':'melee'});
      }
    }
  }
  get currentAttackStats(){return this.attack?ATTACK_STATS[this.attack.name]:null;}
  tryEnemyParry(enemy,pose,attack){
    const stance=enemy.move;
    if(!isDamagingMove(attack)||attack.kind==='projectile'||enemy.state!=='windup'||stance?.kind!=='parry'||Math.hypot(pose.x-enemy.x,pose.z-enemy.z)>stance.reach||attack.radial||attack.impactLevel>stance.maxParryImpact||enemy.elapsed<stance.parryStart||enemy.elapsed>stance.parryEnd)return false;
    if(!inAttackArea(enemy,enemy.heading,pose,Infinity,stance.halfAngle)||!overlapsHeight(attackHeight(enemy,stance),pose,PLAYER_STATS.bodyHeight))return false;
    enemy.counterPending=stance.counterIndex;enemy.counterTargetHeading=Math.atan2(pose.x-enemy.x,pose.z-enemy.z);enemy.parryFeedbackStart=this.enemyTime;enemy.parryFeedbackDuration=stance.feedbackDuration;enemy.parryGlowUntil=this.enemyTime+stance.feedbackDuration;enemy.nextParryAt=this.enemyTime+stance.cooldown;
    enemy.state='recover';enemy.elapsed=0;enemy.recovery=stance.counterDelay;enemy.linkRecovery=false;
    const armored=this.isRaging();if(!armored)this.cancelAttack();
    this.emit('enemyParry',{enemy,x:enemy.x,z:enemy.z});
    this.emit('playerHit',{damage:0,armored,stun:stance.recoil,knockback:.08,x:pose.x,z:pose.z,heading:enemy.heading});
    return true;
  }
  launchWave(pose){
    const damage=this.playerDamage(WAVE_STATS.motionMultiplier*(this.attack?.chargeMultiplier??1)*(1+.1*(this.passives?.marksman??0)));
    const wave={...attackHeight(pose,WAVE_STATS),id:++this.nextWaveId,x:this.counterOrbOrigin?.x??pose.x,z:this.counterOrbOrigin?.z??pose.z,visualY:this.counterOrbOrigin?.y,heading:pose.heading,travel:0,range:WAVE_STATS.range*this.attackRangeMultiplier,damage};this.waves.push(wave);this.emit('waveReleased',{x:pose.x,z:pose.z});return wave;
  }
  updateWaves(dt,targets=this.enemies){
    for(const wave of this.waves){
      const startX=wave.x,startZ=wave.z,step=Math.min(wave.range-wave.travel,WAVE_STATS.speed*dt);
      wave.x+=Math.sin(wave.heading)*step;wave.z+=Math.cos(wave.heading)*step;wave.travel+=step;
      if(this.debugHitboxes)this.emit('debugHitbox',{yMin:wave.yMin,yMax:wave.yMax,owner:'player',shape:'capsule',x:startX,z:startZ,toX:wave.x,toZ:wave.z,radius:WAVE_STATS.radius});
      const dx=wave.x-startX,dz=wave.z-startZ,length2=dx*dx+dz*dz;
      wave.valvesHit??=new Set();
      for(const valve of this.coolingValves){if(valve.health<=0||wave.valvesHit.has(valve)||!overlapsHeight(wave,valve,valve.bodyHeight))continue;const u=length2?clamp(((valve.x-startX)*dx+(valve.z-startZ)*dz)/length2,0,1):0;if(Math.hypot(valve.x-startX-dx*u,valve.z-startZ-dz*u)<=WAVE_STATS.radius+valve.radius){wave.valvesHit.add(valve);damageCoolingValve(this,valve,wave.damage);}}
      for(const enemy of targets){
        if(enemy.health<=0||['thrown','down'].includes(enemy.state)||this.time<(this.waveHitUntil.get(enemy)??-Infinity)-1e-9)continue;
        if(!overlapsHeight(wave,enemy,enemy.bodyHeight??1.55))continue;
        const u=length2?clamp(((enemy.x-startX)*dx+(enemy.z-startZ)*dz)/length2,0,1):0;
        if(Math.hypot(enemy.x-startX-dx*u,enemy.z-startZ-dz*u)>WAVE_STATS.radius+(enemy.radius??.36))continue;
        this.waveHitUntil.set(enemy,this.time+WAVE_STATS.hitCooldown);
        this.damageEnemy(enemy,wave.damage,{label:'气功冲击波',impactLevel:WAVE_STATS.impactLevel,origin:{x:startX,z:startZ,heading:wave.heading},source:'wave'});
      }
    }
    this.waves=this.waves.filter(wave=>wave.travel<wave.range-1e-9);
  }
  strikePlayer(pose,attack=this.enemyStats,impactLag=0,origin=this.enemy) {
    if(!isDamagingMove(attack)||attack.fire&&watered(this.coolingValves,pose,this.enemyTime))return;
    const p=this.player,e=this.enemy;
    const hitTime=this.time-Math.max(0,impactLag);
    const volume=attackHeight(attack.absoluteHeight?{...origin,height:0}:origin,attack);
    if(this.debugHitboxes&&!attack.projectile)this.emit('debugHitbox',{...volume,owner:'enemy',x:origin.x,z:origin.z,heading:origin.heading,range:attack.reach,halfAngle:attack.halfAngle});
    if(p.health<=0 || this.backThrow || hitTime<p.invulnerableUntil)return;
    const immune=pose.dodgeName ? dodgeInvulnerable(pose.dodgeName,pose.dodgeElapsed-Math.max(0,impactLag)) : pose.invulnerable;
    if(immune || !overlapsHeight(volume,pose,PLAYER_STATS.bodyHeight) || !inAttackArea(origin,origin.heading,pose,attack.reach,attack.halfAngle,PLAYER_STATS.radius)) {
      this.emit('miss');return;
    }
    p.lastAttackAt=hitTime;p.nextPoseRegenAt=hitTime+POSE_STATS.regenDelay+POSE_STATS.regenTick;
    if((attack.impactLevel??1)>0)this.cancelCounterCharge();
    let guardElapsed=(pose.guardElapsed??Infinity)-impactLag,guardScale=pose.guardPerfectScale,guardHeading=pose.heading,guardToken=pose.guardToken;
    let guardActive=pose.guarding&&guardElapsed>=-1e-8;
    const previous=pose.previousGuard;
    if(!guardActive&&previous&&impactLag>=previous.endedAgo-1e-9&&previous.elapsed-impactLag>=-1e-9){
      guardActive=true;guardElapsed=previous.elapsed-impactLag;guardScale=previous.scale;guardHeading=previous.heading;guardToken=previous.token;
    }
    const guarding=!attack.unblockable&&!this.breakLaugh&&guardActive && inAttackArea(pose,guardHeading,origin,Infinity,GUARD_STATS.halfAngle);
    const tier=guarding?guardTier(Math.max(0,guardElapsed),guardScale):null;
    const poseDamage=Math.max(0,Number(attack.poseDamage)||0);
    const poseCost=roundDamage(poseDamage*(tier?.poseMultiplier??POSE_STATS.unblockedMultiplier)*(1-.08*(this.passives?.poise??0)));
    if(!guarding&&!this.breakLaugh)p.pose=roundDamage(Math.max(0,p.pose-poseCost));
    // This per-character ratio can be changed by future buffs, independently of tiers.
    const lateRatio=Number.isFinite(p.lateGuardDamageRatio)?clamp(p.lateGuardDamageRatio,0,1):GUARD_STATS.lateDamageRatio;
    const attackDamage=motionDamage(origin,attack.motionMultiplier);
    const chipDamage=tier?.name==='late'?roundDamage(attackDamage*lateRatio*(1-this.gear.reduction)*(this.player.health>this.maxHealth*.8?1-.04*(this.passives?.golden??0):1)):0;
    if(guarding) {
      p.lastGuardHit=hitTime;
      if(tier.minimumGuard || p.guard>=poseCost) {
        const before=p.guard;
        p.guard=roundDamage(Math.max(tier.minimumGuard??0,p.guard-poseCost));
        this.absorbPlayerDamage(chipDamage,true);if(chipDamage>0)this.applyPlayerStatus(attack.statusOnHit);
        const perfect=tier.name==='perfect';
        if(perfect&&!attack.projectile){p.counterReady=true;p.counterUntil=hitTime+GUARD_STATS.counterDuration+(this.passives?.goldDuration??0);if(!attack.projectile)this.impactEnemy(1,pose,'parry');}
        this.emit('blocked',{damage:chipDamage,grade:tier.name,label:tier.label,counterReady:perfect&&!attack.projectile,guardToken,guardCost:poseCost,poseDamage,poseMultiplier:tier.poseMultiplier,guardSpent:roundDamage(Math.max(0,before-p.guard)),x:pose.x,z:pose.z});
        if(!p.health){p.deadTime=0;p.energy=0;p.rageUntil=0;this.cancelAbsorption();this.clearCounter();this.cancelAttack();this.emit('playerDefeated');}
        return;
      }
      p.guard=0;
    }
    const damage=roundDamage((guarding?motionDamage(origin,GUARD_STATS.breakMultiplier)*(1-this.gear.reduction)*(this.player.health>this.maxHealth*.8?1-.04*(this.passives?.golden??0):1)+chipDamage:attackDamage*(1-this.gear.reduction)*(this.player.health>this.maxHealth*.8?1-.04*(this.passives?.golden??0):1))*(this.breakLaugh?LAUGH_STATS.damageMultiplier:1));
    this.absorbPlayerDamage(damage,true);if(damage>0)this.applyPlayerStatus(attack.statusOnHit);p.invulnerableUntil=hitTime+PLAYER_STATS.hitInvulnerability;
    this.cancelAbsorption();
    if(!p.health){this.cancelPotion('hit');p.energy=0;p.rageUntil=0;}
    if(!p.health)this.clearCounter();
    const armored=!attack.stunDuration&&(this.isRaging(hitTime)||(attack.impactLevel??1)<=(this.passives?.impactImmunity??0))&&p.health>0&&!this.breakLaugh;
    const reaction=attack.stunDuration?{impactLevel:1,stun:attack.stunDuration,knockback:0,dodgeAfter:Infinity,stunned:true}:playerImpactReaction(attack.impactLevel);
    if(!armored&&(guarding||reaction.impactLevel>0)){this.cancelAttack();this.cancelPotion('hit');}
    this.emit(guarding?'guardBroken':'playerHit',{damage,armored,...reaction,stun:guarding?Math.max(GUARD_STATS.breakStun,reaction.stun):reaction.stun,x:pose.x,z:pose.z,heading:origin.heading});
    if(!p.health){p.deadTime=0;this.emit('playerDefeated');}
    else if(p.pose<=0&&!this.breakLaugh)this.beginBreakLaugh();
  }
  update(dt,pose,externalTimeScale=1) {
    if(this.drinking&&this.time-this.drinking.start>=2-1e-9){const before=this.player.health;this.player.health=roundDamage(Math.min(this.maxHealth,before+this.maxHealth*POTION_STATS.healRatio*(1+this.gear.potionHeal)*(1+.05*(this.passives?.medicine??0))));this.drinking=null;this.emit('potionUsed',{healed:this.player.health-before,remaining:this.player.potions});}
    if(!this.enabled)return;
    dt=clamp(dt,0,.05);
    if(this.player.health>0){
     const skill=this.skillStatsFor('drain');while(this.player.nextDrainTick<=Math.min(this.time+dt,this.player.drainUntil)+1e-9){const gain=skill.energyPerSecond*skill.tick*this.energyGainMultiplier;this.player.energy=Math.min(ENERGY_STATS.max,this.player.energy+gain);if(this.absorption)this.absorption.baseEnergy+=gain;this.player.nextDrainTick+=skill.tick;}
     const due=this.windQueue.filter(w=>w.at<=this.time+dt);this.windQueue=this.windQueue.filter(w=>w.at>this.time+dt);for(const wind of due){this.emit('windShot',{...wind.pose,range:wind.range,hand:wind.hand});for(const valve of this.coolingValves)if(valve.health>0&&overlapsHeight(wind.volume,valve,valve.bodyHeight)&&inAttackArea(wind.pose,wind.pose.heading,valve,wind.range,wind.halfAngle,valve.radius))damageCoolingValve(this,valve,wind.damage);for(const enemy of this.enemies)if(enemy.damageable&&overlapsHeight(wind.volume,enemy,enemy.bodyHeight)&&inAttackArea(wind.pose,wind.pose.heading,enemy,wind.range,wind.halfAngle,enemy.radius))this.damageEnemy(enemy,wind.damage,{label:'拳风',impactLevel:0,origin:wind.pose,source:'fistwind'});}
    }else{this.windQueue=[];this.player.fistwindUntil=0;}this.worldTimeScale=clamp(externalTimeScale,0,1);const worldDt=dt*this.worldTimeScale;this.time+=dt;this.enemyTime+=worldDt;
    // Paired animations may suspend AI updates; timed effects still use world time.
    for(const actor of this.enemies)actor.effects.update(this.enemyTime);
    updateCooling(this,pose);
    this.player.effects.tick(this.time,(effect,raw)=>{
      if(effect.type!=='burn'||this.player.health<=0)return;
      const damage=roundDamage(raw*(1-this.gear.reduction)*(this.breakLaugh?LAUGH_STATS.damageMultiplier:1)*(this.player.health>this.maxHealth*.8?1-.04*(this.passives?.golden??0):1));
      this.absorbPlayerDamage(damage);this.emit('statusDamage',{status:'burn',damage});
      if(this.player.health<=0){this.cancelPotion('hit');this.player.effects.clear();this.player.energy=0;this.player.rageUntil=0;this.clearCounter();this.cancelAttack();this.emit('playerDefeated');}
    });
    this.expireRage();
    this.expireCounter();
    const p=this.player,e=this.enemy;
    if(p.health>0&&p.pose<=0&&!this.breakLaugh)this.beginBreakLaugh();
    if(!p.health) {
      this.waves=[];this.enemyProjectiles=[];
      p.energy=0;p.rageUntil=0;this.breakLaugh=null;this.cancelAbsorption();this.clearCounter();
      p.deadTime+=dt;
      e.elapsed+=worldDt;e.flash=Math.max(0,e.flash-worldDt);
      if(p.deadTime>=PLAYER_STATS.respawn){this.reset();this.emit('playerRespawned');}
      return;
    }
    this.updateWaves(dt);updateEnemyProjectiles(this,worldDt,pose);
    this.creditAbsorption();
    if(this.absorption&&this.time>=this.absorption.start+ENERGY_STATS.duration-1e-9) {
      const before=p.health;
      const healRatio=this.absorption.fullEnergy?ENERGY_STATS.fullHealRatio:ENERGY_STATS.healRatio;
      p.health=roundDamage(Math.min(this.maxHealth,p.health+this.maxHealth*healRatio));
      this.absorption=null;this.clearCounter();
      this.emit('energyGained',{energy:p.energy,bonus:energyDamageMultiplier(p.energy)-1,healed:roundDamage(p.health-before)});
    }
    if(this.breakLaugh){
      const progress=clamp((this.time-this.breakLaugh.start)/this.breakLaugh.duration,0,1);
      p.pose=Math.min(this.maxPose,(this.breakLaugh.initialPose??0)+this.maxPose*progress);
      if(!this.breakLaugh.active&&progress>=1-1e-9){p.pose=this.maxPose;this.breakLaugh=null;p.nextPoseRegenAt=Infinity;this.emit('breakLaughEnded');}
    }else if(this.time>=p.nextPoseRegenAt-1e-9){
      const ticks=Math.floor((this.time-p.nextPoseRegenAt+1e-9)/POSE_STATS.regenTick)+1;
      const rate=Number.isFinite(p.poseRegenRate)?Math.max(0,p.poseRegenRate):POSE_STATS.regenRate;
      p.pose=roundDamage(Math.min(this.maxPose,p.pose+rate*POSE_STATS.regenTick*ticks));
      p.nextPoseRegenAt+=ticks*POSE_STATS.regenTick;
    }
    const paired=this.backThrow;this.updateBackThrow(dt);
    this.updateGroupAggro(pose);
    for(const enemy of this.enemies){
      if(paired?.target===enemy&&this.backThrow&&!this.backThrow.recoveryStarted)continue;
      if(this.enemies.length===1)this.updateEnemy(worldDt,pose);
      else this.withEnemy(enemy,()=>this.updateEnemy(worldDt,pose));
    }
    updateEnemyAuras(this,pose);
    // Separate live enemies without moving a target out of its paired throw.
    const live=this.enemies.filter(e=>e.health>0&&!['thrown','down','rising'].includes(e.state));
    for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
      const a=live[i],b=live[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),overlap=a.radius+b.radius-d;
      if(overlap<=0)continue;const nx=d>1e-6?dx/d:1,nz=d>1e-6?dz/d:0;
      a.x-=nx*overlap*.5;a.z-=nz*overlap*.5;b.x+=nx*overlap*.5;b.z+=nz*overlap*.5;
    }
  }
  updateGroupAggro(pose){
    const live=this.enemies.filter(e=>e.health>0);
    if(live.length<2){this.groupAggressor=live[0]??null;return;}
    const distance=e=>Math.hypot(e.x-pose.x,e.z-pose.z);
    const busy=live.find(e=>e.state==='windup'&&isDamagingMove(e.move));
    if(busy){this.groupAggressor=busy;return;}
    const nearest=live.reduce((a,b)=>distance(a)<distance(b)?a:b);
    if(!live.includes(this.groupAggressor)){this.groupAggressor=nearest;this.groupAggroChangedAt=this.enemyTime;return;}
    const current=distance(this.groupAggressor),next=distance(nearest);
    if(nearest!==this.groupAggressor&&this.enemyTime-this.groupAggroChangedAt>=1&&current-next>=1.5&&next<current*.65){this.groupAggressor=nearest;this.groupAggroChangedAt=this.enemyTime;}
  }
  get movementObstacles(){return this.enemies.concat(this.sceneryColliders??[]);}
  canEnemyAttack(enemy,move){return this.enemies.filter(e=>e.health>0).length<2||!isDamagingMove(move)||enemy===this.groupAggressor;}
  updateEnemy(worldDt,pose){
    const origin={x:this.enemy.x,z:this.enemy.z};
    this.enemy.update(this,worldDt,pose);
    const resolved=moveActorMotion(origin,this.enemy,this.sceneryColliders??[],this.enemy.radius);
    this.enemy.x=resolved.x;this.enemy.z=resolved.z;
  }
  separation(pose) {
    if(!this.enabled || this.backThrow || pose.height>.8)return {x:0,z:0};
    let x=pose.x,z=pose.z;
    for(let pass=0;pass<3;pass++)for(const enemy of this.enemies){
      if(enemy.health<=0||['thrown','down'].includes(enemy.state))continue;
      const dx=x-enemy.x,dz=z-enemy.z,d=Math.hypot(dx,dz),radius=PLAYER_STATS.radius+enemy.radius;
      if(d>=radius)continue;const yaw=d>1e-7?Math.atan2(dx,dz):enemy.heading;
      x+=Math.sin(yaw)*(radius-d);z+=Math.cos(yaw)*(radius-d);
    }
    return {x:x-pose.x,z:z-pose.z};
  }
}

