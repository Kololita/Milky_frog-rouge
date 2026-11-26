import {EQUIPMENT} from './equipment-catalog.js';
export const LOOT_WEIGHTS={monster:{white:55,green:35,blue:12,purple:6,gold:2},elite:{white:30,green:30,blue:20,purple:15,gold:5}};
const rarityOrder=Object.keys(LOOT_WEIGHTS.monster);
export function hasLootAtLeast(owned,minimumRarity){
 const minimum=rarityOrder.indexOf(minimumRarity);
 return minimum>=0&&EQUIPMENT.some(item=>item.slot!=='ultimate'&&item.droppable!==false&&rarityOrder.indexOf(item.rarity)>=minimum&&!owned.includes(item.id));
}
export const createLootProtection=()=>Object.fromEntries(Object.keys(LOOT_WEIGHTS.monster).map(grade=>[grade,0]));
export function lootWeights(kind,protection={}){
 // One shared miss count drives both pools. Log scaling avoids numeric overflow.
 const logs=Object.entries(LOOT_WEIGHTS[kind]??{}).map(([grade,base])=>[grade,Math.log(base)+(protection[grade]??0)*Math.log(1.1)]);
 const peak=Math.max(...logs.map(([,value])=>value));
 const weights=logs.map(([grade,value])=>[grade,Math.exp(value-peak)]),sum=weights.reduce((n,[,v])=>n+v,0);
 return Object.fromEntries(weights.map(([grade,value])=>[grade,value/sum]));
}
export function rollLoot(kind,random=Math.random,owned=[],protection=createLootProtection(),{slot,count=2,minimumRarity}={}){
 if(!LOOT_WEIGHTS[kind])return [];
 const excluded=new Set(owned),choices=[],appeared=new Set(),weights=lootWeights(kind,protection);
 const choose=items=>items[Math.min(items.length-1,Math.floor(random()*items.length))];
 for(let i=0;i<count;i++){
  const available=EQUIPMENT.filter(item=>item.slot!=='ultimate'&&item.droppable!==false&&!excluded.has(item.id)&&(!slot||item.slot===slot));
  const minimumIndex=i===0?rarityOrder.indexOf(minimumRarity):-1;
  const groups=Object.entries(weights).map(([rarity,weight])=>({rarity,weight,items:available.filter(item=>item.rarity===rarity)})).filter(group=>group.items.length);
  const preferred=minimumIndex>=0?groups.filter(group=>rarityOrder.indexOf(group.rarity)>=minimumIndex):groups;
  const candidates=preferred.length?preferred:groups;
  const total=candidates.reduce((sum,g)=>sum+g.weight,0);if(!total)break;
  let pick=random()*total,group=candidates.at(-1);for(const candidate of candidates){pick-=candidate.weight;if(pick<0){group=candidate;break;}}
  const item=choose(group.items);appeared.add(item.rarity);
  choices.push(item.id);excluded.add(item.id);
 }
 // Once per reward screen: either offer resets that rarity, not only the claimed item.
 for(const grade of Object.keys(LOOT_WEIGHTS[kind]))protection[grade]=appeared.has(grade)?0:(protection[grade]??0)+1;
 return choices;
}
