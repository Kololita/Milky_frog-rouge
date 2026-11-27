/** One damage formula for every actor; each actor owns its independent attack power. */
export function motionDamage(attacker,motionMultiplier,bonus=1){
  const power=Number.isFinite(attacker.attackPower)?Math.max(0,attacker.attackPower):0;
  const multiplier=attacker.damageMultiplier;
  const effects=Number.isFinite(multiplier)?Math.max(0,multiplier):1;
  return Math.round(power*Math.max(0,motionMultiplier)*Math.max(0,bonus)*effects*100)/100;
}
import {tunable} from './tuning-registry.js';

export const ELEMENTAL_DAMAGE=tunable('ELEMENTAL_DAMAGE',{furyPerLevel:.10,specialistConversion:.5,playerResistanceCap:99});
export const DAMAGE_DELIVERY={melee:'近战',ranged:'远程'};
export const DAMAGE_ELEMENTS={normal:'普通',water:'水',fire:'火',electric:'电'};
export const RESISTANCE_LABELS={normal:'物理抗性',water:'水抗性',fire:'火抗性',electric:'电抗性',melee:'近战抗性',ranged:'远程抗性'};
export const NO_RESISTANCES=Object.freeze({normal:0,water:0,fire:0,electric:0,melee:0,ranged:0});
export const ELEMENTAL_SPECIALISTS={water:'waterSpecialist',fire:'fireSpecialist',electric:'electricSpecialist'};
const resistancePercent=value=>Number.isFinite(value)?Math.min(100,value):0;
export const resistanceMultiplier=percent=>1-resistancePercent(percent)/100;
export const damageResistanceMultiplier=(resistances,element,delivery)=>resistanceMultiplier(resistances?.[element])*resistanceMultiplier(resistances?.[delivery]);
export function combineResistances(...sources){
 return Object.fromEntries(Object.keys(NO_RESISTANCES).map(element=>[
  element,Math.round(1e8*(1-sources.reduce((remaining,source)=>remaining*resistanceMultiplier(source?.[element]),1)))/1e6,
 ]));
}
export const elementalFuryMultiplier=passives=>1+ELEMENTAL_DAMAGE.furyPerLevel*(passives?.elementalFury??0);
export function playerDamageComponents(amount,element,passives){
 if(element!=='normal')return [{element,amount}];
 const converted=Object.entries(ELEMENTAL_SPECIALISTS).filter(([,id])=>passives?.[id]>0);
 if(!converted.length)return [{element,amount}];
 const fraction=Math.min(1,converted.length*ELEMENTAL_DAMAGE.specialistConversion);
 const elementalAmount=amount*fraction/converted.length*elementalFuryMultiplier(passives);
 const parts=fraction<1?[{element:'normal',amount:amount*(1-fraction)}]:[];
 return parts.concat(converted.map(([type])=>({element:type,amount:elementalAmount})));
}
export const COMBAT_DAMAGE_TYPES={
 punch:{delivery:'melee',element:'normal'},
 ragePunch:{delivery:'melee',element:'fire'},
 backThrow:{delivery:'melee',element:'normal'},
 chargedOrb:{delivery:'ranged',element:'electric'},
 fistWind:{delivery:'ranged',element:'normal'},
 metal:{delivery:'melee',element:'normal'},
 wood:{delivery:'ranged',element:'normal'},
 earth:{delivery:'melee',element:'normal'},
 rain:{delivery:'ranged',element:'water'},
 thunder:{delivery:'ranged',element:'electric'},
 electric:{delivery:'ranged',element:'electric'},
 burn:{delivery:'ranged',element:'fire'},
 cooling:{delivery:'ranged',element:'water'},
 samuraiLightning:{delivery:'ranged',element:'electric'},
};

export function damageTypeOf(attack={}){
  return {
    delivery:attack.delivery??(attack.kind==='projectile'||attack.kind==='channel'||attack.projectile?'ranged':'melee'),
    element:attack.element==='physical'?'normal':attack.element??(attack.fire?'fire':'normal'),
  };
}
export const damageTypeLabel=({delivery,element,components})=>`${DAMAGE_DELIVERY[delivery]} · ${(components??[{element}]).map(part=>DAMAGE_ELEMENTS[part.element]).join(" / ")}`;
