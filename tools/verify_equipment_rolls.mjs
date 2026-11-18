import assert from 'node:assert/strict';
import {EQUIPMENT,equipmentBonuses,equipmentEffectSummary} from '../src/equipment.js';
import {SHAPES,SHAPE_POOLS,shapePoolFor,equipmentShapeType,shapeCells} from '../src/equipment-shapes.js';
import {rollEquipment,resolveEquipment,equipmentDescription,equipmentDisplayInteger,equipmentBaseMultiplier,EQUIPMENT_STAT_WEIGHTS,EQUIPMENT_BUDGETS} from '../src/equipment-rolls.js';
import {AssemblyLoadout} from '../src/assembly-board.js';
import {RunProgress} from '../src/run-map.js';
import {Battle} from '../src/battle.js';
import {gameFixture} from './game_fixture.mjs';
for(const [type,rarities]of Object.entries(SHAPE_POOLS))for(const [rarity,ids]of Object.entries(rarities)){
 assert(ids.length>=3);for(const id of ids){const s=SHAPES[id];assert.equal(s.rarity,rarity);const cells=shapeCells(s.shape),seen=new Set([String(cells[0])]);let changed=true;while(changed){changed=false;for(const [x,y]of cells)if(!seen.has(`${x},${y}`)&&[[x+1,y],[x-1,y],[x,y+1],[x,y-1]].some(p=>seen.has(String(p)))){seen.add(`${x},${y}`);changed=true;}}assert(cells.length>0);}

}
assert(SHAPES['white-elbow'].multiplier>SHAPES['white-bar'].multiplier,'Corners have no premium');
assert(SHAPES['green-tee'].multiplier>SHAPES['green-square'].multiplier,'Packing difficulty has no premium');
for(const item of EQUIPMENT.filter(i=>i.slot!=='ultimate')){
 const pool=shapePoolFor(item);assert.equal(equipmentDisplayInteger(2.999999999),2);assert.equal(equipmentDisplayInteger(-2.01),-3);assert.deepEqual(pool.map(s=>s.id),SHAPE_POOLS[equipmentShapeType(item)][item.rarity]);
 for(let index=0;index<pool.length;index++){
  const roll=rollEquipment(item.id,()=>index/pool.length+.001),resolved=resolveEquipment(item.id,roll);assert.equal(resolved.shapeId,pool[index].id);
  for(const [key,label]of Object.entries({health:'最大生命',attack:'攻击力',pose:'绷住上限',regen:'绷住恢复',gold:'金光持续'}))if(item[key]){const expected=Math.floor(item[key]*equipmentBaseMultiplier(item)*pool[index].multiplier);assert(equipmentDescription(resolved).includes(`${label} ${expected>=0?'+':''}${expected}`),`${item.id}: rounded before multiplying`);}
  const m=new AssemblyLoadout({rolls:{[item.id]:roll}},new Set(['rage',item.id]));m.upgrade('rage');m.upgrade('rage');const fit=m.firstFit(item.id);assert(fit);assert(m.place(item.id,fit.x,fit.y,fit.rotation).ok);
  const saved=m.snapshot(),restored=new AssemblyLoadout(saved,new Set(['rage',item.id]));assert.deepEqual(restored.snapshot(),saved);assert.deepEqual(restored.item(item.id),resolved);
  const stats=equipmentBonuses(m.loadout);for(const key of Object.keys(EQUIPMENT_STAT_WEIGHTS))if(resolved[key])assert(Math.abs(stats[key]-resolved[key])<1e-8);
  const before=JSON.stringify(m.rolls);m.remove(item.id);m.place(item.id,fit.x,fit.y,(fit.rotation+2)%4);assert.equal(JSON.stringify(m.rolls),before,'Moving rerolls equipment');
 }
 assert(Number.isFinite(equipmentBaseMultiplier(item))&&equipmentBaseMultiplier(item)>0);
}
const r=new RunProgress(91),r2=new RunProgress(91);for(const run of [r,r2]){run.select(run.available()[0].id);run.begin();run.finish(true);}assert.deepEqual(r.lootRolls,r2.lootRolls);assert.equal(Object.keys(r.lootRolls).length,2);const id=r.lootChoices[0],roll={...r.lootRolls[id]};assert(r.claimReward(id));assert.deepEqual(r.equipmentRolls[id],roll);assert(!r.claimReward(id));
const chosenSkillShape=shapePoolFor(EQUIPMENT.find(i=>i.id==='longarm')).find(s=>s.metrics.area===7)??shapePoolFor(EQUIPMENT.find(i=>i.id==='longarm'))[0];
const combined={ultimate:'rage',installed:['armor-light','armor-padded','fist-iron','charm-thread','longarm'],rolls:{'armor-light':{shapeId:'white-elbow'},'armor-padded':{shapeId:'white-bar'},longarm:{shapeId:chosenSkillShape.id}}};
const total=equipmentBonuses(combined),summary=equipmentEffectSummary(combined);assert.equal(summary.find(r=>r.key==='health').value,`+${Math.floor(total.health)}`);assert.equal(summary.find(r=>r.key==='attack').value,`+${Math.floor(total.attack)}`);assert(summary.find(r=>r.key==='skill').value.includes(`${Math.floor(20*chosenSkillShape.multiplier)}%`));assert.deepEqual(equipmentEffectSummary({ultimate:'rage'}),[]);
const skillRoll={shapeId:chosenSkillShape.id},model=new AssemblyLoadout({rolls:{longarm:skillRoll}},new Set(['rage','longarm']));assert(model.place('longarm',1,1).ok);const b=new Battle();b.applyEquipment(model.loadout);b.player.energy=99;assert(b.beginSkill());assert.equal(b.attackRangeMultiplier,1+.2*chosenSkillShape.multiplier);assert.equal(b.player.energy,69);
const g=await gameFixture(60,{equipment:true,home:true});g.read('equipmentMenu.sandbox();enterArena("practice");equipmentMenu.open()');
const grid=g.hud.get('assembly-board'),dialog=g.hud.get('equipment-dialog'),trash=g.hud.get('equipment-recycle');grid.getBoundingClientRect=()=>({left:100,top:100,right:700,bottom:700,width:600,height:600});trash.getBoundingClientRect=()=>({left:800,top:300,right:900,bottom:400,width:100,height:100});
g.read('equipmentMenu.chooseEquipment()');g.hud.get('equipment-list').children.find(n=>n.dataset.itemId==='armor-light').listeners.get('click')({clientX:750,clientY:120});
const hint=dialog.children.find(n=>n.className==='assembly-rotate-hint');assert(hint&&!hint.hidden);assert.equal(hint.textContent,'按R旋转');
g.documentListeners.get('keydown')({code:'KeyR',preventDefault(){},stopPropagation(){}});grid.children[7].listeners.get('click')();assert.equal(g.read('equipmentMenu.assembly.boards.rage.placements[0].rotation'),1);assert(hint.hidden);const sumRow=g.hud.get('equipment-effects').children.find(n=>n.dataset.effect==='health');assert(sumRow);assert.equal(sumRow.children[1].textContent,`+${Math.floor(g.read('battle.gear.health'))}`);
const frozen=JSON.stringify(g.read('equipmentMenu.assembly.rolls'));let tile=g.hud.get('assembly-pieces').children[0].children[0];tile.listeners.get('pointerdown')({button:0,clientX:250,clientY:250,stopPropagation(){}});g.documentListeners.get('pointermove')({clientX:150,clientY:150,preventDefault(){}});assert(!hint.hidden);g.documentListeners.get('pointerup')({clientX:150,clientY:150});assert.equal(g.read('equipmentMenu.assembly.boards.rage.placements[0].x'),1,'Invalid drag lost original position');
tile=g.hud.get('assembly-pieces').children[0].children[0];tile.listeners.get('pointerdown')({button:0,clientX:250,clientY:250,stopPropagation(){}});g.documentListeners.get('pointermove')({clientX:850,clientY:350,preventDefault(){}});g.documentListeners.get('pointerup')({clientX:850,clientY:350});assert.equal(g.read('equipmentMenu.assembly.boards.rage.placements.length'),0);assert.equal(JSON.stringify(g.read('equipmentMenu.assembly.rolls')),frozen);assert(hint.hidden);assert.equal(g.hud.get('equipment-effects').children[0].textContent,'无','Unequipping left stale effect totals');
console.log('EQUIPMENT_ROLLS_VERIFIED: shared pools, connected shapes, area/difficulty premiums, normalized stat budgets, fixed reward rolls, save/load, skill power and cost, click/R/drop, invalid drag rollback, recycling and floating hint lifecycle');
