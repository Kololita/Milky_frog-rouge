import {EQUIPMENT} from './equipment-catalog.js';
export const LOOT_WEIGHTS={monster:{white:55,green:35,blue:12,purple:6,gold:2},elite:{white:30,green:30,blue:20,purple:15,gold:5}};
export const ULTIMATE_DROP_CHANCE=.10;
export const createLootProtection=()=>Object.fromEntries(Object.keys(LOOT_WEIGHTS.monster).map(grade=>[grade,0]));
export function lootWeights(kind,protection={}){
 // One shared miss count drives both pools. Log scaling avoids numeric overflow.
 const logs=Object.entries(LOOT_WEIGHTS[kind]??{}).map(([grade,base])=>[grade,Math.log(base)+(protection[grade]??0)*Math.log(1.1)]);
 const peak=Math.max(...logs.map(([,value])=>value));
 const weights=logs.map(([grade,value])=>[grade,Math.exp(value-peak)]),sum=weights.reduce((n,[,v])=>n+v,0);
 return Object.fromEntries(weights.map(([grade,value])=>[grade,value/sum]));
}
export function rollLoot(kind,random=Math.random,owned=[],protection=createLootProtection()){
 if(!LOOT_WEIGHTS[kind])return [];
 const excluded=new Set(owned),choices=[],appeared=new Set(),weights=lootWeights(kind,protection);
 const choose=items=>items[Math.min(items.length-1,Math.floor(random()*items.length))];
 for(let i=0;i<2;i++){
  const available=EQUIPMENT.filter(item=>item.droppable!==false&&!excluded.has(item.id));
  const ultimates=kind==='elite'?available.filter(item=>item.slot==='ultimate'):[];
  let item;
  if(ultimates.length&&random()<ULTIMATE_DROP_CHANCE)item=choose(ultimates);
  else{
   const groups=Object.entries(weights).map(([rarity,weight])=>({rarity,weight,items:available.filter(item=>item.slot!=='ultimate'&&item.rarity===rarity)})).filter(group=>group.items.length);
   const total=groups.reduce((sum,g)=>sum+g.weight,0);if(!total)break;
   let pick=random()*total,group=groups.at(-1);for(const candidate of groups){pick-=candidate.weight;if(pick<0){group=candidate;break;}}
   item=choose(group.items);appeared.add(item.rarity);
  }
  choices.push(item.id);excluded.add(item.id);
 }
 // Once per reward screen: either offer resets that rarity, not only the claimed item.
 for(const grade of Object.keys(LOOT_WEIGHTS[kind]))protection[grade]=appeared.has(grade)?0:(protection[grade]??0)+1;
 return choices;
}
