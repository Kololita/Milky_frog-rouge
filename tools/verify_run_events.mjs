import assert from 'node:assert/strict';
import {EQUIPMENT} from '../src/equipment-catalog.js';
import {RunProgress,SHOP_SERVICE_PRICE} from '../src/run-map.js';
import {RUN_EVENTS,createRunEventUI,eventForNode,resolveRunEvent,rollWorkshopOffers} from '../src/run-events.js';

const player={health:70,maxHealth:100,potions:3,capacity:6};
function scenario(event,types=['monster','elite','shop','rest','monster','monster','boss']){
 const run=new RunProgress(82412765);
 const nodes=['event',...types].map((type,layer)=>({
  id:`${layer}-0`,type,layer,eventSeed:31227+layer,encounterRoll:792+layer,
  next:layer<types.length?[`${layer+1}-0`]:[],
 }));
 nodes[0].debugEventIndex=RUN_EVENTS.findIndex(entry=>entry.id===event);
 run.map={...run.map,nodes,rows:nodes.map(node=>[node])};
 run.gold=200;
 run.select(nodes[0].id);assert(run.beginEvent());
 return run;
}
const choice=(run,index,state={})=>resolveRunEvent(run.selected,index,{...player,gold:run.gold,...state},run.inventory,run);
function take(run,index){
 const effect=choice(run,index);assert(effect);
 run.gold=effect.gold;
 if(effect.plan)run.setEventPlan(effect.plan);
 assert(run.finishEvent());return effect;
}
function enter(run,type){
 const node=run.available().find(room=>room.type===type);
 assert(node,`next ${type}`);return run.select(node.id);
}
function win(run,data){
 assert(run.begin());assert(run.finish(true,1,data));
 if(run.status==='reward')assert(run.claimReward(run.lootChoices.at(-1)));
 assert(run.advance());
}

