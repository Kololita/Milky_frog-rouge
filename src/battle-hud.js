import {createGpuDamageLabel} from './gpu-damage-label.js';
import {POTION_STATS,PLAYER_STATS,ENERGY_STATS,ENEMY_STATS,RAGE_STATS,energyDamageMultiplier} from './battle-values.js';
import {Vector3} from 'three';
import {createBuffStatus} from './buff-status.js';
import {damageTypeLabel} from './combat-damage.js';
const integer=value=>Math.floor((Number(value)||0)+1e-8);

export function createBattleHUD(doc,scene=null) {
  const buffs=createBuffStatus(doc);
  const elements=new Map();const byId=id=>{if(!elements.has(id))elements.set(id,doc.getElementById?.(id));return elements.get(id);};
  const styles=new WeakMap();function style(element,key,value){if(!element)return;let cache=styles.get(element);if(!cache){cache=new Map();styles.set(element,cache);}if(cache.get(key)===value)return;cache.set(key,value);element.style.setProperty(key,value);}
  const hp=byId('player-health'),guard=byId('player-guard'),hpText=byId('health-value'),guardText=byId('guard-value');
  const enemyText=byId('enemy-value'),feed=byId('battle-feed'),panel=byId('battle-hud');
  const energyText=byId('energy-value');
  const energyBar=byId('player-energy'),rageFilter=byId('rage-filter');let rageActive;
  const damageNumber=byId('combo-damage'),projected=new Vector3();
  const bossPanel=byId('boss-hud'),bossName=byId('boss-name'),bossFill=byId('boss-health-fill'),bossHint=byId('boss-hint');
  let damageTotal=0,lastDamageAt=-Infinity,lastTime=0,energyFull;
  const hitNumbers=new Map();
  function clearHitNumbers(){
    for(const record of hitNumbers.values()){
      record.label?.dispose();
      if(record.node&&record.node!==damageNumber)record.node.remove?.();
    }
    hitNumbers.clear();
  }
  let message='靠近练习傀儡开始战斗',messageUntil=4;
  const meterValues=new WeakMap();let danger;
  function text(element,value){if(element&&element.textContent!==value)element.textContent=value;}
  function meter(element,value,max) {
    if(!element)return;
    if(meterValues.get(element)===`${value}/${max}`)return;
    meterValues.set(element,`${value}/${max}`);
    style(element,'--fill',`${100*value/max}%`);
    element.setAttribute('aria-valuenow',integer(value));
  }
  return {clearEffects(){
    buffs.clear();rageActive=false;energyFull=false;
    panel?.classList.remove('raging');rageFilter?.classList.remove('active');energyBar?.classList.remove('full','draining-skill');
    damageTotal=0;lastDamageAt=-Infinity;clearHitNumbers();if(damageNumber)damageNumber.hidden=true;if(feed)feed.style.opacity='0';
  },get damageTotal(){return damageTotal;},updateTarget(battle,camera,visible=true){
    if(bossPanel)bossPanel.hidden=!visible||battle.encounter.kind!=='boss';
    if(!damageNumber)return;
    for(const [enemy,record] of hitNumbers){
      if(record.label){
        record.label.mesh.visible=visible&&battle.time-record.at<3;
        record.label.mesh.position.set(enemy.x,(enemy.uiHeight??1.76)+(enemy.state==='dazed'?.54:.25),enemy.z);
        continue;
      }
      projected.set(enemy.x,(enemy.uiHeight??1.76)+(enemy.state==='dazed'?.54:.25),enemy.z).project(camera);
      record.node.hidden=!visible||battle.time-record.at>=3||Math.abs(projected.x)>1||Math.abs(projected.y)>1||projected.z< -1||projected.z>1;
      record.node.style.left=`${(projected.x*.5+.5)*100}%`;record.node.style.top=`${(-projected.y*.5+.5)*100}%`;
    }
  },update(battle,events=[],locked=false) {
    buffs.update(battle);
    const p=battle.player,e=battle.enemy;
    text(byId('potion-count'),`${Math.floor(p.potions)} / ${battle.potionCapacity}`);const potionButton=byId('potion-use');if(potionButton)potionButton.disabled=p.health<=0||p.health>=battle.maxHealth||p.potions<=0||Boolean(battle.backThrow||battle.breakLaugh||battle.electricChain);
    if(battle.time<lastTime){clearHitNumbers();damageTotal=0;lastDamageAt=-Infinity;}
    if(battle.time-lastDamageAt>=3-1e-9){damageTotal=0;lastDamageAt=-Infinity;}
    lastTime=battle.time;
    for(const event of events){
      if(['enemyRespawned','playerRespawned'].includes(event.type)){damageTotal=0;lastDamageAt=-Infinity;clearHitNumbers();}
      if(event.type==='enemyHit'&&event.damage>0){
        damageTotal=Math.round((damageTotal+event.damage)*100)/100;lastDamageAt=battle.time;
        const enemy=event.enemy??e;let record=hitNumbers.get(enemy);
        if(!record&&damageNumber&&scene){
          record={label:createGpuDamageLabel(scene,doc),total:0,at:-Infinity};hitNumbers.set(enemy,record);
        }else if(!record&&damageNumber){
          const node=hitNumbers.size===0?damageNumber:doc.createElement('div');node.className='combo-damage';
          if(node!==damageNumber)damageNumber.parentElement?.append(node);
          record={node,total:0,at:-Infinity};hitNumbers.set(enemy,record);
        }
        if(record){
          if(battle.time-record.at>=3)record.total=0;
          record.total+=event.damage;record.at=battle.time;
          const value=String(integer(record.total));
          if(record.label)record.label.setText(value);else text(record.node,value);
        }
      }
    }
    if(damageNumber&&damageTotal<=0)damageNumber.hidden=true;
    meter(hp,p.health,battle.maxHealth);
    const shield=p.shield??0;
    style(hp,'--shield-width',`${100*shield/battle.maxHealth}%`);
    hp?.classList.toggle('has-shield',shield>0);
    meter(guard,p.pose,battle.maxPose);
    text(hpText,`${integer(p.health)} / ${integer(battle.maxHealth)}`);
    text(guardText,`${Math.floor(p.pose)} / ${battle.maxPose}`);
    const raging=battle.isRaging(),rageLeft=Math.max(0,p.rageUntil-battle.time);
    text(energyText,raging?'愤怒 · 霸体 · 攻速 +20%':`能量 ${integer(p.energy)} / ${ENERGY_STATS.max} · 伤害 +${integer((energyDamageMultiplier(p.energy)-1)*100)}%`);
    const previewEnergy=p.energy;
    meter(energyBar,raging?ENERGY_STATS.max*rageLeft/RAGE_STATS.duration:previewEnergy,ENERGY_STATS.max);
    const full=!raging&&p.energy>=ENERGY_STATS.max;
    if(energyFull!==full){energyFull=full;energyBar?.classList.toggle('full',full);}
    if(rageActive!==raging){rageActive=raging;panel?.classList.toggle('raging',raging);rageFilter?.classList.toggle('active',raging);energyBar?.setAttribute('aria-label',raging?'剩余怒气':'能量');}
    text(enemyText,e.health>0?`${locked?'锁定 · ':''}目标 ${integer(e.health)} / ${e.maxHealth}`:'目标已击败');
    if(battle.encounter.kind==='boss'){
      text(bossName,battle.enemyName);style(bossFill,'width',`${100*e.health/e.maxHealth}%`);
    }
    for(const event of events) {
      const text={enemyHit:`${event.label}  −${integer(event.damage)}${event.dazed?` · 击退后晕眩${integer(event.dazeDuration)}秒`:''}`,blocked:`${event.label} · 防御 −${integer(event.guardSpent)}${event.damage?` · 生命 −${integer(event.damage)}`:''}${event.counterReady?' · 右手金光3秒 · 可推掌反击':''}`,guardBroken:`破防  −${integer(event.damage)}`,playerHit:`受到攻击  −${integer(event.damage)}`,enemyDefeated:`击败傀儡 · ${integer(ENEMY_STATS.respawn)} 秒后重生`,playerDefeated:`奶蛙倒下了 · ${integer(PLAYER_STATS.respawn)} 秒后重新开始`,enemyRespawned:'傀儡已重生',playerRespawned:'已恢复 · 再试一次'}[event.type];
      const energyMessage={energyAbsorbing:'吸收金光…',energyInterrupted:'吸收中断 · 金光消散',energyFull:'能量已满',energyGained:`能量 ${integer(event.energy)}/100 · 伤害 +${integer((event.bonus??0)*100)}%${event.healed?` · 生命 +${integer(event.healed)}`:''}`,rageStarted:'进怒 · 时间缓滞',rageEnded:'怒气结束 · 速度恢复'}[event.type];
      const statusMessage=event.status==='burn'?(event.type==='statusApplied'?'着火 · 前滚扑灭':event.type==='statusRemoved'?'火焰已扑灭':null):null;
      if(text||energyMessage||statusMessage){
        message=text??energyMessage??statusMessage;
        if(text&&event.delivery&&event.element&&panel?.classList.contains('detailed'))message+=` · ${damageTypeLabel(event)}`;
        messageUntil=battle.time+2.2;
      }
    }
    text(feed,message.replaceAll('防御','绷住').replaceAll('姿态','绷住'));
    const opacity=battle.time<messageUntil?'1':'0';
    if(feed&&feed.style.opacity!==opacity)feed.style.opacity=opacity;
    if(panel&&danger!==(p.health<=25)){danger=p.health<=25;panel.classList.toggle('danger',danger);}
  }};
}
