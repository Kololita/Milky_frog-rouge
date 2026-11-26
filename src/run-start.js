import {ASSEMBLY_BOARDS} from './assembly-board.js';
import {EQUIPMENT} from './equipment-catalog.js';
import {equipmentIconUrl} from './equipment.js';
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
export const runClasses=()=>EQUIPMENT.filter(item=>item.slot==='ultimate'&&ASSEMBLY_BOARDS.has(item.id));

export function createRunStartUI(doc,{start,back}){
 const get=id=>doc.getElementById(id);
 const classScreen=get('run-class-screen'),boonScreen=get('run-boon-screen');
 if(!classScreen||!boonScreen)return null;
 const roster=get('run-class-roster'),scroll=get('run-class-scroll'),next=get('run-class-next');
 const boonList=get('run-boon-options'),confirm=get('run-boon-confirm');
 let seed,ultimate,boon;

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
    for(const choice of buttons)choice.setAttribute('aria-pressed',String(choice===button));
    onSelect(option.id);
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
  name.textContent=option.profession??option.name;
  button.setAttribute('aria-label',`选择${name.textContent}`);
  image.src=`/images/run-start/${option.id}.png`;
  image.alt='';
  image.addEventListener('error',()=>{image.src=equipmentIconUrl(option.icon);},{once:true});
  button.append(image);
  description.textContent=`专属技能【${option.name}】：${option.description}`;
  card.append(name,button,description);
  return card;
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
   if(event.key!=='Escape')return;
   event.preventDefault();
   goBack();
  });
 }
 next.addEventListener('click',()=>{
  if(classScreen.hidden||!ultimate)return;
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
  ultimate=boon=null;
  next.disabled=confirm.disabled=true;
  renderChoices(roster,runClasses(),classCard,id=>{ultimate=id;next.disabled=false;});
  renderChoices(boonList,rollRunBoons(seed),boonCard,id=>{boon=id;confirm.disabled=false;});
  roster.scrollLeft=0;
  showClasses();
 }};
}
