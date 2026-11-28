import assert from 'node:assert/strict';
import {AdditiveBlending,Object3D,Scene} from 'three';
import {Battle} from '../src/battle.js';
import {AIR_SLAM,AirSlam,ATTACK_RATE,attackCanFinish,attackRate,attackRecoveryGap,PALM_RELEASE_CLIP_TIME} from '../src/combat.js';
import {activeBuffs} from '../src/buff-status.js';
import {PROFESSIONS} from '../src/professions.js';
import {ATTACK_STATS,ENEMY_STATS,PLAYER_STATS,FISTWIND_STATS,RAGE_STATS,WAVE_STATS} from '../src/battle-values.js';
import {COMBAT_DAMAGE_TYPES,DAMAGE_DELIVERY,DAMAGE_ELEMENTS,combineResistances,damageTypeLabel,playerDamageComponents} from '../src/combat-damage.js';
import {EQUIPMENT,equipmentBonuses,equipmentEffectSummary} from '../src/equipment.js';
import {resolveEquipment,rollEquipment} from '../src/equipment-rolls.js';
import {AssemblyLoadout} from '../src/assembly-board.js';
import {shapePoolFor} from '../src/equipment-shapes.js';
import {EQUIPMENT_PASSIVES} from '../src/equipment-passives.js';
import {MONSTER_STATS} from '../src/monster-catalog.js';
import {SAMURAI_MOVES,samuraiSequence} from '../src/samurai.js';
import {updateEnemyProjectiles} from '../src/enemy-projectiles.js';
import {createWeatherEffects} from '../src/weather-effects.js';

const near=(value,expected)=>assert(Math.abs(value-expected)<1e-8,JSON.stringify([value,expected]));
 near(combineResistances({fire:20},{fire:20,water:15}).fire,36);
 near(combineResistances({fire:20},{fire:20,water:15}).water,15);
 assert.deepEqual(MONSTER_STATS.cinderWarden.resistances,{normal:20,water:0,fire:60,electric:20,melee:10,ranged:20});
 for(const stats of Object.values(MONSTER_STATS)){
  assert.deepEqual(Object.keys(stats.resistances),Object.keys({...DAMAGE_ELEMENTS,...DAMAGE_DELIVERY}));
  assert(Object.values(stats.resistances).every(value=>value>=0&&value<=100&&value%5===0));
 }
const attacks=[...Object.values(ATTACK_STATS),ENEMY_STATS,WAVE_STATS,...Object.values(COMBAT_DAMAGE_TYPES)];
for(const {moves} of Object.values(MONSTER_STATS)){
 for(const move of moves){
  if(move.dealsDamage)attacks.push(move);
  if(move.aura?.hit)attacks.push(move.aura.hit);
  if(move.recoveryStrike?.attack)attacks.push(move.recoveryStrike.attack);
 }
}
for(const id of Object.keys(SAMURAI_MOVES))for(const phase of [1,2,3]){
 const moves=samuraiSequence(id,phase);
 assert(moves.every(move=>move.element===(phase===1?'normal':'electric')));
 attacks.push(...moves);
}
for(const attack of attacks){
 assert(Object.hasOwn(DAMAGE_DELIVERY,attack.delivery),attack.label);
 assert(Object.hasOwn(DAMAGE_ELEMENTS,attack.element),attack.label);
}

