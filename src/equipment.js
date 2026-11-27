import {combineResistances,RESISTANCE_LABELS} from './combat-damage.js';
import {nearestAssemblySnap} from './assembly-snap.js';
import {pivotCells,equipmentAnchor} from './equipment-bends.js';
import {renderEquipmentText} from './equipment-text.js';
import {EMPTY_FORGE_PHYSICAL_PER_CELL,EQUIPMENT_PASSIVES,passiveLevels} from './equipment-passives.js';
import {EQUIPMENT,RARITIES,STARTING_LOADOUT,STARTING_ITEMS} from './equipment-catalog.js';
import {AssemblyLoadout,shapeCells,shapeSize,ASSEMBLY_BOARDS} from './assembly-board.js';
import {resolveEquipment,rollEquipment,validEquipmentRoll,equipmentDescription,formatEquipmentBonus} from './equipment-rolls.js';
export {EQUIPMENT,RARITIES};
export const EQUIPMENT_SLOTS={armor:'装甲',gloves:'拳套',charm:'护符',skill:'技能',ultimate:'大招'};
export function equipmentIconUrl(icon){
 if(icon==='longarm'||icon==='rage')return `/images/equipment/${icon}.png`;
 return `/images/equipment/illustrated/${icon}.png`;
}
export function normalizeEquipmentLoadout(loadout={}){
 // Old saves and direct combat tools may still supply category keys; the menu emits installed IDs.
 if(!Array.isArray(loadout.installed))return {...loadout};
 let skill=null;const installed=[...new Set(loadout.installed)].filter(id=>{const item=EQUIPMENT.find(item=>item.id===id&&item.slot!=='ultimate');if(!item)return false;if(item.slot==='skill'){if(skill)return false;skill=id;}return true;});
 const rolls=Object.fromEntries(installed.filter(id=>validEquipmentRoll(EQUIPMENT.find(i=>i.id===id),loadout.rolls?.[id])).map(id=>[id,{shapeId:loadout.rolls[id].shapeId}]));
 return {ultimate:loadout.ultimate,emptyCells:loadout.emptyCells,upgrades:loadout.upgrades??{},...(installed.length?{installed}:{}),...(skill?{skill}:{}),...(Object.keys(rolls).length?{rolls}:{})};
}
export function equipmentBonuses(value={}){
 const loadout=normalizeEquipmentLoadout(value),bonus={health:0,attack:0,regen:0,pose:0,attackSpeed:0,energyGain:0,range:0,potionHeal:0};
 const ids=loadout.installed??Object.entries(loadout).filter(([slot,id])=>EQUIPMENT.some(item=>item.id===id&&item.slot===slot)).map(([,id])=>id);
 let potionMultiplier=1;const resistanceSources=[];
 const empty=ids.includes("charm-empty-forge")?Math.max(0,loadout.emptyCells??0):0;
 bonus.health+=2*empty;bonus.attack+=.5*empty;
 if(empty)resistanceSources.push({normal:empty*EMPTY_FORGE_PHYSICAL_PER_CELL});
 for(const id of new Set(ids)){
  const item=resolveEquipment(id,loadout.rolls?.[id],loadout.upgrades?.[id]);
  if(!item)continue;
  if(item.physicalResistance)resistanceSources.push({normal:item.physicalResistance*100});
  if(item.resistances)resistanceSources.push(item.resistances);
  potionMultiplier*=1+(item.potionHeal??0);
  for(const key of Object.keys(bonus))if(key!=='potionHeal')bonus[key]+=item[key]??0;
 }
 bonus.potionHeal=potionMultiplier-1;bonus.resistances=combineResistances(...resistanceSources);return bonus;
}
/** The same aggregate used by combat; show installed skill separately from passive stats. */
export function equipmentEffectSummary(value={}){
 const loadout=normalizeEquipmentLoadout(value),bonus=equipmentBonuses(loadout),rows=[];
 const emptyCells=loadout.emptyCells??0;
 for(const [key,label,unit]of [['health','生命上限',''],['attack','攻击力',''],['pose','绷住上限',''],['regen','绷住恢复','/秒'],['attackSpeed','攻击速度','%'],['energyGain','能量获取','%'],['range','攻击距离','%'],['potionHeal','血瓶恢复量','%']]){
  const amount=bonus[key];if(Math.abs(amount)<1e-9)continue;
  rows.push({key,label,value:`${formatEquipmentBonus(unit==='%'?amount*100:amount)}${unit}`,negative:amount<0});
 }
 for(const [type,amount] of Object.entries(bonus.resistances))if(amount!==0)
  rows.push({key:type,label:RESISTANCE_LABELS[type],value:`${formatEquipmentBonus(amount)}%`,negative:amount<0});
 if(loadout.skill){const skill=resolveEquipment(loadout.skill,loadout.rolls?.[loadout.skill],loadout.upgrades?.[loadout.skill]);if(skill)rows.push({key:'skill',label:skill.name,value:equipmentDescription(skill)});}
 const ids=loadout.installed??Object.values(loadout).filter(id=>typeof id==='string');
 for(const [id,level]of Object.entries(passiveLevels(ids.map(id=>resolveEquipment(id,loadout.rolls?.[id],loadout.upgrades?.[id])).filter(Boolean)))){const passive=EQUIPMENT_PASSIVES[id];rows.push({key:`passive-${id}`,icon:passive.icon,label:passive.name,value:`等级 ${level}/${passive.max}`,tooltip:id==='emptyForge'?`${passive.effect(level)}
当前增幅：生命 ${formatEquipmentBonus(2*emptyCells)} / 物理抗性${formatEquipmentBonus(emptyCells*EMPTY_FORGE_PHYSICAL_PER_CELL)}% / 攻击力 ${formatEquipmentBonus(.5*emptyCells)}`:passive.effect(level)});}
 return rows;
}
export function createEquipmentMenu(doc,win,{equip=()=>{},onOpen=()=>{},onClose=()=>{},canOpen=()=>true}={}){
 const storage=win.naiwaSettings??win.localStorage,key='milk-heroes-assembly-v2';let owned=null,opened=false,model,fixedUltimate=null;
 let raw=null;try{raw=JSON.parse(storage?.getItem(key)??'null');}catch{}
 try{model=new AssemblyLoadout(raw??{});}catch{model=new AssemblyLoadout();}
 if(!raw){try{const old=JSON.parse(storage?.getItem('milk-heroes-equipment-v1')??'{}');if(old.ultimate)model.selectUltimate(old.ultimate);for(const slot of ['armor','gloves','charm','skill']){const id=old[slot],fit=id&&model.firstFit(id);if(fit)model.place(id,fit.x,fit.y,fit.rotation);}}catch{}}
 const get=id=>doc.getElementById?.(id),dialog=get('equipment-dialog'),slots=get('equipment-slots'),board=get('assembly-board'),pieces=get('assembly-pieces'),status=get('assembly-status'),effects=get('equipment-effects'),picker=get('equipment-picker'),list=get('equipment-list'),trash=get('equipment-recycle'),startButton=get('equipment-start');
 const interactionCounts={ultimateSelect:0,rotate:0,flip:0,bend:0,switchBend:0};
 let cursor=null,pointerOffset={x:0,y:0};
 let selected=null,drag=null,lastPointer=null,ghost=null,rotationHint=null,startBattle=null,cancelPreparation=null,suppressClick=false;
 const find=id=>model.item(id);
 const text=message=>{if(status)status.textContent=message;};
 function updateAnchor(active){const item=find(active.id);active.grab=equipmentAnchor(item.shape,active.rotation,item.bendPivots,active.bendIndex??0);return active.grab;}
 const dropOrigin=(active,x,y)=>{updateAnchor(active);return [Math.round(x-active.grab[0]),Math.round(y-active.grab[1])];};
 function placeAt(active,x,y){const [px,py]=dropOrigin(active,x,y);return model.place(active.id,px,py,active.rotation);}
 function selectItem(id,rotation,event={}){
  if(selected&&selected.id!==id)return;if(picker)picker.hidden=true;model.remove(id);commit();selected={id,rotation,grab:[0,0],bendIndex:0};pointerOffset={x:0,y:0};const rect=board?.getBoundingClientRect?.();
  lastPointer={x:event.clientX??rect?.left??24,y:event.clientY??rect?.top??24};text('');showGhost(lastPointer.x,lastPointer.y);
 }
 function showRotationHint(x,y){
  if(!dialog)return;if(!rotationHint){rotationHint=doc.createElement('span');rotationHint.className='assembly-rotate-hint';rotationHint.textContent='按R旋转';dialog.append(rotationHint);}
  const active=drag??selected;const hasBends=active&&pivotCells(find(active.id).shape).length;rotationHint.textContent=hasBends?'R旋转 · F翻转 · T拐弯 · Y切换拐点':'R旋转 · F翻转';rotationHint.hidden=false;rotationHint.style.left=`${Math.max(8,Math.min((win.innerWidth??960)-106,x+20))}px`;rotationHint.style.top=`${Math.max(8,Math.min((win.innerHeight??700)-36,y+24))}px`;
 }

 function commit(){equip(model.loadout);try{if(!owned)storage?.setItem(key,JSON.stringify(model.snapshot()));}catch{}render();}
 function image(item){const img=doc.createElement('img');img.src=equipmentIconUrl(item.icon);img.alt=item.name;img.draggable=false;return img;}
 function markPivot(tile,item,x,y,rotation=0,active=null){const index=pivotCells(item.shape,rotation,item.bendPivots).findIndex(([px,py])=>px===x&&py===y);if(index<0)return;tile.classList.add('is-bend');tile.title=(tile.title?tile.title+' · ':'')+'拐点';if(active&&(active.bendIndex??0)===index)tile.classList.add('is-active-bend');}
 function shapePreview(item){const cells=shapeCells(item.shape),size=shapeSize(cells),mini=doc.createElement('span');mini.className='equipment-shape-preview';mini.style.gridTemplateColumns=`repeat(${size.width},9px)`;mini.style.gridTemplateRows=`repeat(${size.height},9px)`;for(const [x,y]of cells){const square=doc.createElement('i');markPivot(square,item,x,y);square.style.gridColumn=String(x+1);square.style.gridRow=String(y+1);mini.append(square);}return mini;}
 function render(){
  if(!dialog)return;
  if(effects){effects.replaceChildren();const rows=equipmentEffectSummary(model.loadout);if(!rows.length){const empty=doc.createElement('div');empty.className='equipment-effects-empty';empty.textContent='无';effects.append(empty);}let passiveHeading=false;for(const row of rows){if(row.key.startsWith('passive-')&&!passiveHeading){const heading=doc.createElement('div');heading.className='equipment-passives-heading';heading.textContent='附加被动';effects.append(heading);passiveHeading=true;}const line=doc.createElement('div'),label=doc.createElement('dt'),value=doc.createElement('dd');if(row.tooltip){line.title=row.tooltip;line.setAttribute('tabindex','0');line.setAttribute('aria-label',`${row.label} ${row.value}：${row.tooltip}`);}line.dataset.effect=row.key;line.className=row.key==='skill'?'equipment-effect-skill':row.negative?'is-negative':'';renderEquipmentText(doc,label,row.label,{lines:false});if(row.icon){const icon=doc.createElement("img");icon.className="equipment-effect-icon";icon.src=equipmentIconUrl(row.icon);icon.alt="";label.prepend(icon);}renderEquipmentText(doc,value,row.value);line.append(label,value);effects.append(line);}}
  slots.replaceChildren();const item=find(model.ultimate),wrap=doc.createElement('div'),title=doc.createElement('h3'),button=doc.createElement('button'),name=doc.createElement('p');title.textContent='大招';button.type='button';button.className='equipment-slot';button.disabled=Boolean(fixedUltimate);button.setAttribute('aria-label',fixedUltimate?'当前大招':'选择大招');if(item){button.setAttribute('data-rarity',item.rarity);button.append(image(item));}name.textContent=model.name();button.addEventListener('click',()=>choose('ultimate'));wrap.append(title,button,name);slots.append(wrap);
  const boardRows=model.mask().length,boardCols=model.mask()[0].length;
  if(board){board.style.gridTemplateColumns=`repeat(${boardCols},1fr)`;board.style.gridTemplateRows=`repeat(${boardRows},1fr)`;board.replaceChildren();for(let y=0;y<boardRows;y++)for(let x=0;x<boardCols;x++){const cell=doc.createElement('button');cell.type='button';cell.className='assembly-cell '+(model.mask()[y][x]==='#'?'is-open':'is-closed');cell.setAttribute('aria-label',`${x+1}列${y+1}行${model.mask()[y][x]==='#'?'开放':'未开放'}`);cell.dataset.x=String(x);cell.dataset.y=String(y);cell.addEventListener('click',()=>{if(suppressClick||!selected)return;const result=placeAt(selected,x,y);if(result.ok){selected=null;clearGhost();text('');commit();}else text(result.reason);});board.append(cell);}}
  if(pieces){pieces.replaceChildren();for(const placement of model.placements){const entry=find(placement.id),cells=shapeCells(entry.shape,placement.rotation),size=shapeSize(cells),piece=doc.createElement('div');piece.className='assembly-piece';piece.dataset.itemId=entry.id;piece.style.left=`${placement.x/boardCols*100}%`;piece.style.top=`${placement.y/boardRows*100}%`;piece.style.width=`${size.width/boardCols*100}%`;piece.style.height=`${size.height/boardRows*100}%`;piece.style.gridTemplateColumns=`repeat(${size.width},1fr)`;piece.style.gridTemplateRows=`repeat(${size.height},1fr)`;piece.setAttribute('data-rarity',entry.rarity);
   for(const [x,y]of cells){const tile=doc.createElement('button');tile.type='button';tile.className='assembly-tile';tile.style.gridColumn=String(x+1);tile.style.gridRow=String(y+1);tile.title=`${entry.name}：${entry.description}`;markPivot(tile,entry,x,y,placement.rotation);tile.setAttribute('aria-label',entry.name);tile.append(image(entry));tile.addEventListener('pointerdown',event=>beginDrag(event,entry.id,placement,[x,y]));tile.addEventListener('click',event=>{event.stopPropagation?.();if(suppressClick)return;if(selected){const result=placeAt(selected,placement.x+x,placement.y+y);if(result.ok){selected=null;clearGhost();text('');commit();}else text(result.reason);return;}selectItem(entry.id,placement.rotation,event);});piece.append(tile);}pieces.append(piece);
  }}
 }
 function choose(mode){if(!picker||mode==='ultimate'&&fixedUltimate)return;picker.hidden=false;list.replaceChildren();get('equipment-picker-title').textContent=mode==='ultimate'?'选择大招':'添加装备';
  const installed=new Set(model.placements.map(p=>p.id));const items=EQUIPMENT.filter(item=>model.has(item.id)&&(mode==='ultimate'?item.slot==='ultimate':item.slot!=='ultimate'&&!installed.has(item.id))).map(item=>find(item.id));
  for(const item of items){const button=doc.createElement('button');button.type='button';button.className='equipment-choice';button.dataset.itemId=item.id;button.setAttribute('data-rarity',item.rarity);button.append(image(item));const labels=doc.createElement('span'),name=doc.createElement('strong'),desc=doc.createElement('small');name.textContent=mode==='ultimate'?model.name(item.id):item.name;renderEquipmentText(doc,desc,equipmentDescription(item));labels.append(name,desc);button.append(labels);if(item.shape)button.append(shapePreview(item));
   if(mode==='ultimate')button.disabled=!ASSEMBLY_BOARDS.has(item.id);
   else button.addEventListener('pointerdown',event=>beginDrag(event,item.id,null,[0,0]));
   button.addEventListener('click',event=>{if(suppressClick)return;if(mode==='ultimate'){if(model.selectUltimate(item.id)){interactionCounts.ultimateSelect++;selected=null;picker.hidden=true;text('');commit();}}else{picker.hidden=true;selectItem(item.id,0,event);}});list.append(button);
  }
  if(!items.length){const empty=doc.createElement('p');empty.className='equipment-empty';empty.textContent='暂无可添加的装备';list.append(empty);}
 }
 const pointInside=(element,x,y)=>{const rect=element?.getBoundingClientRect?.();return rect&&x>=rect.left&&x<rect.right&&y>=rect.top&&y<rect.bottom;};
 function gridPoint(x,y){const rect=board?.getBoundingClientRect?.();if(!rect||!rect.width||!pointInside(board,x,y))return null;return {x:(x-rect.left)/rect.width*model.mask()[0].length-.5,y:(y-rect.top)/rect.height*model.mask().length-.5,unit:rect.width/model.mask()[0].length};}
 function beginDrag(event,id,from,grab){if(event.button!==undefined&&event.button!==0)return;event.stopPropagation?.();if(selected)return;clearGhost();if(from){model.remove(id);commit();}drag={id,from,grab,bendIndex:0,rotation:from?.rotation??0,startX:event.clientX,startY:event.clientY,moved:false,pointerId:event.pointerId};updateAnchor(drag);lastPointer={x:event.clientX,y:event.clientY};showRotationHint(event.clientX,event.clientY);}
 function clearGhost(){pointerOffset={x:0,y:0};if(cursor)cursor.hidden=true;doc.body?.classList.remove('assembly-cursor-active');ghost?.remove?.();ghost=null;if(rotationHint)rotationHint.hidden=true;if(trash)trash.classList?.remove('is-over');if(board)for(const cell of board.children){cell.classList?.remove('drop-valid','drop-invalid');}}
 function showGhost(x,y){
  const active=drag??selected;if(!active)return;updateAnchor(active);
  x+=pointerOffset.x;y+=pointerOffset.y;showRotationHint(x,y);
  if(!cursor){cursor=doc.createElement('img');cursor.src='/images/ui/game-cursor.svg';cursor.className='assembly-snap-cursor';cursor.alt='';dialog.append(cursor);}cursor.hidden=false;cursor.style.left=`${x-3}px`;cursor.style.top=`${y-2}px`;doc.body?.classList.add('assembly-cursor-active');const item=find(active.id),cells=shapeCells(item.shape,active.rotation),size=shapeSize(cells),rect=board?.getBoundingClientRect?.(),unit=(rect?.width??360)/model.mask()[0].length;
  if(!ghost){ghost=doc.createElement('div');ghost.className='assembly-drag-ghost';ghost.setAttribute('data-rarity',item.rarity);dialog.append(ghost);}
  ghost.replaceChildren();ghost.style.width=`${size.width*unit}px`;ghost.style.height=`${size.height*unit}px`;ghost.style.left=`${x-(active.grab[0]+.5)*unit}px`;ghost.style.top=`${y-(active.grab[1]+.5)*unit}px`;ghost.style.gridTemplateColumns=`repeat(${size.width},1fr)`;ghost.style.gridTemplateRows=`repeat(${size.height},1fr)`;
  for(const [cx,cy]of cells){const tile=doc.createElement('span');tile.className='assembly-tile';tile.style.gridColumn=String(cx+1);tile.style.gridRow=String(cy+1);tile.append(image(item));markPivot(tile,item,cx,cy,active.rotation,active);ghost.append(tile);}
  const at=gridPoint(x,y),origin=at?dropOrigin(active,at.x,at.y):null,check=origin?model.check(active.id,origin[0],origin[1],active.rotation):{ok:false};ghost.classList?.toggle('is-invalid',!check.ok);trash?.classList?.toggle('is-over',Boolean(active.from&&pointInside(trash,x,y)));
  if(board)for(const cell of board.children){cell.classList?.remove('drop-valid','drop-invalid');if(at&&cells.some(([cx,cy])=>origin[0]+cx===Number(cell.dataset.x)&&origin[1]+cy===Number(cell.dataset.y)))cell.classList?.add(check.ok?'drop-valid':'drop-invalid');}
 }
 function pointerMove(event){if(!opened)return;lastPointer={x:event.clientX,y:event.clientY};if(!drag){if(selected)showGhost(event.clientX,event.clientY);return;}if(!drag.moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<4)return;drag.moved=true;event.preventDefault?.();if(picker)picker.hidden=true;showGhost(event.clientX,event.clientY);}
 function pointerUp(event){if(!drag)return;const current=drag,dropX=event.clientX+pointerOffset.x,dropY=event.clientY+pointerOffset.y;drag=null;clearGhost();if(!current.moved){selectItem(current.id,current.rotation,event);suppressClick=true;win.setTimeout?.(()=>{suppressClick=false;},0);return;}suppressClick=true;win.setTimeout?.(()=>{suppressClick=false;},0);if(!win.setTimeout)suppressClick=false;
  if(current.from&&pointInside(trash,dropX,dropY)){model.remove(current.id);selected=null;clearGhost();text('');commit();return;}
  const at=gridPoint(dropX,dropY);if(!at){selected=current;render();showGhost(event.clientX,event.clientY);return;}const result=placeAt(current,at.x,at.y);if(result.ok){selected=null;clearGhost();text('');commit();}else{selected=current;text(result.reason);render();showGhost(event.clientX,event.clientY);}
 }
 // Only the software cursor moves: browsers do not permit moving the OS pointer.
 function snapPointer(){
  const active=drag??selected;if(!opened||!active||!lastPointer)return;
  updateAnchor(active);const at=gridPoint(lastPointer.x+pointerOffset.x,lastPointer.y+pointerOffset.y);if(!at)return;
  const snap=nearestAssemblySnap(model,active,at);if(!snap)return;
  pointerOffset.x+=(snap.x+active.grab[0]-at.x)*at.unit;
  pointerOffset.y+=(snap.y+active.grab[1]-at.y)*at.unit;
  showGhost(lastPointer.x,lastPointer.y);
 }
 win.setInterval?.(snapPointer,2000);
 doc.addEventListener?.('click',event=>{
  if(!opened||!selected||(!pointerOffset.x&&!pointerOffset.y))return;
  const x=event.clientX+pointerOffset.x,y=event.clientY+pointerOffset.y,at=gridPoint(x,y);if(!at)return;
  event.preventDefault?.();event.stopImmediatePropagation?.();const result=placeAt(selected,at.x,at.y);
  if(result.ok){selected=null;clearGhost();text('');commit();}else text(result.reason);
 },true);
 doc.addEventListener?.('pointermove',pointerMove,{passive:false});doc.addEventListener?.('pointerup',pointerUp);doc.addEventListener?.('pointercancel',()=>{drag=null;clearGhost();render();});
 doc.addEventListener?.('keydown',event=>{
  if(!opened)return;event.stopPropagation?.();
  if(['KeyT','KeyY'].includes(event.code)&&(drag||selected)){event.preventDefault();if(event.repeat)return;const active=drag??selected,count=pivotCells(find(active.id).shape).length;if(!count)return;if(event.code==='KeyY'){active.bendIndex=((active.bendIndex??0)+1)%count;if(count>1)interactionCounts.switchBend++;}else if(model.bend(active.id,active.bendIndex??0)){interactionCounts.bend++;updateAnchor(active);if(drag)drag.moved=true;commit();}if(lastPointer)showGhost(lastPointer.x,lastPointer.y);return;}
  if(event.code==='KeyF'&&(drag||selected)){event.preventDefault();if(event.repeat)return;const active=drag??selected;if(model.flip(active.id,active.rotation)){interactionCounts.flip++;if(drag)drag.moved=true;commit();if(lastPointer)showGhost(lastPointer.x,lastPointer.y);}}
  if(event.code==='KeyR'&&(drag||selected)){event.preventDefault();interactionCounts.rotate++;if(drag){drag.moved=true;const old=shapeSize(shapeCells(find(drag.id).shape,drag.rotation));drag.grab=[old.height-1-drag.grab[1],drag.grab[0]];drag.rotation=(drag.rotation+1)%4;if(lastPointer)showGhost(lastPointer.x,lastPointer.y);}else{selected.rotation=(selected.rotation+1)%4;if(lastPointer)showGhost(lastPointer.x,lastPointer.y);}}
  if(event.code==='Escape'&&(drag||selected)){event.preventDefault();drag=null;selected=null;clearGhost();text('');render();}
 });
 list?.addEventListener('wheel',event=>{event.preventDefault();event.stopPropagation();list.scrollTop+=(event.deltaY??0)*(event.deltaMode===1?16:event.deltaMode===2?list.clientHeight:1);},{passive:false});
 const api={
  startRun(snapshot={},inventory=STARTING_ITEMS,{fixedUltimate:ultimate=null}={}){
   clearGhost();owned=new Set(inventory);fixedUltimate=ultimate;
   model=new AssemblyLoadout(ultimate?{...snapshot,ultimate}:snapshot,owned);selected=null;drag=null;commit();
  },
  sandbox({maxLevel=false}={}){clearGhost();owned=null;fixedUltimate=null;model=new AssemblyLoadout({rolls:Object.fromEntries(EQUIPMENT.filter(i=>i.slot!=='ultimate').map(i=>[i.id,rollEquipment(i.id)]))});if(maxLevel)for(const choice of model.upgradeChoices())while(model.upgrade(choice.item.id)){}selected=null;commit();},
  debugGrant(id,roll){if(!model.debugGrant(id,roll))return false;selected=null;drag=null;clearGhost();commit();return true;},
  grant(id,roll,upgrade){if(!find(id))return false;const changed=model.grant(id,roll??rollEquipment(id),upgrade);render();return changed;},
  upgradeItem(id){if(!model.upgradeItem(id))return false;commit();return true;},
  trimCell(id,cell){if(!model.trimCell(id,cell))return false;commit();return true;},
  hingeItems(){return EQUIPMENT.filter(i=>i.slot!=='ultimate'&&model.has(i.id)).map(i=>({item:model.item(i.id),state:model.hingeState(i.id),upgrade:model.upgradePreview(i.id)}));},
  addHinges(changes){if(!model.addHinges(changes))return false;commit();return true;},
  get interactionCounts(){return {...interactionCounts};},
  get ownedIds(){return owned?[...owned]:EQUIPMENT.map(item=>item.id);},get loadout(){return model.loadout;},get assembly(){return model.snapshot();},get opened(){return opened;},get holding(){return Boolean(selected||drag);},
  place(id,x,y,rotation=0){const result=model.place(id,x,y,rotation);if(result.ok)commit();else text(result.reason);return result;},
  remove(id){const changed=model.remove(id);if(changed)commit();return changed;},clear(){model.clear();selected=null;clearGhost();commit();},
  selectUltimate(id){if(fixedUltimate&&id!==fixedUltimate||!model.selectUltimate(id))return false;selected=null;clearGhost();commit();return true;},
  chooseEquipment(){choose('equipment');},upgradeChoices(){return model.upgradeChoices().filter(choice=>!fixedUltimate||choice.item.id===fixedUltimate);},
  upgrade(id){if(fixedUltimate&&id!==fixedUltimate||!model.upgrade(id))return false;commit();return true;},
  open({beforeBattle=false,onStart=null,onCancel=null}={}){if(opened||(!beforeBattle&&!canOpen()))return;opened=true;dialog?.classList?.toggle('prebattle',beforeBattle);if(get('equipment-close'))get('equipment-close').hidden=beforeBattle;startBattle=beforeBattle?onStart:null;cancelPreparation=onCancel;if(startButton)startButton.hidden=!beforeBattle;if(picker)picker.hidden=true;selected=null;text('');onOpen();render();dialog?.showModal();},
  close({starting=false}={}){if(!opened)return;opened=false;drag=null;selected=null;clearGhost();startBattle=null;const cancel=cancelPreparation;cancelPreparation=null;if(!starting)cancel?.();if(startButton)startButton.hidden=true;dialog?.close();onClose();},
 };
 get('equipment-add')?.addEventListener('click',()=>choose('equipment'));get('equipment-clear')?.addEventListener('click',()=>{api.clear();text('');});trash?.addEventListener('click',()=>{if(selected){api.remove(selected.id);selected=null;clearGhost();text('');}});
 startButton?.addEventListener('click',()=>{const start=startBattle;if(!opened||!start)return;api.close({starting:true});start();});get('equipment-close')?.addEventListener('click',()=>api.close());dialog?.addEventListener('cancel',event=>{event.preventDefault();api.close();});get('equipment-picker-close')?.addEventListener('click',()=>{picker.hidden=true;});
 render();equip(model.loadout);return api;
}
