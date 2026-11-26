import {deriveSeed,formatMapSeed,newMapSeed,seededRandom} from './run-random.js';
import {arrangeRunMap} from './run-map-layout.js';
import {nextEquipmentUpgrade,rollEquipment} from './equipment-rolls.js';
import {rollLoot,createLootProtection,hasLootAtLeast} from './loot.js';
import {STARTING_ITEMS,EQUIPMENT} from './equipment-catalog.js';
import {ENCOUNTER_POOLS,chooseFormation} from './encounter-formations.js';
import {ENERGY_STATS} from './battle-values.js';
import {rollRunBoons,runBoon,runClasses} from './run-start.js';
export const MAP_LAYOUT=Object.freeze({
 layers:16,rowGap:200,padding:80,width:920,
 dashLength:3,dashGap:7,minNodeDistance:150,
 get height(){return (this.layers-1)*this.rowGap+2*this.padding;},
});
export const NODE_LABELS=Object.freeze({monster:'战斗',elite:'精英',rest:'休息处',boss:'首领',event:'事件',shop:'商店'});
const NODE_WEIGHTS=[['elite',2],['rest',2],['shop',1],['event',4],['monster',5]];
const MIN_ROW_WIDTH=3,MAX_ROW_WIDTH=6,MAX_NODE_DEGREE=3;
const corridorPatterns=new Map();
export const SHOP_CATEGORIES=[['armor','防具'],['gloves','武器'],['charm','护符'],['skill','技能']];
export const SHOP_SERVICE_PRICE=50;
export const EXPEDITION_RULES=Object.freeze({
 guideSteps:3,guideGold:100,huntBossHealthFactor:.88,
 restBonusPotions:2,
});
export const WORKSHOP_VOUCHER_PRICE=45;
const SHOP_PRICES={white:24,green:38,blue:58,purple:82,gold:110};
const GOLD_DROPS={monster:[10,20],elite:[30,50]};
function shuffle(items,random){
 for(let i=items.length-1;i>0;i--){
  const j=Math.floor(random()*(i+1));
  [items[i],items[j]]=[items[j],items[i]];
 }
 return items;
}
function planarPatterns(fromWidth,toWidth){
 const key=`${fromWidth}:${toWidth}`;
 if(corridorPatterns.has(key))return corridorPatterns.get(key);
 const patterns=[],edges=[];
 const outgoing=Array(fromWidth).fill(0),incoming=Array(toWidth).fill(0);
 // Advancing monotonically across both rows covers every room and preserves lane order.
 function visit(from,to){
  if(outgoing[from]===MAX_NODE_DEGREE||incoming[to]===MAX_NODE_DEGREE)return;
  outgoing[from]++;incoming[to]++;edges.push([from,to]);
  if(from===fromWidth-1&&to===toWidth-1){
   const branches=outgoing.filter(degree=>degree>1).length;
   const drift=edges.reduce((sum,[a,b])=>sum+Math.abs((a+.5)/fromWidth-(b+.5)/toWidth),0);
   patterns.push({edges:[...edges],outgoing:[...outgoing],branches,drift:drift/edges.length});
  }
  if(from+1<fromWidth&&to+1<toWidth)visit(from+1,to+1);
  if(from+1<fromWidth)visit(from+1,to);
  if(to+1<toWidth)visit(from,to+1);
  edges.pop();outgoing[from]--;incoming[to]--;
 }
 visit(0,0);
 corridorPatterns.set(key,patterns);
 return patterns;
}
function connectRows(rows,parents,random){
 const forcedDepth=new Map();
 for(let layer=0;layer<rows.length-1;layer++){
  const from=rows[layer],to=rows[layer+1];
  const depth=from.map(node=>forcedDepth.get(node.id)??0);
  const desiredBranches=from.length*(.45+random()*.2);
  let chosen,best=Infinity;
  for(const pattern of planarPatterns(from.length,to.length)){
   const continuations=depth.reduce((sum,previous,index)=>
    sum+(pattern.outgoing[index]===1 ? .45*previous*previous : 0),0);
   const score=Math.abs(pattern.branches-desiredBranches)+continuations+2*pattern.drift+random();
   if(score<best){chosen=pattern;best=score;}
  }
  for(const [a,b] of chosen.edges){
   from[a].next.push(to[b].id);parents.get(to[b].id).push(from[a]);
   if(chosen.outgoing[a]===1){
    forcedDepth.set(to[b].id,Math.max(forcedDepth.get(to[b].id)??0,depth[a]+1));
   }
  }
 }
}
export function generateRunMap(seed){
 const root=formatMapSeed(seed),random=seededRandom(deriveSeed(root,'map')),last=MAP_LAYOUT.layers-1;
 const elite=6+Math.floor(random()*5),rest=5+Math.floor(random()*4),finalRests=3;
 const units=(elite+rest+finalRests)/4;
 const quotas=new Map(NODE_WEIGHTS.map(([type,weight])=>[type,Math.round(weight*units)]));
 quotas.set('elite',elite);
 quotas.set('rest',rest+finalRests);
 const widths=Array(last-1).fill(MIN_ROW_WIDTH);
 const safeLayers=shuffle(widths.map((_,layer)=>layer).filter(layer=>layer>=4&&layer<last-2&&layer%2===0),random);
 // Reserve enough capacity for both restricted types before distributing the remaining rooms.
 const reserved=Math.max(0,elite+rest-safeLayers.length*MIN_ROW_WIDTH);
 for(const layer of safeLayers.slice(0,reserved))widths[layer]++;
 const ordinaryCount=[...quotas.values()].reduce((sum,count)=>sum+count,0)-finalRests;
 for(let count=widths.reduce((sum,width)=>sum+width,0);count<ordinaryCount;count++){
  const expandable=widths.map((_,layer)=>layer).filter(layer=>widths[layer]<MAX_ROW_WIDTH);
  widths[expandable[Math.floor(random()*expandable.length)]]++;
 }
 widths.push(finalRests,1);
 const rows=Array.from({length:MAP_LAYOUT.layers},(_,layer)=>{
  const width=widths[layer];
  return Array.from({length:width},(_,lane)=>({
   id:`${layer}-${lane}`,layer,lane,encounterRoll:deriveSeed(root,`encounter:${layer}-${lane}`),
   eventSeed:deriveSeed(root,`event:${layer}-${lane}`),shopSeed:deriveSeed(root,`shop:${layer}-${lane}`),
   x:width===1?MAP_LAYOUT.width/2:45+lane*(MAP_LAYOUT.width-90)/(width-1)+(random()-.5)*12,
   y:MAP_LAYOUT.padding+(last-layer)*MAP_LAYOUT.rowGap,next:[],
  }));
 });
 const parents=new Map(rows.flat().map(node=>[node.id,[]]));
 connectRows(rows,parents,random);
 const nodes=rows.flat();
 function place(node,type){node.type=type;quotas.set(type,quotas.get(type)-1);}
 for(const node of rows[0])place(node,'monster');
 for(const node of rows[last-1])place(node,'rest');
 // Separate restricted nodes onto alternating rows before shuffling their positions.
 const safe=shuffle(safeLayers.flatMap(layer=>rows[layer]),random);
 for(const type of ['elite','rest'])while(quotas.get(type)>0)place(safe.pop(),type);
 const shopRows=shuffle(rows.slice(3,last-1).filter((_,i)=>i%2===0).flat(),random);
 while(quotas.get('shop')>0)place(shopRows.pop(),'shop');
 const early=shuffle(rows.slice(1,3).flat(),random);
 for(const node of early){
  const types=['event','monster'].filter(type=>quotas.get(type)>0);
  place(node,types[Math.floor(random()*types.length)]);
 }
 const free=shuffle(nodes.filter(node=>!node.type&&node.layer!==last),random);
 for(const [type,count] of quotas)for(let i=0;i<count;i++)place(free.pop(),type);
 rows[last][0].type='boss';

 // Trade positions while retaining the assigned counts and all edge constraints.
 const flexible=nodes.filter(node=>node.layer>0&&node.layer<last-1);
 const byId=new Map(nodes.map(node=>[node.id,node]));
 function fits(node){
  const {type,layer}=node;
  if((layer<4&&type==='elite')||(layer<3&&['rest','shop'].includes(type)))return false;
  if(!['elite','rest','shop'].includes(type))return true;
  return !parents.get(node.id).some(parent=>parent.type===type)&&!node.next.some(id=>byId.get(id).type===type);
 }
 for(const a of shuffle(flexible,random)){
  const b=flexible[Math.floor(random()*flexible.length)];
  if(a.type===b.type)continue;
  [a.type,b.type]=[b.type,a.type];
  if(!fits(a)||!fits(b))[a.type,b.type]=[b.type,a.type];
 }
 for(const node of nodes){
  const {type}=node;
  Object.assign(node,{type,name:NODE_LABELS[type],encounter:type==='boss'?'samurai':type==='elite'?ENCOUNTER_POOLS.elite[node.encounterRoll%ENCOUNTER_POOLS.elite.length]:null});
 }
 arrangeRunMap(rows,MAP_LAYOUT,seededRandom(deriveSeed(root,'map-layout')));
 return {seed:root,rows,nodes,height:MAP_LAYOUT.height};
}
export function shopOffers(node,inventory){
 const random=seededRandom(node.shopSeed??node.encounterRoll);
 const pool=EQUIPMENT.filter(item=>SHOP_PRICES[item.rarity]!=null&&item.droppable!==false&&item.slot!=='ultimate'&&!inventory.includes(item.id));
 return SHOP_CATEGORIES.flatMap(([slot])=>{
  const category=shuffle(pool.filter(item=>item.slot===slot),random);
  return category.slice(0,slot==='skill'?1:2).map(item=>({
   id:item.id,price:SHOP_PRICES[item.rarity],roll:rollEquipment(item.id,random),
  }));
 });
}
export class RunProgress{
 static restore(data){
  const {map,selected,...state}=data;
  const nodes=map.rows.flat(),byId=new Map(nodes.map(node=>[node.id,node]));
  if(state.layer<0||state.layer>map.rows.length||state.path.some(id=>!byId.has(id))||
     (!['map','startingReward'].includes(state.status)&&!byId.has(selected)))throw Error('无效的远征进度');
  const {ember,...plans}=state.plans??{};
  delete state.carryEnergy;
  if(state.status==='event'&&ember?.origin===selected)state.eventResult=null;
  if(state.status==='reward'){
   const ultimateIds=new Set(runClasses().map(item=>item.id));
   state.lootChoices=state.lootChoices.filter(id=>!ultimateIds.has(id));
   if(!state.lootChoices.length)state.status='victory';
  }
  state.lootUpgrades??={};
  return Object.assign(Object.create(RunProgress.prototype),state,{plans,map:{...map,nodes},selected:byId.get(selected)??null});
 }
 snapshot(){
  const {map,selected,...state}=this;
  return {...state,map:{seed:map.seed,rows:map.rows,height:map.height},selected:selected?.id??null};
 }
 constructor(seed=newMapSeed(),setup=null){
  const mapSeed=formatMapSeed(seed);
  const boon=setup?rollRunBoons(mapSeed).find(option=>option.id===setup.boon):undefined;
  if(setup&&(!boon||!runClasses().some(item=>item.id===setup.ultimate)))throw new Error('请选择可用的职业与开局增益');
  this.map=generateRunMap(mapSeed);this.status='map';this.layer=0;this.gold=boon?.gold??0;this.lastGoldReward=0;this.shopStock=[];this.path=[];this.selected=null;this.ordinaryBattles=0;this.lastOrdinary=null;
  this.inventory=setup?[setup.ultimate]:[...STARTING_ITEMS];
  if(setup){this.startingUltimate=setup.ultimate;this.startingBoonId=boon.id;}
  this.lootChoices=[];this.lootRolls={};this.lootUpgrades={};this.equipmentRolls={};this.lootProtection=createLootProtection();this.plans={};this.roomNotices=[];
  if(boon?.reward){
   const random=seededRandom(deriveSeed(mapSeed,'starting-reward'));
   this.lootChoices=rollLoot('monster',random,this.inventory,createLootProtection(),boon.reward);
   this.lootRolls=Object.fromEntries(this.lootChoices.map(id=>[id,rollEquipment(id,random)]));
   if(this.lootChoices.length)this.status='startingReward';
  }
 }
 get startingBoon(){return runBoon(this.startingBoonId);}
 get startingAssembly(){
  const ultimate=this.startingUltimate;
  if(!ultimate)return undefined;
  return {ultimate,boards:{[ultimate]:{level:this.startingBoon?.boardLevel??0,placements:[]}}};
 }
 get guidedRoute(){
  const guide=this.plans.guide;
  return guide?[guide.from,...guide.remaining]:[];
 }
 get cachePending(){const cache=this.plans.cache;return cache&&hasLootAtLeast(this.inventory,cache.minimumRarity);}
 surveyRoute(node){
  const random=seededRandom(deriveSeed(this.map.seed,`survey-route:${node.id}`)),remaining=[];
  for(let step=0;step<EXPEDITION_RULES.guideSteps;step++){
   if(!node.next.length)return [];
   const id=node.next[Math.floor(random()*node.next.length)];
   remaining.push(id);node=this.map.rows[node.layer+1].find(room=>room.id===id);
  }
  return remaining;
 }
 setEventPlan(plan){
  if(plan.key==='guide'){
   this.plans.guide={from:this.selected.id,remaining:this.surveyRoute(this.selected)};
   return;
  }
  this.plans[plan.key]={...plan,origin:this.selected.id};
 }
 settleBond(payout,message){
  this.gold+=payout;delete this.plans.bond;
  this.roomNotices.push(`旅契${message} · +${payout} 金币`);
 }
 visit(node){
  this.roomNotices=[];
  const {guide,bond}=this.plans;
  if(guide&&node.id!==guide.from){
   if(node.id!==guide.remaining[0]){
    delete this.plans.guide;this.roomNotices.push('巡山路线 · 已偏离');
   }else{
    guide.remaining.shift();guide.from=node.id;
    if(!guide.remaining.length){
     this.gold+=EXPEDITION_RULES.guideGold;delete this.plans.guide;
     this.roomNotices.push(`巡山路线 · +${EXPEDITION_RULES.guideGold} 金币`);
    }
   }
  }
  if(bond&&node.id!==bond.origin){
   bond.qualified||=node.type===bond.type;
   bond.remaining--;
   if(bond.qualified&&bond.early)this.settleBond(bond.deposit+bond.bonus,'履约');
   else if(!bond.remaining)this.settleBond(bond.qualified?bond.deposit+bond.bonus:bond.refund??bond.deposit,'到期');
  }
  this.path.push(node.id);this.layer++;
 }
 seedFor(domain){return deriveSeed(this.map.seed,`${domain}:${this.selected?.id??'run'}`);}
 battleStart(){
  const {hunt,blessing,cache}=this.plans;
  const type=this.selected?.type;
  const openingEnergy=blessing&&blessing.type===type?blessing.energy:0;
  return {
   energy:Math.min(ENERGY_STATS.max,openingEnergy),
   enemyHealthFactor:type==='boss'&&hunt&&!hunt.failed&&hunt.remaining===0
    ?hunt.bossHealthFactor??EXPEDITION_RULES.huntBossHealthFactor
    :type==='monster'&&this.cachePending?cache.healthFactor:1,
  };
 }
 available(){
  if(this.status==='shop')return this.map.rows[this.selected.layer+1].filter(node=>this.selected.next.includes(node.id));
  if(this.status!=='map')return [];
  if(!this.path.length)return this.map.rows[this.layer];
  const previous=this.map.nodes.find(node=>node.id===this.path.at(-1));
  return this.map.rows[this.layer].filter(node=>previous.next.includes(node.id));
 }
 select(id){
  const node=this.available().find(room=>room.id===id);
  if(!node)return null;
  if(this.status==='shop')this.finishShop();
  if(node.type==='monster')node.encounter=chooseFormation(node,this.ordinaryBattles,this.lastOrdinary);
  this.selected=node;this.status='preparing';return node;
 }
 cancel(){if(this.status==='preparing'){this.status='map';this.selected=null;}}
 beginEvent(){if(this.status!=='preparing'||this.selected.type!=='event')return false;this.eventResult=null;this.status='event';return true;}
 finishEvent(){if(this.status!=='event')return false;this.eventResult=null;this.visit(this.selected);this.status='map';this.selected=null;return true;}
 begin(){if(this.status!=='preparing'||['rest','event','shop'].includes(this.selected.type))return false;if(this.selected.type==='monster'){this.ordinaryBattles++;this.lastOrdinary=this.selected.encounter;}this.status='battle';return true;}
 beginRest(){if(this.status!=='preparing'||this.selected.type!=='rest')return false;this.restActions=[];this.status='rest';return true;}
 finishRest(){if(this.status!=='rest')return false;this.restActions=[];delete this.plans.rest;this.visit(this.selected);this.status='map';this.selected=null;return true;}
 beginShop(){
  if(this.status!=='preparing'||this.selected.type!=='shop')return false;
  this.shopStock=shopOffers(this.selected,this.inventory);this.status='shop';
  const bond=this.plans.bond;
  if(bond?.early&&bond.type==='shop')this.settleBond(bond.deposit+bond.bonus,'履约');
  return true;
 }
 buy(id){
  const offer=this.shopStock.find(item=>item.id===id);
  if(this.status!=='shop'||!offer||this.inventory.includes(id)||this.gold<offer.price)return null;
  this.gold-=offer.price;
  this.inventory.push(id);
  this.equipmentRolls[id]=offer.roll;
  return offer;
 }
 shopServicePrice(action){return action&&this.plans.voucher?.action===action?0:SHOP_SERVICE_PRICE;}
 canBuyService(action){return this.status==='shop'&&this.gold>=this.shopServicePrice(action);}
 payForService(action){
  if(!this.canBuyService(action))return false;
  const price=this.shopServicePrice(action);
  this.gold-=price;
  if(price===0){
   const voucher=this.plans.voucher;
   voucher.usesLeft=(voucher.usesLeft??1)-1;
   if(!voucher.usesLeft)delete this.plans.voucher;
  }
  return true;
 }
 finishShop(){if(this.status!=='shop')return false;this.shopStock=[];delete this.plans.voucher;this.visit(this.selected);this.status='map';this.selected=null;return true;}
 finish(won,enemyCount=1,{healthDamaged=false}={}){
  if(this.status!=='battle')return false;
  if(!won){this.status='lost';return true;}
  this.visit(this.selected);
  if(this.selected.type==='boss'){this.status='won';return true;}
  const {hunt,blessing,cache,cargo}=this.plans,type=this.selected.type;
  if(hunt?.type===this.selected.type&&hunt.remaining>0){
   if(healthDamaged){hunt.failed=true;hunt.remaining=0;}
   else if(--hunt.remaining===0&&hunt.rewardGold){
    this.gold+=hunt.rewardGold;this.roomNotices.push(`猎令完成 · +${hunt.rewardGold} 金币`);
   }
  }
  if(blessing?.type===type)delete this.plans.blessing;
  const minimumRarity=type==='monster'&&this.cachePending?cache.minimumRarity:undefined;
  const count=type==='monster'&&cargo?cargo.offerCount:2;
  if(type==='monster'){
   if(cache)delete this.plans.cache;
   if(cargo)delete this.plans.cargo;
  }
  const random=seededRandom(this.seedFor('loot'));
  const goldRandom=seededRandom(this.seedFor('gold'));
  const rollRandom=seededRandom(this.seedFor('equipment-shapes'));
  const [min,max]=GOLD_DROPS[this.selected.type];
  this.lastGoldReward=0;
  for(let i=0;i<enemyCount;i++)this.lastGoldReward+=min+Math.floor(goldRandom()*(max-min+1));
  this.gold+=this.lastGoldReward;
  this.lootChoices=rollLoot(type,random,this.inventory,this.lootProtection,{count,minimumRarity});
  this.lootRolls=Object.fromEntries(this.lootChoices.map(id=>[id,rollEquipment(id,rollRandom)]));
  this.lootUpgrades={};
  if(type==='monster'&&this.ordinaryBattles<=this.startingBoon?.upgradedBattles){
   for(const id of this.lootChoices){
    const upgrade=nextEquipmentUpgrade(id,this.lootRolls[id]);
    if(upgrade)this.lootUpgrades[id]=upgrade;
   }
  }
  this.status=this.lootChoices.length?'reward':'victory';return true;
 }
 claimReward(id){
  const starting=this.status==='startingReward';
  if(!starting&&this.status!=='reward'||!this.lootChoices.includes(id))return false;
  this.inventory.push(id);this.equipmentRolls[id]={...this.lootRolls[id]};
  this.lootChoices=[];this.lootRolls={};this.lootUpgrades={};
  this.status=starting?'map':'victory';return true;
 }
 advance(){if(this.status!=='victory')return false;this.selected=null;this.status='map';return true;}
}