const items=EQUIPMENT.filter(item=>item.passives?.elementalFury);
assert.equal(items.length,9);
for(const rarity of ['blue','purple','gold'])assert.equal(items.filter(item=>item.rarity===rarity).length,3);
for(const item of items)assert(shapePoolFor(item).length>0);
assert.equal(EQUIPMENT_PASSIVES.elementalFury.effect(5),'水、火、电属性伤害+50%');
const [armor,gloves]=['armor-stormmantle','fist-tidebreaker'].map(id=>EQUIPMENT.find(item=>item.id===id));
try{
 armor.resistances={fire:20,normal:10};
 gloves.resistances={fire:20,water:15};
 assert.deepEqual(equipmentBonuses({installed:[armor.id,gloves.id]}).resistances,{normal:15.4,water:15,fire:36,electric:0,melee:0,ranged:0});
}finally{
 delete armor.resistances;
 delete gloves.resistances;
}
const battle=new Battle();
battle.applyEquipment({ultimate:'rain',installed:items.map(item=>item.id)});
assert.equal(battle.passives.elementalFury,5);
const summary=equipmentEffectSummary(battle.loadout).find(row=>row.key==='passive-elementalFury');
assert.equal(summary.value,'等级 5/5');
assert.equal(summary.icon,'elemental-fury');
battle.player.attackPower=10;
// Isolate the requested bonus from any other passive or equipment stats.
battle.passives={elementalFury:5};
const pose={x:0,z:0,heading:0,height:0};
const target=battle.enemy;
Object.assign(target,{z:1,health:1000,stats:{...target.stats,resistances:MONSTER_STATS.cinderWarden.resistances}});
for(const [profile,expected] of [[COMBAT_DAMAGE_TYPES.punch,7.2],[COMBAT_DAMAGE_TYPES.ragePunch,5.4],
 [COMBAT_DAMAGE_TYPES.rain,12],[COMBAT_DAMAGE_TYPES.chargedOrb,9.6]]){
 assert.equal(battle.damageEnemy(target,battle.playerDamage(1,profile),{...profile,label:'test',impactLevel:0,origin:pose}),expected);
 const event=battle.takeEvents().find(event=>event.type==='enemyHit');
 assert.equal(event.delivery,profile.delivery);
 assert.equal(event.element,profile.element);
}
for(const [id,element,expected] of [['fist-tidebreaker','water',8.55],['charm-cinderlens','fire',5.76],['armor-stormmantle','electric',7.56]]){
 const item=EQUIPMENT.find(item=>item.id===id);
 assert.equal(EQUIPMENT_PASSIVES[element+'Specialist'].max,1);
 battle.passives=item.passives;
 const damage=battle.damageEnemy(target,10,{...COMBAT_DAMAGE_TYPES.punch,label:'test',impactLevel:0,origin:pose});
 assert.equal(damage,expected);
 const hit=battle.takeEvents().find(event=>event.type==='enemyHit');
 assert.deepEqual(hit.components.map(part=>part.element),['normal',element]);
 assert.equal(damageTypeLabel(hit),'近战 · 普通 / '+DAMAGE_ELEMENTS[element]);
}
const two=playerDamageComponents(12,'normal',{fireSpecialist:1,waterSpecialist:1});
assert.deepEqual(two,[{element:'water',amount:6},{element:'fire',amount:6}]);
const three=playerDamageComponents(12,'normal',{fireSpecialist:1,waterSpecialist:1,electricSpecialist:1});
assert.deepEqual(three.map(part=>part.amount),[4,4,4]);
battle.passives={elementalFury:5};
const orb=battle.launchWave(pose);
assert.equal(orb.damage,54);
assert.equal(orb.delivery,'ranged');
assert.equal(orb.element,'electric');

const adventurer=new Battle();
for(const [id,stats] of Object.entries(PROFESSIONS)){
 adventurer.reset('practice',{profession:id,runHealthBonus:10});
 assert.equal(adventurer.maxHealth,stats.health+10);
 assert.equal(adventurer.player.health,adventurer.maxHealth);
 assert.equal(adventurer.player.pose,stats.pose);
 assert.equal(adventurer.launchWave(pose).element,stats.orbElement);
}
adventurer.reset('practice',{profession:'water',runHealthBonus:0});
near(adventurer.playerHitResistance({element:'water',delivery:'ranged'}),.7*.9);
near(adventurer.playerHitResistance({element:'water',delivery:'melee'}),.7*.95);
adventurer.reset('practice',{profession:null});
assert.equal(adventurer.chargedOrbElement,'electric');

const defender=new Battle();
defender.applyEquipment({ultimate:'rain'});
defender.player.resistances.electric=20;
defender.gear.resistances.electric=25;
defender.player.effects.apply({type:'resistance',element:'electric',amount:50,duration:2},0);
defender.player.effects.apply({type:'resistance',element:'fire',amount:20,duration:2},0);
near(defender.playerResistanceMultiplier('electric'),.3);
near(defender.playerResistanceMultiplier('electric',2),.6);
near(defender.playerResistanceMultiplier('fire'),.8);
defender.player.resistances.water=100;
near(defender.playerResistanceMultiplier('water'),.01);
const origin={x:0,z:1,height:0,heading:Math.PI,attackPower:10};
const attack={motionMultiplier:1,poseDamage:0,impactLevel:0,reach:2,halfAngle:Math.PI,heightMin:0,heightMax:1};
defender.strikePlayer(pose,{...attack,...COMBAT_DAMAGE_TYPES.samuraiLightning},0,origin);
assert.equal(defender.player.health,97);
defender.player.invulnerableUntil=0;
defender.strikePlayer(pose,{...attack,...COMBAT_DAMAGE_TYPES.ragePunch},0,origin);
assert.equal(defender.player.health,89);
assert(defender.takeEvents().some(event=>event.type==='playerHit'&&event.delivery==='ranged'&&event.element==='electric'));

