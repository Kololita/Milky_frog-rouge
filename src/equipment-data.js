export const EQUIPMENT_DATA=[
  {id:'charm-empty-forge',slot:'charm',name:'无相玉',rarity:'gold',passives:{emptyForge:1}},
  {id:'charm-artisan',slot:'charm',name:'百炼刻印',rarity:'gold',passives:{artisan:1}},
  {
    "id": "fist-dawn",
    "slot": "gloves",
    "name": "破晓拳铠",
    "attack": 4,
    "attackSpeed": 0.1,
    "passives": {
      "openingStrike": 2,
      "vigor": 1,
      "reach": 1
    },
    "rarity": "gold",
    "icon": "fist-dawn",
    "description": "攻击力 +4，攻击速度 +10%，附加被动：当头一棒+2、精神抖擞+1、延锋+1",
    "shape": [
      "###.#",
      "#.###",
      "###.."
    ]
  },
  {
    "id": "armor-vanguard",
    "slot": "armor",
    "name": "先登银铠",
    "health": 20,
    "pose": 10,
    "passives": {
      "openingStrike": 1,
      "golden": 1,
      "poise": 1
    },
    "rarity": "gold",
    "icon": "armor-vanguard",
    "description": "最大生命 +20，绷住上限 +10，附加被动：当头一棒+1、金钟护体+1、破绷抗性+1",
    "shape": [
      "###",
      "#..",
      "###",
      "#..",
      "###"
    ]
  },
  {
    "id": "charm-firstlight",
    "slot": "charm",
    "name": "初光吊坠",
    "attack": 2,
    "regen": 2,
    "passives": {
      "openingStrike": 2,
      "vigor": 1,
      "goldDuration": 1
    },
    "rarity": "gold",
    "icon": "charm-firstlight",
    "description": "攻击力 +2，绷住恢复 +2/秒，附加被动：当头一棒+2、精神抖擞+1、余辉+1",
    "shape": [
      "..#..",
      ".###.",
      "#####",
      ".###.",
      "..#.."
    ]
  },
  {
    "id": "charm-tigerseal",
    "slot": "charm",
    "name": "伏虎金印",
    "pose": 15,
    "attackSpeed": 0.05,
    "passives": {
      "openingStrike": 1,
      "poise": 1,
      "energy": 1
    },
    "rarity": "gold",
    "icon": "charm-tigerseal",
    "description": "绷住上限 +15，攻击速度 +5%，附加被动：当头一棒+1、破绷抗性+1、能量精通+1",
    "shape": [
      "..#..",
      ".###.",
      "#####",
      ".###.",
      "..#.."
    ]
  },
  {
    "id": "armor-light",
    "slot": "armor",
    "rarity": "white",
    "name": "轻型护甲",
    "icon": "armor-light",
    "health": 5,
    "passives": {},
    "description": "最大生命 +5",
    "shape": [
      "##"
    ]
  },
  {
    "id": "armor-padded",
    "slot": "armor",
    "rarity": "white",
    "name": "衬棉衣",
    "icon": "armor-padded",
    "pose": 5,
    "passives": {},
    "description": "绷住上限 +5",
    "shape": [
      "##"
    ]
  },
  {
    "id": "armor-soft",
    "slot": "armor",
    "rarity": "white",
    "name": "软革背心",
    "icon": "armor-soft",
    "reduction": 0.05,
    "passives": {},
    "description": "受到生命伤害 -5%",
    "shape": [
      "##"
    ]
  },
  {
    "id": "armor-heavy",
    "slot": "armor",
    "rarity": "green",
    "name": "厚实护甲",
    "icon": "armor-heavy",
    "health": 6,
    "reduction": 0.04,
    "passives": {},
    "description": "最大生命 +6，受到生命伤害 -4%",
    "shape": [
      "##",
      "##"
    ]
  },
  {
    "id": "armor-leather",
    "slot": "armor",
    "rarity": "green",
    "name": "铆钉皮甲",
    "icon": "armor-leather",
    "health": 6,
    "pose": 5,
    "passives": {},
    "description": "最大生命 +6，绷住上限 +5",
    "shape": [
      "##",
      "##"
    ]
  },
  {
    "id": "armor-channel",
    "slot": "armor",
    "rarity": "green",
    "name": "引灵衣",
    "icon": "armor-channel",
    "reduction": 0.05,
    "passives": {},
    "description": "绷住恢复 +1/秒，受到生命伤害 -5%",
    "regen": 1,
    "shape": [
      "##",
      "##"
    ]
  },
  {
    "id": "armor-medic",
    "slot": "armor",
    "rarity": "green",
    "name": "药师短袍",
    "icon": "armor-medic",
    "health": 8,
    "passives": {},
    "description": "最大生命 +8",
    "shape": [
      "##",
      "##"
    ]
  },
  {
    "id": "armor-ranger",
    "slot": "armor",
    "rarity": "green",
    "name": "游侠轻衣",
    "icon": "armor-ranger",
    "health": 5,
    "passives": {},
    "description": "最大生命 +5，攻击速度 +2%",
    "attackSpeed": 0.025,
    "shape": [
      "##",
      "##"
    ]
  },
  {
    "id": "armor-chain",
    "slot": "armor",
    "rarity": "blue",
    "name": "锁甲",
    "icon": "armor-chain",
    "health": 20,
    "passives": {
      "flasks": 1
    },
    "description": "最大生命 +20，附加被动：血瓶增加+1",
    "shape": [
      "###",
      "###"
    ]
  },
  {
    "id": "armor-scale",
    "slot": "armor",
    "rarity": "blue",
    "name": "鳞片甲",
    "icon": "armor-scale",
    "health": 35,
    "reduction": -0.1,
    "passives": {
      "comeback": 1
    },
    "description": "最大生命 +35，受到生命伤害 --10%，附加被动：绝地反击+1",
    "shape": [
      "###",
      "###"
    ]
  },
  {
    "id": "armor-knight",
    "slot": "armor",
    "rarity": "purple",
    "name": "誓约重甲",
    "icon": "armor-knight",
    "health": 35,
    "pose": 20,
    "reduction": 0.1,
    "passives": {
      "golden": 1,
      "poise": 1
    },
    "description": "最大生命 +35，绷住上限 +20，受到生命伤害 -10%，附加被动：金钟护体+1、破绷抗性+1",
    "shape": [
      "##.##",
      ".###.",
      ".#.#."
    ]
  },
  {
    "id": "fist-iron",
    "slot": "gloves",
    "rarity": "white",
    "name": "铁拳套",
    "icon": "fist-iron",
    "attack": 2,
    "passives": {},
    "description": "攻击力 +2",
    "shape": [
      "##"
    ]
  },
  {
    "id": "fist-wrap",
    "slot": "gloves",
    "rarity": "white",
    "name": "练功绑带",
    "icon": "fist-wrap",
    "passives": {},
    "description": "攻击速度 +8%",
    "attackSpeed": 0.08,
    "shape": [
      "##"
    ]
  },
  {
    "id": "fist-steel",
    "slot": "gloves",
    "rarity": "green",
    "name": "钢拳套",
    "icon": "fist-steel",
    "attack": 3,
    "health": 3,
    "passives": {},
    "description": "最大生命 +3，攻击力 +3",
    "shape": [
      "#..",
      "###"
    ]
  },
  {
    "id": "fist-hunter",
    "slot": "gloves",
    "rarity": "green",
    "name": "猎手拳套",
    "icon": "fist-hunter",
    "pose": 5,
    "attack": 4,
    "passives": {},
    "description": "绷住上限 +5，攻击力 +4，攻击速度 +6%",
    "attackSpeed": 0.06,
    "shape": [
      "#..",
      "###"
    ]
  },
  {
    "id": "fist-crusher",
    "slot": "gloves",
    "rarity": "blue",
    "name": "碎岩拳套",
    "icon": "fist-crusher",
    "attack": 6,
    "regen": -2,
    "passives": {
      "comeback": 1
    },
    "description": "攻击力 +6，绷住恢复 -2/秒，附加被动：绝地反击+1",
    "shape": [
      "####",
      "#..#"
    ]
  },
  {
    "id": "fist-guard",
    "slot": "gloves",
    "rarity": "blue",
    "name": "守势拳套",
    "icon": "fist-guard",
    "pose": 20,
    "attack": 4,
    "passives": {
      "comeback": 1
    },
    "description": "绷住上限 +20，攻击力 +4，附加被动：绝地反击+1",
    "shape": [
      "####",
      "#..#"
    ]
  },
  {
    "id": "fist-war",
    "slot": "gloves",
    "rarity": "purple",
    "name": "赤战拳套",
    "icon": "fist-war",
    "health": -20,
    "attack": 4,
    "passives": {
      "comeback": 1,
      "reach": 1
    },
    "description": "最大生命 -20，攻击力 +4，附加被动：绝地反击+1、延锋+1",
    "shape": [
      "#..#",
      "####",
      ".##."
    ]
  },
  {
    "id": "fist-oath",
    "slot": "gloves",
    "rarity": "purple",
    "name": "誓光拳套",
    "icon": "fist-oath",
    "pose": 15,
    "attack": 4,
    "passives": {
      "vigor": 1,
      "goldDuration": 1
    },
    "description": "绷住上限 +15，攻击力 +4，附加被动：精神抖擞+1、余辉+1",
    "shape": [
      "#..#",
      "####",
      ".##."
    ]
  },
  {
    "id": "fist-titan",
    "slot": "gloves",
    "rarity": "gold",
    "name": "撼岳拳套",
    "icon": "fist-titan",
    "health": 30,
    "pose": 20,
    "attack": 6,
    "passives": {
      "comeback": 1,
      "reach": 1,
      "poise": 1
    },
    "description": "最大生命 +30，绷住上限 +20，攻击力 +6，附加被动：绝地反击+1、延锋+1、破绷抗性+1",
    "shape": [
      "###.#",
      "#.###",
      "###.."
    ]
  },
  {
    "id": "charm-thread",
    "slot": "charm",
    "rarity": "white",
    "name": "草结护符",
    "icon": "charm-thread",
    "regen": 2,
    "passives": {},
    "description": "绷住恢复 +2/秒",
    "shape": [
      "#"
    ]
  },
  {
    "id": "charm-copper",
    "slot": "charm",
    "rarity": "white",
    "name": "铜叶护符",
    "icon": "charm-copper",
    "health": 10,
    "passives": {},
    "description": "最大生命 +10",
    "shape": [
      "#"
    ]
  },
  {
    "id": "charm-recovery",
    "slot": "charm",
    "rarity": "green",
    "name": "回气护符",
    "icon": "charm-recovery",
    "regen": 5,
    "health": 3,
    "passives": {},
    "description": "最大生命 +3，绷住恢复 +5/秒",
    "shape": [
      "###",
      ".#."
    ]
  },
  {
    "id": "charm-gold",
    "slot": "charm",
    "rarity": "green",
    "name": "聚光护符",
    "icon": "charm-gold",
    "health": 3,
    "passives": {
      "goldDuration": 1
    },
    "description": "最大生命 +3，附加被动：余辉+1",
    "shape": [
      "###",
      ".#."
    ]
  },
  {
    "id": "charm-vigor",
    "slot": "charm",
    "rarity": "blue",
    "name": "生息护符",
    "icon": "charm-vigor",
    "health": 30,
    "regen": 5,
    "passives": {
      "poise": 1
    },
    "description": "最大生命 +30，绷住恢复 +5/秒，附加被动：破绷抗性+1",
    "shape": [
      "##.",
      ".##",
      ".##"
    ]
  },
  {
    "id": "charm-bastion",
    "slot": "charm",
    "rarity": "blue",
    "name": "壁垒护符",
    "icon": "charm-bastion",
    "pose": 30,
    "reduction": 0.05,
    "passives": {
      "golden": 1
    },
    "description": "绷住上限 +30，受到生命伤害 -5%，附加被动：金钟护体+1",
    "shape": [
      "##.",
      ".##",
      ".##"
    ]
  },
  {
    "id": "charm-blood",
    "slot": "charm",
    "rarity": "purple",
    "name": "赤心护符",
    "icon": "charm-blood",
    "health": 35,
    "reduction": 0.08,
    "passives": {
      "golden": 1,
      "poise": 1
    },
    "description": "最大生命 +35，受到生命伤害 -8%，附加被动：金钟护体+1、破绷抗性+1",
    "shape": [
      "##..",
      ".###",
      "..##",
      "...#"
    ]
  },
  {
    "id": "charm-star",
    "slot": "charm",
    "rarity": "gold",
    "name": "星辉护符",
    "icon": "charm-star",
    "pose": 20,
    "regen": 6,
    "passives": {
      "goldDuration": 2,
      "poise": 1
    },
    "description": "绷住上限 +20，绷住恢复 +6/秒，附加被动：余辉+2、破绷抗性+1",
    "shape": [
      "..#..",
      ".###.",
      "#####",
      ".###.",
      "..#.."
    ]
  },
  {
    "id": "armor-linen",
    "slot": "armor",
    "rarity": "white",
    "name": "素布衣",
    "icon": "armor-linen",
    "pose": 6,
    "passives": {},
    "description": "绷住上限 +6",
    "shape": [
      "##"
    ]
  },
  {
    "id": "fist-stone",
    "slot": "gloves",
    "rarity": "white",
    "name": "石片拳套",
    "icon": "fist-stone",
    "attack": 1.5,
    "passives": {},
    "description": "攻击力 +1",
    "shape": [
      "##"
    ]
  },
  {
    "id": "charm-sap",
    "slot": "charm",
    "rarity": "white",
    "name": "树脂坠",
    "icon": "charm-sap",
    "passives": {},
    "description": "最大生命 +8",
    "health": 8,
    "shape": [
      "#"
    ]
  },
  {
    "id": "armor-traveler",
    "slot": "armor",
    "rarity": "green",
    "name": "行旅皮衣",
    "icon": "armor-traveler",
    "health": 5,
    "regen": 1,
    "passives": {},
    "description": "最大生命 +5，绷住恢复 +1/秒",
    "shape": [
      "##",
      "##"
    ]
  },
  {
    "id": "charm-herb",
    "slot": "charm",
    "rarity": "green",
    "name": "草药香囊",
    "icon": "charm-herb",
    "health": 8,
    "passives": {},
    "description": "最大生命 +8",
    "shape": [
      "###",
      ".#."
    ]
  },
  {
    "id": "armor-thorn",
    "slot": "armor",
    "rarity": "blue",
    "name": "荆棘轻甲",
    "icon": "armor-thorn",
    "attack": 1.5,
    "health": -5,
    "passives": {
      "comeback": 1
    },
    "description": "最大生命 -5，攻击力 +1，附加被动：绝地反击+1",
    "shape": [
      "###",
      "###"
    ]
  },
  {
    "id": "charm-anchor",
    "slot": "charm",
    "rarity": "blue",
    "name": "锚石坠",
    "icon": "charm-anchor",
    "pose": 12,
    "passives": {
      "impactImmunity": 1
    },
    "description": "绷住上限 +12，攻击速度 -1%，附加被动：耐冲+1",
    "attackSpeed": -0.01,
    "shape": [
      "##.",
      ".##",
      ".##"
    ]
  },
  {
    "id": "armor-impact-heavy",
    "slot": "armor",
    "rarity": "purple",
    "name": "卸力重甲",
    "icon": "armor-impact-heavy",
    "health": 15,
    "regen": -1,
    "passives": {
      "impactImmunity": 2
    },
    "description": "最大生命 +15，绷住恢复 -1/秒，附加被动：耐冲+2",
    "shape": [
      "##.##",
      ".###.",
      ".#.#."
    ]
  },
  {
    "id": "charm-breath",
    "slot": "charm",
    "rarity": "purple",
    "name": "守息玉",
    "icon": "charm-breath",
    "pose": 12,
    "regen": 2,
    "passives": {
      "medicine": 1,
      "poise": 1
    },
    "description": "绷住上限 +12，绷住恢复 +2/秒，附加被动：药理+1、破绷抗性+1",
    "shape": [
      "##..",
      ".###",
      "..##",
      "...#"
    ]
  },
  {
    "id": "armor-cloud",
    "slot": "armor",
    "rarity": "gold",
    "name": "流云御甲",
    "icon": "armor-cloud",
    "health": 20,
    "reduction": 0.06,
    "passives": {
      "impactImmunity": 2,
      "golden": 1
    },
    "description": "最大生命 +20，受到生命伤害 -6%，附加被动：耐冲+2、金钟护体+1",
    "shape": [
      "###",
      "#..",
      "###",
      "#..",
      "###"
    ]
  },
  {
    "id": "charm-lantern",
    "slot": "charm",
    "rarity": "gold",
    "name": "长明灯芯",
    "icon": "charm-lantern",
    "passives": {
      "vigor": 2,
      "medicine": 1
    },
    "description": "最大生命 +5，绷住上限 +10，附加被动：精神抖擞+2、药理+1",
    "pose": 10,
    "health": 5,
    "shape": [
      "..#..",
      ".###.",
      "#####",
      ".###.",
      "..#.."
    ]
  },
  {
    "id": "fist-windshot",
    "name": "鸣弦拳套",
    "slot": "gloves",
    "rarity": "blue",
    "attack": 3,
    "attackSpeed": 0.03,
    "passives": {
      "marksman": 1
    },
    "icon": "fist-windshot",
    "description": "攻击力 +3，攻击速度 +3%，附加被动：射手潜能+1",
    "shape": [
      "####",
      "#..#"
    ]
  },
  {
    "id": "armor-sumo",
    "name": "角力束甲",
    "slot": "armor",
    "rarity": "blue",
    "health": 12,
    "pose": 8,
    "passives": {
      "sumo": 1
    },
    "icon": "armor-sumo",
    "description": "最大生命 +12，绷住上限 +8，附加被动：相扑手+1",
    "shape": [
      "###",
      "###"
    ]
  },
  {
    "id": "charm-earthring",
    "name": "镇岳玉环",
    "slot": "charm",
    "rarity": "gold",
    "health": 12,
    "regen": 1,
    "passives": {
      "sumo": 1,
      "comeback": 1,
      "poise": 1
    },
    "icon": "charm-earthring",
    "description": "最大生命 +12，绷住恢复 +1/秒，附加被动：相扑手+1、绝地反击+1、破绷抗性+1",
    "shape": [
      "..#..",
      ".###.",
      "#####",
      ".###.",
      "..#.."
    ]
  },
  {
    "id": "fist-stillwater",
    "slot": "gloves",
    "rarity": "blue",
    "name": "静水拳套",
    "attackSpeed": 0.06,
    "passives": {
      "concentration": 1
    },
    "icon": "fist-stillwater",
    "description": "攻击速度 +6%，附加被动：集中+1",
    "shape": [
      "####",
      "#..#"
    ]
  },
  {
    "id": "charm-clearheart",
    "slot": "charm",
    "rarity": "purple",
    "name": "澄心玉坠",
    "health": 12,
    "attackSpeed": 0.02,
    "passives": {
      "concentration": 1,
      "goldDuration": 1
    },
    "icon": "charm-clearheart",
    "description": "最大生命 +12，攻击速度 +2%，附加被动：集中+1、余辉+1",
    "shape": [
      "##..",
      ".###",
      "..##",
      "...#"
    ]
  },
  {
    "id": "armor-quietstorm",
    "slot": "armor",
    "rarity": "gold",
    "name": "藏雷战甲",
    "reduction": 0.04,
    "regen": 1,
    "passives": {
      "concentration": 1,
      "marksman": 1,
      "sumo": 1
    },
    "icon": "armor-quietstorm",
    "description": "绷住恢复 +1/秒，受到生命伤害 -4%，附加被动：集中+1、射手潜能+1、相扑手+1",
    "shape": [
      "###",
      "#..",
      "###",
      "#..",
      "###"
    ]
  }
];
