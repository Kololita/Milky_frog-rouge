import fs from 'node:fs/promises';
import {EQUIPMENT_DATA} from '../src/equipment-data.js';
import {RARITIES} from '../src/equipment-catalog.js';
import {EQUIPMENT_PASSIVES} from '../src/equipment-passives.js';

const slots={装甲:'armor',武器:'gloves',护符:'charm'};
const fields={
 最大生命:['health'],绷住上限:['pose'],攻击力:['attack'],绷住恢复:['regen'],
 攻击速度:['attackSpeed',.01],物理抗性:['physicalResistance',.01],
 能量获取:['energyGain',.01],攻击距离:['range',.01],血瓶恢复量:['potionHeal',.01],
};
const fieldNames=Object.values(fields).map(([name])=>name);
const rarities={'白':'white','绿':'green','蓝':'blue','紫':'purple','金':'gold'};
const passivesByName=new Map(Object.entries(EQUIPMENT_PASSIVES).map(([id,passive])=>[passive.name,id]));
const documentNames=process.argv.slice(2).filter(arg=>arg!=='--check');
if(!documentNames.length||documentNames.some(name=>!Object.hasOwn(slots,name)))
 throw new Error('用法：node tools/sync-equipment-update.mjs [--check] 装甲 武器 护符（可指定其一）');

const dataUrl=new URL('../src/equipment-data.js',import.meta.url);
const items=new Map(structuredClone(EQUIPMENT_DATA).map(item=>[item.id,item]));
const updated=[];
const split=text=>text.replace(/[。.\s]+$/u,'').split(/[，、,]/u).map(part=>part.trim()).filter(Boolean);
const fieldPattern=/^(\S+?)\s*([+-])\s*(\d+(?:\.\d+)?)(%|\/秒)?$/u;
for(const name of new Set(documentNames)){
 const path=new URL(`../docs/equipment/${name}.md`,import.meta.url);
 const text=await fs.readFile(path,'utf8');
 const seen=new Set();
 for(const section of text.split(/^###\s+/mu).slice(1)){
  const title=section.split(/\r?\n/u,1)[0].trim();
  const id=section.match(/^标识(?:[：:]|为)\s*`(.+?)`/mu)?.[1];
  if(!id||seen.has(id))throw new Error(`${name} / ${title} 缺少标识或标识重复`);
  seen.add(id);
  const rarity=rarities[section.match(/^品质(?:[：:]|为)\s*([白绿蓝紫金])/mu)?.[1]];
  const effect=section.match(/^(?:效果[：:]|基础属性为)\s*(.+)$/mu)?.[1];
  const passiveText=section.match(/^(?:额外被动[：:]|附加被动为)\s*(.+)$/mu)?.[1];
  const existing=items.get(id);
  if(!rarity||!effect||!passiveText||existing&&existing.slot!==slots[name])
   throw new Error(`${name} / ${id} 的品质、属性或被动无效`);
  const stats={};
  for(const part of split(effect)){
   if(part==='无')continue;
   const [,label,sign,value,unit]=part.match(fieldPattern)??[];
   const field=fields[label];
   if(!field||Boolean(field[1])!==(unit==='%'))throw new Error(`${id} 的属性无效：${part}`);
   stats[field[0]]=Number(value)*(sign==='-'?-1:1)*(field[1]??1);
  }
  const passives={};
  for(const part of split(passiveText)){
   if(part==='无')continue;
   const [,label,levelText]=part.match(/^(\S+?)\s*\+\s*(\d+)$/u)??[];
   const passive=passivesByName.get(label),level=Number(levelText);
   if(!passive||level<1||level>EQUIPMENT_PASSIVES[passive].max)throw new Error(`${id} 的被动无效：${part}`);
   passives[passive]=level;
  }
  const changed=existing?.name!==title||existing?.rarity!==rarity||
   fieldNames.some(key=>Math.abs((existing?.[key]??0)-(stats[key]??0))>1e-9)||
   Object.keys({...existing?.passives,...passives}).some(key=>existing?.passives?.[key]!==passives[key]);
  if(!changed)continue;
  const next={...existing,id,name:title,slot:slots[name],rarity,passives,description:effect.replace(/[。]+$/u,'')};
  if(existing?.rarity&&existing.rarity!==rarity)next.previousRarity=existing.rarity;
  for(const key of fieldNames){
   delete next[key];
   if(stats[key]!==undefined)next[key]=Number(stats[key].toFixed(8));
  }
  items.set(id,next);updated.push(`${title}（${RARITIES[rarity].label}）`);
 }
}
if(updated.length&&!process.argv.includes('--check'))
 await fs.writeFile(dataUrl,`export const EQUIPMENT_DATA=${JSON.stringify([...items.values()],null,2)};\n`);
console.log(updated.length?updated.join('、'):'装备配置与所选文档一致。');
if(updated.length&&process.argv.includes('--check'))process.exitCode=1;