for(const [mode,distance,label,delivery,element] of [
 ['stonekeeper',4.7,'涡流水弹','ranged','water'],
 ['stonekeeper',1.5,'涌潮震足','melee','water'],
 ['scythemoth',4.7,'引雷飞镰','melee','electric'],
 ['scythemoth',1.5,'雷镰贯刺','melee','electric'],
]){
 const b=new Battle();
 b.reset(mode);
 b.enemy.z=distance;b.enemy.heading=Math.PI;
 if(label==='涌潮震足'){
  const stats={...b.enemy.stats,ai:{cycle:[5]}};
  b.enemy.stats=b.enemyStats=stats;
 }
 let hit;
 const strike=b.strikePlayer.bind(b);
 b.strikePlayer=(pose,move,...args)=>{
  if(move.label===label)hit=move;
  return strike({...pose,invulnerable:true},move,...args);
 };
 for(let i=0;i<480&&!hit;i++){
  b.update(1/60,pose);
  hit??=b.takeEvents().find(event=>event.type==='enemyProjectileReleased'&&event.label===label);
 }
 assert(hit,label);
 assert.equal(hit.element,element);
 assert.equal(hit.delivery,delivery);
}
const physicalBattle=new Battle();
physicalBattle.reset('practice',{profession:'metal'});
physicalBattle.applyEquipment({installed:['armor-soft','armor-knight','charm-empty-forge'],emptyCells:4});
near(physicalBattle.playerHitResistance({element:'normal',delivery:'melee'}),.8*.95*.9*.96*.96*.85);
near(physicalBattle.playerHitResistance({element:'fire',delivery:'melee'}),.95*.85);
physicalBattle.player.health=physicalBattle.maxHealth*.8;
assert.equal(physicalBattle.goldenGuardResistance,0);
near(physicalBattle.playerHitResistance({element:'normal',delivery:'ranged'}),.8*.95*.9*.96*.95);

for(const [item,element,expected] of [
 ['armor-soft','normal',9.5],['armor-soft','water',10],['armor-soft','fire',10],['armor-soft','electric',10],
 ['armor-scale','normal',11],['armor-scale','fire',10],
]){
 const b=new Battle();b.applyEquipment({installed:[item]});
 b.player.shield=20;
 b.strikePlayer(pose,{...attack,delivery:'ranged',element},0,origin);
 assert.equal(b.player.health,b.maxHealth);
 near(20-b.player.shield,expected);
}
assert.equal(equipmentEffectSummary({installed:['armor-scale']}).find(row=>row.key==='normal').value,'-10%');

const stone=EQUIPMENT.find(item=>item.id==='fist-stone');
assert.equal(stone.rarity,'blue');
assert.equal(stone.attack,undefined);
assert.deepEqual(stone.passives,{reach:1});
const newRoll=rollEquipment(stone.id,()=>0);
const newStone=resolveEquipment(stone.id,newRoll);
assert(shapePoolFor(stone).some(shape=>shape.id===newRoll.shapeId&&shape.rarity==='blue'));
const oldRoll={shapeId:'white-domino'};
const model=new AssemblyLoadout({rolls:{[stone.id]:oldRoll}},new Set(['rage',stone.id]));
assert.deepEqual(model.item(stone.id).shape,['##']);
assert(model.place(stone.id,1,1).ok);
assert.deepEqual(new AssemblyLoadout(model.snapshot(),new Set(['rage',stone.id])).rolls[stone.id],oldRoll);
assert(newStone.physicalResistance>model.item(stone.id).physicalResistance);
assert.equal(resolveEquipment(stone.id,newRoll,{level:1}).physicalResistance*100,
 Math.ceil(newStone.physicalResistance*100*1.35-1e-9));

