import {EQUIPMENT,RARITIES,equipmentIconUrl} from './equipment.js';
import {shapePoolFor,shapeCells,shapeSize} from './equipment-shapes.js';
import {resolveEquipment,rollEquipment,equipmentDescription} from './equipment-rolls.js';
import {renderEquipmentText} from './equipment-text.js';
export function createDeveloperEquipment(doc,{grant}){
 const dialog=doc.createElement('dialog');dialog.id='developer-equipment-dialog';doc.body.append(dialog);
 const heading=doc.createElement('div'),title=doc.createElement('h2'),back=doc.createElement('button'),list=doc.createElement('div');heading.className='settings-heading';title.textContent='获得装备';back.type='button';back.textContent='返回';back.addEventListener('click',()=>dialog.close());heading.append(title,back);list.className='developer-equipment-list';dialog.append(heading,list);
 function render(){list.replaceChildren();for(const item of EQUIPMENT){
  const card=doc.createElement('section'),name=doc.createElement('strong'),image=doc.createElement('img'),description=doc.createElement('div'),select=doc.createElement('select'),preview=doc.createElement('div'),get=doc.createElement('button'),message=doc.createElement('span');
  card.dataset.itemId=item.id;image.src=equipmentIconUrl(item.icon);image.alt='';image.style.background=(RARITIES[item.rarity]?.color??'#ced7cc');name.textContent=`${item.name} · ${(RARITIES[item.rarity]?.label??'大招')}`;select.setAttribute('aria-label',`${item.name}形状`);const pool=item.slot==='ultimate'?[]:shapePoolFor(item);let randomRoll=rollEquipment(item.id);
  const option=doc.createElement('option');option.value='random';option.textContent='随机';select.append(option);for(const [index,shape]of pool.entries()){const opt=doc.createElement('option');opt.value=shape.id;const cells=shapeCells(shape.shape),size=shapeSize(cells);opt.textContent=`形状${index+1} · ${size.width}×${size.height} · ${cells.length}格`;select.append(opt);}
  select.value='random';select.disabled=!pool.length;const roll=()=>select.value==='random'?randomRoll:{shapeId:select.value};
  function update(){const resolved=resolveEquipment(item.id,roll());renderEquipmentText(doc,description,equipmentDescription(resolved));preview.replaceChildren();if(resolved.shape){const cells=shapeCells(resolved.shape),size=shapeSize(cells);preview.className='equipment-shape-preview';preview.style.gridTemplateColumns=`repeat(${size.width},15px)`;preview.style.gridTemplateRows=`repeat(${size.height},15px)`;for(const [x,y]of cells){const cell=doc.createElement('i');cell.style.gridColumn=String(x+1);cell.style.gridRow=String(y+1);cell.style.background=(RARITIES[item.rarity]?.color??'#ced7cc');preview.append(cell);}}}
  select.addEventListener('change',()=>{if(select.value==='random')randomRoll=rollEquipment(item.id);update();});get.type='button';get.textContent='获取';get.addEventListener('click',()=>{if(grant(item.id,roll())){message.textContent='已获取';if(select.value==='random'){randomRoll=rollEquipment(item.id);update();}}});card.append(image,name,description,select,preview,get,message);list.append(card);update();
 }}
 dialog.addEventListener('keydown',e=>e.stopPropagation());return {open(){render();dialog.showModal();},close(){dialog.close();}};
}