{
 const run=scenario('spring');
 assert.equal(choice(run,0,{health:12}).health,77);
 assert.equal(choice(run,1).potions,5);
 assert.deepEqual([choice(run,2).health,choice(run,2).potions],[95,4]);
 assert.equal(choice(run,2,{health:100,potions:6}),null);
}
{
 const run=scenario('traveler'),deal=choice(run,0);
 assert.equal(deal.health,40);assert.equal(EQUIPMENT.find(item=>item.id===deal.item).rarity,'purple');
 assert.deepEqual(choice(run,0),deal);
 assert.equal(choice(run,0,{health:30}),null);
 assert.equal(choice(run,1,{potions:1}),null);assert.equal(choice(run,1).gold,295);
}
{
 const run=scenario('cache'),toll=scenario('toll');
 assert.equal(EQUIPMENT.find(item=>item.id===choice(run,0).item).rarity,'blue');
 assert.equal(choice(toll,0,{gold:39}),null);
 assert.deepEqual([choice(toll,0).health,choice(toll,0).potions],[100,4]);
 const delivery=take(toll,1);assert.equal(toll.gold,255);
 run.setEventPlan(delivery.plan);take(run,1);
 enter(run,'monster');assert.equal(run.battleStart().enemyHealthFactor,1.35);
 assert(run.begin());assert(run.finish(true));
 assert.equal(run.lootChoices.length,1);
 assert(['purple','gold'].includes(EQUIPMENT.find(item=>item.id===run.lootChoices[0]).rarity));
 assert(!run.plans.cargo&&!run.plans.cache);
}
{
 const run=scenario('shrine',['monster','elite','rest','boss']);
 take(run,0);enter(run,'monster');assert.equal(run.battleStart().energy,0);win(run);
 enter(run,'elite');assert.equal(run.battleStart().energy,55);win(run);
 assert(!run.plans.blessing);
 const boss=scenario('shrine',['boss']);assert.equal(choice(boss,0),null);
 take(boss,1);enter(boss,'boss');assert.equal(boss.battleStart().energy,80);
}
{
 const run=scenario('survey',['rest','rest','rest','boss']);
 const fork={...run.map.rows[1][0],id:'1-1'};
 run.map.nodes.push(fork);run.map.rows[1].push(fork);run.selected.next.push(fork.id);
 const route=run.surveyRoute(run.selected);assert.equal(route.length,3);
 take(run,0);
 const snapshot=JSON.parse(JSON.stringify(run.snapshot()));
 snapshot.plans.guide.locked=true;
 const restored=RunProgress.restore(snapshot);
 assert.deepEqual(restored.available().map(node=>node.id),['1-0','1-1']);
 for(const id of route){
  assert(restored.select(id));
  assert(restored.beginRest()&&restored.finishRest());
 }
 assert.equal(restored.gold,300);assert(!restored.plans.guide);
 const deviated=RunProgress.restore(JSON.parse(JSON.stringify(run.snapshot())));
 const other=deviated.available().find(node=>node.id!==route[0]);
 assert(deviated.select(other.id));deviated.cancel();assert(deviated.plans.guide);
 assert(deviated.select(other.id));assert(deviated.beginRest()&&deviated.finishRest());
 assert(!deviated.plans.guide);assert.equal(deviated.gold,200);
 for(let i=0;i<2;i++){enter(deviated,'rest');assert(deviated.beginRest()&&deviated.finishRest());}
 assert.equal(deviated.gold,200,'Rejoining the route cannot restore the lost reward');
}
{
 const run=scenario('commission'),before={...run.lootProtection};
 const offers=rollWorkshopOffers(run.selected,run.inventory,run.lootProtection);
 assert.equal(offers.length,3);assert(offers.every(e=>e.offers.length===3));
 assert.deepEqual(rollWorkshopOffers(run.selected,run.inventory,run.lootProtection),offers);
 assert.deepEqual(run.lootProtection,before);
}
{
 const run=scenario('hunt',['elite','rest','boss']);
 assert.equal(choice(run,1),null);
 take(run,0);enter(run,'elite');win(run,{healthDamaged:false});
 assert(run.gold>=295);enter(run,'rest');run.beginRest();run.finishRest();
 enter(run,'boss');assert.equal(run.battleStart().enemyHealthFactor,.82);
 const failed=scenario('hunt',['elite','boss']);
 take(failed,0);enter(failed,'elite');win(failed,{healthDamaged:true});
 enter(failed,'boss');assert.equal(failed.battleStart().enemyHealthFactor,1);
}
{
 const old=scenario('shrine',['monster','boss']).snapshot();
 old.plans.ember={origin:old.selected,carryRatio:.65,restPenalty:1};old.carryEnergy=45;
 old.eventResult={message:'旧事件结果'};
 const restored=RunProgress.restore(old);
 assert(!restored.plans.ember&&!Object.hasOwn(restored,'carryEnergy'));
 assert.equal(restored.eventResult,null);
 restored.finishEvent();enter(restored,'monster');
 assert.equal(restored.battleStart().energy,0);
}
{
 const rest=scenario('relay',['rest','boss']);take(rest,0);enter(rest,'rest');
 assert(rest.plans.rest.refill);assert(rest.beginRest()&&rest.finishRest());assert(!rest.plans.rest);
 const voucher=scenario('voucher',['shop','boss']);take(voucher,1);enter(voucher,'shop');assert(voucher.beginShop());
 assert.equal(voucher.gold,155);assert.equal(voucher.shopServicePrice('hinge'),SHOP_SERVICE_PRICE);
 assert(voucher.payForService('trim')&&voucher.payForService('trim'));
 assert.equal(voucher.gold,155);assert.equal(voucher.shopServicePrice('trim'),SHOP_SERVICE_PRICE);
}
{
 const shop=scenario('bond',['shop','boss']);take(shop,1);enter(shop,'shop');assert(shop.beginShop());
 assert.equal(shop.gold,235);assert(!shop.plans.bond);
 assert(shop.finishShop());assert.equal(shop.gold,235);
 const missed=scenario('bond',['rest','rest','rest','boss']);
 const branch={...missed.map.nodes[1],type:'elite',id:'1-1'};
 missed.map.nodes.push(branch);missed.map.rows[1].push(branch);missed.selected.next.push(branch.id);
 take(missed,0);for(let i=0;i<3;i++){enter(missed,'rest');assert(missed.beginRest()&&missed.finishRest());}
 assert.equal(missed.gold,170);assert(!missed.plans.bond);
}
assert.equal(RUN_EVENTS.length,11);assert(!RUN_EVENTS.some(event=>event.id==='ember'));
for(let seed=0;seed<50;seed++){
 const run=new RunProgress(seed);
 for(const node of run.map.nodes.filter(n=>n.type==='event')){
  const event=eventForNode(node);assert(event);
  if(event.id==='survey')assert(node.layer<8&&run.surveyRoute(node).length===3);
  for(const [index] of (event.choices??[]).entries()){
   assert.deepEqual(resolveRunEvent(node,index,player,run.inventory,run),resolveRunEvent(node,index,player,run.inventory,run));
  }
 }
}
{
 function element(){
  return {children:[],open:false,events:{},
   append(...children){this.children.push(...children);},
   replaceChildren(...children){this.children=children;},
   addEventListener(name,handler){this.events[name]=handler;},
   setAttribute(){},showModal(){this.open=true;},close(){this.open=false;},focus(){},
  };
 }
 const doc={createElement:element,body:element()},run=scenario('spring');
 let current={...player,health:100,potions:6},left=false,saved=0;
 const ui=createRunEventUI(doc,{state:()=>current,apply:effect=>{current={...current,...effect};},saveProgress:()=>saved++});
 ui.open(run.selected,run,()=>{left=run.finishEvent();});
 const [dialog]=doc.body.children;
 const [scroll]=dialog.children,[panel]=scroll.children;
 const [,resources,,options]=panel.children;
 assert(options.children.slice(0,3).every(button=>button.disabled));
 current.health=25;ui.refresh();
 assert(resources.textContent.includes('25 / 100'));
 assert(!options.children[0].disabled);
 options.children[0].events.click();
 assert.equal(current.health,90);assert.equal(saved,1);
 options.children[0].events.click();
 assert(left&&!dialog.open);
}
console.log('RUN_EVENTS_VERIFIED: all 11 events, optional routes, legacy save cleanup, stacked loot contracts, and 50 generated maps');
