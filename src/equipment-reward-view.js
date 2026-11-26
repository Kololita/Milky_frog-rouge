import {pivotCells} from './equipment-bends.js';
import {equipmentIconUrl,RARITIES} from './equipment.js';
import {equipmentDescription} from './equipment-rolls.js';
import {shapeCells,shapeSize} from './equipment-shapes.js';
import {renderEquipmentText} from './equipment-text.js';

export function equipmentShape(doc,item){
 const preview=doc.createElement('span');
 preview.className='equipment-shape-preview';
 if(!item.shape){preview.hidden=true;return preview;}
 const cells=shapeCells(item.shape),size=shapeSize(cells),pivots=pivotCells(item.shape);
 preview.setAttribute('role','img');
 preview.setAttribute('aria-label','装备占地形状');
 preview.style.gridTemplateColumns=`repeat(${size.width},12px)`;
 preview.style.gridTemplateRows=`repeat(${size.height},12px)`;
 for(const [x,y] of cells){
  const cell=doc.createElement('i');
  if(pivots.some(([px,py])=>px===x&&py===y))cell.className='is-bend';
  cell.style.gridColumn=String(x+1);cell.style.gridRow=String(y+1);
  preview.append(cell);
 }
 return preview;
}

export function fillEquipmentRewardCard(doc,card,item){
 card.className='loot-choice';
 card.setAttribute('data-rarity',item.rarity);
 const image=doc.createElement('img'),name=doc.createElement('strong');
 const grade=doc.createElement('span'),description=doc.createElement('p');
 image.src=equipmentIconUrl(item.icon);image.alt='';
 name.textContent=item.name;grade.textContent=RARITIES[item.rarity]?.label??'大招';
 renderEquipmentText(doc,description,equipmentDescription(item));
 const shape=equipmentShape(doc,item);
 shape.classList.add('loot-shape');
 card.append(image,name,grade,description,shape);
}
