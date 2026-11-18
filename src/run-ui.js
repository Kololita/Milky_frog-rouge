import {pivotCells} from './equipment-bends.js';
import {createRunEventUI} from './run-events.js';
import {renderEquipmentText} from './equipment-text.js';
import {resolveEquipment,equipmentDescription} from './equipment-rolls.js';
import {shapeCells,shapeSize} from './equipment-shapes.js';
import {RunProgress,MAP_LAYOUT,NODE_LABELS,SHOP_CATEGORIES,SHOP_SERVICE_PRICE} from './run-map.js';
import {RARITIES,equipmentIconUrl} from './equipment.js';
import {runMapIcon} from './run-map-icons.js';
export function createRunUI(doc,{eventState=()=>({}),applyEvent=()=>{},onNew=()=>{},onMap=()=>{},prepare=()=>{},startBattle=()=>{},enterRest=()=>{},award=()=>{},openInventory=()=>{},openArtisan=()=>false,shopWorkshop,onExit=()=>{}}={}){
 const screen=doc.getElementById?.('run-screen');if(!screen)return null;
 const canvas=doc.getElementById('run-map-canvas'),scroll=doc.getElementById('run-map-scroll'),result=doc.getElementById('run-result');let run=null;
 const seedLabel=doc.getElementById('run-seed');
 const showSeed=()=>{if(seedLabel){seedLabel.hidden=!run;seedLabel.textContent=run?.map.seed??'';}};
 const loot=doc.getElementById('loot-dialog'),choices=doc.getElementById('loot-choices'),confirm=doc.getElementById('loot-confirm');let selectedReward=null;
 confirm?.addEventListener('click',()=>{if(!selectedReward||run?.status!=='reward')return;const {id,item,roll}=selectedReward;if(!run.claimReward(id))return;selectedReward=null;confirm.disabled=true;award(item,roll);loot.close();showResult();});
 doc.getElementById('loot-inventory')?.addEventListener('click',()=>{if(run?.status==='reward')openInventory();});
 const eventUI=createRunEventUI(doc,{state:eventState,apply:applyEvent});
 const shop=doc.createElement('dialog');shop.className='run-shop';doc.body.append(shop);
 function equipmentShape(item,className){
  const preview=doc.createElement('span');
  preview.className=`equipment-shape-preview ${className}`;
  if(!item.shape)return preview;
  const cells=shapeCells(item.shape),size=shapeSize(cells),pivots=pivotCells(item.shape);
  preview.setAttribute('aria-label','装备占地形状');
  preview.style.gridTemplateColumns=`repeat(${size.width},12px)`;
  preview.style.gridTemplateRows=`repeat(${size.height},12px)`;
  for(const [x,y] of cells){
   const cell=doc.createElement('i');
   if(pivots.some(([px,py])=>px===x&&py===y))cell.className='is-bend';
   cell.style.gridColumn=String(x+1);cell.style.gridRow=String(y+1);preview.append(cell);
  }
  return preview;
 }
 function showShop(){
  shop.replaceChildren();
  const grid=doc.createElement('div');grid.className='run-shop-grid';
  const heading=doc.createElement('h2');heading.textContent=`商店 · ${run.gold} 金币`;shop.append(heading);
  for(const [slot,label] of SHOP_CATEGORIES){
   const shelf=doc.createElement('section');shelf.className=`run-shop-shelf shop-${slot}`;
   const title=doc.createElement('h3');title.textContent=label;shelf.append(title);grid.append(shelf);
   for(const offer of run.shopStock){
   const item=resolveEquipment(offer.id,offer.roll);
   if(item.slot!==slot)continue;
   const row=doc.createElement('div');
   const details=doc.createElement('div'),buy=doc.createElement('button'),image=doc.createElement('img');
   const name=doc.createElement('strong'),description=doc.createElement('p'),grade=doc.createElement('small');
   row.className='run-shop-offer';
   image.src=equipmentIconUrl(item.icon);image.alt='';
   name.textContent=item.name;grade.textContent=RARITIES[item.rarity].label;
   renderEquipmentText(doc,description,equipmentDescription(item));
   details.append(name,grade,description,equipmentShape(item,'run-shop-shape'));
   buy.type='button';const sold=run.inventory.includes(offer.id);
   buy.textContent=sold?'已购买':`购买 · ${offer.price} 金币`;buy.disabled=sold||offer.price>run.gold;
   buy.addEventListener('click',()=>{if(run.buy(offer.id)){award(item,offer.roll);showShop();}});
   row.append(image,details,buy);shelf.append(row);
  }
  }
  const services=doc.createElement('section');services.className='run-shop-shelf shop-services';
  const title=doc.createElement('h3');title.textContent='改装服务';services.append(title);grid.append(services);
  for(const [action,label] of [['hinge','灵巧'],['trim','精简']]){
   const service=doc.createElement('button');service.type='button';
   service.textContent=`${label} · ${SHOP_SERVICE_PRICE} 金币`;
   service.disabled=!run.canBuyService()||!shopWorkshop?.canOpen(action);
   service.addEventListener('click',()=>{
    if(run.canBuyService())shopWorkshop.open({action,done:()=>{run.payForService();showShop();}});
   });
   services.append(service);
  }
  shop.append(grid);
  const leave=doc.createElement('button');leave.type='button';leave.textContent='离开商店';
  leave.addEventListener('click',()=>{if(run.finishShop()){shop.close();map();}});
  shop.append(leave);if(!shop.open)shop.showModal();
 }
 shop.addEventListener('cancel',event=>event.preventDefault());
 function showResult(){
  doc.getElementById('run-result-title').textContent=run.status==='won'?'远征完成':run.status==='lost'?'远征失败':`战斗胜利 · ${run.gold} 金币`;
  doc.getElementById('run-result-next').textContent=run.status==='victory'?'下一层':'返回主菜单';result.showModal();
 }
 function showLoot(){
  selectedReward=null;if(confirm)confirm.disabled=true;choices.replaceChildren();doc.getElementById('loot-title').textContent=`选择战利品 · +${run.lastGoldReward} 金币`;for(const id of run.lootChoices){
   const roll={...run.lootRolls[id]},item=resolveEquipment(id,roll),button=doc.createElement('button');button.type='button';button.className='loot-choice';button.setAttribute('data-rarity',item.rarity);
   const image=doc.createElement('img'),name=doc.createElement('strong'),grade=doc.createElement('span'),description=doc.createElement('p');image.src=equipmentIconUrl(item.icon);image.alt=item.name;name.textContent=item.name;grade.textContent=RARITIES[item.rarity]?.label??'大招';renderEquipmentText(doc,description,equipmentDescription(item));
   button.append(image,name,grade,description,equipmentShape(item,'loot-shape'));button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{if(run?.status!=='reward')return;selectedReward={id,item,roll};for(const card of choices.children){card.classList.toggle('selected',card===button);card.setAttribute('aria-pressed',String(card===button));}if(confirm)confirm.disabled=false;});choices.append(button);
  }
  loot.showModal();
 }
 function render(){
  const reachable=new Set(run.available().map(n=>n.id)),visited=new Set(run.path);
  const currentLayer=run.selected?.layer??Math.max(0,run.layer-Number(run.path.length>0));
  const nodesById=new Map(run.map.nodes.map(node=>[node.id,node]));
  let paths='';
  for(const node of run.map.nodes)for(const id of node.next){
   const next=nodesById.get(id),taken=visited.has(node.id)&&visited.has(id);
   paths+=`<path class="${taken?'taken':''}" d="M${node.x} ${node.y} L${next.x} ${next.y}"/>`;
  }
  canvas.style.width=`${MAP_LAYOUT.width}px`;
  canvas.style.height=`${run.map.height}px`;
  canvas.innerHTML=`<svg class="run-paths" viewBox="0 0 ${MAP_LAYOUT.width} ${run.map.height}" preserveAspectRatio="none" stroke-dasharray="${MAP_LAYOUT.dashLength} ${MAP_LAYOUT.dashGap}" aria-hidden="true">${paths}</svg>`;
  for(const node of run.map.nodes){const label=NODE_LABELS[node.type],button=doc.createElement('button');button.type='button';button.className=`run-node ${node.type}${visited.has(node.id)?' cleared':''}${reachable.has(node.id)?' available':''}`;button.classList.toggle('past',node.layer<currentLayer);button.style.left=`${node.x/MAP_LAYOUT.width*100}%`;button.style.top=`${node.y}px`;button.disabled=!reachable.has(node.id);button.setAttribute('aria-label',`第${node.layer+1}层 ${label}`);button.innerHTML=`${runMapIcon(node)}<span>${label}</span>`;
   button.addEventListener('click',()=>{if(!run.select(node.id))return;
    enterNode(node);});canvas.append(button);
  }
  doc.getElementById('run-floor').textContent=`第 ${Math.min(run.map.rows.length,run.layer+1)} 层 / ${run.map.rows.length} · ${run.gold} 金币`;
 }
 function enterNode(node){
    if(node.type==='shop'){if(run.beginShop())showShop();return;}
    if(node.type==='event'){run.beginEvent();eventUI.open(node,run,()=>{if(run?.finishEvent())map();});return;}
    if(node.type==='rest'){run.beginRest();screen.hidden=true;enterRest(()=>{if(run?.finishRest())map();});return;}
    prepare(node,()=>{if(!run.begin())return;screen.hidden=true;startBattle(node);},()=>{run.cancel();render();});
 }
 function map(){
  showSeed();screen.hidden=false;onMap();render();
  const row=run.map.rows[Math.min(run.layer,run.map.rows.length-1)];
  const center=row.reduce((sum,node)=>sum+node.y,0)/row.length;
  scroll.scrollTop=Math.max(0,center-scroll.clientHeight/2);
  const reachable=run.available();
  const focus=run.selected?[run.selected]:reachable.length?reachable:row;
  const centerX=focus.reduce((sum,node)=>sum+node.x,0)/focus.length;
  scroll.scrollLeft=Math.max(0,centerX-scroll.clientWidth/2);
 }
 const api={jump({type,encounter,eventIndex}){
  api.abandon();run=new RunProgress();onNew();
  const node=run.map.nodes.find(room=>room.type===type);
  run.layer=node.layer;run.select(node.id);
  if(encounter!==undefined)node.encounter=encounter;
  if(eventIndex!==undefined)node.eventSeed=eventIndex;
  map();enterNode(node);
 },get run(){return run;},get opened(){return !screen.hidden;},start(seed){run=new RunProgress(seed);onNew();map();},hide(){screen.hidden=true;},abandon(){eventUI.close();shopWorkshop?.close();shop.close();run=null;showSeed();screen.hidden=true;result.close();loot?.close();},exit(){eventUI.close();shopWorkshop?.close();shop.close();run=null;showSeed();screen.hidden=true;result.close();loot?.close();onExit();},tick(battle){
  if(run?.status!=='battle')return;
  if(battle.player.health>0&&(!battle.allDefeated||battle.backThrow))return;
  const won=battle.player.health>0;run.finish(won,battle.enemies?.length??1);onMap();
  const showRewards=()=>{if(run?.status==='reward')showLoot();else if(run)showResult();};
  if(won&&battle.passives?.artisan&&!battle.tookEnemyHealthDamage&&openArtisan(showRewards))return;
  showRewards();
 }};
 doc.getElementById('run-exit').addEventListener('click',()=>api.exit());
 doc.getElementById('run-result-next').addEventListener('click',()=>{result.close();if(run?.advance())map();else api.exit();});
 result.addEventListener('cancel',event=>event.preventDefault());loot?.addEventListener('cancel',event=>event.preventDefault());return api;
}
