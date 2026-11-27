import {ASSEMBLY_BOARDS} from './assembly-board.js';
import {EQUIPMENT} from './equipment-catalog.js';
import {equipmentIconUrl} from './equipment.js';
import {DAMAGE_ELEMENTS,RESISTANCE_LABELS} from './combat-damage.js';
import {PROFESSIONS,professionFor} from './professions.js';
import {deriveSeed,newMapSeed,seededRandom} from './run-random.js';

export const RUN_BOON_POOLS=Object.freeze([
 [
  {id:'funds',name:'远行盘缠',description:'开局获得 70 金币',gold:70},
  {id:'vitality',name:'强健体魄',description:'本局最大生命 +20，以满生命出发',health:20},
 ],
 [
  {id:'spoils',name:'拾遗赠礼',description:'按小怪掉率抽取两件装备或技能，选一件带走',reward:{}},
  {id:'technique',name:'秘技挑选',description:'按小怪掉率抽取两件技能，选一件带走',reward:{slot:'skill'}},
 ],
 [
  {id:'tempered',name:'磨刃契约',description:'失去 1 瓶血瓶，前两场普通战斗的战利品升一级',potionCost:1,upgradedBattles:2},
  {id:'fortitude',name:'血换体魄',description:'失去 2 瓶血瓶，本局最大生命 +35，以满生命出发',potionCost:2,health:35},
 ],
]);
const RUN_BOONS=RUN_BOON_POOLS.flat();
export const runBoon=id=>id==='workbench'?{id,boardLevel:1}:RUN_BOONS.find(boon=>boon.id===id);
export function rollRunBoons(seed){
 return RUN_BOON_POOLS.map((pool,index)=>{
  const random=seededRandom(deriveSeed(seed,`starting-boon:${index}`));
  return pool[Math.floor(random()*pool.length)];
 });
}
const classOrder=['metal','wood','water','rage','earth','fistwind','rain','thunder','electric'];
const classRank=new Map(classOrder.map((id,index)=>[id,index]));
const classSummaries={
 metal:'震伤并眩晕周围的敌人。金币越多，伤害越高，眩晕越久。',
 wood:'用藤蔓困住敌人，拖慢它的出招，吸取它的生命来治疗自己。',
 water:'用水流护身，持续获得护盾、恢复绷住，并免疫火伤。',
 rage:'狂暴时获得霸体，出拳更快，打中敌人还能回血。',
 earth:'变成无敌的岩刺球，撞到敌人会弹开，滚得越远撞得越重。',
 fistwind:'风场反弹可格挡的弹体，出拳推掌会引出劲风伤敌。',
 rain:'唤来暴雨灭火、伤敌并减速。单位在雨中更怕电击。',
 thunder:'对标记的敌人连续落雷，打断它的动作并使它眩晕。',
 electric:'边走边放出电链，让敌人受伤减速，连得越久伤害越高。',
};
export const runClasses=()=>EQUIPMENT.filter(item=>item.slot==='ultimate'&&ASSEMBLY_BOARDS.has(item.id)&&professionFor(item.id))
 .sort((a,b)=>(classRank.get(a.id)??classRank.size)-(classRank.get(b.id)??classRank.size));

