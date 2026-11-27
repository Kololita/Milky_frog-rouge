import {skipActorShadows} from './actor-shadows.js';
import {groundedWeaponPose} from './grounded-weapon-pose.js';
import {retreatHopPose} from './enemy-move.js';
import {SAMURAI_IDLE_PREVIEW} from './model-preview.js';
import * as THREE from 'three';
import {loadModel} from './model-loading.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

export const ENEMY_MODEL_PROFILES=Object.freeze({raider:{motions:{jab:'Jab',hook:'Hook'},walkRate:1.8},shellbug:{motions:{charge:'Charge',spikes:'Spikes'},walkRate:2.2},lantern:{motions:{pulse:'Pulse',empower:'Empower',firebolt:'Firebolt'},walkRate:1.2},mirrorGuard:{revision:'mirror-guard-silver-fullshield-6',extra:['ParryPush'],feedbackClip:'ParryPush',motions:{'shield-thrust':'ShieldThrust',parry:'Parry',riposte:'Riposte','shield-throw':'ShieldThrow'},walkRate:1.6},scythemoth:{revision:'roster-v1',motions:{'cut-left':'CutLeft','cut-right':'CutRight',thrust:'Thrust',pounce:'Pounce'},walkRate:1.7},spitter:{revision:'roster-v1',motions:{shoot:'Shoot','tail-sweep':'TailSweep',retreat:'Retreat'},walkRate:1.8},samurai:{revision:'sarumai-lightning-phase-22',extra:['Extract','Backstep','PhaseShift'],extractionClip:'Extract',motions:{'double-left':'DoubleLeft','double-right':'DoubleRight','counter-thrust':'CounterThrust','cross-left':'CrossLeft','cross-right':'CrossRight',overhead:'Overhead',rising:'Rising','rising-left':'RisingLeft','rising-right':'RisingRight','short-thrust':'ShortThrust','long-thrust':'LongThrust','round-sweep':'RoundSweep','buried-overhead':'BuriedOverhead'},walkRate:1.35},stonekeeper:{revision:'stonekeeper-braced-inversion-10',motions:{smash:'Smash',sweep:'Sweep',quake:'Quake','rock-throw':'RockThrow','shoulder-rush':'ShoulderRush',stomp:'Stomp',uppercut:'Uppercut'},walkRate:1.1}});
export const ENEMY_MODEL_IDS=Object.freeze(Object.keys(ENEMY_MODEL_PROFILES));
const templates=new Map();
export const hasEnemyModel=id=>templates.has(id);
let loading;
export function registerEnemyModel(id,gltf){
 if(!ENEMY_MODEL_IDS.includes(id))throw new Error(`未知敌人模型：${id}`);
 const required=['Idle','Walk','Hurt','Death',...Object.values(ENEMY_MODEL_PROFILES[id].motions),...(ENEMY_MODEL_PROFILES[id].extra??[])];
 if(!required.every(name=>gltf.animations.some(clip=>clip.name===name)))throw new Error(`${id}缺少敌人动画`);
 let skinned=false;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skinned=true;});
 if(!skinned)throw new Error(`${id}没有骨骼绑定`);
 templates.set(id,gltf);
}
export function loadEnemyModels(){
 return loading??=Promise.all(ENEMY_MODEL_IDS.map(async id=>{
  if(templates.has(id))return;
  registerEnemyModel(id,await loadModel(`/models/enemies/${id==='samurai'?'sarumai':id}.glb?v=${ENEMY_MODEL_PROFILES[id].revision??1}`));
 })).catch(error=>{loading=null;throw error;});
}
const clamp=x=>Math.max(0,Math.min(1,x));
export function enemyAnimationSample(id,e,time,hop=retreatHopPose(e)){
 if(id==='samurai'&&SAMURAI_IDLE_PREVIEW)return {name:'Idle',phase:(time*.5)%1};
 if(id==='samurai'&&['thrown','down','rising'].includes(e.state))return {name:'Idle',phase:0};
 if(id==='mirrorGuard'&&['thrown','down','rising','dazed'].includes(e.state))return {name:'Idle',phase:0};
 if(e.state==='dead')return {name:'Death',phase:clamp(e.elapsed/.65)};
 if(id==='samurai'&&e.state==='transition')return {name:'PhaseShift',phase:clamp(e.elapsed/Math.max(.01,e.transitionDuration))};
 if(id==='samurai'&&e.state==='evade')return {name:'Backstep',phase:clamp(e.elapsed/Math.max(.01,e.evadeDuration??.34))};
 if(id==='samurai'&&e.state==='bait')return {name:'Walk',phase:(time*.65)%1};
 if(['hurt','knockback'].includes(e.state))return {name:'Hurt',phase:clamp(e.elapsed/Math.max(.1,e.stun??.4))};
 if(ENEMY_MODEL_PROFILES[id].feedbackClip&&e.move?.kind==='parry'&&time<(e.parryGlowUntil??-Infinity))return {name:ENEMY_MODEL_PROFILES[id].feedbackClip,phase:clamp((time-(e.parryFeedbackStart??time))/Math.max(.01,e.parryFeedbackDuration??.35))};
 if(ENEMY_MODEL_PROFILES[id].extractionClip&&e.state==='recover'&&e.extracting)return {name:ENEMY_MODEL_PROFILES[id].extractionClip,phase:clamp(e.elapsed/Math.max(.01,e.recovery))};
 if(id==='mirrorGuard'&&e.move?.motion==='shield-throw'&&e.state==='windup')return {name:'Parry',phase:.55};
 if(e.move?.kind==='parry'&&e.state==='windup')return {name:ENEMY_MODEL_PROFILES[id].motions[e.move.motion],phase:.55};
 if(e.move&&['windup','recover'].includes(e.state)){
  if(e.state==='recover'&&e.move.recoveryAnimation){
   const {hold,duration}=e.move.recoveryAnimation;
   return {name:ENEMY_MODEL_PROFILES[id].motions[e.move.motion],phase:.7+.3*clamp((e.elapsed-hold)/Math.max(.01,duration))};
  }
  const name=ENEMY_MODEL_PROFILES[id].motions[e.move.motion]??'Idle';
  if(hop)return {name,phase:hop.phase};
  const phase=e.state==='recover'&&e.linkRecovery&&e.move.linkWait===0?.7:e.state==='recover'?.7+.3*clamp(e.elapsed/Math.max(.01,Math.min(.5,e.recovery))):e.elapsed<=e.telegraph?(e.move.chainHold?.45:.45*clamp(e.elapsed/Math.max(.01,e.telegraph))):.45+.25*clamp((e.elapsed-e.telegraph)/Math.max(.01,e.swingDuration));
  return {name,phase};
 }
 if(e.moving||['chase','circle'].includes(e.state))return {name:'Walk',phase:(time*ENEMY_MODEL_PROFILES[id].walkRate)%1};
 return {name:'Idle',phase:(time*.5)%1};
}

