import {rollEquipment} from './equipment-rolls.js';
import {rollLoot,createLootProtection} from './loot.js';
import {STARTING_ITEMS} from './equipment-catalog.js';
import {ENCOUNTER_POOLS,chooseFormation} from './encounter-formations.js';
export const MAP_LAYOUT=Object.freeze({layers:15,rowGap:145,padding:80,width:640,height:2190});
export const NODE_LABELS=Object.freeze({monster:'战斗',elite:'精英',rest:'休息处',boss:'首领',event:'事件'});
const restLayers=new Set([4,9,13]);
export function generateRunMap(seed){
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const rows=[];
 for(let layer=0;layer<MAP_LAYOUT.layers;layer++){
  const rest=restLayers.has(layer),boss=layer===MAP_LAYOUT.layers-1,count=rest||boss?1:3;
  const elite=layer===3||layer===7||layer===11,offset=Math.floor(random()*3);
  rows.push(Array.from({length:count},(_,lane)=>{
   const type=boss?'boss':rest?'rest':elite||layer===6&&lane===2||layer===12&&lane===1?'elite':layer>=2&&lane===(layer+offset)%3?'event':'monster';
   return {id:`${layer}-${lane}`,layer,lane,type,name:NODE_LABELS[type],encounter:type==='boss'?'samurai':type==='elite'?ENCOUNTER_POOLS.elite[(lane+offset)%3]:null,
    encounterRoll:Math.floor(random()*4294967296),x:count===1?320:135+lane*185+(random()-.5)*30,y:MAP_LAYOUT.padding+(MAP_LAYOUT.layers-1-layer)*MAP_LAYOUT.rowGap,next:[]};
  }));
 }
 for(let r=0;r<rows.length-1;r++){
  const direction=random()<.5?-1:1;
  for(const node of rows[r]){
   if(rows[r+1].length===1)node.next=[rows[r+1][0].id];
   else if(rows[r].length===1)node.next=rows[r+1].map(n=>n.id);
   else{node.next=[rows[r+1][node.lane].id];const lane=node.lane+direction;if(lane>=0&&lane<3&&random()<.7)node.next.push(rows[r+1][lane].id);}
  }
 }
 return {seed:seed>>>0,rows,nodes:rows.flat(),height:MAP_LAYOUT.height};
}
export class RunProgress{
 constructor(seed=Date.now()){this.map=generateRunMap(seed);this.status='map';this.layer=0;this.path=[];this.selected=null;this.ordinaryBattles=0;this.lastOrdinary=null;this.inventory=[...STARTING_ITEMS];this.lootChoices=[];this.lootRolls={};this.equipmentRolls={};this.lootSeed=(seed^0x9e3779b9)>>>0;this.lootProtection=createLootProtection();}
 available(){if(this.status!=='map')return [];if(!this.path.length)return this.map.rows[0];const prev=this.map.nodes.find(n=>n.id===this.path.at(-1));return this.map.nodes.filter(n=>prev.next.includes(n.id));}
 select(id){const node=this.available().find(n=>n.id===id);if(!node)return null;if(node.type==='monster')node.encounter=chooseFormation(node,this.ordinaryBattles,this.lastOrdinary);this.selected=node;this.status='preparing';return node;}
 cancel(){if(this.status==='preparing'){this.status='map';this.selected=null;}}
 beginEvent(){if(this.status!=='preparing'||this.selected.type!=='event')return false;this.status='event';return true;}
 finishEvent(){if(this.status!=='event')return false;this.path.push(this.selected.id);this.layer++;this.status='map';this.selected=null;return true;}
 begin(){if(this.status!=='preparing'||['rest','event'].includes(this.selected.type))return false;if(this.selected.type==='monster'){this.ordinaryBattles++;this.lastOrdinary=this.selected.encounter;}this.status='battle';return true;}
 beginRest(){if(this.status!=='preparing'||this.selected.type!=='rest')return false;this.status='rest';return true;}
 finishRest(){if(this.status!=='rest')return false;this.path.push(this.selected.id);this.layer++;this.status='map';this.selected=null;return true;}
 finish(won){if(this.status!=='battle')return false;if(!won){this.status='lost';return true;}this.path.push(this.selected.id);this.layer++;
  if(this.selected.type==='boss'){this.status='won';return true;}
  const random=()=>{this.lootSeed=(Math.imul(this.lootSeed,1664525)+1013904223)>>>0;return this.lootSeed/4294967296;};
  this.lootChoices=rollLoot(this.selected.type,random,this.inventory,this.lootProtection);this.lootRolls=Object.fromEntries(this.lootChoices.map(id=>[id,rollEquipment(id,random)]));
  this.status=this.lootChoices.length?'reward':'victory';return true;
 }
 claimReward(id){if(this.status!=='reward'||!this.lootChoices.includes(id))return false;this.inventory.push(id);this.equipmentRolls[id]={...this.lootRolls[id]};this.lootChoices=[];this.lootRolls={};this.status='victory';return true;}
 advance(){if(this.status!=='victory')return false;this.selected=null;this.status='map';return true;}
}
