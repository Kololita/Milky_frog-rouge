import {MOB_RULES} from './monster-rules.js';
/** Action categories own only the parameters that apply to their effects. */
export const NOT_APPLICABLE=-1;
export class EnemyMove{
 constructor({label,prepare=0,swing,recovery,motion,startupResilience=0,lockLead,...specific}){
  Object.assign(this,{label,prepare,swing,motion,startupResilience},specific);
  if(recovery!=null)Object.defineProperty(this,'recovery',{value:recovery,writable:true,enumerable:true,configurable:true});
  if(lockLead!=null)Object.defineProperty(this,'lockLead',{value:lockLead,writable:true,enumerable:true,configurable:true});
 }
 get recovery(){return 1.2;}
 get lockLead(){return MOB_RULES.lockLead;}
 get dealsDamage(){return false;}
 defaultLifeDamage(){return NOT_APPLICABLE;}
}
export class AttackMove extends EnemyMove{
 constructor(options){super({lunge:0,impactLevel:1,startupResilience:1,...options});this.kind='melee';}
 get windup(){return this.prepare+this.swing;}
 get dealsDamage(){return true;}
 defaultLifeDamage(power){return Math.round(power*this.motionMultiplier*100)/100;}
}
export class ChannelMove extends AttackMove{constructor(options){super(options);this.kind='channel';}}
export class ProjectileMove extends AttackMove{
 constructor(options){super(options);this.kind='projectile';}
}
class UtilityMove extends EnemyMove{
 get motionMultiplier(){return NOT_APPLICABLE;}
 get poseDamage(){return NOT_APPLICABLE;}
 get impactLevel(){return NOT_APPLICABLE;}
 get lunge(){return 0;}
}
export class StanceMove extends UtilityMove{
 constructor(options){super({counterDelay:.12,recoil:0,feedbackDuration:.35,cooldown:3.5,...options});this.kind='parry';}
 get parryStart(){return this.prepare;}
 get parryEnd(){return this.prepare+this.swing;}
}
export class BuffMove extends UtilityMove{
 constructor(options){super(options);this.kind='buff';}
 get reach(){return NOT_APPLICABLE;}
 get halfAngle(){return NOT_APPLICABLE;}
 get heightMin(){return NOT_APPLICABLE;}
 get heightMax(){return NOT_APPLICABLE;}
}
export class AuraMove extends UtilityMove{constructor(options){super(options);this.kind='aura';}}
export class MovementMove extends UtilityMove{
 constructor(options){super(options);this.kind='movement';}
 get reach(){return NOT_APPLICABLE;}
 get halfAngle(){return NOT_APPLICABLE;}
 get heightMin(){return NOT_APPLICABLE;}
 get heightMax(){return NOT_APPLICABLE;}
}
export const isDamagingMove=move=>move instanceof EnemyMove?move.dealsDamage:Boolean(move)&&!['parry','buff','movement'].includes(move.kind);
export const defaultLifeDamage=(move,power)=>move instanceof EnemyMove?move.defaultLifeDamage(power):isDamagingMove(move)?Math.round(power*move.motionMultiplier*100)/100:NOT_APPLICABLE;
