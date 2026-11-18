import {EQUIPMENT_DATA} from './equipment-data.js';
import {defaultShapeFor} from './equipment-shapes.js';
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
 {id:'rage',slot:'ultimate',rarity:null,droppable:true,name:'狂暴',description:'消耗100能量，进入狂暴形态',icon:'rage'},
 {id:'fistwind',slot:'ultimate',rarity:null,droppable:true,name:'拳风',description:'消耗100能量，30秒内拳掌附带0.3倍率劲风',icon:'fistwind'},
 ...EQUIPMENT_DATA,
];

for(const item of EQUIPMENT){if(item.slot!=='ultimate'){item.shape=defaultShapeFor(item);if(!item.shape)throw new Error(`缺少装备占地形状：${item.id}`);if(!['skill'].includes(item.slot))item.icon=item.id;}}
