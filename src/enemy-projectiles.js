import {FISTWIND_STATS,PLAYER_STATS} from './battle-values.js';
import {damageTypeOf,motionDamage} from './combat-damage.js';
import {overlapsHeight} from './attack-volume.js';
export function launchEnemyProjectiles(battle,move){
 const e=battle.enemy,stats=move.projectile;
 for(let i=0;i<stats.count;i++){
  const heading=e.heading+(i-(stats.count-1)/2)*stats.spread;
  battle.enemyProjectiles.push({id:++battle.nextEnemyProjectileId,owner:e,move:{...move},heading,x:e.x+Math.sin(heading)*(e.radius+.12),z:e.z+Math.cos(heading)*(e.radius+.12),height:stats.height,
   attackPower:e.attackPower*e.damageMultiplier,speed:stats.speed,radius:stats.radius,range:stats.range,color:stats.color,travel:0});
 }
 battle.emit('enemyProjectileReleased',{...damageTypeOf(move),enemy:e,x:e.x,z:e.z,label:move.label,damage:motionDamage(e,move.motionMultiplier)});
}
function entryTime(shot,dx,dz,target,radius){
 const x=shot.x-target.x,z=shot.z-target.z,r=shot.radius+radius;
 const distance=x*x+z*z-r*r;
 if(distance<=0)return 0;
 const approach=x*dx+z*dz,length=dx*dx+dz*dz,discriminant=approach*approach-length*distance;
 if(approach>=0||discriminant<0)return Infinity;
 const entry=(-approach-Math.sqrt(discriminant))/length;
 return entry<=1?entry:Infinity;
}
function advanceProjectile(battle,shot,dt,pose){
 const step=Math.min(shot.range-shot.travel,shot.speed*dt);
 if(step<=1e-8)return;
 const x=shot.x,z=shot.z,dx=Math.sin(shot.heading)*step,dz=Math.cos(shot.heading)*step;
 const volume={yMin:shot.height-shot.radius,yMax:shot.height+shot.radius};
 let hitAt=Infinity,target=null,reflect=false;
 if(shot.reflected){
  for(const enemy of battle.enemies){
   if(!enemy.damageable||!overlapsHeight(volume,enemy,enemy.bodyHeight))continue;
   const entry=entryTime(shot,dx,dz,enemy,enemy.radius);
   if(entry<hitAt){hitAt=entry;target=enemy;}
  }
 }else{
  if(!shot.move.unblockable&&battle.isFistWindActive()&&overlapsHeight(volume,pose,FISTWIND_STATS.fieldHeight)){
   hitAt=entryTime(shot,dx,dz,pose,FISTWIND_STATS.fieldRadius);
   reflect=hitAt!==Infinity;
  }
  if(!reflect&&overlapsHeight(volume,pose,PLAYER_STATS.bodyHeight))hitAt=entryTime(shot,dx,dz,pose,PLAYER_STATS.radius);
 }
 const fraction=Math.min(1,hitAt);
 shot.x+=dx*fraction;shot.z+=dz*fraction;shot.travel+=step*fraction;
 if(battle.debugHitboxes)battle.emit('debugHitbox',{...volume,owner:shot.reflected?'player':'enemy',shape:'capsule',x,z,toX:shot.x,toZ:shot.z,radius:shot.radius});
 if(hitAt===Infinity)return;
 if(reflect){
  shot.reflected=true;shot.heading+=Math.PI;shot.travel=0;shot.color='#d9fff3';
  battle.emit('windReflect',{x:shot.x,y:shot.height,z:shot.z,heading:shot.heading});
  advanceProjectile(battle,shot,Math.max(0,dt-step*fraction/shot.speed),pose);
  return;
 }
 const origin={x:shot.x,z:shot.z,height:shot.height,heading:shot.heading,attackPower:shot.attackPower};
 if(shot.reflected){
  battle.damageEnemy(target,motionDamage(shot,shot.move.motionMultiplier),{...damageTypeOf(shot.move),
   label:'拳风反弹',impactLevel:shot.move.impactLevel??0,origin,source:'reflectedProjectile'});
 }else{
  const hit={...shot.move,reach:shot.radius+.002,halfAngle:Math.PI,heightMin:-shot.radius,heightMax:shot.radius};
  const lag=Math.max(0,dt-step*fraction/shot.speed)/(battle.worldTimeScale||1);
  battle.withEnemy(shot.owner,()=>battle.strikePlayer(pose,hit,lag,origin));
 }
 shot.spent=true;
}
export function updateEnemyProjectiles(battle,dt,pose){
 for(const shot of battle.enemyProjectiles)advanceProjectile(battle,shot,dt,pose);
 battle.enemyProjectiles=battle.enemyProjectiles.filter(s=>!s.spent&&s.travel<s.range-1e-9);
}
