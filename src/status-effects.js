import {combineResistances} from './combat-damage.js';

/** Timed effects belong to the receiver, never to a particular caster's AI. */
export class StatusEffects{
 constructor(){this.entries=new Map();this.time=0;}
 update(now){if(now===this.time)return;this.time=now;for(const [key,effect] of this.entries)if(now>=effect.until-1e-9)this.entries.delete(key);}
 apply(effect,now=this.time){
  this.update(now);
  if(!effect?.type||!Number.isFinite(effect.amount)||!(effect.duration>0))return false;
  const key=effect.type==='resistance'?`resistance:${effect.element}:${effect.group??''}`:`${effect.type}:${effect.group??effect.type}`;
  const old=this.entries.get(key);
  let amount=effect.amount;
  if(old){
   if(effect.stacking!=='add')amount=Math.max(old.amount,amount);
   else if(effect.type==='resistance'){
    const element=effect.element;
    amount=combineResistances({[element]:old.amount},{[element]:amount})[element];
   }else amount+=old.amount;
  }
  this.entries.set(key,{...effect,amount,until:now+effect.duration,...(effect.tickInterval>0?{nextTick:old?.nextTick??now+effect.tickInterval}:{})});return true;
 }
 tick(now,callback){for(const effect of this.entries.values())if(effect.tickInterval>0){while(effect.nextTick<=Math.min(now,effect.until)+1e-9){effect.nextTick+=effect.tickInterval;callback(effect,effect.amount*effect.tickInterval);}}this.update(now);}
 remove(type){for(const [key,effect]of this.entries)if(effect.type===type)this.entries.delete(key);}
 value(type){let value=0;for(const effect of this.entries.values())if(effect.type===type)value+=effect.amount;return value;}
 has(type){return [...this.entries.values()].some(effect=>effect.type===type);}
 clear(){this.entries.clear();}
}
