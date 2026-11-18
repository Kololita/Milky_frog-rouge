import {EQUIPMENT_PASSIVES} from './equipment-passives.js';
const TERMS={
 '攻击速度':'出招的快慢。',
 '攻击间隔':'两次攻击之间的等待时间。',
 '攻击力':'提升攻击造成的伤害。',
 '最大生命':'可拥有的最多生命值。',
 '生命上限':'可拥有的最多生命值。',
 '绷住上限':'可承受的绷住损失，耗尽时会忍不住大笑。',
 '绷住恢复':'脱离攻击后，绷住条的恢复速度。',
 '伤害减免':'按比例减少受到的生命与护盾伤害。',
 '受到生命伤害':'受到敌人攻击时损失的生命。',
 '攻击距离':'攻击能够触及的距离。',
 '血瓶恢复量':'使用血瓶时的生命恢复量增幅。',
 '能量获取':'提升每次获得的能量。',
 '护盾':'替生命抵挡伤害的屏障。',
 '能量':'释放技能和大招的资源，上限100。',
 '霸体':'受到冲击时保持动作，仍会受到伤害。',
 '冲击力':'决定目标受到打断、坐倒或击飞的等级。',
};
for(const passive of Object.values(EQUIPMENT_PASSIVES))TERMS[passive.name]=`每级：${passive.effect(1)}`;
TERMS['集中']='缩短蓄力时间：1级10%，2级25%，3级40%。';
const names=Object.keys(TERMS).sort((a,b)=>b.length-a.length);
export function renderEquipmentText(doc,root,value,{lines=true}={}){
 root.replaceChildren();
 for(const text of (lines?String(value).split(/[，、；\n]/):[String(value)])){
  if(!text.trim())continue;
  const line=doc.createElement('span');line.className=lines?'equipment-effect-line':'';
  let offset=0;
  while(offset<text.length){
   const term=names.find(name=>text.startsWith(name,offset));
   const span=doc.createElement('span');
   if(term){span.textContent=term;span.className='equipment-term';span.title=TERMS[term];span.setAttribute('tabindex','0');span.setAttribute('aria-label',term+'：'+TERMS[term]);offset+=term.length;}
   else{let end=offset+1;while(end<text.length&&!names.some(name=>text.startsWith(name,end)))end++;span.textContent=text.slice(offset,end);offset=end;}
   line.append(span);
  }
  root.append(line);
 }
}
