import {SAMURAI_IDLE_PREVIEW} from './model-preview.js';
import {AttackMove,MovementMove} from './enemy-move.js';
import {tunable} from './tuning-registry.js';
import {steerEnemy} from './enemy-steering.js';
import {ATTACK_PREVIEW_LEAD} from './attack-warning.js';
export const SAMURAI_STATS=tunable('SAMURAI_STATS',{name:'武士',visual:'samurai',model:'samurai',visualScale:1.35,bodyHeight:2.25,health:2200,attackPower:6,radius:.55,superArmor:false,impactResistance:1,speed:1.7,turnRate:Math.PI*100/180,windupTurnRate:Math.PI*65/180,turnResponse:5,turnAcceleration:12,noticeRange:40,stopDistance:1.85,approachTolerance:.04,reach:2.2,halfAngle:Math.PI*.45,motionMultiplier:4,startupResilience:1,impactLevel:2,windup:.6,recovery:1.6,respawn:5,spawn:{x:0,z:6},uiHeight:2.42});
const cut=(label,windup,motionMultiplier,range,angle,lunge=0,swing=.26,startupResilience=3,motion='overhead',poseDamage=20,unblockable=false)=>new AttackMove({label,prepare:windup-swing,motionMultiplier,reach:range,halfAngle:(motion.includes('overhead')?75:angle)*Math.PI/180,lunge,swing,startupResilience,impactLevel:motion==='buried-overhead'?3:motion.includes('thrust')?2:startupResilience>=3?2:1,motion,poseDamage,unblockable,heightMin:motion==='round-sweep'?.1:motion.includes('thrust')?.65:motion.includes('overhead')?0:.45,heightMax:motion==='round-sweep'?.75:motion.includes('thrust')?1.4:motion.includes('overhead')?2.3:motion==='rising'?1.9:1.45});
export const SAMURAI_RECOVERY=tunable('SAMURAI_RECOVERY',{link:.32,settle:.36,extractMin:1,extractMax:2});
// Each routine owns its base wait; phase modifiers apply once when it starts.
export const SAMURAI_COMBOS=tunable('SAMURAI_COMBOS',{
 double:{recoveryWait:2.25},quick:{recoveryWait:2.1},delay:{recoveryWait:2.35},mixed:{recoveryWait:2.9},
 thrust:{recoveryWait:1},sweep:{recoveryWait:1},heavy:{recoveryWait:3.2},counter:{recoveryWait:1},
});
export const SAMURAI_PHASES=tunable('SAMURAI_PHASES',{
 phase1:{waitMultiplier:1},phase2:{healthThreshold:.75,waitMultiplier:.9},phase3:{healthThreshold:.4,waitMultiplier:.75},
});
export const SAMURAI_TRANSITION=tunable('SAMURAI_TRANSITION',{duration:5,strikeAt:2.2,radius:2.6,motionMultiplier:2,poseDamage:20,stunDuration:1,damageReduction:.4});
export const samuraiWaitMultiplier=phase=>SAMURAI_PHASES[`phase${Math.max(1,Math.min(3,phase))}`].waitMultiplier;
export const SAMURAI_EVADE=tunable('SAMURAI_EVADE',{range:2.7,chance:.28,baitDuration:1.4,cooldown:8,duration:.34,distance:1.7,counterPause:.42});
const backstep=new MovementMove({label:'后闪',motion:'backstep',prepare:0,swing:.34,invulnerable:true});
// Only the very slow overhead keeps the old limited overhead aim policy.
export const SAMURAI_AIM=tunable('SAMURAI_AIM',{
  'buried-overhead':{rate:Math.PI*150/180,lockLead:.22},
});
export const SAMURAI_MOVES=tunable('SAMURAI_MOVES',{
  double:[Object.assign(cut('二连斩 · 左斩',1.30,3.2,2.5,70,.35,.30,1,'double-left',26),{contactPhase:.35}),cut('二连斩 · 右返',.50,3.4,2.5,70,.35,.30,1,'double-right',28)],
  quick:[Object.assign(cut('突刺斩 · 快斩',.64,3.2,2.2,75,.24,.26,1,'cross-right',24),{linkWait:.20}),cut('突刺斩 · 贯刺',.76,3.8,2.5,30,1.1,.30,1,'short-thrust',28,true)],
  delay:[cut('慢刀 · 蓄势重斩',1.48,5.6,2.65,85,.7,.34,3,'overhead',40),cut('快刀 · 追击',.66,3.2,2.15,60,.25,.26,1,'short-thrust',22)],
  mixed:[cut('慢刀 · 起手',1.04,3.4,2.3,70,.2,.30,3,'rising',30),cut('快刀 · 返斩',.64,2.8,2.2,70,.15,.26,1,'cross-right',24),cut('慢刀 · 压拍重斩',1.38,6,2.65,90,.45,.34,3,'overhead',38)],
  thrust:[cut('突进 · 横斩',1.02,4.8,2.35,75,2.15,.38,3,'cross-left',32)],
  sweep:[cut('慢刀 · 环身横扫',1.34,5,2.65,180,.1,.36,3,'round-sweep',36)],
  heavy:[cut('特慢刀 · 钉地重斩',3.34,7,2.8,80,.35,.34,3,'buried-overhead',60,true)],
  counter:[cut('后闪 · 反身贯刺',.74,5,2.6,28,2.65,.32,2,'counter-thrust',36,true)],
});
function randomBetween(enemy,min,max){enemy.seed=(Math.imul(enemy.seed,1664525)+1013904223)>>>0;return min+(max-min)*enemy.seed/4294967296;}
export function samuraiSequenceWait(enemy){
 return enemy.sequence.recoveryWait;
}
export function samuraiStrikeActive(enemy){
 if(enemy.state!=='windup')return false;
 if(enemy.move?.contactPhase!=null)return enemy.elapsed>=enemy.hitAt-.12&&enemy.elapsed<=enemy.hitAt+.10;
 return enemy.elapsed>=enemy.telegraph;
}
function windup(enemy){
  enemy.move=enemy.sequence[enemy.moveIndex];const rate=enemy.phase>=2&&enemy.move.motion!=='buried-overhead'?1.16:1;
  // Clip phases 0..0.45 cover preparation; 0.45..0.70 cover the later swing.
  // An authored contact phase can target a visible earlier cut without ending the clip.
  const contact=enemy.move.contactPhase??.70,prepWeight=Math.min(1,contact/.45);
  enemy.swingDuration=enemy.move.swing;
  const contactOffset=enemy.swingDuration*Math.max(0,(contact-.45)/.25);
  const prepare=enemy.pattern==='counter'?SAMURAI_EVADE.counterPause:
    enemy.move.prepareOverride??Math.max(.30,enemy.move.windup/rate-enemy.swingDuration);
  enemy.telegraph=Math.max(prepare,(ATTACK_PREVIEW_LEAD-contactOffset)/prepWeight);
  enemy.hitAt=enemy.telegraph*prepWeight+contactOffset;
  enemy.windup=enemy.telegraph+enemy.swingDuration;enemy.elapsed=0;enemy.state='windup';enemy.superArmor=enemy.move.startupResilience>=3;enemy.lungeDone=0;enemy.hitResolved=false;enemy.extracting=false;
}
export function samuraiSequence(name,phase=1){
 const sequence=SAMURAI_MOVES[name].map(move=>Object.assign(Object.create(Object.getPrototypeOf(move)),move));
 const follow=(motion,wait=.30)=>{const move=cut('追斩',wait+.28,3.4,2.5,75,.3,.28,1,motion,28);move.prepareOverride=wait;return move;};
 if(name==='double'){
  sequence[0].prepareOverride=1;sequence[0].linkWait=.16;
  sequence[1].prepareOverride=.20;
  if(phase>=2){sequence[1].linkWait=.14;for(let i=0;i<3;i++){const move=follow(i%2?'cross-left':'cross-right',i===0?.36:.16);move.linkWait=.14;sequence.push(move);}}
  if(phase>=3){const move=cut('终式 · 当头重劈',.86,6.5,2.8,85,.45,.36,3,'overhead',48);move.prepareOverride=.5;sequence.push(move);}
 }else if(name!=='counter')for(let i=1;i<phase;i++)sequence.push(follow(i%2?'cross-right':'overhead',.35));
 sequence.recoveryWait=SAMURAI_COMBOS[name].recoveryWait*samuraiWaitMultiplier(phase);
 return sequence;
}
export function beginBossSequence(battle,name){
  if(battle.enemy.pendingPhase){beginSamuraiTransition(battle);return;}
  const e=battle.enemy;e.pattern=name;e.sequence=samuraiSequence(name,e.phase??1);e.moveIndex=0;
  windup(e);battle.emit('bossMove',{label:e.move.label});
}
export function beginSamuraiTransition(battle){
 const e=battle.enemy;if(!e.pendingPhase||e.state==='transition')return false;
 e.transitionTo=e.pendingPhase;e.pendingPhase=null;e.transitionStrikeAt=Math.max(SAMURAI_TRANSITION.strikeAt,ATTACK_PREVIEW_LEAD);
 e.transitionDuration=Math.max(SAMURAI_TRANSITION.duration,e.transitionStrikeAt);
 e.state='transition';e.elapsed=0;e.turnVelocity=0;e.superArmor=true;e.sequence=null;e.extracting=false;e.swordAnchor=null;
 e.knockX=0;e.knockZ=0;e.transitionHit=false;
 e.move=new AttackMove({label:'引雷转阶段',motion:'phase-shift',prepare:e.transitionStrikeAt,swing:.01,
  reach:SAMURAI_TRANSITION.radius,halfAngle:Math.PI,heightMin:0,heightMax:4,
  motionMultiplier:SAMURAI_TRANSITION.motionMultiplier,poseDamage:SAMURAI_TRANSITION.poseDamage,
  stunDuration:SAMURAI_TRANSITION.stunDuration,impactLevel:1,unblockable:true,damageReduction:SAMURAI_TRANSITION.damageReduction,backThrowImmune:true});
 battle.emit('bossTransitionStarted',{enemy:e,to:e.transitionTo,duration:e.transitionDuration});return true;
}
export function updateSamurai(battle,dt,pose){
  const e=battle.enemy;
  if(SAMURAI_IDLE_PREVIEW){e.state='idle';e.elapsed=0;e.moving=false;e.turnVelocity=0;e.move=null;e.sequence=null;e.extracting=false;return;}
  if(e.health<=0)return;
  if(e.state==='transition'){
    if(!e.transitionHit&&e.elapsed>=e.transitionStrikeAt-1e-9){
      e.transitionHit=true;e.phase=e.transitionTo;e.lightningAt=battle.enemyTime-(e.elapsed-e.transitionStrikeAt);
      battle.emit('bossPhase',{label:battle.enemyName});battle.emit('bossLightning',{enemy:e,x:e.x,z:e.z,radius:e.move.reach});
      battle.strikePlayer(pose,e.move,Math.max(0,(e.elapsed-e.transitionStrikeAt)/(battle.worldTimeScale||1)));
    }
    if(e.elapsed>=e.transitionDuration-1e-9){e.state='idle';e.elapsed=Math.max(0,e.elapsed-e.transitionDuration);e.superArmor=false;e.move=null;e.transitionTo=null;}
    return;
  }
  if(e.state==='hurt'){e.turnVelocity=0;if(e.elapsed>=e.stun){e.state='idle';e.elapsed=0;e.sequence=null;}return;}
  if(e.pendingPhase&&(['idle','chase','circle','bait'].includes(e.state)||e.state==='recover'&&e.elapsed>=e.recovery-1e-9)){beginSamuraiTransition(battle);return;}
  if(e.state==='bait'){
    steerEnemy(e,pose,dt);const dx=pose.x-e.x,dz=pose.z-e.z,d=Math.hypot(dx,dz);
    if((battle.attackIntent??0)>e.baitAttackIntent){
      e.state='evade';e.elapsed=0;e.move=backstep;e.evadeDuration=SAMURAI_EVADE.duration;e.evadeOrigin={x:e.x,z:e.z};
      const yaw=e.heading+Math.PI*.75;e.evadeTarget={x:e.x+Math.sin(yaw)*SAMURAI_EVADE.distance,z:e.z+Math.cos(yaw)*SAMURAI_EVADE.distance};
      e.turnVelocity=0;e.nextEvadeAt=battle.enemyTime+SAMURAI_EVADE.cooldown;return;
    }
    if(e.elapsed>=SAMURAI_EVADE.baitDuration||d>SAMURAI_EVADE.range+.8){e.state='idle';e.elapsed=0;e.nextEvadeAt=battle.enemyTime+SAMURAI_EVADE.cooldown;}
    else if(d>1e-5){const side=.30*Math.sin(e.elapsed*3);e.x-=dz/d*side*dt;e.z+=dx/d*side*dt;}return;
  }
  if(e.state==='evade'){
    const u=Math.min(1,e.elapsed/SAMURAI_EVADE.duration),travel=u*u*(3-2*u);
    e.x=e.evadeOrigin.x+(e.evadeTarget.x-e.evadeOrigin.x)*travel;e.z=e.evadeOrigin.z+(e.evadeTarget.z-e.evadeOrigin.z)*travel;
    e.heading=Math.atan2(pose.x-e.x,pose.z-e.z);
    if(u>=1)beginBossSequence(battle,'counter');return;
  }
  if(e.state==='windup'){
    if(e.move.motion!=='buried-overhead'){
      e.heading=Math.atan2(pose.x-e.x,pose.z-e.z);e.turnVelocity=0;
    }else{
      const aim=SAMURAI_AIM['buried-overhead'],trackingEnd=Math.max(0,e.telegraph-aim.lockLead),trackingDt=Math.max(0,Math.min(dt,trackingEnd-(e.elapsed-dt)));
      if(trackingDt>0)steerEnemy(e,pose,trackingDt,aim.rate);else e.turnVelocity=0;
    }
    const u=Math.max(0,Math.min(1,(e.elapsed-e.telegraph)/e.swingDuration)),travel=e.move.lunge*u*u*(3-2*u);
    let step=Math.max(0,travel-e.lungeDone);
    const forwardX=Math.sin(e.heading),forwardZ=Math.cos(e.heading),dx=pose.x-e.x,dz=pose.z-e.z;
    const along=dx*forwardX+dz*forwardZ,side=dx*forwardZ-dz*forwardX,clearance=e.radius+.40;
    if(along>0&&Math.abs(side)<clearance)step=Math.min(step,Math.max(0,along-Math.sqrt(clearance*clearance-side*side)));
    e.x+=forwardX*step;e.z+=forwardZ*step;e.lungeDone=travel;
    if(!e.hitResolved&&e.elapsed>=e.hitAt-1e-9){
      e.hitResolved=true;
      const impactLag=Math.max(0,(e.elapsed-e.hitAt)/(battle.worldTimeScale||1));
      battle.emit('bossSwing',{label:e.move.label,x:e.x,z:e.z});battle.strikePlayer(pose,e.move,impactLag);
    }
    if(e.state==='windup'&&e.elapsed>=e.windup-1e-9){
      e.state='recover';e.elapsed=0;e.linkRecovery=e.moveIndex+1<e.sequence.length;
      e.extracting=e.move.motion==='buried-overhead';e.swordAnchor=null;
      e.recovery=(e.linkRecovery?(e.move.linkWait??SAMURAI_RECOVERY.link):e.extracting?randomBetween(e,SAMURAI_RECOVERY.extractMin,SAMURAI_RECOVERY.extractMax):SAMURAI_RECOVERY.settle)*samuraiWaitMultiplier(e.phase);
      e.superArmor=false;
    }
    return;
  }
  if(e.state==='recover'){
    e.turnVelocity=0;
    // Only the authored follow-through is stationary. Use the remainder of the
    // existing end-of-chain wait for footwork, without extending attack spacing.
    if(!e.linkRecovery&&e.elapsed>=e.recovery-1e-9){
      e.state='circle';e.elapsed=Math.max(0,e.elapsed-e.recovery);e.circleDuration=samuraiSequenceWait(e);e.extracting=false;e.swordAnchor=null;
      e.circleSign=e.circleSign===1?-1:1;e.move=null;e.sequence=null;return;
    }
    if(e.elapsed>=e.recovery-1e-9){
      if(e.linkRecovery){e.moveIndex++;windup(e);battle.emit('bossMove',{label:e.move.label});}
    }return;
  }
  const dx=pose.x-e.x,dz=pose.z-e.z,distance=Math.hypot(dx,dz);steerEnemy(e,pose,dt);
  if(e.state==='circle'){
    if(e.elapsed<e.circleDuration&&distance>1e-5){
      const radial=Math.max(-.40,Math.min(.40,(distance-2.15)*.65)),side=.65*(e.circleSign??1);
      e.x+=(dx/distance*radial-dz/distance*side)*dt;e.z+=(dz/distance*radial+dx/distance*side)*dt;
      return;
    }
    e.state='idle';e.elapsed=0;
  }
  if(distance<SAMURAI_EVADE.range&&battle.enemyTime>=(e.nextEvadeAt??0)&&randomBetween(e,0,1)<SAMURAI_EVADE.chance){
    e.state='bait';e.elapsed=0;e.move=null;e.sequence=null;e.baitAttackIntent=battle.attackIntent??0;return;
  }
  if(distance>2.5){
    if(distance>3.5&&distance<6.5&&e.decisions%3===2){beginBossSequence(battle,'thrust');e.decisions++;return;}
    e.state='chase';const step=Math.min(Math.max(0,distance-2.05),SAMURAI_STATS.speed*(e.phase===2?1.2:1)*dt);e.x+=dx/distance*step;e.z+=dz/distance*step;return;
  }
  e.seed=(Math.imul(e.seed,1664525)+1013904223)>>>0;
  const choices=['quick','delay','mixed','sweep','heavy','double'];let choice=choices[e.seed%choices.length];
  if(choice===e.previousPattern)choice=choices[(choices.indexOf(choice)+1)%choices.length];
  e.previousPattern=choice;e.decisions++;beginBossSequence(battle,choice);
}
export function updateSamuraiPhase(battle){
  const e=battle.enemy;
  if(e.health<=0||e.state==='transition')return;
  const next=SAMURAI_PHASES[`phase${e.phase+1}`];
  if(next&&e.health<=e.maxHealth*next.healthThreshold)e.pendingPhase=e.phase+1;
}