export function createRunStartUI(doc,{start,back}){
 const get=id=>doc.getElementById(id);
 const classScreen=get('run-class-screen'),boonScreen=get('run-boon-screen');
 if(!classScreen||!boonScreen)return null;
 const roster=get('run-class-roster'),scroll=get('run-class-scroll'),detail=get('run-class-detail');
 const boonList=get('run-boon-options'),confirm=get('run-boon-confirm');
 let seed,ultimate,boon,pendingClass;

 function updateScroll(){
  const max=Math.max(0,roster.scrollWidth-roster.clientWidth);
  scroll.max=String(max);
  scroll.value=String(roster.scrollLeft);
  scroll.disabled=max===0;
 }
 roster.addEventListener('scroll',updateScroll);
 scroll.addEventListener('input',()=>{roster.scrollLeft=Number(scroll.value);});
 const Resize=doc.defaultView?.ResizeObserver;
 if(Resize)new Resize(updateScroll).observe(roster);

 function renderChoices(container,options,makeCard,onSelect){
  container.replaceChildren();
  const buttons=[];
  for(const option of options){
   const button=doc.createElement('button');
   button.type='button';
   button.setAttribute('aria-pressed','false');
   button.addEventListener('click',()=>{
    if(container===boonList)for(const choice of buttons)choice.setAttribute('aria-pressed',String(choice===button));
    onSelect(option);
   });
   buttons.push(button);
   container.append(makeCard(option,button));
  }
 }
 function classCard(option,button){
  const card=doc.createElement('article'),name=doc.createElement('h3');
  const image=doc.createElement('img'),description=doc.createElement('p');
  card.className='run-class-card';
  card.setAttribute('data-class',option.id);
  if(option.accent)card.style?.setProperty?.('--class-accent',option.accent);
  name.textContent=option.profession??option.name;
  button.removeAttribute('aria-pressed');
  button.setAttribute('aria-haspopup','dialog');
  button.setAttribute('aria-label',`查看${name.textContent}`);
  image.src=`/images/run-start/${option.id}.png`;
  image.decoding='async';
  image.alt='';
  image.addEventListener('error',()=>{image.src=equipmentIconUrl(option.icon);},{once:true});
  button.append(image);
  const summary=classSummaries[option.id];
  description.textContent=`专属技能【${option.name}】${summary?`：${summary}`:''}`;
  card.append(name,button,description);
  return card;
 }
 function showDetail(option){
  const profile=professionFor(option.id);
  pendingClass=option.id;
  detail.style?.setProperty('--class-accent',option.accent??(option.id==='fistwind'?'#bcece2':'#f5ca78'));
  get('run-class-detail-title').textContent=option.profession;
  get('run-class-ultimate-icon').src=equipmentIconUrl(option.icon);
  get('run-class-ultimate-name').textContent=`专属技能【${option.name}】`;
  get('run-class-ultimate-description').textContent=option.description;
  get('run-class-element').textContent=`人物属性：${DAMAGE_ELEMENTS[profile.orbElement]}`;
  const portrait=get('run-class-detail-portrait');
  portrait.onerror=()=>{portrait.onerror=null;portrait.src=equipmentIconUrl(option.icon);};
  portrait.src=`/images/run-start/${option.id}.png`;
  const list=get('run-class-stat-list');
  list.replaceChildren();
  function addStat(label,value,max,unit=''){
   const row=doc.createElement('div'),title=doc.createElement('dt'),body=doc.createElement('dd');
   const meter=doc.createElement('meter'),number=doc.createElement('span');
   title.textContent=label;
   meter.min=0;meter.max=max;meter.value=value;meter.setAttribute('aria-hidden','true');
   number.textContent=`${Math.floor(value)}${unit}`;
   body.append(meter,number);row.append(title,body);list.append(row);
  }
  addStat('生命上限',profile.health,Math.max(125,...Object.values(PROFESSIONS).map(stats=>stats.health)));
  addStat('绷住上限',profile.pose,Math.max(75,...Object.values(PROFESSIONS).map(stats=>stats.pose)));
  for(const [key,label] of Object.entries(RESISTANCE_LABELS))
   addStat(label,profile.resistances[key],100,'%');
  if(!detail.open)detail.showModal();
 }

 function boonCard(option,button){
  const name=doc.createElement('strong'),description=doc.createElement('span');
  name.textContent=option.name;
  description.textContent=option.description;
  button.append(name,description);
  return button;
 }
 function showClasses(){
  boonScreen.hidden=true;
  classScreen.hidden=false;
  updateScroll();
  get('run-class-back').focus();
 }
 function leave(){
  classScreen.hidden=true;
  back();
 }
 get('run-class-back').addEventListener('click',leave);
 get('run-boon-back').addEventListener('click',showClasses);
 for(const [screen,goBack] of [[classScreen,leave],[boonScreen,showClasses]]){
  screen.addEventListener('keydown',event=>{
   if(event.key!=='Escape'||detail.open)return;
   event.preventDefault();
   goBack();
  });
 }
 get('run-class-detail-close').addEventListener('click',()=>detail.close());
 get('run-class-detail-confirm').addEventListener('click',()=>{
  if(classScreen.hidden||!detail.open||!pendingClass)return;
  ultimate=pendingClass;
  detail.close();
  classScreen.hidden=true;
  boonScreen.hidden=false;
  get('run-boon-back').focus();
 });
 confirm.addEventListener('click',()=>{
  if(boonScreen.hidden||!boon)return;
  boonScreen.hidden=true;
  start(seed,{ultimate,boon});
 });
 return {open(mapSeed){
  seed=mapSeed??newMapSeed();
  if(detail.open)detail.close();
  ultimate=boon=pendingClass=null;
  confirm.disabled=true;
  renderChoices(roster,runClasses(),classCard,showDetail);
  renderChoices(boonList,rollRunBoons(seed),boonCard,option=>{boon=option.id;confirm.disabled=false;});
  roster.scrollLeft=0;
  showClasses();
 }};
}
