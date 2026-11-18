import {AttackMove} from './enemy-move.js';
import {steerEnemy} from './enemy-steering.js';

function followPlayer(enemy,pose,dt,stats){
  const dx=pose.x-enemy.x,dz=pose.z-enemy.z,distance=Math.hypot(dx,dz);
  if(distance>stats.noticeRange||distance<1e-8)return distance;
  steerEnemy(enemy,pose,dt);
  if(distance<=stats.stopDistance+stats.approachTolerance+1e-9)return distance;
  const step=Math.min(distance-stats.stopDistance,stats.speed*dt);
  enemy.x+=dx/distance*step;enemy.z+=dz/distance*step;enemy.moving=step>1e-8;
  return distance-step;
}

/** Simple close-range sparring AI; preserve overshoot so cadence is FPS independent. */
export function updateTrainingDummy(battle,dt,pose){
  const e=battle.enemy,stats=battle.enemyStats;
  e.moving=false;
  const dx=pose.x-e.x,dz=pose.z-e.z,distance=Math.hypot(dx,dz);
  if(e.state==='hurt'){e.turnVelocity=0;if(e.elapsed>=e.stun){e.state='idle';e.elapsed=0;}return;}
  if(e.state==='windup'){
    const trackingDt=Math.max(0,Math.min(dt,.2-(e.elapsed-dt)));
    if(trackingDt>0)steerEnemy(e,pose,trackingDt,e.windupTurnRate);else e.turnVelocity=0;
    if(e.elapsed>=stats.windup-1e-9){
      battle.strikePlayer(pose,e.move,Math.max(0,(e.elapsed-stats.windup)/(battle.worldTimeScale||1)));
      if(e.state==='windup'){e.state='recover';e.elapsed=Math.max(0,e.elapsed-stats.windup);}
    }
    return;
  }
  let carry=0;
  if(e.state==='recover'){
    if(e.elapsed<stats.recovery-1e-9){
      // The first 0.3s is the punch follow-through; the remaining cooldown
      // blocks attacks only. Tracking and pursuit do not reset this timer.
      if(e.elapsed>stats.settle)followPlayer(e,pose,Math.min(dt,e.elapsed-stats.settle),stats);else e.turnVelocity=0;
      return;
    }
    carry=Math.max(0,e.elapsed-stats.recovery);e.state='idle';
  }
  if(distance>stats.noticeRange){e.state='idle';return;}
  const engageDistance=stats.stopDistance+stats.approachTolerance;
  if(followPlayer(e,pose,dt,stats)>engageDistance+1e-9){e.state='chase';return;}
  const {motionMultiplier,poseDamage,reach,halfAngle,heightMin,heightMax,startupResilience,impactLevel}=stats;
  e.move=new AttackMove({label:'出拳',prepare:stats.windup,swing:0,motion:'jab',motionMultiplier,poseDamage,reach,halfAngle,heightMin,heightMax,startupResilience,impactLevel});e.telegraph=stats.windup;e.swingDuration=0;e.state='windup';e.elapsed=carry;e.moving=false;
}
