import {PLAYER_STATS} from './battle-values.js';
import {motionDamage} from './combat-damage.js';
import {overlapsHeight} from './attack-volume.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function launchEnemyProjectiles(battle,move){
 const e=battle.enemy,stats=move.projectile;
 for(let i=0;i<stats.count;i++){
  const heading=e.heading+(i-(stats.count-1)/2)*stats.spread;
  battle.enemyProjectiles.push({id:++battle.nextEnemyProjectileId,owner:e,move:{...move},heading,x:e.x+Math.sin(heading)*(e.radius+.12),z:e.z+Math.cos(heading)*(e.radius+.12),height:stats.height,
   attackPower:e.attackPower*e.damageMultiplier,speed:stats.speed,radius:stats.radius,range:stats.range,color:stats.color,travel:0});
 }
 battle.emit('enemyProjectileReleased',{enemy:e,x:e.x,z:e.z,label:move.label,damage:motionDamage(e,move.motionMultiplier)});
}
export function updateEnemyProjectiles(battle,dt,pose){
 for(const shot of battle.enemyProjectiles){
  const x=shot.x,z=shot.z,step=Math.min(shot.range-shot.travel,shot.speed*dt),dx=Math.sin(shot.heading)*step,dz=Math.cos(shot.heading)*step;
  shot.x+=dx;shot.z+=dz;shot.travel+=step;
  const volume={yMin:shot.height-shot.radius,yMax:shot.height+shot.radius};
  if(battle.debugHitboxes)battle.emit('debugHitbox',{...volume,owner:'enemy',shape:'capsule',x,z,toX:shot.x,toZ:shot.z,radius:shot.radius});
  if(!overlapsHeight(volume,pose,PLAYER_STATS.bodyHeight))continue;
  const length2=dx*dx+dz*dz;if(length2<1e-12)continue;
  const px=x-pose.x,pz=z-pose.z,r=shot.radius+PLAYER_STATS.radius,b=px*dx+pz*dz,disc=b*b-length2*(px*px+pz*pz-r*r);
  if(disc<0)continue;
  const enter=px*px+pz*pz<=r*r?0:(-b-Math.sqrt(disc))/length2;if(enter<0||enter>1)continue;
  const u=clamp(enter,0,1),origin={x:x+dx*u,z:z+dz*u,height:shot.height,heading:shot.heading,attackPower:shot.attackPower};
  const hit={...shot.move,reach:shot.radius+.002,halfAngle:Math.PI,heightMin:-shot.radius,heightMax:shot.radius};
  battle.withEnemy(shot.owner,()=>battle.strikePlayer(pose,hit,dt*(1-u)/(battle.worldTimeScale||1),origin));
  shot.spent=true;
 }
 battle.enemyProjectiles=battle.enemyProjectiles.filter(s=>!s.spent&&s.travel<s.range-1e-9);
}
