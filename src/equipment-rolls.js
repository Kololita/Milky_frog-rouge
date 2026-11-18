import {EQUIPMENT_PASSIVES} from './equipment-passives.js';
import {EQUIPMENT} from './equipment-catalog.js';
import {SHAPES,shapePoolFor,equipmentShapeType,SHAPE_REFERENCE_AREA} from './equipment-shapes.js';
import {SKILL_STATS} from './skills.js';
export const EQUIPMENT_STAT_WEIGHTS={health:1,pose:.7,attack:10,reduction:200,regen:4,attackSpeed:300,energyGain:240,range:100,potionHeal:50};
export const EQUIPMENT_BALANCE={step:1.08,passivePointValue:2,perCell:{armor:2.5,weapon:7.5,accessory:4.5}};
export function equipmentRawValue(item){return Object.entries(EQUIPMENT_STAT_WEIGHTS).reduce((sum,[key,weight])=>sum+(item[key]??0)*weight*((item[key]??0)<0?.5:1),0);}
export function equipmentPassiveValue(item){return Object.values(item.passives??{}).reduce((sum,level)=>sum+level,0)*EQUIPMENT_BALANCE.passivePointValue;}
export const EQUIPMENT_BUDGETS=Object.fromEntries(Object.entries(EQUIPMENT_BALANCE.perCell).map(([type,value])=>[type,Object.fromEntries(Object.entries(SHAPE_REFERENCE_AREA).map(([rarity,cells],tier)=>[rarity,value*cells*EQUIPMENT_BALANCE.step**tier]))]));
export function validEquipmentRoll(item,roll){return Boolean(item&&roll&&shapePoolFor(item).some(s=>s.id===roll.shapeId));}
export function rollEquipment(id,random=Math.random){
 const item=EQUIPMENT.find(i=>i.id===id),pool=item&&shapePoolFor(item);if(!pool?.length)return null;
 const n=Math.max(0,Math.min(pool.length-1,Math.floor(random()*pool.length)));
 return {shapeId:pool[n].id};
}
export function equipmentBaseMultiplier(item){
 const target=EQUIPMENT_BUDGETS[equipmentShapeType(item)]?.[item.rarity];if(!target)return 1;
 return Math.max(.01,target-equipmentPassiveValue(item))/Math.max(.01,equipmentRawValue(item));
}
export function resolveEquipment(id,roll,upgrade=null){
 const item=EQUIPMENT.find(i=>i.id===id);if(!item)return null;
 const resolved={...item,shapeMultiplier:1,statMultiplier:1};
 if(validEquipmentRoll(item,roll)){
  const shape=SHAPES[roll.shapeId],statMultiplier=shape.multiplier*equipmentBaseMultiplier(item);
  Object.assign(resolved,{shape:shape.shape,shapeId:shape.id,shapeMultiplier:shape.multiplier,statMultiplier});
  for(const key of Object.keys(EQUIPMENT_STAT_WEIGHTS))if(item[key]!==undefined)resolved[key]=item[key]*statMultiplier;
 }
 const grades=['white','green','blue','purple','gold'],max=4-grades.indexOf(item.rarity),level=Math.max(0,Math.min(max,Math.floor(upgrade?.level??0)));
 if(level&&item.slot!=='ultimate'){
  resolved.rarity=grades[grades.indexOf(item.rarity)+level];resolved.upgradeLevel=level;resolved.name=`${item.name}+${level}`;resolved.skillUpgradeLevel=level;
  for(const key of Object.keys(EQUIPMENT_STAT_WEIGHTS))if(resolved[key]>0)resolved[key]=upgradeStat(resolved[key],level,PERCENT_STATS.has(key)?100:1);
  resolved.passives={...item.passives};for(const [key,amount]of Object.entries(upgrade?.passives??{}))if(resolved.passives[key]&&EQUIPMENT_PASSIVES[key])resolved.passives[key]=Math.min(EQUIPMENT_PASSIVES[key].max,resolved.passives[key]+Math.max(0,Math.floor(amount)));
 }
 // Upgraded values are rounded in their displayed units and shared with combat.
 resolved.description=equipmentDescription(resolved);return resolved;
}
export const equipmentDisplayInteger=n=>Math.floor(n+1e-9);
const integer=equipmentDisplayInteger,signed=n=>`${n>=0?'+':''}${integer(n)}`;
const PERCENT_STATS=new Set(['reduction','attackSpeed','energyGain','range','potionHeal']);
export function upgradeStat(value,level,unit=1){for(let i=0;i<level;i++)value=Math.ceil(value*unit*1.35-1e-9)/unit;return value;}
export function equipmentSkillStats(item){
 const source=SKILL_STATS[item?.id];if(!source)return null;
 const result={...source},power=item.shapeMultiplier??1,level=item.skillUpgradeLevel??0;
 // Shape enhances benefits, never raises activation cost or duration.
 if(result.rangeBonus!==undefined)result.rangeBonus=upgradeStat(result.rangeBonus*power,level,100);
 if(result.shield!==undefined)result.shield=upgradeStat(result.shield,level);
 if(result.energyPerSecond!==undefined)result.energyPerSecond=upgradeStat(result.energyPerSecond,level);
 return result;
}
export function equipmentDescription(item){
 const skill=equipmentSkillStats(item);
 if(item.id==='focus')return `消耗${integer(skill.energyCost)}能量，获得一次金光`;
 if(item.id==='longarm')return `消耗${integer(skill.energyCost)}能量，${integer(skill.duration)}秒攻击距离+${integer(skill.rangeBonus*100)}%`;
 if(item.id==='shield')return `消耗${integer(skill.energyCost)}能量，获得${integer(skill.shield)}护盾`;
 if(item.id==='drain')return `失去最大生命${integer(skill.healthRatio*100)}%，${integer(skill.duration)}秒每秒获得${integer(skill.energyPerSecond)}能量`;
 const parts=[],labels={health:'最大生命',pose:'绷住上限',attack:'攻击力',regen:'绷住恢复',attackSpeed:'攻击速度',energyGain:'能量获取',range:'攻击距离',potionHeal:'血瓶恢复量'};
 for(const [key,label]of Object.entries(labels))if(item[key])parts.push(`${label} ${signed(item[key]*(['attackSpeed','energyGain','range','potionHeal'].includes(key)?100:1))}${key==='regen'?'/秒':key==='gold'?'秒':['attackSpeed','energyGain','range','potionHeal'].includes(key)?'%':''}`);
 if(item.reduction)parts.push(`受到生命伤害 -${integer(item.reduction*100)}%`);
 const passives=Object.entries(item.passives??{}).map(([id,level])=>`${EQUIPMENT_PASSIVES[id].name}+${level}${["emptyForge","artisan"].includes(id)?`（${EQUIPMENT_PASSIVES[id].effect(level)}）`:""}`);if(passives.length)parts.push('附加被动：'+passives.join('、'));return parts.join('，')||item.description;
}

export function nextEquipmentUpgrade(id,roll,upgrade={}){
 const item=resolveEquipment(id,roll,upgrade);if(!item||item.rarity==='gold'||item.slot==='ultimate')return null;
 const passive=Object.keys(item.passives??{}).find(k=>item.passives[k]<EQUIPMENT_PASSIVES[k].max);
 return {level:(upgrade.level??0)+1,passives:{...upgrade.passives,...(passive?{[passive]:(upgrade.passives?.[passive]??0)+1}:{})}};
}