for(const concentration of [0,3]){
 const charge=new Battle();
 charge.passives={concentration};
 charge.player.counterReady=true;charge.player.counterUntil=5;
 assert(charge.beginCounterCharge());
 charge.time=.01;
 assert(!charge.releaseCounterCharge());
 assert(charge.counterCharge.releaseQueued);
 assert.equal(charge.player.counterUntil,5);
 assert.equal(charge.waves.length,0);
 charge.time=.499;
 assert(!charge.counterChargeAutoRelease);
 charge.time=.5;
 assert(charge.counterChargeAutoRelease);
 assert(charge.releaseCounterCharge());
 near(charge.pendingChargeMultiplier,1);

 for(const [held,expected] of [[.5,1],[1.2,concentration?1.4:1.2],[3,1.8]]){
  assert(charge.beginCounterCharge());
  charge.time+=held;
  if(held===3)assert(charge.counterChargeFull);
  assert(charge.releaseCounterCharge());
  charge.clearCounter();charge.beginAttack('CounterWave');
  near(charge.attack.chargeMultiplier,expected);
  charge.resolveAttack(.539,pose);assert.equal(charge.waves.length,0);
  charge.resolveAttack(.54,pose);assert.equal(charge.waves.length,1);
  near(charge.waves[0].damage,Math.round(36*expected*100)/100);
  charge.waves=[];
  charge.player.counterReady=true;charge.player.counterUntil=charge.time+5;
 }
}
const interruptedCharge=new Battle();
interruptedCharge.player.counterReady=true;interruptedCharge.player.counterUntil=.2;
assert(interruptedCharge.beginCounterCharge());
interruptedCharge.time=.3;
assert(!interruptedCharge.releaseCounterCharge());
interruptedCharge.cancelCounterCharge();
interruptedCharge.expireCounter();
assert(!interruptedCharge.player.counterReady);
interruptedCharge.time=.5;
assert(!interruptedCharge.counterChargeAutoRelease);
assert(!interruptedCharge.releaseCounterCharge());
assert.equal(attackRecoveryGap('CounterWave'),ATTACK_RATE.normalGap);
assert.equal(attackRecoveryGap('CounterWave'),attackRecoveryGap('Attack4'));
for(const time of [PALM_RELEASE_CLIP_TIME,.75,.83,1,1.179,1.18]){
 assert.equal(attackRate('CounterWave',time,1.2,1.4),attackRate('Attack4',time,1.2,1.4));
 assert.equal(attackCanFinish('CounterWave',time,true),attackCanFinish('Attack4',time,true));
}

const originalAirScale=AIR_SLAM.durationScale;
try{
 for(const height of [0,.8])for(const chargeScale of [1,.6]){
  AIR_SLAM.durationScale=1;
  const oldSlam=new AirSlam(height,chargeScale);
  AIR_SLAM.durationScale=originalAirScale;
  const newSlam=new AirSlam(height,chargeScale);
  for(const key of ['charge','landTime','recoveryStart','duration'])near(newSlam[key],oldSlam[key]*1.05);
  for(const t of [oldSlam.charge/2,(oldSlam.charge+oldSlam.landTime)/2,(oldSlam.recoveryStart+oldSlam.duration)/2])
   near(oldSlam.sample(t).clipTime,newSlam.sample(t*1.05).clipTime);
 }
}finally{AIR_SLAM.durationScale=originalAirScale;}
near(ATTACK_STATS.AirAttack.range,1.85*.9);
for(const [distance,hit] of [[1.66,true],[1.75,false]]){
 const b=new Battle();
 b.enemy.radius=0;b.enemy.z=distance;
 b.beginAttack('AirAttack');
 b.resolveAttack(.5,{...pose,landed:true});
 assert.equal(b.takeEvents().some(event=>event.type==='enemyHit'),hit);
}

const rage=new Battle(),normal=new Battle();
rage.reset('practice',{profession:'rage',runHealthBonus:15});
rage.player.energy=RAGE_STATS.energyCost;rage.player.health=80;
assert(rage.beginRage());
for(const b of [rage,normal]){b.enemy.z=5;for(let i=0;i<20;i++)b.update(.05,pose);}
assert.equal(rage.enemyTime,normal.enemyTime);
near(rage.enemy.z,normal.enemy.z);
rage.enemy.z=1;
rage.beginAttack('Attack1');rage.resolveAttack(.3,pose);
near(rage.player.health,83.6);
const rageBuffs=activeBuffs(rage);
assert(rageBuffs.some(buff=>buff.id==='lifesteal'&&buff.label.includes('3%')));
assert(!rageBuffs.some(buff=>buff.id==='slow'));

