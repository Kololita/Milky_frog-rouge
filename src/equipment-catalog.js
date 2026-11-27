import {EQUIPMENT_DATA} from './equipment-data.js';
import {defaultShapeFor} from './equipment-shapes.js';
import {ELEMENTAL_ULTIMATES,elementalUltimateDescription} from './elemental-ultimates.js';
import {FISTWIND_STATS,RAGE_STATS,FISTWIND_ENERGY_COST} from './battle-values.js';
export const RARITIES={
 white:{label:'白',color:'#d7dce1'},green:{label:'绿',color:'#70af7a'},blue:{label:'蓝',color:'#578fc8'},purple:{label:'紫',color:'#9a71cc'},gold:{label:'金',color:'#d8ab46'},
};
export const STARTING_LOADOUT=Object.freeze({ultimate:'rage'});
export const STARTING_ITEMS=Object.freeze([...Object.values(STARTING_LOADOUT)]);
export const EQUIPMENT=[
 {id:'longarm',slot:'skill',rarity:'blue',name:'长臂',description:'消耗30能量，30秒攻击距离+20%',icon:'longarm'},
 {id:'shield',slot:'skill',rarity:'purple',name:'护盾',description:'消耗50能量，获得50护盾',icon:'shield'},
 {id:'drain',slot:'skill',rarity:'blue',name:'汲能',description:'失去最大生命30%，30秒每秒获得3能量',icon:'drain'},
 {id:'focus',slot:'skill',rarity:'blue',name:'聚能',description:'消耗35能量，获得一次金光',icon:'focus'},
 {id:'rage',slot:'ultimate',rarity:null,droppable:false,name:'狂暴',profession:'火龙',icon:'rage',
  get description(){const s=RAGE_STATS,pct=n=>Math.round(n*100);return `消耗${s.energyCost}能量，狂暴持续${s.duration}秒。期间获得霸体，拳掌变为火属性，攻击速度提高${pct(s.attackSpeed-1)}%，攻击间隔缩短${pct(1-s.attackInterval)}%。每次攻击命中回复${pct(s.onHitHealRatio)}%最大生命。`;}},
 {id:'fistwind',slot:'ultimate',rarity:null,droppable:false,name:'拳风',profession:'风龙',icon:'fistwind',
  get description(){return `消耗${FISTWIND_ENERGY_COST}能量，形成持续${FISTWIND_STATS.duration}秒的风场，反弹可格挡的弹体。拳掌引出劲风，追加${FISTWIND_STATS.multiplier}倍伤害并轻推目标。`;}},
 ...Object.entries(ELEMENTAL_ULTIMATES).map(([id,{name,profession,accent}])=>({
  id,name,profession,accent,slot:'ultimate',rarity:null,droppable:false,icon:id,
  get description(){const cost=ELEMENTAL_ULTIMATES[id].energyCost;return (cost?`消耗${cost}能量，`:'')+elementalUltimateDescription(id);},
 })),
 ...EQUIPMENT_DATA,
];

for(const item of EQUIPMENT){if(item.slot!=='ultimate'){item.shape=defaultShapeFor(item);if(!item.shape)throw new Error(`缺少装备占地形状：${item.id}`);if(!['skill'].includes(item.slot))item.icon=item.id;}}
