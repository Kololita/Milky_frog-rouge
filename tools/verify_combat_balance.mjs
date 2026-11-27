import assert from 'node:assert/strict';
import {ASSEMBLY_BOARDS,ASSEMBLY_BOARD_REVISION,AssemblyLoadout} from '../src/assembly-board.js';
import {Battle} from '../src/battle.js';
import {EQUIPMENT,equipmentEffectSummary} from '../src/equipment.js';
import {equipmentDescription,resolveEquipment,validEquipmentRoll} from '../src/equipment-rolls.js';
import {SHAPES,shapePoolFor} from '../src/equipment-shapes.js';
import {MONSTER_STATS} from '../src/monster-catalog.js';
import {motionDamage} from '../src/combat-damage.js';

const battle=new Battle();
assert.equal(battle.maxPose,50);
assert.equal(battle.player.pose,50);
assert.equal(battle.laughRecoveryDuration,3.5);
for(const floor of [0,1,8,16]){
 battle.reset('stonekeeper',{floor});
 const stone=MONSTER_STATS.stonekeeper;
 assert.equal(battle.enemy.maxHealth,stone.health*(1+floor*.02));
 assert.equal(battle.enemy.attackPower,11*(1+floor*.02));
 if(floor===0)assert.equal(motionDamage(battle.enemy,stone.moves[0].motionMultiplier),44);
}
battle.reset('practice',{floor:16});
assert.equal(battle.enemy.maxHealth,battle.enemy.stats.health);

const player={x:0,z:0,height:0,heading:0};
battle.reset('raider-lantern',{floor:0});
const [melee,leader]=battle.enemies;
Object.assign(leader,{x:-2,z:0});
battle.groupAggressor=leader;
battle.groupAggroChangedAt=battle.enemyTime;
for(const [distance,chases] of [[4,true],[4.01,false],[3.9,true],[6,false]]){
 Object.assign(melee,{x:0,z:distance,state:'idle'});
 battle.update(1/60,player);
 assert.equal(battle.groupAggressor,leader);
 assert.equal(melee.z<distance,chases);
}
battle.reset('spitter-raider',{floor:0});
const [ranged,primary]=battle.enemies;
battle.groupAggressor=primary;
assert.equal(battle.canEnemyChase(ranged,3),false);
assert.equal(battle.canEnemyChase(primary,8),true);
assert.equal(battle.canEnemyAttack(ranged,ranged.stats.moves[0],4),true);
assert.equal(battle.canEnemyAttack(ranged,ranged.stats.moves[0],4.01),false);

assert.equal(equipmentDescription({id:'test',physicalResistance:.07}),'物理抗性+7%');
assert.equal(equipmentDescription({id:'test',physicalResistance:-.07}),'物理抗性-7%');
assert.equal(equipmentEffectSummary({installed:['armor-scale']}).find(row=>row.key==='normal').value,'-10%');

const sword=EQUIPMENT.find(item=>item.slot==='gloves'&&item.rarity==='gold');
const oldRoll={shapeId:'gold-sword'};
assert(shapePoolFor(sword).some(shape=>shape.id===oldRoll.shapeId));
assert(validEquipmentRoll(sword,oldRoll));
const oldBoard=new AssemblyLoadout({rolls:{[sword.id]:oldRoll},boards:{rage:{level:2,placements:[{id:sword.id,x:0,y:0,rotation:0}]}}});
assert.equal(oldBoard.placements.length,1);
assert.deepEqual(resolveEquipment(sword.id,oldBoard.rolls[sword.id]).shape,SHAPES['gold-sword'].shape);
assert(!validEquipmentRoll(EQUIPMENT.find(item=>item.id==='charm-empty-forge'),{shapeId:'accessory-gold-e'}));

