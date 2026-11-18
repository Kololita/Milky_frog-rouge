import {tunable} from './tuning-registry.js';
// Distances in metres; hit times are authored GLB clip seconds, not wall time.
export const PLAYER_STATS=tunable('PLAYER_STATS',{bodyHeight:1.55,health:100,pose:100,guard:100,attackPower:10,attackSpeed:1,attackInterval:1.4,radius:.40,hitInvulnerability:.55,respawn:3});
export const POTION_STATS=tunable('POTION_STATS',{capacity:6,healRatio:.5,restGain:3});
export const LAUGH_STATS=tunable('LAUGH_STATS',{damageMultiplier:.5,recoveryLead:1,minimumRegenRate:.001});
export const POSE_STATS=tunable('POSE_STATS',{unblockedMultiplier:1,regenRate:20,regenDelay:2,regenTick:.1});
// Reference rate for combat windows; render FPS never changes their real duration.
export const COMBAT_FPS=60;
export const ENERGY_STATS=tunable('ENERGY_STATS',{max:100,gain:25,healRatio:.10,fullHealRatio:.15,duration:1.25,raiseEnd:.38,rainEnd:.88,glowEnd:1.08});
export const ENERGY_BONUS=tunable('ENERGY_BONUS',{linearBonus:.15,fullBonus:.05});
export const energyDamageMultiplier=energy=>{const value=Math.max(0,Math.min(ENERGY_STATS.max,Number(energy)||0));return 1+ENERGY_BONUS.linearBonus*value/ENERGY_STATS.max+(value>=ENERGY_STATS.max?ENERGY_BONUS.fullBonus:0);};
export const RAGE_STATS=tunable('RAGE_STATS',{energyCost:100,duration:9,attackSpeed:1.2,attackInterval:.8,worldSpeed:.8,onHitHealRatio:.05});
// Windows are measured from dodge activation (short Shift release), not clip phase.
export const DODGE_DEFENSE=tunable('DODGE_DEFENSE',{
  DodgeSideL:Object.freeze({startFrame:0,frames:14}),
  DodgeSideR:Object.freeze({startFrame:0,frames:14}),
  DodgeRoll:Object.freeze({startFrame:0,frames:18}),
  DodgeBackflip:Object.freeze({startFrame:0,frames:24}),
});
export const GUARD_TIERS=tunable('GUARD_TIERS',[
  Object.freeze({maxFrames:10,name:'perfect',label:'完美格挡',poseMultiplier:.1,minimumGuard:1}),
  Object.freeze({maxFrames:18,name:'precise',label:'精准格挡',poseMultiplier:.25}),
  Object.freeze({maxFrames:30,name:'good',label:'稳健格挡',poseMultiplier:.5}),
  Object.freeze({maxFrames:60,name:'normal',label:'普通格挡',poseMultiplier:.6}),
  Object.freeze({maxFrames:Infinity,name:'late',label:'迟缓格挡',poseMultiplier:.75}),
]);
export const GUARD_STATS=tunable('GUARD_STATS',{halfAngle:Math.PI*75/180,lateDamageRatio:.30,breakMultiplier:1.2,breakStun:.8,counterDuration:5});
// 0.7s preparation + 2.6s recovery = 3.3s, twice the former 1.65s cycle.
export const ENEMY_STATS=tunable('ENEMY_STATS',{bodyHeight:1.55,heightMin:.35,heightMax:1,health:600,attackPower:5,superArmor:false,radius:.36,speed:1.05,turnRate:Math.PI/2,windupTurnRate:Math.PI*220/180,turnResponse:5,turnAcceleration:12,noticeRange:10,stopDistance:1.35,approachTolerance:.04,reach:1.55,halfAngle:Math.PI*65/180,motionMultiplier:2.4,poseDamage:20,startupResilience:0,impactLevel:1,windup:.7,recovery:2.6,settle:.3,respawn:3,spawn:{x:0,z:3.6}});
export const IMPACT_LEVELS=tunable('IMPACT_LEVELS',{
  0:Object.freeze({stun:0,knockback:0}),
  1:Object.freeze({stun:.24,knockback:.12}),
  2:Object.freeze({stun:.72,knockback:.85}),
  3:Object.freeze({stun:.2,knockback:1.2,knockDuration:.2,daze:1}),
});
export const ATTACK_STATS=tunable('ATTACK_STATS',{
  CounterWave:{heightMin:0.55,heightMax:1.35,label:'气功推掌',motionMultiplier:4,times:[.54],range:1.17*1.2,halfAngle:Math.PI*.34,impactLevel:2},
  Attack1:{heightMin:0.65,heightMax:1.2,label:'左直拳',motionMultiplier:1,times:[.27],range:.96*1.2,halfAngle:Math.PI*.29,impactLevel:1},
  Attack2:{heightMin:0.65,heightMax:1.2,label:'跨步右直拳',motionMultiplier:1.2,times:[.42],range:1.04*1.2,halfAngle:Math.PI*.29,impactLevel:1},
  Attack3:{heightMin:0.6,heightMax:1.25,label:'三连拳',motionMultiplier:.8,times:[.18,.41,.65],range:1.02*1.2,halfAngle:Math.PI*.31,impactLevel:0},
  Attack4:{heightMin:0.55,heightMax:1.35,label:'蓄力重推掌',motionMultiplier:4,times:[.54],range:1.17*1.2,halfAngle:Math.PI*.34,impactLevel:2},
  RunAttack:{heightMin:0.4,heightMax:1.25,label:'跑步双掌',motionMultiplier:1.2,times:[.205],range:1.20,halfAngle:Math.PI*.35,impactLevel:2},
  AirAttack:{heightMin:0,heightMax:0.65,label:'跳跃下砸',motionMultiplier:3,times:[.50],range:1.85,halfAngle:Math.PI,impactLevel:3,radial:true},
});
export const WAVE_STATS=tunable('WAVE_STATS',{heightMin:.37,heightMax:1.33,range:1.55*3.5,speed:8,radius:.48,motionMultiplier:ATTACK_STATS.CounterWave.motionMultiplier*.75,hitCooldown:1,impactLevel:1});
export function currentImpactResistance(enemy){
 const startup=enemy.state==='windup'?(enemy.move?.startupResilience??enemy.stats?.startupResilience):undefined;
 return Math.max(0,Math.floor(startup??enemy.impactResistance??0));
}
export const effectiveImpactLevel=(enemy,level)=>Math.max(0,Math.floor(level)-currentImpactResistance(enemy));
export const PLAYER_IMPACT=tunable('PLAYER_IMPACT',{1:{stun:.65,knockback:.15},2:{stun:3,knockback:.75,dodgeAfter:1},3:{stun:6,knockback:1.8,dodgeAfter:3}});
export function playerImpactReaction(level){
 const impactLevel=Math.max(0,Math.min(3,Math.floor(level??1))),impact=PLAYER_IMPACT[impactLevel]??IMPACT_LEVELS[0];
 return {impactLevel,stun:impact.stun,knockback:impact.knockback,dodgeAfter:impact.dodgeAfter??Infinity};
}
