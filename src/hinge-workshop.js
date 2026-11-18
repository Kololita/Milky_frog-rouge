import {hingeCandidates,removableCells} from './equipment-bends.js';
import {equipmentIconUrl,RARITIES} from './equipment.js';
import {equipmentDescription} from './equipment-rolls.js';
import {renderEquipmentText} from './equipment-text.js';
const MODES={upgrade:'升级',hinge:'灵巧',trim:'精简'};
export function createHingeWorkshop(doc,{equipment,finish,dialogId='hinge-workshop'}){
 const dialog=doc.createElement('dialog');dialog.id=dialogId;doc.body.append(dialog);let mode,editing,selected,onDone,artisan;
 const button=(label,action)=>{const b=doc.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',action);return b;};
 const entries=()=>equipment().hingeItems();
 const candidates=entry=>mode==='hinge'?hingeCandidates(entry.state):removableCells(entry.state);
 const leave=()=>{dialog.close();if(artisan)onDone?.();};
 function comparison(item,title){const box=doc.createElement('section'),heading=doc.createElement('h3'),name=doc.createElement('strong'),effects=doc.createElement('div');heading.textContent=title;name.textContent=`${item.name} · ${RARITIES[item.rarity].label}`;box.style.borderColor=RARITIES[item.rarity].color;renderEquipmentText(doc,effects,equipmentDescription(item));box.append(heading,name,effects);return box;}
 function render(){
  dialog.replaceChildren();const title=doc.createElement('h2');title.textContent=artisan?'工匠 · 精简':MODES[mode];dialog.append(title);
  dialog.append(button(artisan&&!editing?'跳过':'返回',()=>{if(editing){editing=null;selected=null;}else{leave();return;}render();}));
  if(!editing){const list=doc.createElement('div');list.className='hinge-equipment-list';for(const entry of entries().filter(entry=>mode==='upgrade'||candidates(entry).length)){
   const {item}=entry,b=button(item.name,()=>{editing=item.id;selected=null;render();});b.disabled=mode==='upgrade'?!entry.upgrade:!candidates(entry).length;
   b.title=b.disabled?(mode==='upgrade'?'已达最高品质':'没有可改造的格子'):'';const image=doc.createElement('img');image.src=equipmentIconUrl(item.icon);image.alt='';image.style.background=RARITIES[item.rarity].color;b.prepend(image);list.append(b);
  }dialog.append(list);return;}
  const entry=entries().find(e=>e.item.id===editing);if(!entry){editing=null;render();return;}
  const heading=doc.createElement('h3');heading.textContent=entry.item.name;dialog.append(heading);
  if(mode==='upgrade'){const compare=doc.createElement('div');compare.className='retrofit-compare';compare.append(comparison(entry.item,'升级前'),comparison(entry.upgrade,'升级后'));dialog.append(compare);}
  else{
   const state=entry.state,allowed=new Set(candidates(entry)),grid=doc.createElement('div');grid.className='hinge-edit-grid';grid.style.gridTemplateColumns=`repeat(${Math.max(...state.cells.map(c=>c.x))+1},42px)`;grid.style.gridTemplateRows=`repeat(${Math.max(...state.cells.map(c=>c.y))+1},42px)`;
   for(const cell of state.cells){const b=button('',()=>{if(allowed.has(cell.id)){selected=cell.id;render();}});b.style.gridColumn=String(cell.x+1);b.style.gridRow=String(cell.y+1);b.className='hinge-edit-cell'+(cell.pivot?' is-bend':'')+(allowed.has(cell.id)?' hinge-candidate':'')+(selected===cell.id?' hinge-added':'');b.setAttribute('aria-label',`${cell.x+1}列${cell.y+1}行${selected===cell.id?'已选中':allowed.has(cell.id)?'可改造':'不可改造'}`);b.addEventListener('contextmenu',e=>{e.preventDefault();if(selected===cell.id){selected=null;render();}});const image=doc.createElement('img');image.src=equipmentIconUrl(entry.item.icon);image.alt='';b.append(image);grid.append(b);}dialog.append(grid);
  }
  const confirm=button('确认',()=>{if(!editing)return;const menu=equipment();const ok=mode==='upgrade'?menu.upgradeItem(editing):mode==='hinge'?menu.addHinges({[editing]:[selected]}):menu.trimCell(editing,selected);if(!ok)return;dialog.close();onDone?.();});confirm.disabled=mode!=='upgrade'&&selected===null;dialog.append(confirm);
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();if(editing){editing=null;selected=null;}else{leave();return;}render();});dialog.addEventListener('keydown',e=>e.stopPropagation());
 return {canOpen(action){return entries().some(entry=>action==='upgrade'?entry.upgrade:action==='hinge'?hingeCandidates(entry.state).length:removableCells(entry.state).length);},open({action='upgrade',onlyTrim=false,done=finish}={}){mode=onlyTrim?'trim':action;if(!this.canOpen(mode))return false;artisan=onlyTrim;onDone=done;editing=null;selected=null;render();dialog.showModal();return true;},close(){dialog.close();}};
}
