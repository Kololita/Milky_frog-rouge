import fs from 'node:fs/promises';
import {EQUIPMENT,RARITIES} from '../src/equipment-catalog.js';
const categories={armor:'装甲',gloves:'拳套',charm:'护符',skill:'技能',ultimate:'大招'};
await fs.mkdir('docs/equipment',{recursive:true});
const details={
 longarm:['能量不足或技能已在生效时不能再次开启。','攻击时显示与实际攻击距离对应的中空掌／拳特效。'],
 drain:['当前生命必须高于消耗量；技能已在生效时不能重复开启。','生效时能量条周边显示光圈。'],
 rage:['消耗 100 能量，持续 9 秒，可在远征开局选择。','获得霸体，攻击动画速度增加20%，攻击间隔缩短20%，环境速度降低20%。','每次命中回复最大生命的5%，不额外增加伤害。','眼睛变为纯红色，画面叠加偏红效果，能量条显示剩余持续时间。'],
};
for(const [slot,label] of Object.entries(categories)){
 const items=EQUIPMENT.filter(item=>item.slot===slot);
 const page=['# '+label+'设计','','共有的品质、掉落、装备和结算规则见[装备与掉落](../装备与掉落.md)。占地及最终数值见[占地形状池](./占地形状池.md)。',''];
 for(const item of items){
  page.push('### '+item.name,'','品质：'+(RARITIES[item.rarity]?.label??'无')+'。','','效果：'+item.description.replace(/。$/,'')+'。','','标识：`'+item.id+'`。','');
  for(const text of details[item.id]??[])page.push(text,'');
 }
 if(slot==='skill')page.push('数值配置：src/skills.js；目录与品质：src/equipment-catalog.js。','');
 if(slot==='ultimate')page.push('数值配置：src/battle-values.js中的RAGE_STATS。','');
 // Preserve manually authored equipment designs.
 try{await fs.writeFile('docs/equipment/'+label+'.md',page.join('\n'),{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
}
const lines=[
 '# 装备与掉落', '',
 '每次开始新游戏，先选择职业大招，再选择一项开局增益。职业贯穿本局，战斗战利品只包含装备与技能。练习场和独立竞技场采用独立的测试配装。', '',
 '小怪、精英胜利后显示两张战利品卡，必须选一件收入背包才能进入下一层，未选择的一件丢弃。两张卡不同，避免重复掉落已经持有的同名物品；选中的装备不会自动替换当前配装。之后在战前装备界面安装，列表只显示本局持有且尚未装入当前装配台的装备。休息处不掉装备，samurai胜利直接结束本局。', '',
 '## 品质与概率', '',
 '小怪掉落：白65%、绿28%、蓝7%；不掉落紫、金。', '',
 '精英掉落：绿45%、蓝32%、紫18%、金5%；不掉落白。', '',
 '每张卡先按品质权重抽取，再从该品质未持有的物品中抽一件；同次抽取排除已选候选，品质池耗尽时在仍有候选的合法品质中重新归一化。图标底色与卡片边框使用对应品质色。', '',
 '技能共用白、绿、蓝、紫、金五档品质；目前“长臂”“汲能”均为蓝色，参加小怪和精英战斗胜利后的二选一掉落，使用蓝色图标底色。品质与技能效果分别配置，当前没有额外的技能升级或经验系统。选中后收入背包，在战前装配台安装后才能使用（最多一个技能）。', '',
 '## 分类设计文档', '', ...Object.values(categories).map(label=>`- [${label}设计](./equipment/${label}.md)`), '',
 '## 属性结算', '',
 '只有当前大招装配台内的装备生效，已安装装备属性相加，可同时增加和减少多种属性。官方名称为“绷住”。锁甲为蓝色，最大生命+50、绷住上限-20；裸装时生命100、绷住100，装配后为生命150、绷住80。切换上限装备按当前资源比例换算，不通过来回切换重复回血。大笑恢复、自然恢复和界面条均使用当前绷住上限。装备常驻属性不生成状态图标。', '',
 '主配置：src/equipment-catalog.js，修改描述和对应数值字段；概率：src/loot.js。品质色：src/style.css的data-rarity样式。局内背包推进：src/run-map.js。', '',
 '占地由类型及品质形状池在奖励生成时确定，属性按平衡倍率和形状倍率结算，见[占地形状池](./equipment/占地形状池.md)。', '', '本次仅更新网页与共用代码，未更新release发行文件。', '',
];
await fs.writeFile('docs/装备与掉落.md',lines.join('\n'));console.log(`EQUIPMENT_DESIGN_WRITTEN: ${EQUIPMENT.length} items`);
