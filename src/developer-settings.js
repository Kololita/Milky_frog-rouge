import {tuningFields,tuningRange,applyTuning} from './tuning-registry.js';
import './battle-values.js';
import './control-tuning.js';
import './samurai.js';
import './back-throw.js';
import './character-state.js';
import './combat.js';
import './guard-effect.js';
import './shift-tap.js';
import './skills.js';
import './monster-catalog.js';

const groups={MONSTER_RULES:'怪物共有规则',MOB_RULES:'小怪共有规则',POTION_STATS:'血瓶',MONSTER_STATS:'远征怪物',SKILL_STATS:'主动技能',ATTACK_RATE:'攻击动画速度',DODGE_RATE:'闪避动画速度',ENERGY_BONUS:'能量增伤',JUMP_TUNING:'跳跃高度',DODGE_TUNING:'闪避距离与方向',SHIFT_TUNING:'跑步与点按判定（毫秒）',PLAYER_STATS:'奶蛙基础',POSE_STATS:'绷住',ENERGY_STATS:'金光与能量',RAGE_STATS:'愤怒形态',DODGE_DEFENSE:'闪避无敌帧',GUARD_TIERS:'格挡档位',GUARD_STATS:'格挡与反击',ENEMY_STATS:'训练人偶',IMPACT_LEVELS:'冲击力等级',ATTACK_STATS:'攻击判定与伤害',WAVE_STATS:'气功波',MOVEMENT:'移动手感',ANIMATION:'动画混合',BLOCK:'格挡输入',COMBO:'连招输入',CAMERA:'镜头',TARGET_LOCK:'锁定镜头',SAMURAI_STATS:'Boss 基础',SAMURAI_RECOVERY:'Boss 攻击间隔',SAMURAI_COMBOS:'武士 连段收招等待',SAMURAI_PHASES:'武士 阶段参数',SAMURAI_TRANSITION:'武士 引雷转阶段',SAMURAI_EVADE:'武士 后闪反刺',SAMURAI_AIM:'Boss 出招转向',SAMURAI_MOVES:'Boss 各招式',BACK_THROW:'背摔',CHAIN_WINDOWS:'连携态',MOBILITY_TIMING:'跳跃与闪避时序',AIR_SLAM:'空中下砸',GUARD_EFFECT:'格挡特效'};
const names={contactPhase:'命中动画位置',waitMultiplier:'收招等待倍率',healthThreshold:'生命阈值',strikeAt:'雷击时刻',stunDuration:'眩晕时长',damageReduction:'伤害减免',recoveryWait:'收招等待（秒）',baitDuration:'诱攻踱步时间',counterPause:'后闪后反刺停顿',chance:'触发概率',maxPrediction:'最长预判时间',maxPlayerSpeed:'玩家速度采样上限',recoil:'弹反造成硬直',counterDelay:'弹反衔接时间',feedbackDuration:'弹反反馈时长',cooldown:'招式冷却',maxParryImpact:'可弹冲击上限',hitProgress:'释放结算进度',hurtRecovery:'受击恢复间隔',knockDecay:'击退衰减',ai:'选招配置',orbitDuration:'近身侧绕时间',lockRecovery:'保留动作冷却',recoveryMovement:'恢复移动',startupResilience:'出手韧性',restGain:'休息补充血瓶',retreatChance:'近身后撤概率',closeShotChance:'贴身攻击中三射比例',retreatCooldown:'后撤冷却',retreatDistance:'后撤触发距离',retreat:'后撤距离',projectile:'弹体',count:'弹体数量',spread:'散射间角',lead:'预判提前量',effect:'施加效果',amount:'效果数值',prepare:'准备时间',capacity:'携带上限',heightMin:'判定底部高度',heightMax:'判定顶部高度',bodyHeight:'受击体高度',rangeBonus:'攻击距离增幅',healthRatio:'生命消耗比例',energyPerHit:'每击能量获取',waitMin:'连招等待最短时间',waitMax:'连招等待最长时间',extractMin:'拔剑最短时间',extractMax:'拔剑最长时间',warningLead:'剑身红光提前时间',runRecovery:'跑攻后摇播放倍率',palmCharge:'推掌蓄势播放倍率',linearBonus:'线性增伤上限',fullBonus:'满能量额外增伤',height:'跳跃高度',rollDistance:'前滚距离',backflipDistance:'后空翻距离',sideDistance:'侧闪距离',forwardAngle:'前滚最大夹角',backwardAngle:'后空翻最小夹角',tapMs:'起步点按窗口（毫秒）',movingTapMs:'行走点按窗口（毫秒）',sprintWalkMs:'使用短翻滚窗口所需行走时间（毫秒）',health:'生命上限',pose:'绷住上限',guard:'防御上限',attackPower:'攻击力',radius:'半径',hitInvulnerability:'受击无敌时间',respawn:'重生时间',unblockedMultiplier:'未格挡破绷倍率',regenRate:'恢复速度',regenDelay:'恢复等待时间',regenTick:'恢复结算间隔',max:'上限',gain:'吸收增加量',healRatio:'治疗比例',fullHealRatio:'满能量治疗比例',duration:'持续时间',raiseEnd:'抬手结束',rainEnd:'金光结束',glowEnd:'发光结束',energyCost:'能量消耗',damageMultiplier:'伤害倍率',attackSpeed:'攻击速度倍率',attackInterval:'攻击间隔倍率',worldSpeed:'环境速度倍率',onHitHealRatio:'命中治疗比例',startFrame:'无敌起始帧',frames:'无敌帧数',maxFrames:'档位截止帧',poseMultiplier:'格挡破绷倍率',poseDamage:'基础破绷伤害',minimumGuard:'最低保留量',halfAngle:'判定半角（弧度）',lateDamageRatio:'迟缓格挡受伤比例',breakMultiplier:'破防伤害倍率',breakStun:'破防硬直',counterDuration:'金光有效时间',speed:'移动速度',turnRate:'自由转向速度（弧度/秒）',windupTurnRate:'起手转向速度',turnResponse:'转向响应',turnAcceleration:'转向加速度',noticeRange:'警戒范围',stopDistance:'停步距离',approachTolerance:'接近容差',reach:'攻击距离',motionMultiplier:'动作倍率',stun:'硬直时间',knockback:'击退距离',windup:'出招总时间',recovery:'恢复时间',settle:'稳住身形时间',spawn:'出生位置',x:'横坐标',z:'纵坐标',knockDuration:'击退时间',daze:'眩晕时间',times:'命中时刻',range:'作用距离',impactLevel:'冲击力',hitCooldown:'同目标命中冷却',walkSpeed:'走路速度',runSpeed:'跑步速度',acceleration:'加速响应',speedDown:'降速响应',braking:'刹车响应',stopSpeed:'停止速度阈值',turnSnap:'转向吸附角',reverseAngle:'掉头触发角',reverseMinSpeed:'掉头触发速度',walkPivotDuration:'走路掉头时间',runPivotDuration:'跑步掉头时间',runPivotSpeed:'跑步掉头速度阈值',walkRate:'走路播放倍率',runRate:'跑步播放倍率',minWalkStride:'走路最小步幅',minRunStride:'跑步最小步幅',runExitSpeed:'跑步退出速度',rateResponse:'播放速度响应',raiseDuration:'格挡抬手时间',raiseClipFraction:'格挡抬手采样比例',releaseGrace:'松开宽限时间',reblockVulnerability:'再次格挡空窗',repeatPenaltyWindow:'连按惩罚时间',repeatPerfectScale:'连按完美窗口倍率',inputWindow:'连招保留时间',yawSensitivity:'鼠标转向系数',zoomResponse:'镜头距离响应',initialDistance:'初始镜头距离',pitch:'俯仰角',targetHeight:'镜头目标高度',tolerance:'拉回容许角',response:'拉回响应',maxYawRate:'最大镜头角速度',settledAngle:'拉回结束角',minTargetDistance:'最小锁定距离',screenMargin:'画面边缘比例',impactResistance:'冲击耐受',uiHeight:'血条高度',link:'连段间隔',phase1:'一阶段',phase2:'二阶段',phase3:'三阶段',rate:'转向速度',lockLead:'提前锁定方向时间',lunge:'向前突进距离',swing:'挥刀时间',slamTakeoff:'坐砸起跳时刻',slamApex:'坐砸顶点时刻',slamHeight:'坐砸高度',impact:'落地时刻',flipStart:'起身开始时刻',regrabProtection:'起身背摔保护',attack:'攻击后连携',roll:'前滚后连携',dodge:'闪避后连携',block:'格挡后连携',takeoff:'起跳动画比例',contact:'落地动画比例',startup:'前摇时间',charge:'蓄势时间',lift:'二段跃起高度',impactHold:'砸地停留时间',recoveryRate:'起身动画速度',gravity:'下砸重力',driftBase:'基础前移',driftPerSpeed:'速度前移系数',driftMax:'最大前移',faceOpacity:'盾面不透明度',rimOpacity:'盾边不透明度',forwardOffset:'盾前移距离',absorbStart:'金光收拢开始',absorbEnd:'金光收拢结束'};
const actions={longarm:'长臂',drain:'汲能',Attack1:'左直拳',Attack2:'右直拳',Attack3:'三连拳',Attack4:'重推掌',CounterWave:'气功推掌',RunAttack:'跑攻',AirAttack:'跳砸',DodgeRoll:'前滚',DodgeBackflip:'后空翻',DodgeSideL:'左侧闪',DodgeSideR:'右侧闪',Jump:'原地跳',JumpWalk:'走跳',JumpRun:'跑跳',counter:'后闪反刺',double:'二连斩',heavy:'特慢刀',quick:'快刀',delay:'慢刀',mixed:'混合连招',thrust:'突刺',sweep:'横扫'};
export function createDeveloperSettings(doc,win,{onApply=()=>{}}={}){
  const root=doc.getElementById?.('developer-controls');if(!root)return;
  const storage=win.naiwaSettings??win.localStorage,key='milk-heroes-tuning-v1';
  let saved={},draft={};
  try{saved=JSON.parse(storage?.getItem(key)??'{}')??{};applyTuning(saved);}catch{saved={};applyTuning();}
  draft={...saved};
  const toggle=doc.getElementById('developer-enabled'),search=doc.getElementById('developer-search'),message=doc.getElementById('developer-message');
  const rows=[];
  for(const [id,title] of Object.entries(groups)){
    const fields=tuningFields().filter(f=>f.group===id);if(!fields.length)continue;
    const details=doc.createElement('details'),summary=doc.createElement('summary');summary.textContent=`${title} · ${fields.length}`;details.append(summary);root.append(details);
    for(const field of fields){
      const row=doc.createElement('label'),caption=doc.createElement('span'),input=doc.createElement('input'),output=doc.createElement('output');
      const label=field.path.map(p=>actions[p]??names[p]??(/^\d+$/.test(p)?`第${Number(p)+1}项`:p)).join(' / ');
      row.className='tuning-row';caption.textContent=label;caption.title=field.id;input.type='range';
      Object.assign(input,tuningRange(field));input.value=field.value;
      // Developer precision is deliberate; normal gameplay UI still floors numbers.
      const update=()=>{output.textContent=Number(input.value).toFixed(4).replace(/\.?0+$/,'')||'0';};
      input.addEventListener('input',()=>{draft[field.id]=Number(input.value);update();message.textContent='有未应用的调整';});
      row.append(caption,input,output);details.append(row);update();rows.push({row,details,input,update,field,text:`${title} ${label} ${field.id}`.toLowerCase()});
    }
  }
  toggle.addEventListener('change',()=>{doc.getElementById('developer-panel').hidden=!toggle.checked;});
  search.addEventListener('input',()=>{
    const q=search.value.trim().toLowerCase();for(const r of rows)r.row.hidden=!r.text.includes(q);
    for(const details of root.children){details.hidden=!rows.some(r=>r.details===details&&!r.row.hidden);if(q)details.open=true;}
  });
  function commit(patch){
    try{applyTuning(patch);saved={...patch};draft={...patch};
      try{storage?.setItem(key,JSON.stringify(saved));}catch{}
      for(const r of rows){r.input.value=patch[r.field.id]??r.field.default;r.update();}
      onApply();message.textContent='已应用并保存，当前训练场已重置';
    }catch(error){message.textContent=error.message;}
  }
  doc.getElementById('developer-apply').addEventListener('click',()=>commit(draft));
  doc.getElementById('developer-reset').addEventListener('click',()=>commit({}));
  onApply();
}
