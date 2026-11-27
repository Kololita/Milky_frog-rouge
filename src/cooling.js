import {COMBAT_DAMAGE_TYPES} from './combat-damage.js';

export const MOLTEN_POOL=Object.freeze({x:-7,z:3,radius:2.35,collisionRadius:2.58});
export const BOILER_VALVES=Object.freeze([{x:-6,z:-2},{x:2,z:-6},{x:6,z:2},{x:-2,z:6}]);
const valveCenter=BOILER_VALVES.reduce((center,valve)=>({
 x:center.x+valve.x/BOILER_VALVES.length,z:center.z+valve.z/BOILER_VALVES.length,
}),{x:0,z:0});
const furnaceHeading=Math.atan2(MOLTEN_POOL.x-valveCenter.x,MOLTEN_POOL.z-valveCenter.z);
export const FOUNDRY_ENEMY_SPAWN={...valveCenter,heading:Math.atan2(valveCenter.x-MOLTEN_POOL.x,valveCenter.z-MOLTEN_POOL.z)};
export const FOUNDRY_PLAYER_SPAWN={x:2*valveCenter.x-MOLTEN_POOL.x,z:2*valveCenter.z-MOLTEN_POOL.z,heading:furnaceHeading};
export const FOUNDRY_CONTROL_ANGLES=Object.freeze([Math.PI*.3,Math.PI*1.3]);
export function createFoundryColliders(mode){
 if(mode!=='cinderWarden')return [];
 const circle=(x,z,radius)=>({x,z,radius,health:1});
 const colliders=BOILER_VALVES.flatMap(({x,z})=>[
  circle(x,z,.35),circle(x,z+.30,.14),
 ]);
 const {x,z,collisionRadius}=MOLTEN_POOL;
 colliders.push(circle(x,z,collisionRadius));
 // The short service railing extends past the reservoir only on this arc.
 for(let i=0;i<=5;i++){
  const angle=Math.PI*(.8+.3*i/5);
  colliders.push(circle(x+2.75*Math.cos(angle),z-2.75*Math.sin(angle),.07));
 }
 for(const angle of FOUNDRY_CONTROL_ANGLES){
  for(const side of [-1,1]){
   colliders.push(circle(Math.sin(angle)*10.65+side*.24*Math.cos(angle),
    Math.cos(angle)*10.65-side*.24*Math.sin(angle),.34));
  }
 }
 return colliders;
}
export const COOLING={radius:4,duration:5,cooldown:30,health:20,tick:.2,damage:.6};
export function createCoolingState(mode){return mode==='cinderWarden'?BOILER_VALVES.map(v=>({...v,until:0,readyAt:0,nextTick:0,health:COOLING.health,maxHealth:COOLING.health,radius:.4,bodyHeight:1.3,brokenAt:-Infinity})):[];}
export function watered(zones,point,time){return zones.some(z=>time<z.until-1e-9&&Math.hypot(point.x-z.x,point.z-z.z)<=COOLING.radius);}
export function damageCoolingValve(battle,valve,damage){
 if(valve.health<=0||damage<=0)return false;
 valve.health=Math.max(0,valve.health-damage);valve.flashUntil=battle.enemyTime+.15;
 if(valve.health===0){valve.brokenAt=battle.enemyTime;valve.until=battle.enemyTime+COOLING.duration;valve.readyAt=Infinity;battle.emit('coolingActivated',{x:valve.x,z:valve.z});}
 return true;
}
export function updateCooling(battle,pose){
 const zones=battle.coolingValves;

 if(watered(zones,pose,battle.enemyTime)&&battle.player.effects.has('burn')){battle.player.effects.remove('burn');battle.emit('statusRemoved',{status:'burn'});}
 for(const enemy of battle.enemies){
  if(enemy.activeAura&&zones.some(z=>battle.enemyTime<z.until&&Math.hypot(enemy.x-z.x,enemy.z-z.z)<=COOLING.radius+enemy.activeAura.outerRadius)){enemy.nextAuraAt=battle.enemyTime+enemy.activeAura.cooldown;enemy.activeAura=null;}
  enemy.waterZones=zones;const zone=zones.find(z=>watered([z],enemy,battle.enemyTime));if(!zone||!enemy.alive)continue;
  enemy.effects.remove('burn');enemy.effects.apply({type:'cooling',amount:1,duration:.3},battle.enemyTime);
  if(enemy.activeAura){enemy.nextAuraAt=battle.enemyTime+enemy.activeAura.cooldown;enemy.activeAura=null;}
  if(battle.enemyTime>=(enemy.nextCoolingTick??0)-1e-9){
   enemy.nextCoolingTick=battle.enemyTime+COOLING.tick;
   battle.damageEnemy(enemy,COOLING.damage,{...COMBAT_DAMAGE_TYPES.cooling,label:'冷却水',impactLevel:1,origin:{x:zone.x,z:zone.z,heading:0,ignoreImpactResistance:true},source:'environment',credited:false});
   if(enemy.state==='hurt')enemy.stun=Math.max(enemy.stun,.3);
  }
 }
}
