import {createRunEventUI,eventForNode} from './run-events.js';
import {equipmentShape,fillEquipmentRewardCard} from './equipment-reward-view.js';
import {renderEquipmentText} from './equipment-text.js';
import {resolveEquipment,equipmentDescription} from './equipment-rolls.js';
import {RunProgress,MAP_LAYOUT,NODE_LABELS,SHOP_CATEGORIES,EXPEDITION_RULES} from './run-map.js';
import {RARITIES,equipmentIconUrl} from './equipment.js';
import {runMapIcon} from './run-map-icons.js';

const SHOP_SERVICES=[
 {
  action:'hinge',label:'灵巧',
  effect:'为一件装备添加一个拐点。装配时可以绕拐点转动部分格子，改变装备的占地形状。',
  diagram:'<path d="M4 18h36v12H4zM16 18v12m12-12v12M78 6h12v12h12v12H78zM78 18h12v12"/><path class="service-mark" d="m18 20 8 8m0-8-8 8m62 0 8 8m0-8-8 8"/>',
 },
 {
  action:'trim',label:'精简',
  effect:'从一件装备上移除一个格子，腾出装配台空间。拐点无法移除，剩余格子须保持连通，角相接也算连通。',
  diagram:'<path d="M10 6h24v24H10zM22 6v24M10 18h24M66 6h12v12h12v12H66zM66 18h12v12"/><rect class="service-removed" x="22" y="6" width="12" height="12"/><path class="service-mark" d="m24 8 8 8m0-8-8 8"/>',
 },
];
const MAP_PREVIEW_STATES=new Set(['event','rest','shop','reward','startingReward']);
export function createRunUI(doc,{eventState=()=>({}),applyEvent=()=>{},onNew=()=>{},onMap=()=>{},prepare=()=>{},startBattle=()=>{},enterRest=()=>{},award=()=>{},openInventory=()=>{},openSettings=()=>{},openArtisan=()=>false,shopWorkshop,onExit=()=>{},saveStore,getAssembly=()=>({}),onSaveError=()=>{}}={}){
 const screen=doc.getElementById?.('run-screen');if(!screen)return null;
 const canvas=doc.getElementById('run-map-canvas'),scroll=doc.getElementById('run-map-scroll'),result=doc.getElementById('run-result');let run=null;
 const toolbar=doc.getElementById('run-toolbar'),toolbarHome=toolbar.parentElement;
 const floorLabel=doc.getElementById('run-floor'),goldLabel=doc.getElementById('run-gold'),seedLabel=doc.getElementById('run-seed');
 const mapButton=doc.getElementById('run-view-map'),inventoryButton=doc.getElementById('run-view-inventory');
 const restScreen=doc.getElementById('rest-screen');
 const mapPreview=doc.createElement('dialog');mapPreview.className='run-map-preview';
 mapPreview.setAttribute('aria-label','查看地图');
 screen.after(mapPreview);
 const plansUI=doc.getElementById('run-plans');
 const loot=doc.getElementById('loot-dialog'),choices=doc.getElementById('loot-choices'),confirm=doc.getElementById('loot-confirm');let selectedReward=null;
 let practiceRun=false,battleEntryPlayer;
 function saveProgress(){
  if(!run||practiceRun||!saveStore)return true;
  if(['lost','won'].includes(run.status))return saveStore.clear();
  const savedRun=run.snapshot();
  if(run.status==='battle'){
   savedRun.status='preparing';
   if(run.selected.type==='monster')savedRun.ordinaryBattles--;
   savedRun.lastOrdinary=battleEntryPlayer.lastOrdinary;
  }
  const player=run.status==='battle'?battleEntryPlayer.state:eventState();
  return saveStore.save({run:savedRun,player,assembly:getAssembly(),rewardId:selectedReward?.id??null});
 }
 function checkpoint(){if(!saveProgress())onSaveError();}
 confirm?.addEventListener('click',()=>{
  if(!selectedReward||!run)return;
  const {id,item,roll,upgrade}=selectedReward;
  if(!run.claimReward(id))return;
  selectedReward=null;confirm.disabled=true;award(item,roll,upgrade);loot.close();
  if(run.status==='map')map();
  else {checkpoint();showResult();}
 });
 const eventUI=createRunEventUI(doc,{state:eventState,apply:applyEvent,award,mountToolbar,updateToolbar,saveProgress:checkpoint});
 const shop=doc.createElement('dialog');shop.className='run-room-dialog';doc.body.append(shop);
 const shopScroll=doc.createElement('div'),shopPanel=doc.createElement('div');
 shopScroll.className='run-room-scroll';shopPanel.className='run-shop';
 shopScroll.append(shopPanel);shop.append(shopScroll);
 function showShop(){
  shopPanel.replaceChildren();
  const header=doc.createElement('header');header.className='run-shop-header';
  const heading=doc.createElement('h2');heading.id='run-shop-title';heading.textContent='商店';
  const {voucher}=run.plans;
  const orders=doc.createElement('span');
  orders.textContent=[
   voucher&&`${voucher.label}工票 × ${voucher.usesLeft??1}`,
   ...run.roomNotices.filter(notice=>notice.startsWith('旅契履约')),
  ].filter(Boolean).join(' · ');
  const leave=doc.createElement('button');leave.type='button';leave.textContent='离开商店';
  leave.addEventListener('click',()=>{if(run.finishShop()){shop.close();map();}});
  header.append(heading);
  if(orders.textContent)header.append(orders);
  header.append(leave);shopPanel.append(header);shop.setAttribute('aria-labelledby',heading.id);

  const grid=doc.createElement('div');grid.className='run-shop-grid';
  const stock=run.shopStock.map(({id,roll,price})=>({item:resolveEquipment(id,roll),roll,price}));
  for(const [slot,label] of SHOP_CATEGORIES){
   const shelf=doc.createElement('section');shelf.className=`run-shop-shelf shop-${slot}`;
   const title=doc.createElement('h3');title.textContent=label;shelf.append(title);grid.append(shelf);
   const offers=stock.filter(({item})=>item.slot===slot);
   if(!offers.length){
    const empty=doc.createElement('p');empty.className='run-shop-empty';empty.textContent='暂无商品';shelf.append(empty);
   }
   for(const {item,roll,price} of offers){
    const row=doc.createElement('article'),details=doc.createElement('div'),image=doc.createElement('img');
    const name=doc.createElement('strong'),description=doc.createElement('p'),grade=doc.createElement('small');
    const actions=doc.createElement('div'),buy=doc.createElement('button');
    row.className='run-shop-offer';row.setAttribute('data-rarity',item.rarity);
    image.src=equipmentIconUrl(item.icon);image.alt='';
    name.textContent=item.name;grade.textContent=RARITIES[item.rarity].label;
    renderEquipmentText(doc,description,equipmentDescription(item));
    details.append(name,grade);
    row.append(image,details);
    if(slot==='skill'){
     const effects=doc.createElement('details'),label=doc.createElement('summary');
     effects.className='shop-skill-effects';effects.open=true;
     label.textContent='技能效果';
     effects.append(label,description);row.append(effects);
    }else details.append(description);
    actions.className='run-shop-offer-actions';
    buy.type='button';const sold=run.inventory.includes(item.id);
    buy.textContent=sold?'已购买':`购买 · ${price} 金币`;buy.disabled=sold||price>run.gold;
    buy.addEventListener('click',()=>{if(run.buy(item.id)){award(item,roll);showShop();}});
    actions.append(equipmentShape(doc,item),buy);
    row.append(actions);shelf.append(row);
   }
  }
  const services=doc.createElement('section');services.className='run-shop-shelf shop-services';
  const title=doc.createElement('h3'),serviceGrid=doc.createElement('div');
  title.textContent='改装服务';serviceGrid.className='shop-service-grid';
  services.append(title,serviceGrid);grid.append(services);
  for(const {action,label,effect,diagram} of SHOP_SERVICES){
   const card=doc.createElement('div'),service=doc.createElement('button'),info=doc.createElement('button');
   const tip=doc.createElement('span');
   card.className='shop-service';
   tip.className='shop-service-tip';tip.id=`shop-service-tip-${action}`;
   tip.setAttribute('role','tooltip');tip.textContent=effect;
   info.type='button';info.className='shop-service-info';info.textContent='?';
   info.setAttribute('aria-label',`查看${label}效果`);info.setAttribute('aria-describedby',tip.id);
   info.addEventListener('click',()=>info.focus());
   service.type='button';service.className='shop-service-action';
   service.setAttribute('aria-describedby',tip.id);
   const price=run.shopServicePrice(action);
   service.innerHTML=`<strong>${label}</strong><svg viewBox="0 0 106 36" aria-hidden="true">${diagram}<path class="service-arrow" d="M47 18h12m-4-4 4 4-4 4"/></svg><span>${price===0?'使用工票':`${price} 金币`}</span>`;
   service.disabled=!run.canBuyService(action)||!shopWorkshop?.canOpen(action);
   service.addEventListener('click',()=>{
    if(run.canBuyService(action))shopWorkshop?.open({action,done:()=>{run.payForService(action);showShop();}});
   });
   card.append(service,info,tip);serviceGrid.append(card);
  }
  shopPanel.append(grid);mountToolbar(shop);if(!shop.open)shop.showModal();checkpoint();
 }
 shop.addEventListener('cancel',event=>event.preventDefault());
 function showResult(){
  mountToolbar(toolbarHome);
  doc.getElementById('run-result-title').textContent=run.status==='won'?'远征完成':run.status==='lost'?'远征失败':`战斗胜利 · +${run.lastGoldReward} 金币`;
  doc.getElementById('run-result-next').textContent=run.status==='victory'?'下一层':'返回主菜单';result.showModal();
 }
 function showLoot(rewardId){
  selectedReward=null;if(confirm)confirm.disabled=true;choices.replaceChildren();
  const rewardStatus=run.status;
  doc.getElementById('loot-title').textContent=rewardStatus==='startingReward'?'选择开局装备':`选择战利品 · +${run.lastGoldReward} 金币`;
  for(const id of run.lootChoices){
   const roll={...run.lootRolls[id]},upgrade=run.lootUpgrades[id],item=resolveEquipment(id,roll,upgrade),button=doc.createElement('button');
   button.type='button';fillEquipmentRewardCard(doc,button,item);
   const selected=id===rewardId;
   if(selected){selectedReward={id,item,roll,upgrade};confirm.disabled=false;button.classList.add('selected');}
   button.setAttribute('aria-pressed',String(selected));button.addEventListener('click',()=>{if(run?.status!==rewardStatus)return;selectedReward={id,item,roll,upgrade};for(const card of choices.children){card.classList.toggle('selected',card===button);card.setAttribute('aria-pressed',String(card===button));}if(confirm)confirm.disabled=false;});choices.append(button);
  }
  mountToolbar(loot);loot.showModal();
 }
 function render(){
  const reachable=new Set(run.available().map(n=>n.id)),visited=new Set(run.path);
  const current=run.selected??run.map.nodes.find(node=>node.id===run.path.at(-1));
  const previewSurvey=run.status==='event'&&!run.eventResult&&!run.plans.guide&&eventForNode(current).id==='survey';
  const route=previewSurvey?[current.id,...run.surveyRoute(current)]:run.guidedRoute;
  const shownRoute=!run.selected||route.includes(run.selected.id)?route:[];
  const markedEdges=new Map(shownRoute.slice(0,-1).map((id,i)=>[id,shownRoute[i+1]]));
  const {hunt,rest,voucher,bond,blessing,cargo}=run.plans;
  const planText=[
   markedEdges.size&&`${previewSurvey?'巡山路线预览':'巡山路线'} · ${markedEdges.size} 步 · ${EXPEDITION_RULES.guideGold} 金币`,
   voucher&&`下家商店 · ${voucher.label}工票 × ${voucher.usesLeft??1}`,
   bond&&`旅契 · 剩 ${bond.remaining} 步 · ${bond.qualified?'已达成':NODE_LABELS[bond.type]}`,
   hunt&&(hunt.failed?'猎令 · 已失败':hunt.remaining===0?`猎令 · 首领最大生命 −${Math.round((1-(hunt.bossHealthFactor??EXPEDITION_RULES.huntBossHealthFactor))*100)}%`:`猎令 · 还需无伤完成 ${hunt.remaining} 场${NODE_LABELS[hunt.type]}`),
   blessing&&`祝祷 · 下场${NODE_LABELS[blessing.type]}开场 +${blessing.energy} 能量`,
   run.cachePending&&'荆棘锁 · 下一场普通战斗的敌人更强，至少一个紫色或金色战利品',
   cargo&&'渡夫货物 · 下一场普通战斗只有一个战利品候选',
   rest&&`下个休息处 · ${rest.action==='forge'?'锻台':'药箱'}`,
   ...run.roomNotices,
  ].filter(Boolean);
  if(plansUI){
   plansUI.replaceChildren(...planText.map(label=>{const tag=doc.createElement('span');tag.textContent=label;return tag;}));
   plansUI.hidden=planText.length===0;
  }
  const currentLayer=current?.layer??run.layer;
  const nodesById=new Map(run.map.nodes.map(node=>[node.id,node]));
  const pending=current?[current]:run.map.rows[run.layer].slice();
  const possible=new Set(pending.map(node=>node.id));
  for(const node of pending)for(const id of node.next){
   if(possible.has(id))continue;
   possible.add(id);pending.push(nodesById.get(id));
  }
  let paths='';
  for(const node of run.map.nodes)for(const id of node.next){
   const next=nodesById.get(id),taken=visited.has(node.id)&&(visited.has(id)||id===current?.id);
   const marked=markedEdges.get(node.id)===id;
   paths+=`<path class="${taken?'taken':marked?'guided':''}" d="M${node.x} ${node.y} L${next.x} ${next.y}"/>`;
  }
  canvas.style.width=`${MAP_LAYOUT.width}px`;
  canvas.style.height=`${run.map.height}px`;
  const cutouts=run.map.nodes.map(node=>`<circle class="run-path-cutout ${node.type}" cx="${node.x}" cy="${node.y}"/>`).join('');
  canvas.innerHTML=`<svg class="run-paths" viewBox="0 0 ${MAP_LAYOUT.width} ${run.map.height}" preserveAspectRatio="none" stroke-dasharray="${MAP_LAYOUT.dashLength} ${MAP_LAYOUT.dashGap}" aria-hidden="true">
   <defs><mask id="run-path-mask" maskUnits="userSpaceOnUse"><rect width="${MAP_LAYOUT.width}" height="${run.map.height}" fill="white" stroke="none"/>${cutouts}</mask></defs>
   <g mask="url(#run-path-mask)">${paths}</g>
  </svg>`;
  for(const node of run.map.nodes){const label=NODE_LABELS[node.type],button=doc.createElement('button');button.type='button';button.className=`run-node ${node.type}${visited.has(node.id)?' cleared':''}${reachable.has(node.id)?' available':''}`;button.classList.toggle('past',node.layer<currentLayer);button.style.left=`${node.x/MAP_LAYOUT.width*100}%`;button.style.top=`${node.y}px`;button.disabled=!reachable.has(node.id);button.setAttribute('aria-label',`第${node.layer+1}层 ${label}`);button.innerHTML=`${runMapIcon(node)}<span>${label}</span>`;
   if(node===current){button.classList.add('room-current');button.setAttribute('aria-current','location');}
   button.classList.toggle('unreachable',!possible.has(node.id)&&!visited.has(node.id));
   button.addEventListener('click',()=>{
    const leavingShop=run.status==='shop';
    if(!run.select(node.id))return;
    if(leavingShop){closeMapPreview(false);shopWorkshop?.close();shop.close();mountToolbar(screen);}
    render();centerMap();enterNode(node);
   });canvas.append(button);
  }
  updateToolbar();
 }
 function enterNode(node){
    if(node.type==='shop'){if(run.status==='shop'||run.beginShop())showShop();return;}
    if(node.type==='event'){
     if(run.status!=='event')run.beginEvent();
     checkpoint();screen.hidden=true;eventUI.open(node,run,()=>{if(run?.finishEvent())map();});return;
    }
    if(node.type==='rest'){
     if(run.status!=='rest')run.beginRest();
     checkpoint();screen.hidden=true;
     enterRest(()=>{if(run?.finishRest())map();},{
      order:run.plans.rest?.action,refill:run.plans.rest?.refill??false,
      potionBonus:run.plans.rest?.action==='restock'&&!run.plans.rest.refill?EXPEDITION_RULES.restBonusPotions:0,
      actions:run.restActions,saveProgress:actions=>{run.restActions=actions;checkpoint();},
     });
     mountToolbar(restScreen);
     return;
    }
    checkpoint();
    prepare(node,()=>{
     const entry={state:eventState(),lastOrdinary:run.lastOrdinary};
     if(!run.begin())return;
     battleEntryPlayer=entry;
     checkpoint();screen.hidden=true;mountToolbar(toolbarHome);startBattle(node,run.battleStart());
    },()=>{run.cancel();render();checkpoint();});
 }
 function mountToolbar(host){
  if(toolbar.parentElement!==host)host.prepend(toolbar);
  updateToolbar();
 }
 function updateToolbar(){
  toolbar.hidden=!run||run.status==='battle';
  if(!run)return;
  const layer=run.selected?.layer??run.layer;
  floorLabel.textContent=`第 ${Math.min(run.map.rows.length,layer+1)} / ${run.map.rows.length} 层`;
  goldLabel.textContent=`${run.gold} 金币`;
  seedLabel.textContent=run.map.seed;
  const choosingLoot=run.status==='reward'||run.status==='startingReward';
  mapButton.textContent=mapPreview.open?(choosingLoot?'返回战利品':'返回房间'):'查看地图';
  mapButton.setAttribute('aria-expanded',String(mapPreview.open));
  mapButton.disabled=!mapPreview.open&&run.status!=='map'&&!MAP_PREVIEW_STATES.has(run.status);
  inventoryButton.disabled=run.status==='battle';
 }
 function map({save=true}={}){
  closeMapPreview(false);
  screen.hidden=false;mountToolbar(screen);onMap();render();centerMap();if(save)checkpoint();
 }
 function centerMap(){
  const row=run.map.rows[Math.min(run.layer,run.map.rows.length-1)];
  const center=run.selected?.y??row.reduce((sum,node)=>sum+node.y,0)/row.length;
  scroll.scrollTop=Math.max(0,center-scroll.clientHeight/2);
  const reachable=run.available();
  const focus=run.selected?[run.selected]:reachable.length?reachable:row;
  const centerX=focus.reduce((sum,node)=>sum+node.x,0)/focus.length;
  scroll.scrollLeft=Math.max(0,centerX-scroll.clientWidth/2);
 }
 let previewOrigin;
 function viewMap(){
  if(mapPreview.open){closeMapPreview();return;}
  if(previewOrigin)closeMapPreview(false);
  if(run?.status==='map'){centerMap();return;}
  if(!MAP_PREVIEW_STATES.has(run?.status))return;
  previewOrigin={host:toolbar.parentElement,hidden:screen.hidden};
  mapPreview.append(screen);
  screen.hidden=false;
  mapPreview.showModal();
  mountToolbar(screen);render();centerMap();mapButton.focus();
 }
 function closeMapPreview(restoreFocus=true){
  if(!previewOrigin)return;
  const {host,hidden}=previewOrigin;
  previewOrigin=null;
  if(mapPreview.open)mapPreview.close();
  screen.hidden=hidden;
  mapPreview.before(screen);
  mountToolbar(host);
  if(restoreFocus)mapButton.focus();
 }
 const api={jump({type,encounter,eventIndex}){
  api.abandon();practiceRun=true;run=new RunProgress();onNew(null,run);
  const node=run.map.nodes.find(room=>room.type===type);
  run.layer=node.layer;run.select(node.id);
  if(encounter!==undefined)node.encounter=encounter;
  if(eventIndex!==undefined)node.debugEventIndex=eventIndex;
  map();enterNode(node);
 },get run(){return run;},get opened(){return !screen.hidden;},
 start(seed,setup){
  api.abandon();run=new RunProgress(seed,setup);onNew(null,run);map();
  if(run.status==='startingReward'){screen.hidden=true;showLoot();}
 },
 resume(save){
  const restored=RunProgress.restore(save.run);
  api.abandon();run=restored;onNew(save,run);map({save:false});
  if(['reward','startingReward'].includes(run.status)){screen.hidden=true;showLoot(save.rewardId);}
  else if(run.status==='victory'){screen.hidden=true;showResult();}
  else if(run.status!=='map')enterNode(run.selected);
 },
 save:saveProgress,
 refreshEvent(){eventUI.refresh();},
 hide(){closeMapPreview(false);screen.hidden=true;},
 abandon(){closeMapPreview(false);eventUI.close();shopWorkshop?.close();shop.close();run=null;practiceRun=false;battleEntryPlayer=null;selectedReward=null;mountToolbar(toolbarHome);screen.hidden=true;result.close();loot?.close();},
 exit(){api.abandon();onExit();},
 tick(battle){
  if(run?.status!=='battle')return;
  if(battle.player.health>0&&(!battle.allDefeated||battle.backThrow))return;
  const won=battle.player.health>0;
  run.finish(won,battle.enemies?.length??1,{healthDamaged:battle.tookEnemyHealthDamage});checkpoint();onMap();
  updateToolbar();
  const showRewards=()=>{if(!run)return;checkpoint();if(run.status==='reward')showLoot();else showResult();};
  if(won&&battle.passives?.artisan&&!battle.tookEnemyHealthDamage&&openArtisan(showRewards))return;
  showRewards();
 }};
 mapButton.addEventListener('click',viewMap);
 inventoryButton.addEventListener('click',openInventory);
 doc.getElementById('run-open-settings').addEventListener('click',openSettings);
 mapPreview.addEventListener('cancel',event=>{event.preventDefault();closeMapPreview();});
 mapPreview.addEventListener('close',()=>{if(!mapPreview.open)closeMapPreview();});
 doc.getElementById('run-result-next').addEventListener('click',()=>{result.close();if(run?.advance())map();else api.exit();});
 result.addEventListener('cancel',event=>event.preventDefault());loot?.addEventListener('cancel',event=>event.preventDefault());return api;
}