for(const id of ['rage','fistwind']){
 const {levels}=ASSEMBLY_BOARDS.get(id);
 assert.deepEqual(levels.map(mask=>mask.join('').match(/#/g).length),[16,22,28,36]);
 for(const mask of levels){
  for(const [row,cells] of mask.entries()){
   const opposite=id==='rage'?mask[mask.length-1-row]:cells;
   assert.equal(cells,[...opposite].reverse().join(''));
  }
 }
 const model=new AssemblyLoadout({ultimate:id});
 for(let level=1;level<=3;level++){
  assert(model.upgrade(id));
  assert.equal(model.board(id).level,level);
  assert.equal(new AssemblyLoadout(model.snapshot()).board(id).level,level);
 }
 assert(!model.upgrade(id));
 for(const [oldLevel,newLevel] of [[1,2],[2,3]])assert.equal(new AssemblyLoadout({boards:{[id]:{level:oldLevel}}}).board(id).level,newLevel);
}
const [,rageLevelOne,rageLevelTwo]=ASSEMBLY_BOARDS.get('rage').levels;
assert.deepEqual(rageLevelTwo,rageLevelOne.map((row,y)=>
 [...row].map((cell,x)=>cell==='#'||rageLevelOne[row.length-1-x][y]==='#'?'#':'.').join('')));
const oldLayout=new AssemblyLoadout({rolls:{'armor-light':{shapeId:'armor-white-domino'}},boards:{rage:{level:1,placements:[{id:'armor-light',x:0,y:1,rotation:0}]}}});
assert.equal(oldLayout.placements.length,1);
assert.equal(oldLayout.snapshot().boardRevision,ASSEMBLY_BOARD_REVISION);
assert.deepEqual(oldLayout.item('armor-light').shape,['##']);
assert.equal(oldLayout.item('armor-light').shapeMultiplier,1.07);
const previousPinwheel=new AssemblyLoadout({boardRevision:1,rolls:{'armor-light':{shapeId:'armor-white-domino'}},boards:{rage:{level:2,placements:[{id:'armor-light',x:0,y:0,rotation:0}]}}});
assert.equal(previousPinwheel.board().level,2);
assert.equal(previousPinwheel.placements.length,1);
assert.notDeepEqual(previousPinwheel.placements[0],{id:'armor-light',x:0,y:0,rotation:0});
const elbow=EQUIPMENT.find(item=>item.id==='armor-light');
const elementalIds=['metal','wood','water','earth','rain','thunder','electric'];
for(let level=0;level<=3;level++){
 const masks=elementalIds.map(id=>ASSEMBLY_BOARDS.get(id).levels[level].join(''));
 assert.equal(new Set(masks).size,elementalIds.length);
 for(const mask of masks)assert.equal(mask.split('#').length-1,[16,22,28,36][level]);
}
for(const id of elementalIds){
 const previousRevision=['rain','thunder','electric'].includes(id)?3:2;
 const saves={boardRevision:previousRevision,ultimate:id,rolls:{'armor-light':{shapeId:'armor-white-domino'}},
  boards:{[id]:{level:0,placements:[{id:'armor-light',x:2,y:2,rotation:0}]}}};
 const model=new AssemblyLoadout(saves);
 const empty=new AssemblyLoadout({ultimate:id});
 for(const skill of ['shield','longarm','drain','focus'])assert(empty.firstFit(skill),id+' can fit '+skill);
 assert.deepEqual(model.placements,[{id:'armor-light',x:3,y:3,rotation:0}]);
 assert.deepEqual(new AssemblyLoadout(model.snapshot()).placements,model.placements);
}
const relocated=new AssemblyLoadout({boardRevision:2,ultimate:'water',rolls:{'armor-light':{shapeId:'armor-white-domino'}},
 boards:{water:{level:0,placements:[{id:'armor-light',x:1,y:1,rotation:0}]}}});
assert.equal(relocated.placements.length,1);
assert(relocated.check('armor-light',relocated.placements[0].x,relocated.placements[0].y,relocated.placements[0].rotation).ok);
assert.equal(shapePoolFor(elbow).filter(shape=>shape.id==='white-elbow').length,1);
assert.equal(resolveEquipment(elbow.id,{shapeId:'white-notch'}).shapeMultiplier,1.6);
console.log('COMBAT_BALANCE_VERIFIED: combat stats, original shape rolls, 16/22/28/36 boards, symmetry and save migration');
