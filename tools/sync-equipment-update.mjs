import fs from 'node:fs/promises';
import {EQUIPMENT as old,RARITIES} from '../src/equipment-catalog.js';
import {EQUIPMENT_PASSIVES} from '../src/equipment-passives.js';
const names=[['软革背心','armor-soft'],['引灵衣','armor-channel'],['药师短袍','armor-medic'],['游侠轻衣','armor-ranger'],['玄铁甲','armor-blackiron'],['行医护甲','armor-healer']];let unnamed=0;const result=[];
const slots={'装甲':'armor','武器':'gloves','护符':'charm'};
const stats={'最大生命':'health','绷住上限':'pose','攻击力':'attack','绷住恢复':'regen','金光持续':'gold','伤害减免':'reduction','能量获取':'energyGain','攻击距离':'range','血瓶恢复量':'potionHeal','血瓶回复量':'potionHeal','受到生命伤害':'reduction'};
const labels={health:'最大生命',pose:'绷住上限',attack:'攻击力',regen:'绷住恢复',gold:'金光持续',reduction:'伤害减免',energyGain:'能量获取',range:'攻击距离',potionHeal:'血瓶恢复量'};
for(const [file,slot]of Object.entries(slots)){
 const raw=await fs.readFile(`docs/equipment/${file}.md`,'utf8');let page=`# ${file}设计\n\n白色一项基础属性，绿色两项正面属性；蓝／紫／金默认分别提供1／2／3点附加被动等级，可分配给同一被动。明确“无”被动的装备保留为属性型例外。减伤与血瓶回复修正乘算，属性仅乘形状倍率。\n\n`;
 for(const section of raw.split(/^###[ \t]*/m).slice(1)){
  let name=section.split('\n')[0].trim(),id=section.match(/标识：\s*`([^`]+)`/)?.[1];
  if(!name||/待命名|未命名/.test(name)){[name,id]=names[unnamed++];}
  const rarity=Object.entries(RARITIES).find(([,r])=>section.includes(`品质：${r.label}`))?.[0];if(!rarity)continue;
  const item={id,slot,rarity,name,icon:old.find(i=>i.id===id)?.icon??'armor'};
  const effect=section.match(/效果：([^\n]+)/)?.[1]??'';
  for(const [label,key]of Object.entries(stats)){const match=effect.match(new RegExp(label+'\\s*([+-]?\\s*\\d+(?:\\.\\d+)?)'));if(match){let v=Number(match[1].replaceAll(' ',''));if(['reduction','energyGain','range','potionHeal'].includes(key))v/=100;if(label==='受到生命伤害')v=-v;item[key]=v;}}
  if(rarity==='white'){for(const k of Object.keys(stats).map(k=>stats[k]).filter((v,i,a)=>a.indexOf(v)===i).filter(k=>item[k]!==undefined).slice(1))delete item[k];}
  if(rarity==='green'){for(const key of Object.values(stats))if(item[key]<0)item[key]=Math.abs(item[key]);if(Object.values(stats).filter((k,i,a)=>a.indexOf(k)===i&&item[k]).length<2){const key=item.health?'pose':'health';item[key]=3;}}
  if(rarity==='purple'||rarity==='gold')for(const key of Object.values(stats))if(item[key]!==undefined){const cap={health:rarity==='gold'?50:35,pose:20,attack:rarity==='gold'?6:4,regen:6,gold:2,reduction:.1};if(cap[key])item[key]=Math.sign(item[key])*Math.min(Math.abs(item[key]),cap[key]);}
  const passiveText=section.match(/额外被动：([^\n]+)/)?.[1];const budget={blue:1,purple:2,gold:3}[rarity]??0;const passives={};
  if(budget&&passiveText!=='无'){
   for(const [pid,p]of Object.entries(EQUIPMENT_PASSIVES)){const m=passiveText?.match(new RegExp(p.name+'\\s*\\+\\s*(\\d+)'));if(m)passives[pid]=Number(m[1]);}
   let left=budget-Object.values(passives).reduce((a,b)=>a+b,0);const preferred=item.attack?['comeback','reach','poise']:item.regen?['recovery','energy','medicine']:item.reduction?['golden','poise','energy']:['medicine','flasks','recovery'];
   for(const pid of preferred){if(left<=0)break;if(!passives[pid]){passives[pid]=1;left--;}}if(left>0)passives[preferred[0]]=(passives[preferred[0]]??0)+left;
  }item.passives=passives;
  const descriptions=Object.entries(labels).filter(([k])=>item[k]!==undefined).map(([k,label])=>`${label} ${item[k]>=0?'+':''}${Number((item[k]*(['reduction','energyGain','range','potionHeal'].includes(k)?100:1)).toFixed(2))}${['reduction','energyGain','range','potionHeal'].includes(k)?'%':k==='regen'?'/秒':''}`);item.description=descriptions.join('，');result.push(item);
  page+=`### ${name}\n\n品质：${RARITIES[rarity].label}。\n\n效果：${item.description}。\n\n额外被动：${Object.entries(passives).map(([p,l])=>`${EQUIPMENT_PASSIVES[p].name}+${l}`).join('，')||'无'}。\n\n标识：\`${id}\`。\n\n占地：对应类型／品质形状池随机。\n\n`;
 }await fs.writeFile(`docs/equipment/${file}.md`,page);
}
await fs.writeFile('src/equipment-data.js','export const EQUIPMENT_DATA='+JSON.stringify(result,null,2)+';\n');
let text=await fs.readFile('src/equipment-catalog.js','utf8');const start=text.indexOf(" {id:'armor-light'");const end=text.indexOf('\n];',start);text=text.slice(0,start)+' ...EQUIPMENT_DATA,'+text.slice(end);text="import {EQUIPMENT_DATA} from './equipment-data.js';\n"+text;await fs.writeFile('src/equipment-catalog.js',text);
await fs.writeFile('docs/equipment/附加被动.md','# 附加被动\n\n同名等级相加并受各自上限限制，不受占地倍率影响。仅已装配装备提供等级。\n\n'+Object.entries(EQUIPMENT_PASSIVES).map(([id,p])=>`### ${p.name}\n\n标识：\`${id}\`；上限${p.max}级。\n\n`+Array.from({length:p.max},(_,i)=>`${i+1}级：${p.effect(i+1)}。`).join('\n\n')).join('\n\n'));
