import {Mob} from './monster.js';
import {AttackMove,ProjectileMove,StanceMove,BuffMove,MovementMove,ChannelMove,AuraMove} from './enemy-move.js';
import {tunable} from './tuning-registry.js';
import {FOUNDRY_ENEMY_SPAWN,FOUNDRY_PLAYER_SPAWN} from './cooling.js';
const base=Mob.defaults;
const stoneCadence={prepare:1.2,swing:.38,comboRecovery:.32,lockLead:.38};
export const MONSTER_STATS=tunable('MONSTER_STATS',{
 raider:{...base,health:240,attackPower:6,speed:1.3,stopDistance:1.2,name:"拳兵",model:"raider",color:"#557b54",
  moves:[
   new AttackMove({label:"试探直拳",prepare:0.65,swing:0.22,recovery:1.1,motion:"jab",motionMultiplier:2,poseDamage:18,reach:1.5,halfAngle:45*Math.PI/180,heightMin:0.35,heightMax:1.2}),
   new AttackMove({label:"转腰摆拳",startupResilience:2,prepare:1,swing:0.3,recovery:1.4,motion:"hook",motionMultiplier:2.6,poseDamage:24,reach:1.65,halfAngle:85*Math.PI/180,heightMin:0.6,heightMax:1.45}),
  ]},
 cinderWarden:{...base,spawn:{...FOUNDRY_ENEMY_SPAWN},playerSpawn:{...FOUNDRY_PLAYER_SPAWN},health:720,attackPower:8,bodyHeight:1.8,radius:.55,speed:.5,stopDistance:1.6,turnRate:150*Math.PI/180,windupTurnRate:150*Math.PI/180,name:'灰烬司炉官',visual:'cinderWarden',bodyPlan:'nonhumanoid',backThrowable:false,uiHeight:2.1,impactResistance:1,color:'#705348',ai:{preferredDistance:1.6,closeWhenBreathLocked:true,auraMove:3,rules:[{min:2.4,max:7,move:2,atDistance:true},{max:2.4,chance:.3,move:2,atDistance:true}],cycle:[[0,4,6,2],[5,0,1],[4,6,5]]},
  moves:[
   new AttackMove({label:'炉钳横扫',motion:'tongs-sweep',prepare:.85,swing:.32,recovery:.65,startupResilience:2,motionMultiplier:2.2,poseDamage:25,impactLevel:1,reach:2.4,halfAngle:75*Math.PI/180,heightMin:.45,heightMax:1.4}),
   new AttackMove({label:'炉钳下砸',motion:'tongs-slam',prepare:.75,swing:.28,recovery:.7,startupResilience:1,lunge:.35,motionMultiplier:1.8,poseDamage:22,impactLevel:1,reach:2.6,halfAngle:22*Math.PI/180,heightMin:.5,heightMax:1.3}),
   new ChannelMove({label:'炉膛喷涌',motion:'furnace-breath',requiresMeleeBeat:true,prepare:2,swing:3,recovery:1.1,preferredDistance:2.5,startupResilience:2,aimThroughout:true,trackingTurnRate:30*Math.PI/180,unblockable:true,fire:true,hitInterval:.4,motionMultiplier:.525,poseDamage:9,impactLevel:0,reach:7,halfAngle:Math.PI/8,heightMin:.15,heightMax:1.4,statusOnHit:{type:'burn',amount:3,duration:4,tickInterval:.5}}),
   new AuraMove({label:'火圈',motion:'ignite-ring',prepare:1,swing:0,recovery:.8,startupResilience:2,aura:{duration:30,cooldown:30,innerRadius:1.45,outerRadius:1.95,hitInterval:.75,cancelStates:['knockback','dazed','thrown','down'],hit:new AttackMove({label:'火圈灼击',fire:true,unblockable:true,prepare:0,swing:0,motionMultiplier:.75,poseDamage:12,impactLevel:1,reach:1.95,halfAngle:Math.PI,heightMin:0,heightMax:.6,statusOnHit:{type:'burn',amount:3,duration:4,tickInterval:.5}})}}),
   new AttackMove({label:'炉盖头槌',motion:'boiler-headbutt',prepare:.55,swing:.28,recovery:.65,startupResilience:2,lunge:.3,motionMultiplier:2,poseDamage:24,impactLevel:1,reach:1.65,halfAngle:40*Math.PI/180,heightMin:.35,heightMax:1.5}),
   new AttackMove({label:'炉钳突刺',motion:'tongs-thrust',prepare:.7,swing:.35,recovery:.75,startupResilience:1,lunge:.95,motionMultiplier:2.1,poseDamage:24,impactLevel:1,reach:2.25,halfAngle:22*Math.PI/180,heightMin:.5,heightMax:1.3}),
   new MovementMove({label:'退步调距',motion:'boiler-retreat',prepare:0,swing:.16,recovery:.08,retreat:1}),
  ]},
 shellbug:{...base,bodyPlan:'nonhumanoid',bodyHeight:0.9,health:280,attackPower:7,radius:0.53,speed:1.1,turnRate:1.3,windupTurnRate:1.7,stopDistance:2.7,ai:{"rules":[{"max":1.25,"move":1}],"cycle":[0]},name:"刺壳虫",visual:"shellbug",model:"shellbug",uiHeight:1.16,backThrowable:false,color:"#3f8490",
  moves:[
   new AttackMove({label:"顶角冲锋",prepare:0.85,swing:0.4,recovery:1.55,motion:"charge",startupResilience:1,lunge:3,impactLevel:2,motionMultiplier:2.4,poseDamage:26,reach:1.1,halfAngle:38*Math.PI/180,heightMin:0.05,heightMax:0.78}),
   new AttackMove({label:"环身尖刺",prepare:1.25,swing:0.3,motion:"spikes",startupResilience:1,motionMultiplier:1.8,poseDamage:20,reach:1,halfAngle:180*Math.PI/180,heightMin:0,heightMax:1}),
  ]},
 lantern:{...base,bodyPlan:'nonhumanoid',backThrowable:true,throwOverride:true,bodyHeight:0.95,health:180,radius:0.34,speed:1.15,turnRate:1.8,windupTurnRate:2.2,noticeRange:40,stopDistance:1.85,ai:{"orbitDuration":0.55,"rules":[{"ready":"nextEmpowerAt","move":1,"atDistance":true},{"min":2.5,"move":2,"atDistance":true}],"cycle":[0]},name:"灯笼灵",visual:"lantern",model:"lantern",height:0.25,uiHeight:1.55,orbitSpeed:0.65,color:"#659bd0",
  moves:[
   new AttackMove({label:"灯焰震波",prepare:1.1,swing:0.22,recovery:1.65,motion:"pulse",absoluteHeight:true,motionMultiplier:2,poseDamage:20,reach:2.05,halfAngle:180*Math.PI/180,heightMin:0,heightMax:1}),
   new BuffMove({label:"增幅灯笼",prepare:2,swing:0.3,recovery:1,motion:"empower",cooldownKey:"nextEmpowerAt",effect:{type:"damageIncrease",amount:0.2,duration:30,group:"support-damage",stacking:"strongest"}}),
   new ProjectileMove({label:"追光灯火",prepare:0.95,swing:0.24,recovery:1.3,motion:"firebolt",projectile:{"speed":8.5,"range":26,"radius":0.15,"height":0.8,"count":3,"spread":0.12,"lead":0.65,"color":"#ffb950"},motionMultiplier:1.8,poseDamage:18,reach:26,halfAngle:12*Math.PI/180,heightMin:0.6,heightMax:1}),
  ]},
 spitter:{...base,bodyPlan:'nonhumanoid',bodyHeight:1.25,health:300,attackPower:6,radius:0.42,speed:1.6,turnRate:1.65,windupTurnRate:3.8,noticeRange:40,stopDistance:5.8,ai:{"startAnywhere":true,"lockRecovery":true,"rules":[{"min":"retreatDistance","inclusive":true,"move":0},{"ready":"nextRetreatAt","respectRecovery":true,"chance":"retreatChance","move":2,"cooldown":"retreatCooldown"},{"weighted":[{"move":0,"chance":"closeShotChance"},{"move":1}]}]},name:"弩尾蜥",visual:"spitter",model:"spitter",uiHeight:1.6,retreatDistance:2.5,retreatCooldown:10,retreatChance:0.35,closeShotChance:0.45,backThrowable:false,color:"#a66753",
  moves:[
   new ProjectileMove({label:"晶矢三射",prepare:1.85,swing:0.25,recovery:2.1,motion:"shoot",recoveryMovement:{"start":0.5,"forward":0.85,"side":0.55},projectile:{"speed":10,"range":26,"radius":0.12,"height":0.85,"count":3,"spread":0.16,"lead":0.7,"color":"#ef7976"},motionMultiplier:1.8,poseDamage:20,reach:26,halfAngle:18*Math.PI/180,heightMin:0.73,heightMax:0.97}),
   new AttackMove({label:"回身甩尾",startupResilience:2,prepare:0.75,swing:0.3,recovery:1.3,motion:"tail-sweep",motionMultiplier:2.3,poseDamage:25,reach:1.8,halfAngle:120*Math.PI/180,heightMin:0.05,heightMax:0.75}),
   new MovementMove({label:"后撤步",prepare:0,swing:0.08,recovery:1,motion:"retreat",retreat:4}),
  ]},
 mirrorGuard:{...base,bodyHeight:1.65,health:420,attackPower:7,radius:0.43,speed:1.45,turnRate:3.5,windupTurnRate:6,noticeRange:40,stopDistance:1.7,ai:{"startAnywhere":true,"rules":[{"min":3,"move":3},{"ready":"nextParryAt","attackingOrCadence":{"period":3,"index":1},"move":1,"cooldown":"moves.1.cooldown"}],"cycle":[0]},name:"镜盾侍",visual:"mirrorGuard",model:"mirrorGuard",uiHeight:1.95,color:"#718ca6",
  moves:[
   new AttackMove({label:"盾刃突刺",prepare:0.8,swing:0.28,motion:"shield-thrust",startupResilience:1,lunge:0.85,motionMultiplier:2.2,poseDamage:25,reach:2,halfAngle:40*Math.PI/180,heightMin:0.5,heightMax:1.35}),
   new StanceMove({label:"镜面架势",prepare:1.5,swing:1.2,recovery:1,motion:"parry",startupResilience:2,maxParryImpact:1,counterDelay:0.12,recoil:1,feedbackDuration:0.35,cooldown:3.5,counterIndex:2,reach:2,halfAngle:130*Math.PI/180,heightMin:0.3,heightMax:1.6}),
   new AttackMove({label:"弹反回斩",prepare:0.1,swing:0.25,recovery:2,motion:"riposte",startupResilience:1,lunge:0.45,impactLevel:2,motionMultiplier:2.8,poseDamage:30,reach:2.15,halfAngle:70*Math.PI/180,heightMin:0.4,heightMax:1.5}),
   new ProjectileMove({label:"投镜追击",aimThroughout:true,prepare:1.05,swing:0.26,recovery:1.5,motion:"shield-throw",projectile:{"speed":10,"range":26,"radius":0.22,"height":0.95,"count":1,"spread":0,"lead":0.7,"color":"#7addff"},motionMultiplier:2,poseDamage:22,reach:26,halfAngle:12*Math.PI/180,heightMin:0.6,heightMax:1.2}),
  ]},
 stonekeeper:{...base,permanentSuperArmor:true,bodyHeight:2.15,health:900,attackPower:9,radius:0.64,speed:0.8,turnRate:1.05,windupTurnRate:1.3,stopDistance:2,ai:{rules:[{min:4,move:3,atDistance:true}],cycle:[[1,0,2],[4,6,0],[2,1,0],[5,1],[6,4,5]]},name:"石槌守卫",visual:"stonekeeper",model:"stonekeeper",uiHeight:2.45,impactResistance:1,color:"#78828b",
  moves:[
   new AttackMove({...stoneCadence,label:"裂地重槌",recovery:2.8,comboRecovery:1.7,recoveryAnimation:{hold:.886,duration:.65},recoveryStrike:{at:1.08,forward:.85,side:-.30,attack:new AttackMove({label:'拔槌震荡',prepare:0,swing:0,motionMultiplier:1.5,poseDamage:18,impactLevel:1,reach:3.2,halfAngle:Math.PI,heightMin:0,heightMax:.85})},recoveryDamageTaken:1.35,motion:"smash",startupResilience:3,lunge:0.3,impactLevel:3,stunDuration:1,motionMultiplier:4,poseDamage:44,reach:2.8,halfAngle:75*Math.PI/180,heightMin:0,heightMax:2.25}),
   new AttackMove({...stoneCadence,label:"横槌扫腿",recovery:1.8,motion:"sweep",startupResilience:2,impactLevel:2,motionMultiplier:2.5,poseDamage:30,reach:2.25,halfAngle:100*Math.PI/180,heightMin:0.05,heightMax:0.72}),
   new AttackMove({...stoneCadence,label:"岩拳震地",recovery:2.2,recoveryDamageTaken:1.2,motion:"quake",startupResilience:3,impactLevel:2,stunDuration:1,motionMultiplier:3,poseDamage:36,reach:2.2,halfAngle:180*Math.PI/180,heightMin:0,heightMax:0.45}),
   new ProjectileMove({label:"掷岩追击",prepare:1.4,swing:0.3,recovery:2.2,lockLead:.55,motion:"rock-throw",startupResilience:2,impactLevel:2,projectile:{"speed":8,"range":24,"radius":0.26,"height":0.65,"count":1,"spread":0,"lead":0.2,"color":"#b3a68e"},motionMultiplier:2.8,poseDamage:30,reach:24,halfAngle:20*Math.PI/180,heightMin:0.39,heightMax:0.91}),
   new AttackMove({...stoneCadence,label:'沉肩撞山',motion:'shoulder-rush',recovery:1.5,lunge:1.35,impactLevel:2,motionMultiplier:2.2,poseDamage:26,reach:1.35,halfAngle:Math.PI/6,heightMin:.35,heightMax:1.65}),
   new AttackMove({...stoneCadence,label:'踏台震足',motion:'stomp',recovery:1.7,impactLevel:1,motionMultiplier:1.8,poseDamage:22,reach:1.95,halfAngle:Math.PI,heightMin:0,heightMax:.38}),
   new AttackMove({...stoneCadence,label:'开山挑拳',motion:'uppercut',recovery:1.8,lunge:.32,impactLevel:2,motionMultiplier:2.8,poseDamage:31,reach:1.85,halfAngle:Math.PI/5,heightMin:.35,heightMax:2.25}),
  ]},
 scythemoth:{...base,bodyPlan:'nonhumanoid',bodyHeight:1.95,health:560,attackPower:7,radius:0.38,speed:1.65,turnRate:1.8,windupTurnRate:3,stopDistance:1.7,ai:{"rules":[{"min":3,"max":7,"move":3,"atDistance":true}],"cycle":[0]},name:"镰足螳",visual:"scythemoth",model:"scythemoth",uiHeight:2.23,impactResistance:1,lowHealthThreshold:0.5,lowHealthLinkScale:0.75,color:"#729956",
  moves:[
   new AttackMove({label:"左镰高斩",prepare:0.65,swing:0.25,motion:"cut-left",startupResilience:2,link:0.32,motionMultiplier:2.2,poseDamage:22,reach:1.95,halfAngle:65*Math.PI/180,heightMin:0.75,heightMax:1.75}),
   new AttackMove({label:"右镰扫腿",prepare:0.72,swing:0.26,motion:"cut-right",startupResilience:2,link:0.38,motionMultiplier:2.4,poseDamage:25,reach:2.05,halfAngle:85*Math.PI/180,heightMin:0.05,heightMax:0.65}),
   new AttackMove({label:"双镰穿刺",prepare:1.15,swing:0.28,recovery:1.65,motion:"thrust",startupResilience:3,lunge:0.45,impactLevel:2,motionMultiplier:3.4,poseDamage:34,reach:2.4,halfAngle:32*Math.PI/180,heightMin:0.6,heightMax:1.5}),
   new AttackMove({label:"交镰飞扑",prepare:0.75,swing:0.35,recovery:1.5,motion:"pounce",startupResilience:3,lunge:3.6,impactLevel:2,motionMultiplier:3.2,poseDamage:32,reach:2.2,halfAngle:50*Math.PI/180,heightMin:0.25,heightMax:1.75}),
  ]},
});
