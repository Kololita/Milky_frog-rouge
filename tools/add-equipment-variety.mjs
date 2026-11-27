import fs from 'node:fs/promises';
import {EQUIPMENT_DATA as old} from '../src/equipment-data.js';
import {EQUIPMENT_PASSIVES} from '../src/equipment-passives.js';
const added=[
 ['armor-linen','armor','white','素布衣',{pose:6}],['fist-stone','gloves','white','石片拳套',{attack:1.5}],['charm-sap','charm','white','树脂坠',{energyGain:.06}],
 ['armor-traveler','armor','green','行旅皮衣',{health:5,regen:1}],['fist-long','gloves','green','展拳护手',{attack:1.2,range:.04}],['charm-herb','charm','green','草药香囊',{health:4,potionHeal:.08}],
 ['armor-impact','armor','blue','缓冲衬甲',{health:12,pose:8},{impactImmunity:1}],['armor-thorn','armor','blue','荆棘轻甲',{attack:1.5,health:-5},{comeback:1}],['fist-mist','gloves','blue','薄雾拳套',{attack:2,energyGain:.06},{energy:1}],['charm-anchor','charm','blue','锚石坠',{pose:12,range:-.02},{impactImmunity:1}],
 ['armor-impact-heavy','armor','purple','卸力重甲',{health:15,regen:-1},{impactImmunity:2}],['fist-breaker','gloves','purple','破阵护拳',{attack:3,pose:-5},{impactImmunity:1,reach:1}],['charm-breath','charm','purple','守息玉',{pose:12,regen:2},{recovery:1,medicine:1}],['armor-dawn','armor','purple','晨光护衣',{health:12,energyGain:.06},{goldDuration:1,energy:1}],
 ['armor-cloud','armor','gold','流云御甲',{health:20,physicalResistance:.06},{impactImmunity:2,golden:1}],['fist-tempest','gloves','gold','逐风拳甲',{attack:4,range:.03},{reach:1,impactImmunity:1,energy:1}],['charm-lantern','charm','gold','长明灯芯',{energyGain:.08,potionHeal:.1},{goldDuration:2,medicine:1}],['charm-still','charm','gold','定心印',{pose:18,regen:3},{impactImmunity:2,recovery:1}],
].map(([id,slot,rarity,name,stats,passives={}])=>({id,slot,rarity,name,icon:id,...stats,passives,description:''}));
const labels={health:'最大生命',pose:'绷住上限',regen:'绷住恢复',attack:'攻击力',range:'攻击距离',energyGain:'能量获取',potionHeal:'血瓶恢复量',physicalResistance:'物理抗性'},percent=['range','energyGain','potionHeal','physicalResistance'],grades={white:'白',green:'绿',blue:'蓝',purple:'紫',gold:'金'},files={armor:'装甲',gloves:'武器',charm:'护符'};
for(const i of added){i.description=Object.entries(labels).filter(([k])=>i[k]).map(([k,l])=>`${l} ${i[k]>0?'+':''}${Number((i[k]*(percent.includes(k)?100:1)).toFixed(2))}${percent.includes(k)?'%':k==='regen'?'/秒':''}`).join('，');await fs.appendFile(`docs/equipment/${files[i.slot]}.md`,`\n### ${i.name}\n\n品质：${grades[i.rarity]}。\n\n效果：${i.description}。\n\n额外被动：${Object.entries(i.passives).map(([k,v])=>EQUIPMENT_PASSIVES[k].name+'+'+v).join('，')||'无'}。\n\n标识：\`${i.id}\`。\n\n占地：对应类型／品质形状池随机。\n`);}
await fs.writeFile('src/equipment-data.js','export const EQUIPMENT_DATA='+JSON.stringify([...old,...added],null,2)+';\n');
await fs.appendFile('docs/equipment/附加被动.md','\n### 耐冲\n\n标识：`impactImmunity`；上限2级。\n\n1级免疫一级冲击造成的硬直；2级免疫一、二级冲击造成的硬直。未免疫的高等级冲击完全保留原硬直和击退，不减级、不抵伤、不减少破绷。\n');
