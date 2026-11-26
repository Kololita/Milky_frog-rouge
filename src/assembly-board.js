import {replayBends,turnBend,bendRows,addHinge,removeShapeCell,rotatedStateCells} from './equipment-bends.js';
import {EQUIPMENT,STARTING_LOADOUT} from './equipment-catalog.js';
import {resolveEquipment,validEquipmentRoll,nextEquipmentUpgrade} from './equipment-rolls.js';
import {shapeCells,shapeSize} from './equipment-shapes.js';

export const BOARD_SIZE=6;
/** Each ultimate supplies explicit masks; future workbenches may be asymmetric or have holes. */
export const ASSEMBLY_BOARDS=new Map();
export function registerAssemblyBoard(id,definition){
 if(!definition.levels?.length||definition.levels.some(mask=>mask.length!==definition.levels[0].length||mask.some(row=>row.length!==definition.levels[0][0].length||/[^.#]/.test(row))))throw new Error('装配台各级尺寸必须一致');
 for(let level=1;level<definition.levels.length;level++)for(let y=0;y<definition.levels[0].length;y++)for(let x=0;x<definition.levels[0][0].length;x++)if(definition.levels[level-1][y][x]==='#'&&definition.levels[level][y][x]!=='#')throw new Error('升级不能关闭已有开放格');
 ASSEMBLY_BOARDS.set(id,{...definition,levels:definition.levels.map(mask=>[...mask])});
}
registerAssemblyBoard('rage',{levels:[
 ['......','.####.','.####.','.####.','.####.','......'],
 ['#####.','#####.','#####.','#####.','#####.','......'],
 ['######','######','######','######','######','######'],
]});
registerAssemblyBoard('fistwind',{levels:[['........','........','..####..','..####..','..####..','..####..','........','........'],['........','...##...','.######.','..####..','..####..','.######.','...##...','........'],['...##...','..####..','.######.','########','..####..','.######.','..####..','...##...']]});
const itemById=id=>EQUIPMENT.find(item=>item.id===id);
const copy=value=>JSON.parse(JSON.stringify(value));
export class AssemblyLoadout{
 constructor(raw={},owned=null){
  raw=raw&&typeof raw==='object'?raw:{};this.owned=owned;this.ultimate=STARTING_LOADOUT.ultimate;this.boards={};this.rolls={};this.bends={};this.upgrades=copy(raw.upgrades??{});
  for(const [id,roll]of Object.entries(raw.rolls??{}))if(this.has(id)&&validEquipmentRoll(itemById(id),roll))this.rolls[id]={shapeId:roll.shapeId};
  for(const [id,history]of Object.entries(raw.bends??{})){try{if(this.has(id)&&itemById(id)&&(!raw.rolls?.[id]||validEquipmentRoll(itemById(id),raw.rolls[id]))){replayBends(resolveEquipment(id,this.rolls[id]).shape,history);this.bends[id]=[...history];}}catch{}}
  if(itemById(raw.ultimate)?.slot==='ultimate'&&ASSEMBLY_BOARDS.has(raw.ultimate)&&this.has(raw.ultimate))this.ultimate=raw.ultimate;
  for(const [id,value]of Object.entries(raw.boards??{})){
   if(!ASSEMBLY_BOARDS.has(id)||!value||typeof value!=='object')continue;
   const level=Math.max(0,Math.min(ASSEMBLY_BOARDS.get(id).levels.length-1,Math.floor(Number(value.level)||0)));this.boards[id]={level,placements:[]};
   for(const p of (Array.isArray(value.placements)?value.placements:[]))if(p&&!this.boards[id].placements.some(existing=>existing.id===p.id)&&this.check(p.id,p.x,p.y,p.rotation??0,id).ok)this.boards[id].placements.push({id:p.id,x:p.x,y:p.y,rotation:((p.rotation??0)%4+4)%4});
  }
  this.board();
 }
 hingeState(id){const item=resolveEquipment(id,this.rolls[id]);return item?.shape?replayBends(item.shape,this.bends[id]??[]):null;}
 item(id){const item=resolveEquipment(id,this.rolls[id],this.upgrades[id]);if(item?.shape){const state=this.hingeState(id);item.shape=bendRows(state);item.bendPivots=state.pivots.map(p=>{const c=state.cells.find(c=>c.id===p.id);return [c.x,c.y];});}return item;}
 upgradeItem(id){if(!this.has(id))return false;const next=nextEquipmentUpgrade(id,this.rolls[id],this.upgrades[id]);if(!next)return false;this.upgrades[id]=next;return true;}
 upgradePreview(id){const next=nextEquipmentUpgrade(id,this.rolls[id],this.upgrades[id]);return next?resolveEquipment(id,this.rolls[id],next):null;}
 trimCell(id,cell){if(!this.has(id))return false;const old=this.hingeState(id);if(!old)return false;const next=removeShapeCell(old,cell);if(!next)return false;for(const b of Object.values(this.boards))for(const p of b.placements)if(p.id===id){const before=rotatedStateCells(old,p.rotation),after=rotatedStateCells(next,p.rotation),ref=after[0],previous=before.find(c=>c.id===ref.id);p.x+=previous.x-ref.x;p.y+=previous.y-ref.y;}this.bends[id]=[...(this.bends[id]??[]),{remove:cell}];return true;}
 addHinges(changes){const backup=copy(this.bends);let total=0;try{for(const [id,ids]of Object.entries(changes)){if(!this.has(id)||!Array.isArray(ids))throw Error();for(const cell of ids){if(++total>1||!addHinge(this.hingeState(id),cell))throw Error();this.bends[id]=[...(this.bends[id]??[]),{add:cell}];}}return true;}catch{this.bends=backup;return false;}}

 bend(id,index){if(!this.has(id)||this.placements.some(p=>p.id===id))return false;const item=resolveEquipment(id,this.rolls[id]);if(!item?.shape||(this.bends[id]?.length??0)>=256)return false;const state=replayBends(item.shape,this.bends[id]??[]);if(!turnBend(state,index))return false;this.bends[id]=[...(this.bends[id]??[]),index];return true;}
 flip(id,rotation=0){if(!this.item(id)?.shape||!this.has(id)||this.placements.some(p=>p.id===id)||(this.bends[id]?.length??0)>=256)return false;this.bends[id]=[...(this.bends[id]??[]),{mirror:rotation%2?'y':'x'}];return true;}
 debugGrant(id,roll){if(!itemById(id))return false;if(itemById(id).slot!=='ultimate'&&!validEquipmentRoll(itemById(id),roll))return false;this.owned?.add(id);if(roll)this.rolls[id]={...roll};delete this.bends[id];for(const [ultimate,b]of Object.entries(this.boards))b.placements=b.placements.filter(p=>p.id!==id||this.check(p.id,p.x,p.y,p.rotation,ultimate).ok);return true;}

 grant(id,roll,upgrade){
  const item=itemById(id);
  if(!item||this.owned?.has(id))return false;
  this.owned?.add(id);
  if(validEquipmentRoll(item,roll)&&!this.rolls[id])this.rolls[id]={shapeId:roll.shapeId};
  if(upgrade)this.upgrades[id]=copy(upgrade);
  return true;
 }
 has(id){return !this.owned||this.owned.has(id);}
 board(id=this.ultimate){if(!this.boards[id])this.boards[id]={level:0,placements:[]};return this.boards[id];}
 mask(id=this.ultimate,level=this.board(id).level){return ASSEMBLY_BOARDS.get(id)?.levels[level]??Array(6).fill('......');}
 name(id=this.ultimate){const item=itemById(id),level=this.board(id).level;return (item?.name??id)+(level?`+${level}`:'');}
 selectUltimate(id){if(itemById(id)?.slot!=='ultimate'||!ASSEMBLY_BOARDS.has(id)||!this.has(id))return false;this.ultimate=id;this.board();return true;}
 check(id,x,y,rotation=0,ultimate=this.ultimate){
  const item=this.item(id);if(!item?.shape||item.slot==='ultimate'||!this.has(id))return {ok:false,reason:'未拥有这件装备'};
  if(!Number.isInteger(x)||!Number.isInteger(y)||!Number.isInteger(rotation))return {ok:false,reason:'请选择棋盘格'};
  const board=this.board(ultimate),mask=this.mask(ultimate),others=board.placements.filter(p=>p.id!==id);
  if(item.slot==='skill'&&others.some(p=>itemById(p.id)?.slot==='skill'))return {ok:false,reason:'装配台最多安装一个技能'};
  const occupied=new Set(others.flatMap(p=>shapeCells(this.item(p.id).shape,p.rotation).map(([dx,dy])=>`${p.x+dx},${p.y+dy}`)));
  const cells=shapeCells(item.shape,rotation).map(([dx,dy])=>[x+dx,y+dy]);
  if(cells.some(([cx,cy])=>cx<0||cy<0||cx>=mask[0].length||cy>=mask.length||mask[cy][cx]!=='#'))return {ok:false,reason:'装备只能放入绿色开放格'};
  if(cells.some(([cx,cy])=>occupied.has(`${cx},${cy}`)))return {ok:false,reason:'装备不能重叠'};
  return {ok:true,cells};
 }
 place(id,x,y,rotation=0){const result=this.check(id,x,y,rotation);if(!result.ok)return result;const b=this.board();b.placements=b.placements.filter(p=>p.id!==id);b.placements.push({id,x,y,rotation:((rotation%4)+4)%4});return result;}
 remove(id){const b=this.board(),before=b.placements.length;b.placements=b.placements.filter(p=>p.id!==id);return b.placements.length!==before;}
 clear(){this.board().placements=[];}
 firstFit(id){for(let rotation=0;rotation<4;rotation++)for(let y=0;y<this.mask().length;y++)for(let x=0;x<this.mask()[0].length;x++)if(this.check(id,x,y,rotation).ok)return {x,y,rotation};return null;}
 upgrade(id){if(!this.has(id)||itemById(id)?.slot!=='ultimate')return false;const definition=ASSEMBLY_BOARDS.get(id),board=this.board(id);if(!definition||board.level>=definition.levels.length-1)return false;board.level++;return true;}
 upgradeChoices(){return EQUIPMENT.filter(item=>item.slot==='ultimate'&&this.has(item.id)&&ASSEMBLY_BOARDS.has(item.id)).map(item=>({item,level:this.board(item.id).level,maxLevel:ASSEMBLY_BOARDS.get(item.id).levels.length-1,name:this.name(item.id)}));}
 get placements(){return copy(this.board().placements);}
 get loadout(){const ids=this.board().placements.map(p=>p.id),skill=ids.find(id=>itemById(id)?.slot==='skill');const open=this.mask().reduce((sum,row)=>sum+[...row].filter(cell=>cell==='#').length,0);
 const used=ids.reduce((sum,id)=>sum+shapeCells(this.item(id).shape).length,0);
 return {ultimate:this.ultimate,...(ids.includes("charm-empty-forge")?{emptyCells:Math.max(0,open-used)}:{}),...(Object.keys(this.upgrades).length?{upgrades:copy(this.upgrades)}:{}),...(ids.length?{installed:ids}:{}),...(skill?{skill}:{}),...(ids.some(id=>this.rolls[id])?{rolls:Object.fromEntries(ids.filter(id=>this.rolls[id]).map(id=>[id,{...this.rolls[id]}]))}:{})};}
 snapshot(){return copy({ultimate:this.ultimate,boards:this.boards,rolls:this.rolls,bends:this.bends,upgrades:this.upgrades});}
}
export {shapeCells,shapeSize};
