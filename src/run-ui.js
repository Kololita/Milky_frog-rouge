import {pivotCells} from './equipment-bends.js';
import {createRunEventUI} from './run-events.js';
import {renderEquipmentText} from './equipment-text.js';
import {resolveEquipment,equipmentDescription} from './equipment-rolls.js';
import {shapeCells,shapeSize} from './equipment-shapes.js';
import {RunProgress,MAP_LAYOUT,NODE_LABELS} from './run-map.js';
import {RARITIES,equipmentIconUrl} from './equipment.js';
const icons={event:'<path d="M-11-15Q-11-28 3-26Q22-24 15-7L1 5V12M1 22V26"/>',rest:'<path d="M-23 4H23V13H-23ZM-17 13V26M17 13V26M-16 4V-17H16V4M-28-25L0-32L28-25"/>',monster:'<path d="M-17-12L-22-23L-8-17Q0-22 8-17L22-23L17-12Q27 16 10 22L-10 22Q-27 16-17-12Z"/><path d="M-12-2L-5 2M12-2L5 2M-8 13L0 9L8 13"/>',elite:'<path d="M0-28L9-17L23-17L20-4L28 8L15 16L9 29L-5 23L-20 25L-20 10L-29 0L-17-9L-13-23Z"/><path d="M-10-4L-4 0M10-4L4 0M-8 12L8 12"/>',boss:'<path d="M-28-12L-14-3L0-26L14-3L28-12L21 20L-21 20Z"/><path d="M-14 9L14 9"/>'};
export function createRunUI(doc,{eventState=()=>({}),applyEvent=()=>{},onNew=()=>{},onMap=()=>{},prepare=()=>{},startBattle=()=>{},enterRest=()=>{},award=()=>{},openInventory=()=>{},openArtisan=()=>false,onExit=()=>{}}={}){
 const screen=doc.getElementById?.('run-screen');if(!screen)return null;
 const canvas=doc.getElementById('run-map-canvas'),scroll=doc.getElementById('run-map-scroll'),result=doc.getElementById('run-result');let run=null;
 const loot=doc.getElementById('loot-dialog'),choices=doc.getElementById('loot-choices'),confirm=doc.getElementById('loot-confirm');let selectedReward=null;
 confirm?.addEventListener('click',()=>{if(!selectedReward||run?.status!=='reward')return;const {id,item,roll}=selectedReward;if(!run.claimReward(id))return;selectedReward=null;confirm.disabled=true;award(item,roll);loot.close();showResult();});
 doc.getElementById('loot-inventory')?.addEventListener('click',()=>{if(run?.status==='reward')openInventory();});
 const eventUI=createRunEventUI(doc,{state:eventState,apply:applyEvent});
 function showResult(){
  doc.getElementById('run-result-title').textContent=run.status==='won'?'远征完成':run.status==='lost'?'远征失败':'战斗胜利';
  doc.getElementById('run-result-next').textContent=run.status==='victory'?'下一层':'返回主菜单';result.showModal();
 }
 function showLoot(){
  selectedReward=null;if(confirm)confirm.disabled=true;choices.replaceChildren();for(const id of run.lootChoices){
   const roll={...run.lootRolls[id]},item=resolveEquipment(id,roll),button=doc.createElement('button');button.type='button';button.className='loot-choice';button.setAttribute('data-rarity',item.rarity);
   const image=doc.createElement('img'),name=doc.createElement('strong'),grade=doc.createElement('span'),description=doc.createElement('p');image.src=equipmentIconUrl(item.icon);image.alt=item.name;name.textContent=item.name;grade.textContent=RARITIES[item.rarity]?.label??'大招';renderEquipmentText(doc,description,equipmentDescription(item));
   const preview=doc.createElement('span'),cells=item.shape?shapeCells(item.shape):[],size=cells.length?shapeSize(cells):{width:0,height:0};preview.className='equipment-shape-preview loot-shape';preview.style.gridTemplateColumns=`repeat(${size.width},12px)`;preview.style.gridTemplateRows=`repeat(${size.height},12px)`;for(const [x,y]of cells){const cell=doc.createElement('i');if(pivotCells(item.shape).some(([px,py])=>px===x&&py===y))cell.className='is-bend';cell.style.gridColumn=String(x+1);cell.style.gridRow=String(y+1);preview.append(cell);}button.append(image,name,grade,description,preview);button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{if(run?.status!=='reward')return;selectedReward={id,item,roll};for(const card of choices.children){card.classList.toggle('selected',card===button);card.setAttribute('aria-pressed',String(card===button));}if(confirm)confirm.disabled=false;});choices.append(button);
  }
  loot.showModal();
 }
 function render(){
  const reachable=new Set(run.available().map(n=>n.id)),visited=new Set(run.path);
  let paths='';for(const node of run.map.nodes)for(const id of node.next){const next=run.map.nodes.find(n=>n.id===id);const taken=visited.has(node.id)&&visited.has(id);paths+=`<path class="${taken?'taken':''}" d="M${node.x} ${node.y} Q${(node.x+next.x)/2+15} ${(node.y+next.y)/2} ${next.x} ${next.y}"/>`;}
  canvas.style.height=`${run.map.height}px`;
  canvas.innerHTML=`<svg class="run-paths" viewBox="0 0 ${MAP_LAYOUT.width} ${run.map.height}" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`;
  for(const node of run.map.nodes){const label=NODE_LABELS[node.type],button=doc.createElement('button');button.type='button';button.className=`run-node ${node.type}${visited.has(node.id)?' cleared':''}${reachable.has(node.id)?' available':''}`;button.style.left=`${node.x/MAP_LAYOUT.width*100}%`;button.style.top=`${node.y}px`;button.disabled=!reachable.has(node.id);button.setAttribute('aria-label',`第${node.layer+1}层 ${label}`);button.innerHTML=`<svg viewBox="-36 -36 72 72" aria-hidden="true">${icons[node.type]}</svg><span>${label}</span>`;
   button.addEventListener('click',()=>{if(!run.select(node.id))return;
    enterNode(node);});canvas.append(button);
  }
  doc.getElementById('run-floor').textContent=`第 ${Math.min(run.map.rows.length,run.layer+1)} 层 / ${run.map.rows.length}`;
 }
 function enterNode(node){
    if(node.type==='event'){run.beginEvent();eventUI.open(node,run,()=>{if(run?.finishEvent())map();});return;}
    if(node.type==='rest'){run.beginRest();screen.hidden=true;enterRest(()=>{if(run?.finishRest())map();});return;}
    prepare(node,()=>{if(!run.begin())return;screen.hidden=true;startBattle(node);},()=>{run.cancel();render();});
 }
 function map(){screen.hidden=false;onMap();render();scroll.scrollTop=Math.max(0,MAP_LAYOUT.padding+(MAP_LAYOUT.layers-1-run.layer)*MAP_LAYOUT.rowGap-scroll.clientHeight/2);}
 const api={jump({type,encounter=null,eventIndex=0}){api.abandon();run=new RunProgress();onNew();const node=run.map.rows[0][0];Object.assign(node,{type,encounter,encounterRoll:eventIndex});run.selected=node;run.status='preparing';map();enterNode(node);},get run(){return run;},get opened(){return !screen.hidden;},start(seed=Date.now()){run=new RunProgress(seed);onNew();map();},hide(){screen.hidden=true;},abandon(){eventUI.close();run=null;screen.hidden=true;result.close();loot?.close();},exit(){eventUI.close();run=null;screen.hidden=true;result.close();loot?.close();onExit();},tick(battle){
  if(run?.status!=='battle')return;
  if(battle.player.health>0&&(!battle.allDefeated||battle.backThrow))return;
  const won=battle.player.health>0;run.finish(won);onMap();
  const showRewards=()=>{if(run?.status==='reward')showLoot();else if(run)showResult();};
  if(won&&battle.passives?.artisan&&!battle.tookEnemyHealthDamage&&openArtisan(showRewards))return;
  showRewards();
 }};
 doc.getElementById('run-exit').addEventListener('click',()=>api.exit());
 doc.getElementById('run-result-next').addEventListener('click',()=>{result.close();if(run?.advance())map();else api.exit();});
 result.addEventListener('cancel',event=>event.preventDefault());loot?.addEventListener('cancel',event=>event.preventDefault());return api;
}
