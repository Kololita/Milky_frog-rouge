import {deriveSeed,seededRandom} from './run-random.js';
import {EQUIPMENT} from './equipment-catalog.js';
import {rollEquipment} from './equipment-rolls.js';
export const RUN_EVENTS=[
 {id:'spring',name:'林间清泉',description:'石缝中涌出一汪清泉。你可以饮下泉水，也可以用它补充药瓶。',choices:[{label:'饮泉',detail:'恢复30%最大生命',heal:.30},{label:'灌装',detail:'补充1瓶血瓶',potions:1}]},
 {id:'traveler',name:'受伤的行商',description:'行商被困在倒下的货架旁。他愿意拿一件装备，换你帮忙搬开沉重的木架。',choices:[{label:'伸出援手',detail:'失去20%最大生命，获得一件绿色装备',costHealth:.20,rarity:'green'},{label:'留下绷带',detail:'消耗1瓶血瓶，获得一件蓝色装备',costPotion:1,rarity:'blue'},{label:'离开',detail:'不作交换'}]},
 {id:'cache',name:'荆棘中的旧箱',description:'一只旧箱被荆棘缠住。外侧挂着一件尚能使用的装备，箱子深处则闪着更耀眼的光。',choices:[{label:'取走外侧装备',detail:'获得一件白色装备',rarity:'white'},{label:'深入荆棘',detail:'失去25%最大生命，获得一件蓝色装备',costHealth:.25,rarity:'blue'}]},
 {id:'toll',name:'断桥摆渡',description:'摆渡人开价载你过河。岸边也有人在找帮手。',choices:[{label:'付船费',detail:'支付20金币，恢复25%最大生命',costGold:20,heal:.25},{label:'帮忙装货',detail:'获得15金币',gold:15},{label:'离开',detail:'绕道过河'}]},
 {id:'shrine',name:'旅途石龛',description:'石龛前刻着旧时旅人的祈愿，旁边有一个用来盛放药液的小碗。',choices:[{label:'献上药液',detail:'消耗1瓶血瓶，获得一件蓝色装备',costPotion:1,rarity:'blue'},{label:'静坐片刻',detail:'恢复15%最大生命',heal:.15}]},
];
export function eventForNode(node){return RUN_EVENTS[((node.eventSeed??node.encounterRoll)>>>0)%RUN_EVENTS.length];}
export function resolveRunEvent(node,choice,state,inventory=[]){
 const option=eventForNode(node).choices[choice];if(!option||(state.gold??0)<(option.costGold??0))return null;
 if(option.costPotion&&(state.potions<option.costPotion))return null;
 const cost=Math.floor(state.maxHealth*(option.costHealth??0));if(state.health<=cost)return null;
 const random=seededRandom(deriveSeed(node.eventSeed??node.encounterRoll,`choice:${choice}`));
 const pool=EQUIPMENT.filter(e=>e.rarity===option.rarity&&e.droppable!==false&&e.slot!=='ultimate'&&!inventory.includes(e.id));
 const item=option.rarity&&pool.length?pool[Math.floor(random()*pool.length)]:null;
 if(option.rarity&&!item)return null;
 return {gold:(state.gold??0)-(option.costGold??0)+(option.gold??0),health:Math.min(state.maxHealth,state.health-cost+Math.floor(state.maxHealth*(option.heal??0))),potions:Math.min(state.capacity,state.potions-(option.costPotion??0)+(option.potions??0)),item:item?.id,roll:item?rollEquipment(item.id,random):null,itemName:item?.name};
}
export function createRunEventUI(doc,{state,apply}){
 const dialog=doc.createElement('dialog');dialog.id='run-event-dialog';doc.body.append(dialog);
 dialog.addEventListener('cancel',e=>e.preventDefault());
 return {close(){dialog.close();},open(node,run,leave){
  const event=eventForNode(node);dialog.replaceChildren();const heading=doc.createElement('h2'),story=doc.createElement('p'),options=doc.createElement('div');heading.textContent=event.name;story.textContent=event.description;dialog.append(heading,story,options);let chosen=false;
  for(let i=0;i<event.choices.length;i++){
   const choice=event.choices[i],button=doc.createElement('button'),name=doc.createElement('strong'),detail=doc.createElement('span');name.textContent=choice.label;detail.textContent=choice.detail;button.append(name,detail);button.disabled=!resolveRunEvent(node,i,{...state(),gold:run.gold},run.inventory);options.append(button);
   button.addEventListener('click',()=>{if(chosen)return;const effect=resolveRunEvent(node,i,{...state(),gold:run.gold},run.inventory);if(!effect)return;chosen=true;run.gold=effect.gold;apply(effect);if(effect.item){run.inventory.push(effect.item);run.equipmentRolls[effect.item]=effect.roll;}options.replaceChildren();story.textContent=`${choice.detail}${effect.itemName?`：${effect.itemName}`:'。'}`;const next=doc.createElement('button');next.textContent='继续前进';next.addEventListener('click',()=>{dialog.close();leave();},{once:true});options.append(next);});
  }dialog.showModal();
 }};
}
