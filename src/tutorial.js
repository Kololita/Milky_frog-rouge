import {COUNTER_CHARGE} from './battle-values.js';

const label=code=>({Mouse0:'鼠标左键',Mouse1:'鼠标中键',Mouse2:'鼠标右键',ShiftLeft:'Shift',Space:'空格'}[code]??code.replace(/^Key|^Digit/,''));
export const TUTORIAL_SECTIONS=[{id:'basics',name:'基础操作与机制'},{id:'equipment',name:'装备与装配'},{id:'moves',name:'招式大全'}];
export function createTutorial(doc,{bindings,exit,prepareAssembly=()=>{},closeAssembly=()=>{},prepareAbility=()=>{},prepareMove=()=>{}}){
 const panel=doc.getElementById('tutorial-panel'),host=panel?.parentElement;let index=-1,baseline,readyAt=null,done=false,section='basics',lessons=[],entered=false;
 const key=action=>label(bindings()[action]??(action==='Laugh'?'KeyE':action)),hit=label=>(s,events)=>events.some(e=>e.type==='enemyHit'&&e.label===label),skill=id=>(s,events)=>events.some(e=>e.type==='skillStarted'&&e.id===id);
 const basics=[
  {title:'移动',text:()=>`按 ${['KeyW','KeyA','KeyS','KeyD'].map(key).join(' / ')} 移动，走出几步。`,test:s=>Math.hypot(s.x-baseline.x,s.z-baseline.z)>2},
  {title:'观察四周',text:()=> '移动鼠标转动视角。战斗中鼠标锁在窗口内，可以持续向同一方向转动。',test:s=>Math.abs(s.yaw-baseline.yaw)>.5},
  {title:'疾跑',text:()=>`按住方向键和 ${key('ShiftLeft')} 加速，持续按住进入疾跑。`,test:s=>s.sprint&&s.speed>2.5},
  {title:'锁定目标',text:()=>`按 ${key('KeyQ')} 锁定人偶；锁定时左右甩动鼠标可切换目标，再按一次解除。`,test:s=>s.locked},
  {title:'生命、绷住与能量',manual:true,text:()=> '红条是生命，绿条是绷住。绷住耗尽会忍不住大笑并逐渐恢复。拳掌命中积累能量，用于技能与大招。'},
  {title:'跳跃',text:()=>`按 ${key('Space')} 跳跃，也可以边走或边跑边跳。`,test:s=>Boolean(s.jumpName)},
  {title:'闪避',text:()=>`按住方向并点按、松开 ${key('ShiftLeft')} 闪避；持续按住则用于疾跑。`,test:s=>Boolean(s.dodgeName)},
  {title:'格挡',text:()=>`面对人偶，按住 ${key('Mouse2')} 挡住攻击。观察抬手与出拳预警，松开后结束格挡。`,live:true,test:(s,events)=>events.some(e=>e.type==='blocked')},
  {title:'完美格挡',text:()=>`在人偶攻击即将命中时按 ${key('Mouse2')}。时机准确会获得金光，连按格挡会使完美时机更难把握。`,live:true,test:(s,events)=>events.some(e=>e.type==='blocked'&&e.grade==='perfect')},
  {title:'使用血瓶',potion:true,text:()=>`按 ${key('KeyH')} 举瓶喝药。需要完整喝完2秒才治疗；可以走动转身，攻击或翻滚会中断，瓶数返还；受到硬直会中断。`,test:(s,events)=>events.some(e=>e.type==='potionUsed')},
 ];
 const equipment=[
  {title:'选择大招',text:()=>`点击上方的大招图标，在弹出列表中选择一个大招。大招决定装配台形状；能量充满后按 ${key('KeyF')} 释放。`,test:s=>s.equipment&&(s.assemblyActions?.ultimateSelect??0)>(baseline.assemblyActions?.ultimateSelect??0)},
  {title:'放入装备',text:()=> '点击“添加装备”，选一件演示装备，再点击棋盘放入。装备不能重叠；也可以拖动放置。',test:s=>s.equipment&&(s.placements?.length??0)>0},
  {title:'旋转装备',text:()=> '选中装备，按 R 整体旋转、F镜像翻转，再放回棋盘。',test:s=>s.equipment&&s.placements?.some(p=>p.rotation!==0)},
  {title:'折叠装备',text:()=> '选择“守势拳套”，黄色高亮叉线格是当前拐点。按 T 折叠较小一侧，再放回棋盘。',test:s=>s.equipment&&(s.assemblyActions?.bend??0)>(baseline.assemblyActions?.bend??0)&&!s.holding},
  {title:'切换拐点',text:()=> '再次选中“守势拳套”，按 Y 切换拐点，再按 T 折叠并放回。',test:s=>s.equipment&&(s.assemblyActions?.switchBend??0)>(baseline.assemblyActions?.switchBend??0)&&(s.assemblyActions?.bend??0)>(baseline.assemblyActions?.bend??0)&&!s.holding},
  {title:'卸下装备',text:()=> '选中一件已放入的装备，拖进红色回收站松开，或选中后点击回收站。装备会回到背包。',test:s=>s.equipment&&!s.holding&&(s.placements?.length??0)<(baseline.placements?.length??0)},
  {title:'装配一个技能',text:()=>`点击“添加装备”，选择长臂、汲能、护盾或聚能并放入棋盘。每次最多装一个技能。`,test:s=>s.equipment&&Boolean(s.skillEquipped)},
  {title:'释放技能',close:true,ability:'skill',energy:true,text:()=>`按 ${key('KeyE')} 释放刚装配的技能，消耗和效果由技能决定。`,test:(s,events)=>events.some(e=>e.type==='skillStarted')},
  {title:'释放大招',ability:'ultimate',energy:true,text:()=>`按 ${key('KeyF')} 释放当前大招。狂暴提供霸体、加快攻击，命中时回血；拳风让拳掌攻击附带远程劲风。`,test:(s,events)=>events.some(e=>['rageStarted','fistwindStarted','elementalUltimateStarted'].includes(e.type))},
  {title:'转化金光',gold:true,text:()=>`获得金光后按 ${key('Mouse1')} 释放默认金光技能「汲取金光」，获得能量并恢复生命。攻击或闪避会中断，但已经汇聚的能量会保留。`,test:(s,events)=>events.some(e=>e.type==='energyGained')},
  {title:'主动大笑',text:()=>`按 ${key('Laugh')} 开始大笑，绿条会按被动大笑的速度恢复，敌方攻击伤害减半。移动、攻击或转动视角会立即结束大笑。`,test:s=>s.activeLaugh},
 ];
 const moves=[
  {id:'Attack1',title:'左直拳',text:()=>`靠近人偶，按 ${key('Mouse0')} 或 ${key('KeyJ')} 打出第一段左直拳。`,test:hit('左直拳')},
  {id:'Attack2',title:'跨步右直拳',text:()=> '短时间内再次攻击，接第二段右直拳。出招过程中也可预输入下一段。',test:hit('跨步右直拳')},
  {id:'Attack3',title:'三连拳',text:()=> '连续输入攻击至第三段，打出左右左三连拳。三拳快速连续打出。',test:hit('三连拳')},
  {id:'Attack4',title:'重推掌',text:()=> '继续输入第四次攻击，短暂收手蓄势后重推掌。',test:hit('蓄力重推掌')},
  {id:'RunAttack',title:'跑步攻击',text:()=>`疾跑中按 ${key('Mouse0')} 或 ${key('KeyJ')} 双掌前推。稳住身形时可立即走动、闪避，但0.5秒内不能再次攻击。`,test:hit('跑步双掌')},
  {id:'jump',title:'原地跳、走跳与跑跳',text:()=>`站立、走动或疾跑时按 ${key('Space')}，会使用对应跳跃。跳跃不会打断移动方向。`,test:s=>Boolean(s.jumpName)},
  {id:'AirAttack',title:'跳跃下砸',text:()=>`先跳跃，再按攻击。会二次跃起蓄势，双拳向下砸地，随后后空翻站起；命中可击退并眩晕敌人。`,test:hit('跳跃下砸')},
  {id:'CounterWave',title:'金光气功光球',gold:true,text:()=>`金光状态下按住 ${key('Mouse0')} 或 ${key('KeyJ')} 蓄力，松开后发射光球。点按时会自动蓄满${COUNTER_CHARGE.minimum}秒再发射。每档闪一下、增伤${Math.round(COUNTER_CHARGE.bonusPerStage*100)}%，最多${COUNTER_CHARGE.maxStages}档，满蓄额外增伤${Math.round(COUNTER_CHARGE.fullBonus*100)}%。光球可穿透多个敌人。`,test:(s,events)=>events.some(e=>e.type==='waveReleased')},
  {id:'BackThrow',title:'背摔',text:()=> '靠近可背摔目标的背后，一个身位内按攻击：过肩摔后跃起坐砸。目标倒地无敌，起身时可以追击；非人形目标通常不能背摔。',test:(s,events)=>events.some(e=>e.type==='backThrowCompleted')},
  {id:'DodgeRoll',title:'前滚翻',text:()=>`朝人物前方输入方向并点按 ${key('ShiftLeft')}，前滚避开攻击。闪避开始就有短暂无敌。`,test:s=>s.dodgeName==='DodgeRoll'},
  {id:'DodgeBackflip',title:'后空翻',text:()=>`保持人物朝向，按后方向并点按 ${key('ShiftLeft')}。在攻击等动作后的连携态可做出后空翻。`,test:s=>s.dodgeName==='DodgeBackflip'},
  {id:'DodgeSide',title:'侧闪',text:()=>`保持朝向，按左或右方向并点按 ${key('ShiftLeft')}，向侧面闪身。`,test:s=>['DodgeSideL','DodgeSideR'].includes(s.dodgeName)},
 ];
 const snapshot=s=>({...s,assemblyActions:{...s.assemblyActions}});
 const groups={basics,equipment,moves};
 function attachPanel(){if(!panel)return;if(section==='equipment'&&index<7){const dialog=doc.getElementById('equipment-dialog');if(dialog)dialog.insertBefore(panel,dialog.querySelector('.equipment-layout'));}else host?.append(panel);}
 function render(){if(!panel)return;panel.hidden=index<0;if(index<0)return;const lesson=lessons[index];panel.querySelector('h2').textContent=done?'本部分完成':`${index+1} / ${lessons.length}　${lesson.title}`;panel.querySelector('p').textContent=done?'按 Enter 返回教程目录。':lesson.text();panel.querySelector('progress').max=lessons.length;panel.querySelector('progress').value=done?lessons.length:index;const footer=panel.querySelector('small');if(footer)footer.textContent=section==='moves'?'N 下一招 · P 上一招 · Esc 返回目录':lesson.manual?'N 继续 · Esc 返回目录':'N 跳过此步 · Esc 返回目录';}
 function stop(){index=-1;readyAt=null;done=false;entered=false;if(host&&panel)host.append(panel);render();}
 function enter(battle){const lesson=lessons[index];entered=true;if(section==='moves')prepareMove(lesson.id);if(lesson.close){closeAssembly();attachPanel();}if(lesson.ability)prepareAbility(lesson.ability);if(lesson.gold){battle.player.counterReady=true;battle.player.counterUntil=battle.time+120;}if(lesson.energy)battle.player.energy=100;if(lesson.potion){battle.player.health=battle.maxHealth*.4;battle.player.potions=Math.max(1,battle.player.potions);}battle.enemy.state='idle';battle.enemy.elapsed=0;}
 doc.addEventListener('keydown',event=>{if(index<0)return;if(['Escape','KeyN'].includes(event.code)||section==='moves'&&event.code==='KeyP'||done&&event.code==='Enter'){event.preventDefault();event.stopImmediatePropagation();if(event.code==='Escape'||done){stop();exit();}else if(event.code==='KeyP'){index=Math.max(0,index-1);readyAt=null;entered=false;render();}else readyAt=0;}},true);
 return {stop,get active(){return index>=0;},get section(){return section;},start(state,part='basics'){section=groups[part]?part:'basics';lessons=groups[section];index=0;baseline=snapshot(state);readyAt=null;done=false;entered=false;if(section==='equipment')prepareAssembly();attachPanel();render();},update(s,events,battle){
  if(index<0)return;if(!entered)enter(battle);
  const lesson=lessons[index],clock=s.now??battle.time;
  if(!lesson.live||done){if(!['thrown','down','rising'].includes(battle.enemy.state)){battle.enemy.state='hurt';battle.enemy.elapsed=0;battle.enemy.stun=100;}battle.enemy.knockX=0;battle.enemy.knockZ=0;}
  battle.player.health=Math.max(30,battle.player.health);if(battle.enemy.health<=0){battle.enemy.health=battle.enemy.maxHealth;battle.enemy.state='idle';}
  if(done)return;if(readyAt===null&&lesson.test?.(s,events)){readyAt=clock+.75;panel.querySelector('p').textContent='完成';}
  if(readyAt!==null&&clock>=readyAt){index++;baseline=snapshot(s);readyAt=null;entered=false;if(index===lessons.length){index--;done=true;}attachPanel();render();}
 }};
}
