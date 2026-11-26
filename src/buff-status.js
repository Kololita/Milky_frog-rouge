import {equipmentIconUrl} from './equipment.js';

export function activeBuffs(battle){
 const p=battle.player;if(p.health<=0)return [];
 const buffs=[],add=(id,label,until=null,icon=id)=>buffs.push({id,label,until,icon});
 const integer=n=>Math.floor(n+1e-8);
 for(const effect of p.effects?.entries.values()??[])if(effect.type==='burn')add('burn','着火 · 持续失去生命，前滚扑灭',effect.until);
 const levels=battle.passives??{};
 if(levels.vigor&&battle.invigorated)add('passive-vigor',`精神抖擞 · 伤害+${levels.vigor*5}%`,null,'attack');
 if(levels.comeback&&p.health<battle.maxHealth*.2)add('passive-comeback',`绝地反击 · 伤害+${levels.comeback*10}%`,null,'attack');
 if(levels.golden&&p.health>battle.maxHealth*.8)add('passive-golden',`金钟护体 · 受到伤害减少${levels.golden*4}%`,null,'shield');
 if(p.energyGainMultiplier>1)add('energy-gain',`能量获取 +${integer((p.energyGainMultiplier-1)*100)}%`,null,'damage');
 if(battle.time<p.longarmUntil)add('longarm','长臂 · 攻击距离增加',p.longarmUntil,'longarm.png');
 if(battle.time<p.drainUntil)add('drain','汲能 · 持续恢复能量',p.drainUntil,'drain.png');
 if(p.counterReady&&battle.time<p.counterUntil)add('gold','金光 · 可反击或转化',p.counterUntil);
 if(battle.time<p.fistwindUntil)add('fistwind','拳风 · 拳掌附带劲风',p.fistwindUntil,'fistwind.png');
 if(battle.isRaging()){
  add('rage','狂暴 · 霸体',p.rageUntil,'rage.png');add('haste','攻击速度提升、攻击间隔缩短',p.rageUntil);
  add('lifesteal','攻击命中回血',p.rageUntil);add('slow','环境速度降低',p.rageUntil);
 }
 return buffs;
}
export function createBuffStatus(doc){
 const root=doc.getElementById?.('buff-status');let signature='',nodes=[];
 return {clear(){signature='';nodes=[];if(root){root.replaceChildren();root.hidden=true;}},update(battle){
  if(!root)return;const buffs=activeBuffs(battle),next=buffs.map(b=>b.id).join('|');
  if(next!==signature){
   signature=next;root.replaceChildren();nodes=buffs.map(buff=>{
    const item=doc.createElement('span'),img=doc.createElement('img'),time=doc.createElement('small');item.className='buff-icon';item.setAttribute('role','listitem');
    img.src=/\.(png|svg)$/.test(buff.icon)?equipmentIconUrl(buff.icon.replace(/\.(png|svg)$/,'')):`/images/buffs/${buff.icon}.png`;img.alt='';item.append(img,time);root.append(item);return {item,time};
   });
  }
  buffs.forEach((buff,index)=>{const node=nodes[index];if(node.item.title!==buff.label){node.item.title=buff.label;node.item.setAttribute('aria-label',buff.label);}const remaining=buff.until===null?'':String(Math.max(0,Math.floor(buff.until-battle.time)));if(node.time.textContent!==remaining)node.time.textContent=remaining;});
  root.hidden=buffs.length===0;
 }};
}
