import {PLAYER_STATS} from './battle-values.js';
/** Persistent aura lifetime and annular collision are independent of the owner's current move. */
export function updateEnemyAuras(battle,pose){
 for(const enemy of battle.enemies){
  if(enemy.auraCasting&&(enemy.state!=='windup'||enemy.move!==enemy.auraCasting||enemy.health<=0)){
   enemy.nextAuraAt=battle.enemyTime+enemy.auraCasting.aura.cooldown;enemy.auraCasting=null;
  }
  const aura=enemy.activeAura;if(!aura)continue;
  if(enemy.health<=0||battle.enemyTime>=aura.until-1e-9||aura.cancelStates.includes(enemy.state)){
   enemy.activeAura=null;enemy.nextAuraAt=battle.enemyTime+aura.cooldown;battle.emit('enemyAuraEnded',{enemy});continue;
  }
  if(battle.player.health<=0||battle.enemyTime<aura.nextHit-1e-9)continue;
  const distance=Math.hypot(pose.x-enemy.x,pose.z-enemy.z);
  if(distance+PLAYER_STATS.radius<aura.innerRadius-1e-9||distance-PLAYER_STATS.radius>aura.outerRadius+1e-9)continue;
  // All normal height, invulnerability, shield, status and impact rules are reused.
  aura.nextHit=battle.enemyTime+aura.hitInterval;
  battle.withEnemy(enemy,()=>battle.strikePlayer(pose,aura.hit));
 }
}
