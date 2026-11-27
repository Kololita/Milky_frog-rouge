import {tunable} from './tuning-registry.js';

const percent=value=>`${Math.round(value*100)}%`;
export const ELEMENTAL_ULTIMATES=tunable('ELEMENTAL_ULTIMATES',{
 metal:{name:'金震',profession:'金龙',accent:'#f0dba8',energyCost:100,radius:6,multiplier:4,stun:4,
  multiplierPerGold:.02,stunPerGold:.01,duration:.65,recoilTime:.24,recoilAngle:.15},
 wood:{name:'缚藤',profession:'木龙',accent:'#b4eba6',energyCost:100,duration:10,tick:1,drain:5,slow:.30},
 water:{name:'净潮',profession:'水龙',accent:'#a5e6ff',energyCost:100,duration:20,tick:.5,shield:3,poseRegen:3},
 earth:{name:'岩棘',profession:'土龙',accent:'#efb591',energyCost:100,duration:20,radius:.92,
  acceleration:15,drag:1.35,maxSpeed:7,enemyReboundSpeed:3,baseMultiplier:2,multiplierPerMeter:.3,
  exitDuration:.9,exitHeight:.85,crumbleDuration:.18},
 rain:{name:'雨幕',profession:'雨龙',accent:'#a9d8ff',energyCost:100,duration:8,tick:1,
  radius:4.5,aimRange:7,forwardRange:4,multiplier:1.5,slow:.30,electricBonus:.20,fireResistance:.30},
 thunder:{name:'落雷',profession:'雷龙',accent:'#e1ccff',energyCost:100,
  firstStrike:1,tick:3,multipliers:[3,4,5],stun:1},
 electric:{name:'跃电',profession:'电龙',accent:'#ebeb98',energyCost:0,
  tick:.1,energyPerTick:1,multiplier:.15,reach:5,jumpReach:5,jumpMultiplier:.75,slow:.60,rampInterval:3,rampMultipliers:[1,2,5,15]},
});

export function electricChainStage(stats,elapsed){
 return Math.max(0,Math.min(stats.rampMultipliers.length-1,Math.floor((elapsed+1e-9)/stats.rampInterval)));
}

export function elementalUltimateDescription(id){
 const stats=ELEMENTAL_ULTIMATES[id];
 switch(id){
  case 'metal': return `震击${stats.radius}米内的敌人，造成${stats.multiplier}倍攻击力伤害并眩晕${stats.stun}秒。每持有1金币，伤害倍率增加${stats.multiplierPerGold}，眩晕延长${stats.stunPerGold}秒。`;
  case 'wood': return `以藤蔓困住一名敌人${stats.duration}秒，使其攻击速度降低${percent(stats.slow)}。每秒从它身上吸取${stats.drain}点生命。`;
  case 'water': return `净潮护身${stats.duration}秒，免疫火焰伤害。每${stats.tick}秒获得${stats.shield}点护盾，并恢复${stats.poseRegen}点绷住。`;
  case 'earth': return `化为无敌的岩刺球${stats.duration}秒。按住移动键加速，撞上敌人会被更有力地弹开，并造成${stats.baseMultiplier}倍攻击力伤害。自变身或上次碰撞起，每滚动1米追加${stats.multiplierPerMeter}倍攻击力伤害。`;
  case 'rain': return `布下持续${stats.duration}秒的暴雨，每秒造成${stats.multiplier}倍攻击力伤害并使敌人移速降低${percent(stats.slow)}。单位在雨中受到的电伤提高${percent(stats.electricBonus)}，火伤降低${percent(stats.fireResistance)}。暴雨持续扑灭区域内的火焰。`;
  case 'thunder': return `标记一名敌人，在第${stats.multipliers.map((_,index)=>stats.firstStrike+index*stats.tick).join('、')}秒降下落雷，依次造成${stats.multipliers.join('、')}倍攻击力的电系伤害。每道雷都会打断动作并眩晕敌人${stats.stun}秒。`;
  case 'electric': return `按大招键开关。连接${stats.reach}米内的锁定目标，未锁定时连接最近的敌人。每${stats.tick}秒消耗${stats.energyPerTick}能量，造成${stats.multiplier}倍电伤并使相连的敌人减速${percent(stats.slow)}。与同一目标保持连线时，伤害每${stats.rampInterval}秒升一档，依次为基础伤害的${stats.rampMultipliers.join("、")}倍。闪电向${stats.jumpReach}米内传导，每跳保留${percent(stats.jumpMultiplier)}伤害。开启时只能走路，跑步、闪避、攻击、被击中或能量耗尽时自动关闭。`;
 }
}
