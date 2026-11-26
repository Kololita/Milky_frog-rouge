import {deriveSeed,seededRandom} from './run-random.js';
import {EQUIPMENT} from './equipment-catalog.js';
import {resolveEquipment,rollEquipment} from './equipment-rolls.js';
import {fillEquipmentRewardCard} from './equipment-reward-view.js';
import {hasLootAtLeast,rollLoot} from './loot.js';
import {EXPEDITION_RULES,MAP_LAYOUT,NODE_LABELS,SHOP_CATEGORIES,WORKSHOP_VOUCHER_PRICE} from './run-map.js';

const {guideSteps,guideGold}=EXPEDITION_RULES;
const surveyLastLayer=MAP_LAYOUT.layers/2;
const BOND_DEPOSIT=50,BOND_REFUND=20,BOND_ROOMS=3;
const HUNTS=[
 {label:'伏击誓约',detail:'无伤完成下一场精英战',type:'elite',remaining:1,bossHealthFactor:.82,rewardGold:65},
 {label:'连胜誓约',detail:'无伤完成接下来的三场普通战斗',type:'monster',remaining:3,bossHealthFactor:.88,rewardGold:45},
];
const healthPercent=factor=>Math.round(factor*100);
const healDetail=ratio=>`恢复 ${healthPercent(ratio)}% 最大生命`;
const cachePlan={key:'cache',healthFactor:1.35,minimumRarity:'purple'};
const cargoPlan={key:'cargo',offerCount:1};
const voucherUses=2;
const pass={label:'离开'};
export const RUN_EVENTS=[
 {id:'spring',name:'林间清泉',choices:[
  {label:'饮泉',detail:healDetail(.65),heal:.65},
  {label:'灌装',detail:'补充 2 瓶血瓶',potions:2},
  {label:'留一半',detail:`${healDetail(.25)}，补充 1 瓶血瓶`,heal:.25,potions:1},
  pass,
 ]},
 {id:'traveler',name:'受伤的行商',choices:[
  {label:'抬起货架',detail:'失去 30% 最大生命，获得一件紫色装备',costHealth:.30,rarity:'purple'},
  {label:'以药易金',detail:'交出 2 瓶血瓶，获得 95 金币',costPotion:2,gold:95},
  pass,
 ]},
 {id:'cache',name:'荆棘中的旧箱',choices:[
  {label:'取走箱外装备',detail:'立刻获得一件蓝色装备',rarity:'blue'},
  {label:'带走荆棘锁',detail:`下一场普通战斗的敌人最大生命增加 ${healthPercent(cachePlan.healthFactor-1)}%。胜利后至少一个候选为紫色或金色装备。`,plan:cachePlan},
  pass,
 ]},
 {id:'toll',name:'断桥摆渡',choices:[
  {label:'购买船上补给',detail:`支付 40 金币，${healDetail(.60)}并补充 1 瓶血瓶`,costGold:40,heal:.60,potions:1},
  {label:'替渡夫送货',detail:'立刻获得 55 金币。下一场普通战斗的战利品只有一个候选。',gold:55,plan:cargoPlan},
  pass,
 ]},
 {id:'shrine',name:'旅途石龛',choices:[
  {label:'猎场祝祷',detail:'献上 1 瓶血瓶，下一场精英战开场获得 55 能量',costPotion:1,plan:{key:'blessing',type:'elite',energy:55}},
  {label:'终战祝祷',detail:'献上 2 瓶血瓶，首领战开场获得 80 能量',costPotion:2,plan:{key:'blessing',type:'boss',energy:80}},
  pass,
 ]},
 {id:'survey',name:'巡山人的底图',lastFloor:surveyLastLayer,choices:[
  {label:'求迷问道',detail:(run,node)=>`按顺序走完标记的 ${guideSteps} 个房间可获得 ${guideGold} 金币。可以自由偏离，偏离后奖励失效。${run?' '+run.surveyRoute(node).map(id=>NODE_LABELS[run.map.nodes.find(room=>room.id===id).type]).join(' → '):''}`,plan:{key:'guide'},outcome:'路线已标在地图上。'},
  {label:'无视',detail:'失去 1 瓶血瓶，自由选择路线。',costPotion:1,allowEmptyPotion:true,outcome:effect=>effect.potionCost?'失去了 1 瓶血瓶。':'血瓶已经用完。'},
 ]},
 {id:'commission',name:'折角工坊',equipmentChoice:true},
 {id:'hunt',name:'刻痕猎令',description:'誓约指定的战斗中，被敌人打掉生命即失败。',choices:HUNTS.map(({label,detail,...plan})=>({
  label,detail:`${detail}，获得 ${plan.rewardGold} 金币，首领最大生命降低 ${healthPercent(1-plan.bossHealthFactor)}%。`,plan:{key:'hunt',...plan},
 })).concat(pass)},
 {id:'relay',name:'守夜人的委托',description:'为下一处营地指定用途。',choices:[
  {label:'送去药箱',detail:'休息时补满血瓶，无法升级装备或装配台。',plan:{key:'rest',action:'restock',refill:true}},
  {label:'布置锻台',detail:'装备和装配台各升级一次，无法补充血瓶',plan:{key:'rest',action:'forge'}},pass,
 ]},
 {id:'voucher',name:'巡回匠人',description:`预付 ${WORKSHOP_VOUCHER_PRICE} 金币。在下一家商店可使用两次同类改装，离店后工票作废。`,choices:[
  {label:'预付灵巧',detail:'添加两次拐点，每次为一件装备添加一个拐点。',costGold:WORKSHOP_VOUCHER_PRICE,plan:{key:'voucher',action:'hinge',label:'灵巧',usesLeft:voucherUses}},
  {label:'预付精简',detail:'精简两次，每次从一件装备移除一格。',costGold:WORKSHOP_VOUCHER_PRICE,plan:{key:'voucher',action:'trim',label:'精简',usesLeft:voucherUses}},pass,
 ]},
 {id:'bond',name:'铜印旅契',description:`押下 ${BOND_DEPOSIT} 金币，在接下来 ${BOND_ROOMS} 个房间内履约。到期未履约只退 ${BOND_REFUND} 金币。`,choices:[
  ...[['elite','挑战精英',75],['shop','拜访商店',35]].map(([type,label,bonus])=>({
   label,detail:`${type==='elite'?'战胜精英':'进入商店'}时立即退还押金，再得 ${bonus} 金币。`,
   costGold:BOND_DEPOSIT,plan:{key:'bond',type,deposit:BOND_DEPOSIT,bonus,refund:BOND_REFUND,remaining:BOND_ROOMS,early:true},
  })),pass,
 ]},
];
// Keep existing seeds mapped to the same events except at the deleted slot.
const earlySlots=[...RUN_EVENTS.slice(0,8),null,...RUN_EVENTS.slice(8)];
const regularSlots=earlySlots.filter(event=>!event?.lastFloor);
const earlyReplacements=earlySlots.filter(Boolean),regularReplacements=regularSlots.filter(Boolean);
export function eventForNode(node){
 if(node.debugEventIndex!==undefined)return RUN_EVENTS[node.debugEventIndex];
 const early=node.layer<surveyLastLayer,pool=early?earlySlots:regularSlots;
 const seed=(node.eventSeed??node.encounterRoll)>>>0,event=pool[seed%pool.length];
 if(event)return event;
 const replacements=early?earlyReplacements:regularReplacements;
 return replacements[deriveSeed(seed,'event-replacement')%replacements.length];
}
function reachableWithin(run,node,type,steps){
 const byId=new Map(run.map.nodes.map(room=>[room.id,room]));
 let frontier=new Set(node.next);
 for(let step=0;step<steps&&frontier.size;step++){
  const rooms=[...frontier].map(id=>byId.get(id));
  if(rooms.some(room=>room.type===type))return true;
  frontier=new Set(rooms.flatMap(room=>room.next));
 }
 return false;
}
function planAvailable(run,node,plan){
 if(!plan||!run)return true;
 const existing=run.plans[plan.key];
 if(existing&&!(plan.key==='hunt'&&existing.failed))return false;
 const floorsLeft=run.map.rows.length-node.layer-1;
 if(plan.key==='guide')return floorsLeft>guideSteps;
 const nextRoom={voucher:'shop',blessing:plan.type,rest:'rest',cache:'monster',cargo:'monster'}[plan.key];
 if(nextRoom)return reachableWithin(run,node,nextRoom,floorsLeft);
 if(plan.key==='bond')return reachableWithin(run,node,plan.type,plan.remaining);
 if(plan.key!=='hunt')return true;
 const byId=new Map(run.map.nodes.map(room=>[room.id,room])),counts=new Map();
 for(const row of run.map.rows.slice(node.layer+1).reverse())for(const room of row){
  counts.set(room,(room.type===plan.type?1:0)+Math.max(0,...room.next.map(id=>counts.get(byId.get(id)))));
 }
 return node.next.some(id=>counts.get(byId.get(id))>=plan.remaining);
}
export function resolveRunEvent(node,choice,state,inventory=[],run=null){
 const option=eventForNode(node).choices?.[choice];if(!option||!planAvailable(run,node,option.plan)||(state.gold??0)<(option.costGold??0))return null;
 if(option.plan?.minimumRarity&&!hasLootAtLeast(inventory,option.plan.minimumRarity))return null;
 if(option.costPotion&&state.potions<option.costPotion&&!option.allowEmptyPotion)return null;
 const potionCost=Math.min(state.potions,option.costPotion??0);
 const cost=Math.floor(state.maxHealth*(option.costHealth??0));if(state.health<=cost)return null;
 const health=Math.min(state.maxHealth,state.health-cost+Math.floor(state.maxHealth*(option.heal??0)));
 const potions=Math.min(state.capacity,state.potions-potionCost+(option.potions??0));
 if((option.heal||option.potions)&&health===state.health&&potions===state.potions)return null;
 const random=seededRandom(deriveSeed(node.eventSeed??node.encounterRoll,`choice:${choice}`));
 const pool=EQUIPMENT.filter(e=>e.rarity===option.rarity&&e.droppable!==false&&e.slot!=='ultimate'&&!inventory.includes(e.id));
 const item=option.rarity&&pool.length?pool[Math.floor(random()*pool.length)]:null;
 if(option.rarity&&!item)return null;
 return {gold:(state.gold??0)-(option.costGold??0)+(option.gold??0),health,potions,potionCost,item:item?.id,roll:item?rollEquipment(item.id,random):null,plan:option.plan};
}
const WORKSHOP_OFFER_COUNT=3;
export function rollWorkshopOffers(node,inventory,protection){
 const seed=node.eventSeed??node.encounterRoll;
 return SHOP_CATEGORIES.filter(([slot])=>slot!=='skill').map(([slot,label])=>{
  const random=seededRandom(deriveSeed(seed,`workshop-offers:${slot}`));
  const ids=rollLoot('monster',random,inventory,{...protection},{slot,count:WORKSHOP_OFFER_COUNT});
  const offers=ids.map(id=>{
   const roll=rollEquipment(id,random);
   return {item:resolveEquipment(id,roll),roll};
  });
  return {slot,label:slot==='armor'?'护甲':label,offers};
 });
}
export function createRunEventUI(doc,{state,apply,award,mountToolbar,updateToolbar,saveProgress=()=>{}}){
 const dialog=doc.createElement('dialog');dialog.id='run-event-dialog';dialog.className='run-room-dialog';doc.body.append(dialog);
 const scroll=doc.createElement('div'),panel=doc.createElement('div');
 scroll.className='run-room-scroll';panel.className='run-event-panel';
 scroll.append(panel);dialog.append(scroll);
 dialog.setAttribute('aria-labelledby','run-event-title');
 dialog.addEventListener('cancel',e=>e.preventDefault());
 let refresh=()=>{};
 return {close(){dialog.close();refresh=()=>{};},refresh(){if(dialog.open)refresh();},open(node,run,leave){
  const event=eventForNode(node);panel.replaceChildren();
  const heading=doc.createElement('h2');
  const resources=doc.createElement('p'),story=doc.createElement('p'),options=doc.createElement('div');
  heading.id='run-event-title';heading.textContent=event.name;story.textContent=event.description??'';
  story.hidden=!story.textContent;options.className='run-event-options';
  resources.className='run-event-resources';
  panel.append(heading,resources,story,options);
  const availability=[];
  refresh=()=>{
   const current=state();
   resources.textContent=`生命 ${Math.floor(current.health)} / ${Math.floor(current.maxHealth)} · 血瓶 ${current.potions} / ${current.capacity}`;
   for(const [button,index] of availability)button.disabled=!resolveRunEvent(node,index,{...current,gold:run.gold},run.inventory,run);
  };
  function nextButton(label,onClick,className='run-event-confirm'){
   const next=doc.createElement('button');next.type='button';next.className=className;
   next.textContent=label;next.addEventListener('click',onClick);return next;
  }
  const finish=()=>{dialog.close();leave();};
  function showOutcome({item,roll,message}){
   availability.length=0;options.replaceChildren();refresh();
   if(item){
    const reward=doc.createElement('article');
    fillEquipmentRewardCard(doc,reward,resolveEquipment(item,roll));
    options.append(reward);
   }
   story.textContent=message;story.hidden=!message;
   const next=nextButton(item?'确认':'继续前进',finish);
   options.append(next);next.focus();
  }
  if(event.equipmentChoice){
   const categories=rollWorkshopOffers(node,run.inventory,run.lootProtection);
   let claimed=false;
   function showCategories(){
    options.replaceChildren();
    for(const category of categories){
     const button=nextButton(category.label,()=>showOffers(category),'');
     const detail=doc.createElement('span');
     detail.textContent=`获得一件${category.label}`;
     button.append(detail);
     button.disabled=!category.offers.length;
     options.append(button);
    }
    if(categories.every(category=>!category.offers.length))options.append(nextButton('离开',finish));
   }
   function showOffers({label,offers}){
    if(claimed||!offers.length)return;
    heading.textContent=`${event.name} · ${label}`;
    const cards=doc.createElement('div');cards.className='run-event-offers';
    let selected=null;
    const confirm=nextButton('确认',()=>{
     if(claimed||!selected||run.inventory.includes(selected.item.id))return;
     claimed=true;
     run.inventory.push(selected.item.id);run.equipmentRolls[selected.item.id]=selected.roll;
     award(selected.item,selected.roll);finish();
    });
    confirm.disabled=true;
    for(const offer of offers){
     const card=doc.createElement('button');card.type='button';fillEquipmentRewardCard(doc,card,offer.item);
     card.setAttribute('aria-pressed','false');
     card.addEventListener('click',()=>{
      selected=offer;confirm.disabled=false;
      for(const other of cards.children){
       other.classList.toggle('selected',other===card);
       other.setAttribute('aria-pressed',String(other===card));
      }
     });
     cards.append(card);
    }
    const actions=doc.createElement('div');actions.className='run-event-offer-actions';
    const back=nextButton('返回',()=>{heading.textContent=event.name;showCategories();options.children[0]?.focus();},'');
    actions.append(back,confirm);options.replaceChildren(cards,actions);
    cards.children[0].focus();
   }
   showCategories();
  }else if(run.eventResult){
   showOutcome(run.eventResult);
  }else{
  let chosen=false;
  for(let i=0;i<event.choices.length;i++){
   const choice=event.choices[i],button=doc.createElement('button'),name=doc.createElement('strong');
   button.type='button';name.textContent=choice.label;button.append(name);
   const description=typeof choice.detail==='function'?choice.detail(run,node):choice.detail;
   if(description){const detail=doc.createElement('span');detail.textContent=description;button.append(detail);}
   availability.push([button,i]);options.append(button);
   button.addEventListener('click',()=>{
    if(chosen)return;
    const effect=resolveRunEvent(node,i,{...state(),gold:run.gold},run.inventory,run);
    if(!effect)return;
    chosen=true;run.gold=effect.gold;apply(effect);
    if(effect.plan)run.setEventPlan(effect.plan);
    if(choice===pass){finish();return;}
    if(effect.item){
     run.inventory.push(effect.item);run.equipmentRolls[effect.item]=effect.roll;
    }
    const message=typeof choice.outcome==='function'?choice.outcome(effect):choice.outcome??description??'';
    run.eventResult={item:effect.item,roll:effect.roll,message};
    showOutcome(run.eventResult);
    updateToolbar?.();
    saveProgress();
   });
  }
  }
  refresh();mountToolbar?.(dialog);dialog.showModal();scroll.scrollTop=0;
 }};
}
