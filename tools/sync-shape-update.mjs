import fs from 'node:fs/promises';
import {LEGACY_SHAPE_POOLS} from '../src/equipment-shape-data.js';

const raw=(await fs.readFile(new URL('../docs/equipment/占地形状池.md',import.meta.url),'utf8')).replaceAll('\r\n','\n');
const sections=new Map(raw.split(/^## /m).slice(1).map(block=>{
 const newline=block.indexOf('\n');
 return [block.slice(0,newline),block.slice(newline+1)];
}));
const poolNames={armor:'护甲',weapon:'武器',accessory:'护符'};
const rarities=['white','green','blue','purple','gold'];
const catalog={},knownIds=new Set(),footprints=new Map();
const legacyIds=new Set(Object.values(LEGACY_SHAPE_POOLS).flat().map(({id})=>id));
function footprint(shape){
 const cells=shape.flatMap((row,y)=>[...row].flatMap((mark,x)=>mark==='.'?[]:[[x,y,mark]]));
 const variants=[];
 for(const direction of [1,-1]){
  let points=cells.map(([x,y,mark])=>[x*direction,y,mark]);
  for(let rotation=0;rotation<4;rotation++){
   const minX=Math.min(...points.map(([x])=>x)),minY=Math.min(...points.map(([,y])=>y));
   variants.push(points.map(([x,y,mark])=>`${x-minX},${y-minY},${mark}`).sort().join(';'));
   points=points.map(([x,y,mark])=>[-y,x,mark]);
  }
 }
 return variants.sort()[0];
}
for(const section of (sections.get('形状目录')??'').split(/^### /m).slice(1)){
 const [rarity,...blocks]=section.split(/^#### /m);
 const grade=rarity.trim();
 if(!rarities.includes(grade)||catalog[grade])throw Error(`无效目录品质：${grade}`);
 catalog[grade]={};
 for(const block of blocks){
  const match=block.trim().match(/^([\w-]+)\n\n```text\n([.#*\n]+)\n```$/);
  if(!match)throw Error(`无效形状定义：${block.split('\n')[0]}`);
  const [,id,grid]=match;
  const shape=grid.split('\n');
  if(knownIds.has(id)||legacyIds.has(id)||id.endsWith('-extra')||!/[#*]/.test(grid)||shape.some(row=>row.length!==shape[0].length)){
   throw Error(`形状重复或数据无效：${id}`);
  }
  const key=footprint(shape);
  if(footprints.has(key))throw Error(`形状相同：${id} 与 ${footprints.get(key)}`);
  footprints.set(key,id);
  knownIds.add(id);
  catalog[grade][id]=shape;
 }
}
if(rarities.some(rarity=>!catalog[rarity]))throw Error('形状目录缺少品质');

const config={};
for(const [type,name] of Object.entries(poolNames)){
 const grades=config[type]={};
 for(const block of (sections.get(name+'形状池')??'').split(/^### /m).slice(1)){
  const [rarity,...lines]=block.trim().split('\n');
  if(!rarities.includes(rarity)||grades[rarity])throw Error(`无效品质：${name} ${rarity}`);
  const seen=new Set();
  grades[rarity]=lines.filter(line=>line.trim()).map(line=>{
   const [,id,weightText]=line.trim().match(/^- `([\w-]+)` +(\d+(?:\.\d{1,2})?)$/)??[];
   const weight=Number(weightText);
   if(!Object.hasOwn(catalog[rarity],id)||!(weight>0)||seen.has(id))throw Error(`无效或重复的池条目：${name} ${line}`);
   seen.add(id);
   return {id,weight};
  });
  if(!grades[rarity].length)throw Error(`空形状池：${name} ${rarity}`);
 }
 if(rarities.some(rarity=>!grades[rarity]))throw Error(`缺少品质：${name}`);
}
config.skill={};
const render=data=>'{\n'+Object.entries(data).map(([group,entries])=>
 `  ${group}:{\n${Object.entries(entries).map(([id,value])=>'    '+JSON.stringify(id)+':'+JSON.stringify(value)+',').join('\n')}\n  },`).join('\n')+'\n}';
const source='export const SHAPE_CATALOG='+render(catalog)+';\n\n'
 +'export const AUTHORED_SHAPE_POOLS='+render(config)+';\n\n'
 +'// Exact layouts and multipliers for names recorded by prior versions.\n'
 +'export const LEGACY_SHAPE_POOLS='+JSON.stringify(LEGACY_SHAPE_POOLS,null,2)+';\n';
await fs.writeFile(new URL('../src/equipment-shape-data.js',import.meta.url),source);