/** Cloned skeletons and materials keep simultaneous enemies independent. */
export function createRiggedEnemy(id){
 const root=new THREE.Group();root.name=`${id}_low`;let model=null,mixer=null,actions=null,previous=null,lastTime=null;
 const mats=[];
 function attach(){
  if(model||!templates.has(id))return;
  const template=templates.get(id);model=clone(template.scene);root.add(model);
  model.traverse(o=>{if(!o.isMesh)return;
   o.castShadow=true;o.receiveShadow=false;
   o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();
   for(const material of Array.isArray(o.material)?o.material:[o.material]){skipActorShadows(material);mats.push(material);}
   // Bounds are deformed by skinning; avoid stale rest-pose frustum bounds.
   if(o.isSkinnedMesh)o.frustumCulled=false;
  });
  mixer=new THREE.AnimationMixer(model);
  actions=new Map(template.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
  // Bind all bone/property tracks now, including clips not used by the idle pose.
  for(const action of actions.values()){action.reset().play();action.time=action.getClip().duration*.45;mixer.update(0);action.stop();}
  mixer.update(0);model.updateMatrixWorld(true);
 }
 return {root,mats,rigged:true,get ready(){attach();return Boolean(model);},get model(){return model;},get mixer(){return mixer;},
  animate(e,time,_prep,_strike,_recover,hop){
   attach();if(!model)return;
   const sample=enemyAnimationSample(id,e,time,hop),action=actions.get(sample.name),delta=lastTime===null?0:Math.max(0,Math.min(.1,time-lastTime));lastTime=time;
   if(previous!==action){
    if(previous)previous.fadeOut(.08);
    action.reset().setEffectiveWeight(1).setEffectiveTimeScale(0).play();
    if(previous)action.fadeIn(.08);
    previous=action;
   }
   action.time=sample.phase*Math.max(0,action.getClip().duration-1e-6);
   mixer.update(delta);model.updateMatrixWorld(true);if(id==='samurai'&&['thrown','down','rising'].includes(e.state))groundedWeaponPose(model);
  },
 };
}