const chainBattle=new Battle();
chainBattle.applyEquipment({ultimate:'electric'});
Object.assign(chainBattle.enemy,{x:0,z:2,health:10000,act(){}});
chainBattle.player.energy=40;
const chainScene=new Scene(),chainHand=new Object3D();
chainScene.add(chainHand);
const weather=createWeatherEffects(chainScene);
const weatherRoot=chainScene.getObjectByName('weather-ultimate-effects');
const chainCore=weatherRoot.children.find(mesh=>mesh.isInstancedMesh);
const chainLine=weatherRoot.children.find(mesh=>mesh.isLineSegments);
weatherRoot.traverse(object=>assert(!object.isLight,'Weather visuals must not light the scene'));
for(const mesh of [chainCore,chainLine]){
 assert.equal(mesh.material.blending,AdditiveBlending);
 assert(!mesh.material.depthWrite&&!mesh.castShadow&&!mesh.receiveShadow);
}
assert(chainBattle.beginUltimate(pose));
const chainTick=()=>{
 chainBattle.player.energy=40;
 chainBattle.update(.05,pose);
 chainBattle.update(.05,pose);
 const events=chainBattle.takeEvents();
 weather.update(chainBattle.electricChain,chainBattle.time,events,chainHand);
 return events.find(event=>event.type==='enemyHit')?.damage;
};
const chain=chainBattle.electricChain;
const power=()=>{
 chainBattle.player.energy=39;
 return [1,2,5,15].map(multiplier=>chainBattle.playerDamage(chain.stats.multiplier*multiplier,COMBAT_DAMAGE_TYPES.electric));
};
const [initial,double,fivefold,fifteenfold]=power();
assert.equal(chainTick(),initial);
assert(chainLine.visible&&chainCore.visible);
let segments=chainCore.count;
for(const next of [double,fivefold,fifteenfold]){
 for(let i=0;i<29;i++)chainTick();
 assert.equal(chainTick(),next);
 assert(chainCore.count>segments,'Higher stages must add visible branches');
 segments=chainCore.count;
}
for(let i=0;i<31;i++)assert.equal(chainTick(),fifteenfold);
chainBattle.enemy.z=8;assert.equal(chainTick(),undefined);
assert(!chainLine.visible&&!chainCore.visible);
chainBattle.enemy.z=2;assert.equal(chainTick(),initial);
assert(chainLine.visible&&chainCore.visible);
chainBattle.strikePlayer({...pose,invulnerable:true},attack,0,origin);
assert(chainBattle.electricChain,'A dodged attack should leave the chain active');
chainBattle.player.shield=20;
chainBattle.strikePlayer(pose,attack,0,origin);
assert.equal(chainBattle.electricChain,null,'Level-zero hits stop the chain even when the shield absorbs all damage');
weather.update(chainBattle.electricChain,chainBattle.time,[],chainHand);
assert(weatherRoot.children.every(mesh=>!mesh.visible));
assert.equal(chainBattle.player.health,chainBattle.maxHealth);
assert(chainBattle.beginUltimate(pose));
chainBattle.beginAttack('Attack1');
assert.equal(chainBattle.electricChain,null);
assert.equal(chainBattle.attack.name,'Attack1');

const wind=new Battle();
wind.applyEquipment({ultimate:'fistwind'});
wind.player.energy=100;
assert(wind.beginUltimate(pose));
Object.assign(wind.enemy,{x:0,z:3,health:1000,act(){}});
const projectile={x:0,z:2.5,heading:Math.PI,height:.8,attackPower:10,radius:.15,
 speed:8,range:15,travel:0,owner:wind.enemy,move:{...COMBAT_DAMAGE_TYPES.chargedOrb,motionMultiplier:1,poseDamage:0,impactLevel:0}};
wind.enemyProjectiles.push(projectile);
updateEnemyProjectiles(wind,.2,pose);
assert(projectile.reflected);
assert(projectile.z>FISTWIND_STATS.fieldRadius);
assert.equal(wind.player.health,100);
updateEnemyProjectiles(wind,.25,pose);
assert.equal(wind.enemy.health,990);
assert(wind.takeEvents().some(event=>event.type==='enemyHit'&&event.label==='拳风反弹'&&event.element==='electric'));
const unblockable={...projectile,z:2.5,heading:Math.PI,travel:0,spent:false,reflected:false,move:{...projectile.move,unblockable:true}};
wind.enemyProjectiles.push(unblockable);
wind.time=.5;
updateEnemyProjectiles(wind,.35,pose);
assert(!unblockable.reflected);
assert.equal(wind.player.health,90);

const gust={pose,volume:{yMin:0,yMax:1.9},range:2.5,halfAngle:Math.PI,damage:3};
for(const resistance of [0,1,3]){
 Object.assign(wind.enemy,{x:0,z:1,state:'windup',move:{startupResilience:resistance},elapsed:.4});
 wind.applyFistWind(gust);
 const expectedPush=PLAYER_STATS.radius*2*FISTWIND_STATS.pushBodyFraction*(1-resistance/3);
 assert(Math.abs(wind.enemy.z-1-expectedPush)<1e-8);
 assert.equal(wind.enemy.state,'windup');
 assert.equal(wind.enemy.elapsed,.4);
 assert(wind.takeEvents().some(event=>event.type==='enemyHit'&&event.label==='拳风'&&event.impactLevel===0));
}
console.log('DAMAGE_TYPES_VERIFIED: tags, resistances, elemental passives, projectile snapshot, electric ramp, wind reflection and push');
