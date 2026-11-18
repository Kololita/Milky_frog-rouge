export const EQUIPMENT_PASSIVES={
 emptyForge:{name:'无中生有',max:1,effect:()=> '每个未占据的开放格 +2 最大生命、+1% 免伤、+0.5 攻击力'},
 artisan:{name:'工匠',max:1,effect:()=> '战斗胜利时，若期间未因敌方攻击损失生命，可精简一件装备'}, 
 concentration:{name:'集中',max:3,effect:l=>`蓄力时间缩短${[0,10,25,40][l]}%`},
 marksman:{name:'射手潜能',max:5,effect:l=>`远程攻击伤害+${l*10}%`},
 sumo:{name:'相扑手',max:3,effect:l=>`背摔伤害+${l*15}%`},
 openingStrike:{name:'当头一棒',max:5,effect:l=>`普通攻击第一段伤害+${l*20}%`},
 vigor:{name:'精神抖擞',max:4,effect:l=>`连续10秒未损失生命，伤害+${l*5}%`},
 impactImmunity:{name:'耐冲',max:2,effect:l=>`免疫${l===1?'一级':'一、二级'}冲击造成的硬直`},
 goldDuration:{name:'余辉',max:3,effect:l=>`完美格挡获得的金光持续时间+${l}秒`},
 comeback:{name:'绝地反击',max:3,effect:l=>`生命低于20%时伤害+${l*10}%`},
 flasks:{name:'血瓶增加',max:5,effect:l=>`血瓶携带上限+${l}`},
 energy:{name:'能量精通',max:3,effect:l=>`能量获取+${l*10}%`},
 poise:{name:'破绷抗性',max:3,effect:l=>`受到破绷伤害减少${l*8}%`},
 golden:{name:'金钟护体',max:3,effect:l=>`生命高于80%时受到伤害减少${l*4}%`},
 reach:{name:'延锋',max:3,effect:l=>`攻击距离+${l*3}%`},
 medicine:{name:'药理',max:3,effect:l=>`血瓶回复量+${l*10}%`},
};
export function passiveLevels(items){const levels={};for(const item of items)for(const [id,level]of Object.entries(item.passives??{}))if(EQUIPMENT_PASSIVES[id])levels[id]=Math.min(EQUIPMENT_PASSIVES[id].max,(levels[id]??0)+level);return levels;}

export const concentrationTimeScale=level=>[1,.9,.75,.6][Math.max(0,Math.min(3,Math.floor(level??0)))];
