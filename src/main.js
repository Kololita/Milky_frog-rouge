import {deriveSeed,seededRandom} from './run-random.js';
import {GOLD_SKILLS,DEFAULT_GOLD_SKILL} from './gold-skills.js';
import {createHingeWorkshop} from './hinge-workshop.js';
import {createImpactRing} from './impact-ring.js';
import {useGpuBillboard} from './gpu-billboard.js';
import {createFoundryPost} from './foundry-post.js';
import {createPlayerEffects} from './player-effects.js';
import {createDeveloperEquipment} from './developer-equipment.js';
import {warmScene,compileSceneInBatches,waitForStartupGpu} from './startup-warmup.js';
import {createLoadingBudget,yieldStartup} from './loading-budget.js';
import {createFrameProfiler} from './frame-profiler.js';
import {damageCoolingValve} from './cooling.js';
import {launchEnemyProjectiles} from './enemy-projectiles.js';
import {createMirrorReflections} from './mirror-reflections.js';
import {ENCOUNTERS as jumpEncounters} from './encounters.js';
import {RUN_EVENTS as jumpEvents} from './run-events.js';
import {createRunStartUI} from './run-start.js';
import {NODE_LABELS} from './run-map.js';
import {createTutorial,TUTORIAL_SECTIONS} from './tutorial.js';
import {loadEnemyModels} from './enemy-models.js';
import * as THREE from 'three';
import { FROG_HIT_ANIMATION_URL, loadAnimatedModel } from './assets.js';
import './style.css';
import { nextBlinkDelay, movementInput, jumpForMovement, advanceMovement } from './movement.js';
import { AttackCombo } from './attack-combo.js';
import { CHARACTER_HEIGHT, DODGE_NAMES, planDodge, planDirectionalDodge, dodgeProgress, dodgeVisualTurn, dodgeEndHeading } from './dodge.js';
import { screenInputDirection, attackHeading } from './direction.js';
import { worldCameraPose, pointerYaw, advanceZoom,TargetLock,createCameraOcclusion,createCombatCamera } from './world-camera.js';
import { CAMERA, ANIMATION, BLOCK } from './control-tuning.js';
import {isGait,gaitTransitionPhase,locomotionName,locomotionRate,transitionDuration} from './locomotion-animation.js';
import { ShiftTap, isShift } from './shift-tap.js';
import { CharacterState, reconcileGesture } from './character-state.js';
import { CommandBuffer } from './command-buffer.js';
import { ActionBlend } from './action-blend.js';
import {isAttack,attackRate,advanceAttackTime,attackCanFinish,ATTACK_RATE,airSlamRate,mobilityTime,jumpClearance,AirSlam,airDriftDistance} from './combat.js';
import {createFloorProbe} from './floor-probe.js';
import {ImpactFeedback} from './impact-feedback.js';
import {Battle} from './battle.js';
import {createArenaMenu} from './arena-menu.js';
import {createEnemyView,createArenaView,BOSS_ARENA_RADIUS,createWaveView,createEnemyProjectileView} from './enemy-view.js';
import {createBattleHUD} from './battle-hud.js';
import {dodgeInvulnerable} from './defense.js';
import {RAGE_STATS,GUARD_TIERS,COMBAT_FPS,PLAYER_STATS} from './battle-values.js';
import {canBackThrow,createBackThrowClip} from './back-throw.js';
import {moveActorMotion} from './actor-collision.js';
import {createThrowGrip} from './throw-grip.js';
import {randomHomeArt} from './home-art.js';
import {createSettings} from './settings.js';
import {createRestSite} from './rest-site.js';
import {createRunUI} from './run-ui.js';
import {createRunSaveStore} from './run-save.js';
import {createHitboxView} from './hitbox-view.js';
import {createEquipmentMenu} from './equipment.js';
import {createDeveloperSettings} from './developer-settings.js';

const canvas = document.querySelector('#scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#dce8e9');
scene.fog = new THREE.Fog('#dce8e9', 24, 70);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true,powerPreference:'high-performance' });
const profile = new URLSearchParams(location.search).has('profile') ? createFrameProfiler(renderer) : null;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 110);
const foundryPost=createFoundryPost(renderer,scene,camera);
scene.add(new THREE.HemisphereLight('#f4fbff', '#839480', 2));
const sun = new THREE.DirectionalLight('#fff0d4', 2.8);
sun.position.set(0, 16, 0);
sun.target.position.set(0,0,0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 0.1, far: 30 });
sun.shadow.normalBias = 0.025;
sun.shadow.bias = -0.00015;
scene.add(sun, sun.target);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: '#c5d7cc', roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(160, 160, '#a0b9aa', '#a0b9aa');
grid.position.y = 0.002;
grid.material.transparent = true;
grid.material.opacity = 0.3;
scene.add(grid);

const player = new THREE.Group();
player.userData.cameraOcclusion=false;
scene.add(player);
const modelPivot = new THREE.Group();
player.add(modelPivot);
const impactFeedback=new ImpactFeedback();
const impactRingView=createImpactRing(),impactRing=impactRingView.mesh;
scene.add(impactRing);
const battle=new Battle();
if(profile) {
  window.naiwaProfile = {
    reset: profile.reset,
    snapshot: profile.snapshot,
    bakeFoundryReflection:lighting=>arenaView.boiler.bakeReflection(renderer,lighting),
    foundryReflection:()=>arenaView.boiler.reflectionInfo(),
    readFoundryReflection:()=>arenaView.boiler.readReflection(renderer),
    grantCounter() {
      battle.player.counterReady=true;
      battle.player.counterUntil=battle.time+5;
      battle.emit('blocked',{grade:'perfect',counterReady:true,x:player.position.x,z:player.position.z});
    },
    absorbCounter:()=>startEnergyAbsorption(),
    launchProjectile() {
      const move=battle.enemy.stats.moves.find(move=>move.projectile);
      if(!move)return false;
      launchEnemyProjectiles(battle,move);
      return battle.enemyProjectiles.length>0;
    },
    drinkPotion() {
      battle.player.health=battle.maxHealth*.5;
      return battle.usePotion();
    },
    effectState() {
      return {
        projectileVisible:enemyProjectileView.root.visible,
        potionVisible:modelPivot.getObjectByName('HealingPotion')?.visible??false,
        drinking:Boolean(battle.drinking),
        health:battle.player.health,
      };
    },
    start(mode) {
      runGame?.abandon();
      enterArena(mode);
    },
    movementState() {
      return {velocity,action:currentAction?.getClip().name,dodge:activeDodge?.name,heading,yaw:orbit.yaw,
        player:{x:player.position.x,z:player.position.z},
        enemy:{x:battle.enemy.x,z:battle.enemy.z,heading:battle.enemy.heading}};
    },
    encounterState() {
      const enemy=battle.enemy,model=enemyView.monsterVisuals.entries[battle.enemyStats.model];
      const hit=activeGesture?.name==='Hit'?activeGesture.action:null;
      return {mode:battle.mode,time:battle.enemyTime,state:enemy.state,motion:enemy.move?.motion,elapsed:enemy.elapsed,
        hitResolved:enemy.hitResolved,rigged:Boolean(model?.rigged&&model.ready),
        stonePlatform:arenaView.stonePlatform.visible,foundry:arenaView.boiler.root.visible,standard:arenaView.group.visible,
        playerAction:currentAction?.getClip().name,hitDuration:hit?hit.getClip().duration/hit.getEffectiveTimeScale():null};
    },
    isolate(feature) {
      arenaView.boiler.setRefraction(feature!=='refraction'&&settings.values.waterQuality==='high');
      renderer.shadowMap.autoUpdate=feature!=='shadow';
      foundryPost.setBloomEnabled?.(feature!=='bloom');
      mirrorReflections.setFrozen(feature==='mirror');
      const room=arenaView.boiler.root;
      for(const name of ['foundry-steam','foundry-light-shaft'])room.getObjectByName(name).visible=feature!=='fog';
      for(const name of ['low-molten-reservoir','continuous-molten-inflow'])room.getObjectByName(name).visible=feature!=='lava';
    },
    breakValves(count) {
      for (const valve of battle.coolingValves.slice(0, count)) damageCoolingValve(battle, valve, valve.health);
    },
    setValveDuration(seconds) {
      for (const valve of battle.coolingValves) {
        if (Number.isFinite(valve.brokenAt)) valve.until = battle.enemyTime + seconds;
      }
      return battle.coolingValves.filter(valve=>Number.isFinite(valve.brokenAt)).length;
    },
  };
}
const restSite=createRestSite(scene,document,{equipment:()=>equipmentMenu});
const hitboxView=createHitboxView(scene);
const enemyView=createEnemyView(scene);
const enemyViews=[enemyView];
const mirrorReflections=createMirrorReflections(renderer,scene);
const arenaView=createArenaView(scene,ground,grid);
const waveView=createWaveView(scene),enemyProjectileView=createEnemyProjectileView(scene),cameraOcclusion=createCameraOcclusion(scene),combatCamera=createCombatCamera(scene);
const playerEffects=createPlayerEffects(scene,player,document);
const battleHUD=createBattleHUD(document,scene);
let playerKnockback;
let battleFrameTime;
const keys = new Set();
const movementKeys = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ShiftLeft', 'ShiftRight']);
const shiftTap = new ShiftTap();
const orbit = { yaw:0,pitch:CAMERA.pitch,distance:CAMERA.initialDistance };
const targetLock=new TargetLock();
const lockRing=new THREE.Mesh(new THREE.RingGeometry(.43,.48,48),new THREE.MeshBasicMaterial({color:'#f7d77d',transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false}));
lockRing.name='锁定目标';lockRing.rotation.x=-Math.PI/2;lockRing.visible=false;scene.add(lockRing);
const lockShape=new THREE.Shape();lockShape.moveTo(-.10,.09);lockShape.lineTo(.10,.09);lockShape.lineTo(0,-.10);lockShape.closePath();
const lockArrow=new THREE.Mesh(new THREE.ShapeGeometry(lockShape),new THREE.MeshBasicMaterial({color:'#ffdb35',side:THREE.DoubleSide,depthTest:false,depthWrite:false}));
useGpuBillboard(lockArrow);lockArrow.name='锁定敌人倒三角';lockArrow.renderOrder=20;lockArrow.visible=false;scene.add(lockArrow);
let targetDistance=orbit.distance;
const movementForward = new THREE.Vector3();
let mixer, currentAction, pointerX, activeGesture, activeJump, activeDodge;
let activeAirAttack,floorProbe,rightHand,throwGrip;
let actions = {};
let faceActions = {};
const combo = new AttackCombo();
const characterState = new CharacterState();
const commandBuffer = new CommandBuffer();
const bodyBlend = new ActionBlend();
let readyCommand;
let attackMotion = {}, dodgeMotion = {}, attackScale = 1, attackTravel = new THREE.Vector3();
const gestures = [
  { name: 'Jump', code: 'Space' },
  { name: 'Block', persistent: true },
  { name: 'Attack', code: 'KeyJ' },
  { name: 'Hit', code: 'KeyK' },
  { name: 'Dodge' },
  { name: 'Blink', code: 'KeyB', overlay: true },
  { name: 'Crouch', code: 'KeyC', persistent: true },
  { name: 'Sit', code: 'KeyX', persistent: true },
];
let heading = 0;
let velocity = 0;
let pivot;
let turnTarget;
let loaded = false;
let blockHeldAt = null;
let blockReleaseUntil = null;
let blockButtonHeld = false;
let blockQueuedAt = null;
let blockNextEligibleAt = -Infinity;
let blockLastReleaseAt = -Infinity;
let blockLastAttemptPerfect = true;
let blockAttemptPerfect = false;
let blockPerfectScale = 1;
let lastGuardWindow;
let blinkRandom=Math.random;
let blinkCountdown = nextBlinkDelay();
let menuOpenedAt=0;
const homeScreen=document.getElementById?.('home-screen');
if(homeScreen)homeScreen.hidden=true;
const startupStatus=document.getElementById('startup-status');
const startupProgress=document.getElementById('startup-progress');
const startupPercent=document.getElementById('startup-percent');
const startupProgressValues=profile?[]:null;
const startupPhases=profile?[]:null;
const foundryCompileBatches=profile?[]:null;
const foundryPreviewPasses=profile?[]:null;
if(profile){
  window.naiwaProfile.startupProgress=()=>startupProgressValues.slice();
  window.naiwaProfile.startupPhases=()=>startupPhases.slice();
  window.naiwaProfile.foundryCompileBatches=()=>foundryCompileBatches.slice();
  window.naiwaProfile.foundryPreviewPasses=()=>foundryPreviewPasses.slice();
}
function showStartupProgress(percent,message){
  const value=Math.round(percent);
  if(startupProgress)startupProgress.value=value;
  if(startupPercent)startupPercent.textContent=`${value}%`;
  if(startupStatus&&startupStatus.textContent!==message)startupStatus.textContent=message;
  if(startupPhases&&startupPhases.at(-1)?.message!==message){
    startupPhases.push({message,time:performance.now(),programs:renderer.info.programs.length});
  }
  if(startupProgress)startupProgressValues?.push(startupProgress.value);
}
function refreshHomeArt(){
  if(!homeScreen)return;
  const art=randomHomeArt(homeScreen.dataset.zodiac);
  homeScreen.dataset.zodiac=art.id;
  homeScreen.style.setProperty('--home-background',`url("${art.url}")`);
}
refreshHomeArt();
let inPractice=!homeScreen;
const practiceButton=document.getElementById?.('home-practice');
const settings=createSettings(document,window,{
  apply(values){
    targetDistance=({near:3.5,medium:5.5,far:8})[values.camera]??5.5;
    camera.fov=48;camera.updateProjectionMatrix();
    renderer.toneMappingExposure=Number(values.brightness)||1.12;
    battle.debugHitboxes=Boolean(values.hitboxes);if(!values.hitboxes)hitboxView.clear();
    const shadowSize={off:0,low:512,medium:1024,high:2048}[values.shadowQuality];
    renderer.shadowMap.enabled=shadowSize>0;
    if(shadowSize)scene.traverse(light=>{
      if(!light.isLight||!light.castShadow||!light.shadow)return;
      const size=Math.min(shadowSize,renderer.capabilities.maxTextureSize);
      if(light.shadow.mapSize.x===size&&light.shadow.mapSize.y===size)return;
      light.shadow.map?.dispose();light.shadow.map=null;
      light.shadow.mapSize.set(size,size);
    });
    arenaView.boiler.setQuality(values.lightingQuality,values.reflectionQuality);
    mirrorReflections.setQuality(values.reflectionQuality);
    foundryPost.setQuality(values.postQuality);
    arenaView.boiler.setRefraction(values.waterQuality==='high');
    const mode=values.ui??'simple';
    const panel=document.getElementById?.('battle-hud');panel?.classList.toggle('detailed',mode==='detailed');
    if(panel)panel.style.display=mode==='none'?'none':'';
    const feed=document.getElementById?.('battle-feed');if(feed)feed.style.display=mode==='detailed'?'':'none';
    resize(values);
  },
  onOpen(){exitActiveLaugh();clearInput();menuOpenedAt=performance.now()/1000;},
  onClose(){
    resumeMenuTimers();
  },
});
let runGame;
const equipmentMenu=createEquipmentMenu(document,window,{
  equip:loadout=>{battle.applyEquipment(loadout);battleHUD.update(battle);},
  canOpen:()=>!inPractice||battle.encounter.kind==='training',
  onOpen(){keys.clear();shiftTap.reset();blockButtonHeld=false;blockQueuedAt=null;releaseBlock({immediate:true});pointerX=undefined;menuOpenedAt=performance.now()/1000;},
  onClose(){resumeMenuTimers();runGame?.refreshEvent();restSite.refresh();},
});
function resumeMenuTimers(){
  const duration=performance.now()/1000-menuOpenedAt;
  if(Number.isFinite(characterState.until))characterState.until+=duration;
  if(Number.isFinite(combo.finishedAt))combo.finishedAt+=duration;
  if(blockHeldAt!==null)blockHeldAt+=duration;
  if(blockReleaseUntil!==null)blockReleaseUntil+=duration;
  blockNextEligibleAt+=duration;blockLastReleaseAt+=duration;pointerX=undefined;
}
createDeveloperSettings(document,window,{onApply(){
  battle.reset();returnToOrigin();orbit.pitch=CAMERA.pitch;
  if(loaded){
    const clip=createBackThrowClip(Object.values(actions).map(action=>action.getClip()));
    if(clip){const previous=actions.BackThrow;previous?.stop();if(previous)mixer.uncacheClip(previous.getClip());actions.BackThrow=mixer.clipAction(clip);}
  }
}});
function showHome(){
  tutorial?.stop();
  if(!homeScreen)return;
  runGame?.abandon();restSite.close();document.getElementById('app').classList.remove('on-map','on-rest');
  cameraOcclusion.clear();combatCamera.reset();
  clearInput();battle.reset('practice',{runHealthBonus:0});arenaView.setMode('practice');returnToOrigin();inPractice=false;homeScreen.hidden=false;
  document.getElementById('app').classList.add('on-home');
  updateHomeRunButtons();
  clearCombatEffects();
  refreshHomeArt();
  orbit.yaw=Math.PI;orbit.distance=5.5;updateCamera();
  document.getElementById('home-practice').focus();
}
function enterArena(mode='practice',{run=false,floor=1}={}){
  if(!loaded)return;
  if(!run)runGame?.abandon();restSite.close();document.getElementById?.('app')?.classList.remove('on-map','on-rest');
  cameraOcclusion.clear();combatCamera.reset();
  const mapRun=run?runGame?.run:null;
  settings.close();battle.reset(mode,{floor,runHealthBonus:mapRun?.startingBoon?.health??0});
  if(mapRun)for(const enemy of battle.enemies)enemy.seed=deriveSeed(mapRun.seedFor('enemy-ai'),enemy.id);
  blinkRandom=mapRun?seededRandom(mapRun.seedFor('blink')):Math.random;
  blinkCountdown=nextBlinkDelay(blinkRandom);
  arenaView.setMode(mode);inPractice=true;if(homeScreen)homeScreen.hidden=true;document.getElementById?.('app')?.classList.remove('on-home');
  returnToOrigin();orbit.yaw=heading;updateCamera();
}
practiceButton?.addEventListener('click',()=>{equipmentMenu.sandbox();enterArena();});
const tutorialDirectory=document.getElementById('tutorial-directory');
const tutorialState=()=>({activeLaugh:Boolean(battle.breakLaugh?.active),x:player.position.x,z:player.position.z,yaw:orbit.yaw,speed:velocity,sprint:currentMovement().sprint,locked:Boolean(targetLock.target),jumpName:activeJump?.name,dodgeName:activeDodge?.name,equipment:equipmentMenu.opened,skillEquipped:equipmentMenu.loadout.skill,ultimate:equipmentMenu.loadout.ultimate,assemblyActions:{...equipmentMenu.interactionCounts},holding:equipmentMenu.holding,now:performance.now()/1000,placements:equipmentMenu.assembly.boards[equipmentMenu.assembly.ultimate]?.placements??[]});
function prepareTutorialMove(id){
  equipmentMenu.startRun();returnToOrigin();
  battle.enemy.x=0;battle.enemy.z=id==='BackThrow'?1:id==='CounterWave'?4:2;
  battle.enemy.heading=id==='BackThrow'?0:Math.PI;
  if(id?.startsWith('skill:')){const skill=id.slice(6);equipmentMenu.grant(skill);equipmentMenu.place(skill,1,1);battle.player.energy=100;}
  if(id?.startsWith('ultimate:')){equipmentMenu.grant(id.slice(9));equipmentMenu.selectUltimate(id.slice(9));equipmentMenu.upgrade(id.slice(9));equipmentMenu.upgrade(id.slice(9));battle.player.energy=100;}
  if(id==='DodgeBackflip'||id==='DodgeSide')characterState.begin('TutorialDirection');
}
const tutorial=createTutorial(document,{
  bindings:()=>settings.values.bindings,
  prepareAssembly:()=>{equipmentMenu.startRun();equipmentMenu.upgrade('rage');equipmentMenu.upgrade('rage');equipmentMenu.grant('armor-light');equipmentMenu.grant('fist-guard',{shapeId:'blue-double-hinge'});equipmentMenu.grant('charm-thread');equipmentMenu.grant('fistwind');equipmentMenu.upgrade('fistwind');equipmentMenu.upgrade('fistwind');for(const id of ['longarm','drain','shield','focus'])equipmentMenu.grant(id);equipmentMenu.open();},
  closeAssembly:()=>equipmentMenu.close(),prepareAbility:kind=>{
    restoreStanding({clearKeys:true});battle.clearBattleEffects();battle.player.health=battle.maxHealth;battle.player.energy=100;
    if(kind==='skill'&&!equipmentMenu.loadout.skill){equipmentMenu.clear();equipmentMenu.grant('longarm');equipmentMenu.place('longarm',1,1);}
  },prepareMove:prepareTutorialMove,
  exit:()=>{equipmentMenu.close();battle.clearBattleEffects();showHome();tutorialDirectory?.showModal();}
});
document.getElementById('home-tutorial')?.addEventListener('click',()=>tutorialDirectory?.showModal());
document.getElementById('tutorial-directory-close')?.addEventListener('click',()=>tutorialDirectory?.close());
for(const section of TUTORIAL_SECTIONS)document.getElementById(`tutorial-${section.id}`)?.addEventListener('click',()=>{tutorialDirectory.close();equipmentMenu.startRun();enterArena();tutorial.start(tutorialState(),section.id);});
const arenaMenu=createArenaMenu(document,{select:mode=>{equipmentMenu.sandbox({maxLevel:true});equipmentMenu.open({beforeBattle:true,onStart:()=>enterArena(mode)});}});
let finishArtisan;
const artisanWorkshop=createHingeWorkshop(document,{equipment:()=>equipmentMenu,finish:()=>finishArtisan?.(),dialogId:'artisan-workshop'});
const shopWorkshop=createHingeWorkshop(document,{equipment:()=>equipmentMenu,dialogId:'shop-workshop'});
const runSave=createRunSaveStore({
  getItem:key=>(window.naiwaSettings??window.localStorage).getItem(key),
  setItem:(key,value)=>(window.naiwaSettings??window.localStorage).setItem(key,value),
});
function reportSaveError(){window.alert('无法保存远征进度，请检查本地存储是否可用。');}
runGame=createRunUI(document,{
  saveStore:runSave,
  getAssembly:()=>equipmentMenu.assembly,
  onSaveError:reportSaveError,
  eventState:()=>({health:battle.player.health,maxHealth:battle.maxHealth,potions:battle.player.potions,capacity:battle.potionCapacity}),
  applyEvent:effect=>{battle.player.health=effect.health;battle.player.potions=effect.potions;if(effect.item)equipmentMenu.grant(effect.item,effect.roll);battleHUD.update(battle);},
  onNew(save,progress){
   equipmentMenu.startRun(save?.assembly??progress.startingAssembly,progress.inventory,{fixedUltimate:progress.startingUltimate});
   battle.reset('practice',{floor:1,runHealthBonus:progress.startingBoon?.health??0});
   if(save){
    battle.player.health=Math.max(0,Math.min(battle.maxHealth,save.player.health));
    battle.player.potions=Math.max(0,Math.min(battle.potionCapacity,save.player.potions));
   }else battle.player.potions=Math.max(0,battle.player.potions-(progress.startingBoon?.potionCost??0));
   battleHUD.update(battle);
   restoreStanding({clearKeys:true});
  },
  onMap(){restSite.close();document.getElementById('app').classList.remove('on-rest');clearCombatEffects();targetLock.clear();inPractice=false;if(homeScreen)homeScreen.hidden=true;document.getElementById('app').classList.add('on-map');},
  prepare(node,start,cancel){equipmentMenu.open({beforeBattle:true,onStart:start,onCancel:cancel});},
  startBattle(node,opening={energy:0,enemyHealthFactor:1}){
   const health=battle.player.health,potions=battle.player.potions;
   enterArena(node.encounter,{run:true,floor:node.layer+1});
   battle.player.health=Math.min(battle.maxHealth,health);
   battle.player.energy=opening.energy;battle.player.potions=potions;
   if(opening.enemyHealthFactor!==1)for(const enemy of battle.enemies)enemy.health=enemy.maxHealth=Math.round(enemy.maxHealth*opening.enemyHealthFactor*100)/100;
  },
  enterRest:(leave,options)=>openRestSite(leave,options),
  award:(item,roll,upgrade)=>equipmentMenu.grant(item.id,roll,upgrade),
  openInventory:()=>equipmentMenu.open(),
  openSettings:()=>settings.open(),
  shopWorkshop,
  openArtisan(done){finishArtisan=done;return artisanWorkshop.open({onlyTrim:true});},
  onExit(){showHome();},
});
const developerEquipment=createDeveloperEquipment(document,{grant:(id,roll)=>{if(!equipmentMenu.debugGrant(id,roll))return false;const run=runGame?.run;if(run){if(!run.inventory.includes(id))run.inventory.push(id);if(roll)run.equipmentRolls[id]=roll;}return true;}});
document.getElementById('developer-equipment-get').addEventListener('click',()=>{if(loaded)developerEquipment.open();});
const jumpSelect=document.getElementById('developer-jump-target');
const jumpEntries=[];
for(const [type,label] of Object.entries(NODE_LABELS)){
 const group=document.createElement('optgroup');group.label=label;
 const encounters=[...jumpEncounters.values()].filter(encounter=>encounter.kind===type);
 const choices=type==='event'
  ?jumpEvents.map((event,eventIndex)=>({label:event.name,eventIndex}))
  :encounters.map(encounter=>({label:encounter.name??encounter.stats.name,encounter:encounter.id}));
 if(!choices.length)choices.push({label});
 for(const choice of choices){
  const option=document.createElement('option');option.value=String(jumpEntries.length);option.textContent=choice.label;
  jumpEntries.push({type,...choice});group.append(option);
 }
 jumpSelect.append(group);
}
document.getElementById('developer-jump-go').addEventListener('click',()=>{if(!loaded)return;settings.close();equipmentMenu.close();tutorial.stop();restSite.close();clearInput();runGame.jump(jumpEntries[Number(jumpSelect.value)]);});

const homeNewGame=document.getElementById('home-new-game'),homeContinue=document.getElementById('home-continue-game');
const newGameDialog=document.getElementById('new-game-dialog'),discardGameDialog=document.getElementById('discard-game-dialog');
const customGameButton=document.getElementById('home-custom-game');
const customGameDialog=document.getElementById('custom-game-dialog');
const customGameForm=document.getElementById('custom-game-form');
const customGameSeed=document.getElementById('custom-game-seed');
const customGameError=document.getElementById('custom-game-error');
const runStart=createRunStartUI(document,{
  start(seed,setup){
    if(!loaded||runSave.read()){homeScreen.hidden=false;updateHomeRunButtons();return;}
    runGame.start(seed,setup);
  },
  back(){
    homeScreen.hidden=false;
    if(runSave.read()){updateHomeRunButtons();homeContinue.focus();return;}
    newGameDialog.showModal();
  },
});
function openRunStart(seed){
  if(!runStart)return;
  newGameDialog.close();
  homeScreen.hidden=true;
  runStart.open(seed);
}
function updateHomeRunButtons(){
  const hasSave=Boolean(runSave.read());
  homeContinue.hidden=!hasSave;homeContinue.disabled=!loaded;
  homeNewGame.disabled=!loaded;homeNewGame.textContent=hasSave?'放弃当前游戏':'开始新游戏';
  homeNewGame.classList.toggle('home-primary',!hasSave);
}
homeNewGame.addEventListener('click',()=>{
  if(!loaded)return;
  (runSave.read()?discardGameDialog:newGameDialog).showModal();
});
homeContinue.addEventListener('click',()=>{
  if(!loaded)return;
  const save=runSave.read();
  if(!save){updateHomeRunButtons();return;}
  try{runGame.resume(save);}
  catch(error){console.error(error);showHome();window.alert('无法读取此远征存档。');}
});
document.getElementById('discard-game-cancel').addEventListener('click',()=>discardGameDialog.close());
document.getElementById('discard-game-confirm').addEventListener('click',()=>{
  if(!runSave.clear()){reportSaveError();return;}
  discardGameDialog.close();updateHomeRunButtons();homeNewGame.focus();
});
document.getElementById('new-game-cancel').addEventListener('click',()=>newGameDialog.close());
document.getElementById('home-random-game').addEventListener('click',()=>{
  if(!loaded||runSave.read())return;
  openRunStart();
});
function clearSeedError(){
  customGameError.hidden=true;
  customGameSeed.removeAttribute('aria-invalid');
}
customGameButton?.addEventListener('click',()=>{
  if(!loaded)return;
  customGameForm.reset();
  clearSeedError();
  customGameDialog.showModal();
});
document.getElementById('custom-game-cancel')?.addEventListener('click',()=>customGameDialog.close());
customGameSeed?.addEventListener('input',clearSeedError);
customGameDialog?.addEventListener('keydown',event=>event.stopPropagation());
customGameForm?.addEventListener('submit',event=>{
  event.preventDefault();
  if(!loaded||runSave.read())return;
  if(!customGameSeed.validity.valid){
    customGameError.hidden=false;
    customGameSeed.setAttribute('aria-invalid','true');
    customGameSeed.focus();
    return;
  }
  const seed=customGameSeed.value;
  customGameDialog.close();openRunStart(seed);
});

document.getElementById?.('potion-use')?.addEventListener('click',()=>{if(inPractice&&!settings.opened&&!equipmentMenu.opened)battle.usePotion();});

const saveAndExit=document.getElementById('return-home');
const openHomeSettings=document.getElementById('home-settings');
openHomeSettings?.addEventListener('click',()=>settings.open());
document.getElementById('settings-dialog')?.addEventListener('toggle',event=>{
  if(event.newState==='open'&&saveAndExit)saveAndExit.hidden=!homeScreen.hidden;
});
document.getElementById?.('return-home')?.addEventListener('click',()=>{
  if(!runGame.save()){reportSaveError();return;}
  settings.close();showHome();
});
window.addEventListener('pagehide',()=>runGame.save());
window.addEventListener('storage',()=>{if(!homeScreen.hidden)updateHomeRunButtons();});

function openRestSite(leave,options){
  clearCombatEffects();inPractice=false;homeScreen.hidden=true;targetLock.clear();arenaView.setMode('practice');
  document.getElementById('app').classList.remove('on-map');document.getElementById('app').classList.add('on-rest');
  player.position.set(0,0,0);heading=0;player.rotation.y=0;modelPivot.position.y=.265;
  mixer.stopAllAction();bodyBlend.reset();currentAction=undefined;switchAction('Sit',true);actions.Sit.paused=true;actions.Sit.time=Math.min(2.3,actions.Sit.getClip().duration);mixer.update(0);
  for(const view of enemyViews)view.group.visible=false;lockRing.visible=lockArrow.visible=false;restSite.open(battle,leave,options);
}
function clearCombatEffects(){
  battle.clearBattleEffects();restoreStanding({clearKeys:true});pointerX=undefined;
  playerEffects.clear();hitboxView.clear();
  for(const view of enemyViews){view.impactParticles.clear();view.dazeStars.visible=false;view.group.visible=false;}waveView.update(battle);enemyProjectileView.update(battle);battleHUD.clearEffects();
}
function clearInput() {
  if(battle.counterCharge){battle.cancelCounterCharge();restoreStanding({preserveCounter:true});}
  battle.cancelAbsorption();
  keys.clear();
  shiftTap.reset();
  commandBuffer.clear();
  readyCommand = undefined;
  pointerX = undefined;
  pivot = undefined;
  velocity = 0;
  turnTarget = null;
  blockButtonHeld=false;
  blockQueuedAt=null;
  releaseBlock({immediate:true});
}
function playLaughPose(){
  restoreStanding({preserveCounter:true});
  activeGesture={name:'Laugh',action:actions.Laugh,forced:true};
  characterState.begin('Laugh');
  currentAction=undefined;
  switchAction('Laugh',true);
  actions.Laugh.paused=true;
  if(faceActions.Laugh){faceActions.Laugh.reset().setEffectiveWeight(1).play();faceActions.Laugh.paused=true;}
}
function exitActiveLaugh(){
  if(!battle.endActiveLaugh())return false;
  restoreStanding({preserveCounter:true});
  return true;
}
function controlKeyDown(event) {
  if(settings.opened||equipmentMenu.opened)return;
  if(!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&exitActiveLaugh()&&event.code==='Laugh'){event.preventDefault();return;}
  if(event.code==='KeyI'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();equipmentMenu.open();return;}
  if(battle.backThrow&&event.code!=='Home'&&!movementKeys.has(event.code))return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const spec = gestures.find(item => item.code === event.code);
  if (!movementKeys.has(event.code) && !spec && !['KeyR','Home','KeyQ','KeyF','KeyI','KeyE','KeyH','Laugh'].includes(event.code)) return;
  event.preventDefault();
  if (movementKeys.has(event.code)) {
    cancelBlockRelease();
    keys.add(event.code);
    const now=performance.now();
    shiftTap.updateWalk(now,keys,canWalkForSprint());
    if (isShift(event.code) && !event.repeat) shiftTap.press(event.code,now,keys);
    shiftTap.rememberDirections(keys);
  }
  else if (!event.repeat && loaded) {
    if(battle.breakLaugh&&event.code!=='Home')return;
    if(battle.player.health<=0 && event.code!=='Home')return;
    if (event.code === 'KeyR') restoreStanding();
    else if (event.code === 'Home') {if(runGame?.run?.status!=='battle')returnToOrigin();}
    else if (event.code === 'KeyQ') {targetLock.toggle(battle.nearestEnemy(player.position));if(targetLock.target)battle.focusEnemy(targetLock.target);updateCamera();}
    else if (event.code === 'KeyF') battle.beginRage();
    else if (event.code === 'KeyI') equipmentMenu.open();
    else if (event.code === 'KeyE') battle.beginSkill();
    else if(event.code==='Laugh'){
      if(!activeJump&&!activeDodge&&!activeAirAttack&&!battle.drinking&&(!activeGesture||activeGesture.persistent)&&battle.beginActiveLaugh())playLaughPose();
    }
    else if (event.code === 'KeyH') battle.usePotion();
    else {if(spec.name==='Attack')battle.noteAttackInput();triggerGesture(spec);}
  }
}
function controlKeyUp(event) {
  if(event.code==='KeyJ')releaseCounterCharge();
  if(settings.opened||equipmentMenu.opened)return;
  const dodgeKeys = isShift(event.code) ? shiftTap.release(event.code,performance.now(),keys) : null;
  keys.delete(event.code);
  shiftTap.updateWalk(performance.now(),keys,canWalkForSprint());
  shiftTap.rememberDirections(keys);
  if (movementKeys.has(event.code)) event.preventDefault();
  if (dodgeKeys && loaded) requestDodge(dodgeKeys);
}
function dispatchBinding(event,down,physical) {
  if(settings.opened||equipmentMenu.opened||!inPractice)return;
  const code=settings.resolve(physical)??(physical==='ShiftRight'&&settings.values.bindings.ShiftLeft==='ShiftLeft'?'ShiftRight':null);
  if(!code)return;
  if(code.startsWith('Mouse')){const mapped={button:Number(code.slice(5)),preventDefault:()=>event.preventDefault()};down?controlMouseDown(mapped):controlMouseUp(mapped);}
  else {const mapped={code,repeat:event.repeat,ctrlKey:event.ctrlKey,metaKey:event.metaKey,altKey:event.altKey,preventDefault:()=>event.preventDefault()};down?controlKeyDown(mapped):controlKeyUp(mapped);}
}
window.addEventListener('keydown',event=>dispatchBinding(event,true,event.code));
window.addEventListener('keyup',event=>dispatchBinding(event,false,event.code));
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('auxclick', event => {if(event.button===1)event.preventDefault();});
function controlMouseDown(event) {
  if(settings.opened||equipmentMenu.opened)return;
  exitActiveLaugh();
  if(battle.breakLaugh||battle.backThrow)return;
  if (!loaded || battle.player.health<=0 || ![0,1,2].includes(event.button)) return;
  event.preventDefault();
  if(event.button===1){GOLD_SKILLS[DEFAULT_GOLD_SKILL].activate({absorb:startEnergyAbsorption});return;}
  if(event.button===2) {
    blockButtonHeld=true;
    blockQueuedAt=performance.now()/1000;
    if(blockHeldAt!==null){
      // A successful parry may re-arm immediately without dropping the arm pose.
      if(blockReleaseUntil!==null&&blockAttemptPerfect){lastGuardWindow={start:blockHeldAt,end:blockQueuedAt,scale:blockPerfectScale,heading};blockHeldAt=null;blockReleaseUntil=null;beginBlock(blockQueuedAt);}
      return;
    }
    if(blockQueuedAt<blockNextEligibleAt-1e-9)return;
    beginBlock(blockQueuedAt);
    return;
  }
  if(event.button===0)battle.noteAttackInput();
  triggerGesture(gestures.find(spec => spec.name === (event.button === 0 ? 'Attack' : 'Block')));
}
canvas.addEventListener('mousedown',event=>dispatchBinding(event,true,`Mouse${event.button}`));
// Listen on the window so releasing over the UI or outside the canvas also works.
function controlMouseUp(event){if(event.button===0)releaseCounterCharge();if(event.button===2){blockButtonHeld=false;blockQueuedAt=null;releaseBlock();}}
window.addEventListener('mouseup',event=>dispatchBinding(event,false,`Mouse${event.button}`));
window.addEventListener('pointercancel', () => {blockButtonHeld=false;blockQueuedAt=null;releaseBlock({immediate:true});});
function combatPointerActive(){return inPractice&&!settings.opened&&!equipmentMenu.opened&&!restSite.opened&&battle.player.health>0&&(!runGame?.run||runGame.run.status==='battle')&&!document.querySelector?.('dialog[open]');}
function requestCombatPointer(){if(combatPointerActive()&&document.pointerLockElement!==canvas){try{canvas.requestPointerLock?.()?.catch?.(error=>console.warn('Pointer lock unavailable:',error.message));}catch{}}}
document.addEventListener('pointerdown',requestCombatPointer);
document.addEventListener('click',requestCombatPointer);
window.addEventListener('keyup',event=>{if(event.code!=='Escape')requestCombatPointer();});
document.addEventListener('selectstart',event=>event.preventDefault());
document.addEventListener('dragstart',event=>event.preventDefault());
let combatPointerLocked=false;
document.addEventListener('pointerlockchange',()=>{
  const locked=document.pointerLockElement===canvas;
  const released=combatPointerLocked&&!locked;
  combatPointerLocked=locked;
  pointerX=undefined;
  document.body?.classList.toggle('combat-pointer-locked',locked);
  // Browsers can consume Escape to release Pointer Lock before sending a key event.
  if(released&&combatPointerActive()&&document.hasFocus())settings.open();
});
canvas.addEventListener('pointerenter', event => { pointerX = event.clientX; });
let lockMouseAccum=0,lockMouseAt=0,lockSwitchAt=-Infinity;
// Locked mouse movement is relative and has no screen-edge limit.
document.addEventListener('mousemove', event => {
  if(!combatPointerActive())return;
  const locked=document.pointerLockElement===canvas;
  if(!locked&&event.target!==canvas)return;
  const delta=locked?event.movementX:(pointerX===undefined?0:event.clientX-pointerX);
  pointerX=event.clientX;
  if(delta||event.movementY)exitActiveLaugh();
  if(targetLock.target){
    const now=performance.now();
    if(now-lockMouseAt>180||Math.sign(delta)!==Math.sign(lockMouseAccum))lockMouseAccum=0;
    lockMouseAt=now;
    if(now-lockSwitchAt>=300){
      lockMouseAccum+=delta;
      if(Math.abs(lockMouseAccum)>=40){
        const next=targetLock.switchDirection(Math.sign(lockMouseAccum),battle.enemies,player.position,orbit);
        if(next)battle.focusEnemy(next);
        lockMouseAccum=0;lockSwitchAt=now;
      }
    }
  }else{lockMouseAccum=0;}
  if(!targetLock.target)orbit.yaw=pointerYaw(orbit.yaw,delta*settings.values.sensitivity*(settings.values.invert?-1:1));
  updateCamera();
});for (const event of ['pointerleave', 'pointercancel']) {
  canvas.addEventListener(event, () => { pointerX = undefined; });
}
function resize(values) {
  const resolution=values?.resolution??settings?.values.resolution??'native';
  let ratio=Math.min(window.devicePixelRatio||1,2);
  if(resolution!=='native'){const [width,height]=resolution.split('x').map(Number);ratio=Math.min(width/window.innerWidth,height/window.innerHeight);}
  renderer.setPixelRatio(ratio);
  renderer.setSize(window.innerWidth,window.innerHeight,false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function updateControlState(now = performance.now()/1000) {
  if(blockReleaseUntil!==null&&now>=blockReleaseUntil-1e-9)endBlock(blockReleaseUntil);
  if(blockButtonHeld&&blockHeldAt===null&&blockQueuedAt!==null&&now>=blockNextEligibleAt-1e-9)beginBlock(now);
  activeGesture=reconcileGesture(characterState,activeGesture,now);
  combo.expire(now);
}
function beginBlock(now=performance.now()/1000) {
  if(blockHeldAt!==null||!blockButtonHeld)return;
  const repeat=blockQueuedAt!==null&&blockQueuedAt-blockLastReleaseAt<=BLOCK.repeatPenaltyWindow+1e-9&&!blockLastAttemptPerfect;
  blockPerfectScale=repeat?BLOCK.repeatPerfectScale:1;
  blockAttemptPerfect=false;
  blockReleaseUntil=null;
  blockHeldAt=now;
  triggerGesture(gestures.find(spec=>spec.name==='Block'));
}
function endBlock(now=performance.now()/1000) {
  if(blockHeldAt!==null&&activeGesture?.name==='Block')lastGuardWindow={start:blockHeldAt,end:now,scale:blockPerfectScale,heading};
  blockReleaseUntil=null;
  blockHeldAt=null;
  blockNextEligibleAt=blockAttemptPerfect?now:Math.max(blockNextEligibleAt,now+BLOCK.reblockVulnerability);
  if(commandBuffer.pending?.name==='Block')commandBuffer.clear();
  if(readyCommand?.name==='Block')readyCommand=undefined;
  if(activeGesture?.name==='Block')finishCommand('Block',now);
}
function cancelBlockRelease() {
  if(blockReleaseUntil!==null&&performance.now()/1000>=blockMinimumUntil()-1e-9)endBlock();
}
function blockMinimumUntil(){return blockHeldAt===null?-Infinity:blockHeldAt+GUARD_TIERS[0].maxFrames*blockPerfectScale/COMBAT_FPS;}
function releaseBlock({immediate=false}={}) {
  if(blockHeldAt===null)return;
  updateControlState();
  // A guard released before landing must never fire later from the input queue.
  if(commandBuffer.pending?.name==='Block')commandBuffer.clear();
  if(readyCommand?.name==='Block')readyCommand=undefined;
  if(blockReleaseUntil!==null)return;
  blockLastReleaseAt=performance.now()/1000;
  blockLastAttemptPerfect=blockAttemptPerfect;
  const otherInput=[...movementKeys].some(code=>keys.has(code))||commandBuffer.has('Block');
  const now=performance.now()/1000;
  if(immediate||activeGesture?.name!=='Block')endBlock();
  else blockReleaseUntil=Math.max(blockMinimumUntil(),otherInput?now:now+BLOCK.releaseGrace);
}
function finishCommand(name, now = performance.now()/1000) {
  if(!characterState.finish(name,now)) return;
  if(isAttack(name)&&battle.isRaging())characterState.until=now+(characterState.until-now)*RAGE_STATS.attackInterval;
  activeGesture = undefined;
  velocity = 0;
  // Read the buffer at completion, then dispatch after mixer.update returns.
  // This also permits replaying the same dodge without resetting it mid-update.
  readyCommand = commandBuffer.take(name);
  if (readyCommand) return;
  if(name==='RunAttack'&&isGait(currentAction?.getClip().name??''))return;
  switchAction('Idle');
}

function switchAction(name, oneShot = false) {
  const next = actions[name];
  if (!next) return;
  if(!isAttack(name))battle.cancelAttack();
  // Automatic blink is an overlay. Only idle / walking movement preserves a combo.
  if(!isAttack(name)&&!['Idle','Walk','WalkBack','PivotLeft','PivotRight','TurnLeft','TurnRight'].includes(name)) {
    combo.reset();
  }
  if (next === currentAction) return;
  const from=currentAction?.getClip().name;
  const phase=gaitTransitionPhase(currentAction,name);
  next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
  // The first half of Block reaches the fully raised pose; compress it to 0.1s.
  if(name==='Block')next.setEffectiveTimeScale(next.getClip().duration*BLOCK.raiseClipFraction/BLOCK.raiseDuration);
  if (phase!==null) next.time=phase*next.getClip().duration;
  next.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
  next.clampWhenFinished = oneShot;
  next.play();
  bodyBlend.to(next,transitionDuration(from,name));
  currentAction = next;
}
function restoreStanding({clearKeys=false,preserveCounter=false}={}) {
  if (!loaded) return;
  if(battle.counterCharge)battle.cancelCounterCharge();
  throwGrip?.prepare();
  battle.cancelBackThrow();
  battle.cancelAbsorption();playerEffects.resetStance();
  blockHeldAt = null;
  blockReleaseUntil = null;
  blockButtonHeld=false;blockQueuedAt=null;blockNextEligibleAt=-Infinity;
  blockLastReleaseAt=-Infinity;blockLastAttemptPerfect=true;blockAttemptPerfect=false;blockPerfectScale=1;
  lastGuardWindow=undefined;
  if(!preserveCounter)battle.clearCounter();
  playerKnockback = undefined;
  activeGesture = undefined;
  activeJump = undefined;
  activeDodge = undefined;
  activeAirAttack = undefined;
  impactFeedback.reset();
  impactRing.visible=false;
  pivot = undefined;
  turnTarget = null;
  modelPivot.rotation.y = 0;
  modelPivot.position.y = 0;
  combo.reset();
  characterState.reset();
  commandBuffer.clear();
  readyCommand = undefined;
  if(clearKeys) keys.clear();
  shiftTap.reset();
  velocity = 0;
  actions.Blink?.stop();
  Object.values(faceActions).forEach(action => action.stop());
  switchAction('Idle');
}
function startJump() {
  if (activeJump || activeDodge || (activeGesture && !activeGesture.persistent)) return;
  const name = jumpForMovement(currentMovement(), velocity);
  if (!actions[name]) return;
  pivot = undefined;
  activeGesture = undefined;
  combo.reset();
  commandBuffer.clear();
  characterState.reset();
  activeJump = { name, action: actions[name],elapsed:0,height:0 };
  if(currentAction===actions[name])currentAction=undefined;
  switchAction(name, true);
  activeJump.action.paused=true;
}
function startEnergyAbsorption() {
  battle.expireCounter();
  if(!battle.player.counterReady||battle.player.health<=0||battle.breakLaugh||battle.backThrow)return;
  const owner=activeJump?.name??activeGesture?.name;
  if(owner&&(activeJump||activeDodge||activeAirAttack||activeGesture.name!=='Block'||performance.now()/1000<blockMinimumUntil()-1e-9)){
    commandBuffer.push('Absorb',owner);return;
  }
  if(!battle.beginAbsorption())return;
  blockHeldAt=null;blockReleaseUntil=null;blockButtonHeld=false;blockQueuedAt=null;
  activeGesture=undefined;characterState.reset();combo.reset();commandBuffer.clear();readyCommand=undefined;
  switchAction('Idle');
}
function completeJump() {
  if(!activeJump)return;
  const name=activeJump.name;
  activeJump=undefined;
  modelPivot.position.y=0;
  readyCommand=commandBuffer.take(name);
}
function completeDodge(now=performance.now()/1000) {
  if(!activeDodge)return;
  const {name,duration,endHeading}=activeDodge;
  applyDodgeTravel(duration);
  heading=endHeading;
  player.rotation.y=heading;
  activeDodge=undefined;
  modelPivot.rotation.y=0;
  finishCommand(name,now);
}
function returnToOrigin() {
  if (!loaded) return;
  targetLock.clear();
  battle.reset();
  playerEffects.clear();
  restoreStanding({clearKeys:true});
  const spawn=battle.enemyStats.playerSpawn??{x:0,z:0,heading:0};
  player.position.set(spawn.x,0,spawn.z);
  heading = spawn.heading??0;
  player.rotation.y = heading;
  mixer.stopAllAction();
  bodyBlend.reset();
  currentAction = undefined;
  switchAction('Idle');
  mixer.update(0);
}
function applyDodgeTravel(time) {
  if (!activeDodge) return;
  const { origin,direction,duration,facing,name,motionEnd,endHeading } = activeDodge;
  const sample = dodgeMotion[name]?.evaluate(time);
  const progress = sample ? Math.max(0,Math.min(1,(sample[0]*motionEnd.x+sample[2]*motionEnd.z)/motionEnd.lengthSq())) : dodgeProgress(time,duration);
  const distance = activeDodge.distance*progress;
  const travel=Math.max(0,distance-(activeDodge.lastTravel??0));activeDodge.lastTravel=distance;
  const desired={x:player.position.x+direction.x*travel,z:player.position.z+direction.z*travel};
  const result=moveActorMotion(player.position,desired,battle.movementObstacles);
  player.position.set(result.x,origin.y,result.z);
  modelPivot.rotation.y = dodgeVisualTurn(facing,heading,time,duration,endHeading);
}
function requestDodge(directionKeys = keys) {
  if (!loaded) return;
  updateControlState();
  const forward = camera.getWorldDirection(movementForward);
  const {direction} = planDodge(directionKeys,forward,heading,characterState.isFree);
  triggerGesture(gestures.find(spec => spec.name === 'Dodge'),direction);
}
function startDodge(aim) {
  if (activeJump || activeDodge) return;
  battle.cancelAbsorption();
  updateControlState();
  const {heading:nextHeading,...spec} = planDirectionalDodge(aim,heading,characterState.isFree);
  const {direction} = spec;
  const action = actions[spec.name];
  if (!action) return;
  pivot = undefined;
  heading = nextHeading;
  player.rotation.y = heading;
  combo.reset();
  actions.Blink?.stop();
  Object.values(faceActions).forEach(action => action.stop());
  const duration = action.getClip().duration;
  battle.extinguishByDodge(spec.name);
  const end = dodgeMotion[spec.name]?.evaluate(duration);
  activeDodge = {
    origin:player.position.clone(),
    ...spec, direction, action, duration,elapsed:0,
    endHeading:dodgeEndHeading(spec.name,direction,heading),
    motionEnd:end ? new THREE.Vector3(end[0],0,end[2]) : undefined,
  };
  velocity = 0;
  activeGesture = { name:spec.name,action };
  commandBuffer.clear();
  characterState.begin(spec.name);
  if (currentAction === action) currentAction = undefined;
  switchAction(spec.name,true);
  action.paused=true;
}
function applyAttackTravel(time) {
  if(activeGesture?.name==='RunAttack'&&time>=.5-1e-9)return;
  if (!combo.stage || !isAttack(activeGesture?.name ?? '')) return;
  const sample = attackMotion[activeGesture.name]?.evaluate(time);
  if (!sample) return;
  const dx=(sample[0]-attackTravel.x)*attackScale,dz=(sample[2]-attackTravel.z)*attackScale;
  const cosine=Math.cos(heading),sine=Math.sin(heading);
  const desired={x:player.position.x+cosine*dx+sine*dz,z:player.position.z-sine*dx+cosine*dz};
  const moved=moveActorMotion(player.position,desired,battle.movementObstacles,PLAYER_STATS.radius);
  player.position.x=moved.x;player.position.z=moved.z;
  attackTravel.set(sample[0],0,sample[2]);
}
function lockedTargetAim() {
  const target=targetLock.target;
  if(!target||target.health<=0)return null;
  const x=target.x-player.position.x,z=target.z-player.position.z,length=Math.hypot(x,z);
  return Number.isFinite(length)&&length>1e-6 ? {x:x/length,z:z/length} : null;
}
function playAttack(stage, name = `Attack${stage}`) {
  battle.clearCounter();
  pivot = undefined;
  // Resolve the live target at execution, including buffered and special attacks.
  const targetAim=lockedTargetAim();
  heading = targetAim ? Math.atan2(targetAim.x,targetAim.z) : attackHeading(heading,combo.aim,stage);
  player.rotation.y = heading;
  actions.Blink?.stop();
  Object.values(faceActions).forEach(action => action.stop());
  activeGesture = { name, action: actions[name] };
  battle.beginAttack(name);
  commandBuffer.clear();
  characterState.begin(name);
  attackTravel.set(0,0,0);
  velocity = 0;
  switchAction(name,true);
  activeGesture.action.paused=true;
}
function startAirAttack(aim) {
  aim=lockedTargetAim()??aim;
  const height=Math.max(0,activeJump?.height??(floorProbe()-player.position.y));
  const origin=player.position.clone(),distance=airDriftDistance(velocity);
  const direction=aim ? {...aim} : {x:Math.sin(heading),z:Math.cos(heading)};
  activeJump=undefined;
  combo.enter(1,aim);
  playAttack(1,'AirAttack');
  activeAirAttack={timeline:new AirSlam(height,battle.chargeTimeScale),elapsed:0,sample:null,origin,direction,distance};
  activeGesture.action.paused=true;
}
function completeAttack(now=performance.now()/1000) {
  if(!activeGesture || !isAttack(activeGesture.name)) return;
  const name=activeGesture.name;
  if(/^Attack[1-4]$/.test(name)){
    activeGesture.gapStartedAt??=battle.time;
    if(battle.time-activeGesture.gapStartedAt<ATTACK_RATE.normalGap-1e-9)return;
  }
  applyAttackTravel(activeGesture.action.time);
  battle.resolveAttack(activeGesture.action.time,battlePose());
  if(activeAirAttack) {activeAirAttack=undefined;modelPivot.position.y=0;}
  if(name==='AirAttack') combo.reset();
  else combo.finish(now);
  const speed=velocity;finishCommand(name,now);if(name==='RunAttack'){characterState.reset();velocity=speed;}
}
let releasingCounterCharge=false;
function releaseCounterCharge(){if(!battle.counterCharge)return;if(!battle.releaseCounterCharge())return;restoreStanding({preserveCounter:true});releasingCounterCharge=true;triggerGesture(gestures.find(s=>s.name==='Attack'));if(activeGesture?.name==='CounterWave'){activeGesture.action.time=.35;const sample=attackMotion.CounterWave?.evaluate(.35);if(sample)attackTravel.set(sample[0],0,sample[2]);}releasingCounterCharge=false;}
function triggerGesture(spec, capturedAim = undefined) {
  if (!loaded || battle.player.health<=0) return;
  if(battle.breakLaugh||battle.backThrow)return;
  if(battle.drinking){if(!['Attack','Dodge'].includes(spec.name))return;battle.cancelPotion('self');restoreStanding({preserveCounter:true});}
  if(battle.counterCharge&&spec.name==='Attack'&&!releasingCounterCharge)return;
  runAttackRecovery();
  if(spec.name==='Attack'&&battle.time<battle.runAttackLockUntil-1e-9)return;
  if(spec.name==='Attack'&&!battle.player.counterReady&&!activeJump&&!activeDodge&&!activeAirAttack&&tryStartBackThrow())return;
  if(!spec.overlay)battle.cancelAbsorption();
  if(!spec.overlay&&spec.name!=='Block')cancelBlockRelease();
  if(spec.name==='Block' && blockHeldAt===null)return;
  if(!spec.overlay&&spec.name!=='Block'&&activeGesture?.name==='Block'&&performance.now()/1000<blockMinimumUntil()-1e-9){
    commandBuffer.push(spec.name,'Block',capturedAim??screenInputDirection(keys,camera.getWorldDirection(movementForward)));return;
  }
  updateControlState();
  battle.expireCounter();
  const buffered = ['Attack','Block','Dodge','Jump'].includes(spec.name);
  const aim = capturedAim === undefined
    ? screenInputDirection(keys,camera.getWorldDirection(movementForward)) : capturedAim;
  if (spec.name === 'Dodge' && !aim) return requestDodge();
  if(spec.name==='Dodge'&&runAttackRecovery())return startDodge(aim);
  if (buffered && activeJump) {
    if(spec.name==='Attack'&&!battle.player.counterReady) startAirAttack(aim);
    else {
      commandBuffer.push(spec.name,activeJump.name,aim);
    }
    return;
  }
  if (spec.name === 'Block' && activeGesture?.name === 'Block') {
    return;
  }
  if(battle.counterCharge&&spec.name!=='Attack'&&!spec.overlay){battle.cancelCounterCharge();restoreStanding({preserveCounter:true});}
  if(spec.name==='Attack'&&battle.player.counterReady&&!activeJump&&!activeDodge&&!activeAirAttack&&(!activeGesture||activeGesture.persistent||activeGesture.name==='Block')) {
    blockHeldAt=null;blockReleaseUntil=null;blockButtonHeld=false;blockQueuedAt=null;readyCommand=undefined;
    if(!releasingCounterCharge&&battle.beginCounterCharge()){switchAction('CounterWave',true);currentAction.paused=true;currentAction.time=0;characterState.begin('Charge');activeGesture={name:'Charge',persistent:true,action:currentAction};return;}
    combo.enter(4,aim);playAttack(4,'CounterWave');
    return;
  }
  if(spec.name==='Dodge'&&canDodgeFromHit()){
    activeGesture.action.stop();activeGesture=undefined;playerKnockback=undefined;currentAction=undefined;
    commandBuffer.clear();readyCommand=undefined;
    return startDodge(aim);
  }
  const playing = activeGesture && (activeGesture.name==='Block' || !activeGesture.persistent || activeGesture.action.time < activeGesture.action.getClip().duration);
  if (buffered && playing && (spec.name!=='Block' || activeDodge || activeAirAttack || activeGesture.name==='Hit')) {
    commandBuffer.push(spec.name,activeGesture.name,aim);
    return;
  }
  if (spec.name === 'Dodge') return startDodge(aim);
  if (activeDodge && !spec.overlay) return;
  if (spec.name === 'Attack') {
    const movement=currentMovement();
    if(characterState.isFree&&movement.sprint)combo.reset();
    if(!combo.stage && !activeGesture && characterState.isFree && !pivot && movement.sprint && velocity>1.6) {
      combo.enter(2,aim);playAttack(2,'RunAttack');return;
    }
    const next = combo.press(performance.now()/1000,aim);
    if (next) playAttack(next);
    return;
  }
  if (!actions[spec.name]) return;
  if (activeAirAttack && !spec.overlay) return;
  if (spec.name === 'Jump') return startJump();
  if (activeJump && !spec.overlay) return;
  if (spec.overlay) {
    // Blink contains facial weights only, so walking keeps playing underneath.
    if (activeGesture?.name === 'Laugh') return;
    const blink = actions[spec.name];
    blink.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(THREE.LoopOnce, 1);
    blink.clampWhenFinished = false;
    blink.play();
    blinkCountdown = nextBlinkDelay(blinkRandom);
    return;
  }
  pivot = undefined;
  if(spec.name==='Block') {
    if(isAttack(activeGesture?.name ?? '')) {
      applyAttackTravel(activeGesture.action.time);
      battle.resolveAttack(activeGesture.action.time,battlePose());
    }
  }
  combo.reset();
  commandBuffer.clear();
  actions.Blink?.stop();
  Object.values(faceActions).forEach(action => action.stop());
  if (faceActions[spec.name]) {
    const face = faceActions[spec.name];
    face.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(THREE.LoopOnce, 1);
    face.clampWhenFinished = false;
    face.play();
  }
  if (activeGesture?.name === spec.name && spec.persistent) return finishCommand(spec.name);
  if (spec.name === 'Block') {
    const target=targetLock.target;
    if(target?.health>0)heading=Math.atan2(target.x-player.position.x,target.z-player.position.z);
    else if (aim) heading = Math.atan2(aim.x,aim.z);
    player.rotation.y = heading;
  }
  if (currentAction === actions[spec.name]) currentAction = undefined;
  activeGesture = { ...spec, action: actions[spec.name] };
  characterState.begin(spec.name);
  velocity = 0;
  switchAction(spec.name, true);
}
function canWalkForSprint(){return characterState.isFree&&!activeGesture&&!activeJump&&!activeDodge;}
function tryStartBackThrow(){
  if(!actions.BackThrow||!battle.enemies.some(e=>canBackThrow(battlePose(),e,battle.time)))return false;
  restoreStanding({preserveCounter:true});
  if(!battle.beginBackThrow(battlePose()))return false;
  activeGesture={name:'BackThrow',action:actions.BackThrow};characterState.begin('BackThrow');
  currentAction=undefined;switchAction('BackThrow',true);actions.BackThrow.paused=true;return true;
}
function applyBackThrowPose(sample){
  throwGrip?.prepare();
  const pose=sample.hero;heading=pose.heading;player.rotation.y=heading;player.position.set(pose.x,0,pose.z);
  actions.BackThrow.time=pose.time;modelPivot.position.y=0;mixer.update(0);player.updateMatrixWorld(true);
  // Publish the same world-space lift to the rendered model and to the grip IK.
  modelPivot.position.y=pose.height-(floorProbe()-player.position.y);
  player.updateMatrixWorld(true);throwGrip?.apply(battle.backThrow);
}
function currentMovement(now=performance.now()){
  const input=movementInput(keys,camera.getWorldDirection(movementForward));
  const timing=shiftTap.sprintTiming(now,keys,canWalkForSprint()&&!battle.drinking);
  input.sprintRamp=timing?.ramp;
  input.sprint=activeJump ? input.sprint&&activeJump.name==='JumpRun' : timing?.sprint??false;
  return input;
}
function runAttackRecovery(){const recovering=activeGesture?.name==='RunAttack'&&(activeGesture.recoveryStartedAt!==undefined||activeGesture.action.time>=.5-1e-9);if(recovering&&activeGesture.recoveryStartedAt===undefined){activeGesture.recoveryStartedAt=battle.time;battle.runAttackLockUntil=battle.time+.5;}return recovering;}
function updateLocomotion(input,dt) {
  const movementUnlocked=characterState.isFree||Boolean(battle.drinking)||runAttackRecovery();
  if(characterState.isFree&&!activeJump&&input.sprint)combo.reset();
  const targetAim=movementUnlocked&&!activeJump&&!input.sprint ? lockedTargetAim() : null;
  const facingHeading=targetAim ? Math.atan2(targetAim.x,targetAim.z) : null;
  const step = advanceMovement({ heading, velocity, pivot, turnTarget }, input, dt, !movementUnlocked, {airborne:Boolean(activeJump),facingHeading});
  pivot = step.pivot;
  turnTarget = step.turnTarget;
  heading = step.heading;
  velocity = step.velocity;
  const travel=moveActorMotion(player.position,{x:player.position.x+step.dx,z:player.position.z+step.dz},battle.movementObstacles,PLAYER_STATS.radius);
  player.position.x=travel.x;player.position.z=travel.z;
  const updatedAim=targetAim ? lockedTargetAim() : null;
  if(updatedAim)heading=Math.atan2(updatedAim.x,updatedAim.z);
  player.rotation.y = heading;
  if ((!activeGesture||battle.drinking||runAttackRecovery()) && !activeJump) {
    if (pivot) {
      switchAction(pivot.name,true);
      // Sample explicitly so the planted steps and the world turn stay in sync.
      currentAction.paused = true;
      currentAction.time = pivot.elapsed/pivot.duration*currentAction.getClip().duration;
    } else {
      const name=locomotionName(input,velocity,currentAction?.getClip().name,!movementUnlocked);
      const changed=currentAction!==actions[name];
      switchAction(name);
      if (isGait(name)) {
        const rate=locomotionRate(name,velocity);
        const previous=currentAction.getEffectiveTimeScale();
        currentAction.setEffectiveTimeScale(changed ? rate : rate+(previous-rate)*Math.exp(-ANIMATION.rateResponse*dt));
      }
    }
  }
}
function updateCamera(dt=0) {
  targetLock.update(orbit,player.position,dt,{playerAlive:battle.player.health>0,fov:camera.fov,aspect:camera.aspect});
  lockRing.visible=Boolean(targetLock.target)&&settings.values.ui!=='none';
  if(targetLock.target)lockRing.position.set(targetLock.target.x,.025,targetLock.target.z);
  const focusEnemy=targetLock.target??(inPractice?battle.enemies.filter(e=>e.health>0).reduce((best,e)=>Math.hypot(e.x-player.position.x,e.z-player.position.z)<Math.hypot((best?.x??Infinity)-player.position.x,(best?.z??Infinity)-player.position.z)?e:best,null):null);
  const {position,target} = combatCamera.update(worldCameraPose(orbit,player.position),orbit,player.position,focusEnemy,dt);
  const shake=settings.values.shake?impactFeedback.sample():{x:0,y:0,z:0};
  camera.position.set(position.x+shake.x,position.y+shake.y,position.z+shake.z);
  camera.lookAt(target.x+shake.x,target.y+shake.y,target.z+shake.z);
  camera.updateMatrixWorld(true);
  lockArrow.visible=Boolean(targetLock.target)&&settings.values.ui!=='none';
  if(targetLock.target){lockArrow.position.set(targetLock.target.x,(targetLock.target.uiHeight??1.76)+(targetLock.target.state==='dazed'?.89:.64),targetLock.target.z);}
}
function battlePose() {
  return {x:player.position.x,z:player.position.z,heading,
    impactTime:battleFrameTime,
    height:activeAirAttack?.sample?.height??activeJump?.height??0,
    landed:Boolean(activeAirAttack?.sample?.landed),
    guarding:activeGesture?.name==='Block'&&blockHeldAt!==null,
    guardElapsed:blockHeldAt===null?Infinity:Math.max(0,performance.now()/1000-blockHeldAt),
    guardPerfectScale:blockPerfectScale,
    guardToken:blockHeldAt,
    previousGuard:lastGuardWindow?{elapsed:performance.now()/1000-lastGuardWindow.start,endedAgo:performance.now()/1000-lastGuardWindow.end,scale:lastGuardWindow.scale,heading:lastGuardWindow.heading,token:lastGuardWindow.start}:null,
    invulnerable:Boolean(activeDodge&&dodgeInvulnerable(activeDodge.name,activeDodge.elapsed)),
    dodgeName:activeDodge?.name,dodgeElapsed:activeDodge?.elapsed,
  };
}
function canDodgeFromHit(){return activeGesture?.name==='Hit'&&battle.time>=activeGesture.dodgeAt-1e-9;}
function receiveBattleHit(event) {
  if(battle.breakLaugh||event.armored||(event.impactLevel===0&&event.type!=='guardBroken'))return;
  restoreStanding({preserveCounter:true});
  const hitName=event.impactLevel>=3?'HitLaunch':event.impactLevel===2?'HitSit':'HitRecoil';
  const hitAction=actions[hitName]??actions.Hit;
  activeGesture={name:'Hit',action:hitAction,dodgeAt:battle.time+(event.dodgeAfter??(event.impactLevel===2?1:event.impactLevel>=3?3:Infinity))};
  characterState.begin('Hit');
  currentAction=undefined;
  switchAction(actions[hitName]?hitName:'Hit',true);
  hitAction.setEffectiveTimeScale(hitAction.getClip().duration/event.stun);
  playerKnockback=new THREE.Vector3(Math.sin(event.heading),0,Math.cos(event.heading)).multiplyScalar(event.knockback*12);
}
function updateBattle(dt,externalTimeScale=1) {
  if(!battle.backThrow&&battle.enemy.health<=0){const next=targetLock.target?.health>0?targetLock.target:battle.nearestEnemy(player.position);if(next)battle.focusEnemy(next);}
  if(playerKnockback) {
    const decay=Math.exp(-12*dt);
    const knocked=moveActorMotion(player.position,{x:player.position.x+playerKnockback.x*(1-decay)/12,z:player.position.z+playerKnockback.z*(1-decay)/12},battle.movementObstacles,PLAYER_STATS.radius);
    player.position.x=knocked.x;player.position.z=knocked.z;playerKnockback.multiplyScalar(decay);
    if(playerKnockback.lengthSq()<.0001)playerKnockback=undefined;
  }
  const pose=battlePose();
  const pairedThrow=battle.backThrow;
  battle.update(dt,pose,externalTimeScale);
  if(pairedThrow)applyBackThrowPose(pairedThrow.sample);
  if(battle.encounter.kind!=='training'){
    for(const actor of [...battle.enemies,player.position]){
      const radius=Math.hypot(actor.x,actor.z);
      const boundary=battle.mode==='samurai'
        ?arenaView.reedField.boundaryRadius(Math.atan2(actor.z,actor.x))
        :BOSS_ARENA_RADIUS;
      const limit=boundary-.6;
      if(radius>limit){actor.x*=limit/radius;actor.z*=limit/radius;}
    }
  }
  const events=battle.takeEvents();
  for(const event of events) {
    if(event.type==='breakLaughStarted')playLaughPose();
    if(event.type==='breakLaughEnded'&&activeGesture?.forced)restoreStanding({preserveCounter:true});
    if(event.type==='blocked'&&event.grade==='perfect') {
      blockNextEligibleAt=-Infinity;
      if(event.guardToken==null||event.guardToken===blockHeldAt){
        blockAttemptPerfect=true;if(blockReleaseUntil!==null)blockLastAttemptPerfect=true;
      }else if(event.guardToken===lastGuardWindow?.start)blockLastAttemptPerfect=true;
    }
    if(event.type==='backThrowCompleted')restoreStanding({preserveCounter:true});
    if(event.type==='enemyHit'&&event.label==='过肩背摔 · 坐砸'){
      impactFeedback.trigger();impactRing.position.set(event.x,.008,event.z);
    }
    if(event.type==='potionStarted'){restoreStanding({preserveCounter:true});characterState.begin('Drink');activeGesture={name:'Drink',persistent:true,action:actions.Idle};}
    if(event.type==='potionUsed'||event.type==='potionInterrupted'){if(activeGesture?.name==='Drink')restoreStanding({preserveCounter:true});}
    if((event.type==='playerHit'||event.type==='guardBroken')&&activeGesture?.name==='Charge')restoreStanding({preserveCounter:true});
    if(event.type==='playerHit'||event.type==='guardBroken')receiveBattleHit(event);
    if(event.type==='playerDefeated') {
      restoreStanding({clearKeys:true});
      characterState.begin('Defeated');activeGesture={name:'Defeated',persistent:true,action:actions.Crouch};
      switchAction('Crouch',true);
    }
    if(event.type==='playerRespawned') {
      restoreStanding({clearKeys:true});const spawn=battle.enemyStats.playerSpawn??{x:0,z:0,heading:0};player.position.set(spawn.x,0,spawn.z);heading=spawn.heading??0;player.rotation.y=heading;
    }
  }
  if(battle.breakLaugh&&activeGesture?.forced){
    const phase=(battle.time-battle.breakLaugh.start)/battle.breakLaugh.duration;
    const progress=battle.breakLaugh.active?phase%1:Math.min(1,phase);
    actions.Laugh.time=actions.Laugh.getClip().duration*progress;
    if(faceActions.Laugh)faceActions.Laugh.time=faceActions.Laugh.getClip().duration*progress;
    mixer.update(0);
  }
  const correction=battle.separation({x:player.position.x,z:player.position.z,height:pose.height});
  player.position.x+=correction.x;player.position.z+=correction.z;
  battleHUD.update(battle,events,targetLock.target===battle.enemy&&battle.enemy.health>0);
  return events;
}
async function loadPlayer() {
  let loadingFailed=false;
  try {
    showStartupProgress(0,'正在加载资源…');
    let resourcesReady=0;
    const trackResource=async task=>{
      const result=await task;
      if(!loadingFailed)showStartupProgress(++resourcesReady*10,'正在加载资源…');
      return result;
    };
    const [asset] = await Promise.all([
      trackResource(loadAnimatedModel('/models/characters/frog.glb?v=welded-lip-2',FROG_HIT_ANIMATION_URL)),
      trackResource(loadEnemyModels()),
      trackResource(Promise.all([arenaView.boiler.ready,arenaView.boiler.preloadReflection()])),
    ]);
    if(profile)window.naiwaProfile.bakedHitClips=asset.bakedHitClips;
    showStartupProgress(30,'正在准备角色和动画…');
    await yieldStartup();
    const cpuBudget=createLoadingBudget();
    if (!['Walk', 'Idle', 'Run', 'PivotLeft','PivotRight','Jump', 'JumpWalk', 'JumpRun',...DODGE_NAMES,'Attack1','Attack2','Attack3','Attack4','RunAttack','AirAttack'].every(name => asset.actions[name])) throw new Error('模型缺少基础动画');
    mixer = asset.mixer;
    actions = asset.actions;
    faceActions = asset.faceActions;
    attackMotion = asset.attackMotion;
    attackMotion.CounterWave=attackMotion.Attack4;
    dodgeMotion = asset.dodgeMotion;
    switchAction('Idle');
    mixer.update(0);
    asset.model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(asset.model, true);
    const scale = CHARACTER_HEIGHT / (bounds.max.y - bounds.min.y);
    attackScale = scale;
    const center = bounds.getCenter(new THREE.Vector3());
    asset.model.scale.setScalar(scale);
    asset.model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    // Blender's front (-Y) exports to +Z. W must follow the model's face.
    modelPivot.add(asset.model);
    player.updateMatrixWorld(true);
    floorProbe=createFloorProbe(asset.model,{fullBody:true});
    rightHand=modelPivot.getObjectByName('handR');
    throwGrip=createThrowGrip(asset.model,player);
    playerEffects.bind({
      model:asset.model,pivot:modelPivot,actions,rightHand,
      clips:asset.animations??Object.values(actions).map(action=>action.getClip()),
    });
    const animationActions=[...new Set([...Object.values(actions),...Object.values(faceActions)])];
    for(let i=0;i<animationActions.length;i++){
      mixer.stopAllAction();
      const action=animationActions[i];
      action.reset().play();
      action.time=action.getClip().duration*.45;
      mixer.update(0);
      showStartupProgress(31+8*(i+1)/animationActions.length,'正在准备角色和动画…');
      await cpuBudget.checkpoint();
    }
    mixer.stopAllAction();bodyBlend.reset();currentAction=undefined;switchAction('Idle');mixer.update(0);
    let encountersReady=0;
    for(const encounter of jumpEncounters.values()){
      battle.reset(encounter.id);for(let i=0;i<battle.enemies.length;i++){const view=enemyViews[i]??(enemyViews[i]=createEnemyView(scene));view.update(battle.enemies.length===1?battle:battle.viewOf(battle.enemies[i]),camera,0,[]);}
      showStartupProgress(39+8*++encountersReady/jumpEncounters.size,'正在准备敌人和特效…');
      await cpuBudget.checkpoint();
    }
    battle.reset('practice');for(const view of enemyViews)view.group.visible=false;
    showStartupProgress(47,'正在加载技能特效…');
    await playerEffects.preload(renderer,cpuBudget);
    playerEffects.prime(heading);
    battle.player.counterReady=true;battle.player.counterUntil=5;
    battle.beginCounterCharge();battle.time=1;waveView.update(battle,rightHand,heading);
    showStartupProgress(48,'正在生成环境反射…');
    await yieldStartup();
    updateCamera();
    await arenaView.boiler.prepareStartup(renderer,fraction=>{
      showStartupProgress(48+4*fraction,'正在生成环境反射…');
    });
    cameraOcclusion.prepare();
    mirrorReflections.register();
    mirrorReflections.update();
    showStartupProgress(53,'正在上传 GPU 资源…');
    await yieldStartup();
    await warmScene(renderer,scene,camera,()=>renderer.render(scene,camera),(stage,fraction)=>{
      if(stage==='upload')showStartupProgress(53+9*fraction,'正在上传 GPU 资源…');
      else showStartupProgress(62+19*fraction,'正在编译着色器…');
    },new Set([arenaView.boiler.root,restSite.group]));
    cameraOcclusion.clear();playerEffects.clear();battle.reset('practice');waveView.update(battle);mixer.stopAllAction();bodyBlend.reset();currentAction=undefined;switchAction('Idle');mixer.update(0);
    showStartupProgress(82,'正在预热镜盾反射…');
    await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
    const originalPosition=player.position.clone(),originalHeading=heading,originalYaw=orbit.yaw;
    const placeWarmupPlayer=mode=>{
      battle.reset(mode);
      arenaView.setMode(mode);
      const spawn=battle.enemyStats.playerSpawn??{x:0,z:0,heading:0};
      player.position.set(spawn.x,0,spawn.z);
      player.rotation.y=heading=spawn.heading??0;
      orbit.yaw=heading;
      updateCamera();
      enemyView.update(battle,camera,0,[]);
    };
    try{
      for(const mode of ['mirrorGuard','samurai']){
        placeWarmupPlayer(mode);
        mirrorReflections.update(camera);
        if(mode==='mirrorGuard'){
          await mirrorReflections.compileWarmup(camera,fraction=>{
            showStartupProgress(82+fraction,'正在预热镜盾反射…');
          });
        }else showStartupProgress(84,'正在预热武士竞技场…');
        renderer.render(scene,camera);
        await cpuBudget.checkpoint(true);
      }
      showStartupProgress(85,'正在预热休息处…');
      arenaView.setMode('practice');
      enemyView.group.visible=false;
      mirrorReflections.update(camera);
      restSite.group.visible=true;
      try{
        restSite.update(camera,0);
        await compileSceneInBatches(renderer,scene,camera,undefined,{visibleOnly:true});
        renderer.render(scene,camera);
      }finally{restSite.group.visible=false;}

      showStartupProgress(86,'正在预热锅炉房画面…');
      placeWarmupPlayer('cinderWarden');
      arenaView.boiler.update(battle,player.position,settings.values.bindings,camera);
      const unusedInFoundry=new Set([arenaView.group,arenaView.stonePlatform,restSite.group,ground,grid,
        ...enemyViews.slice(1).map(view=>view.group)]);
      for(const entry of Object.values(enemyView.monsterVisuals.entries)){
        if(!entry.root.visible)unusedInFoundry.add(entry.root);
      }
      await arenaView.boiler.warmup(async wet=>{
        showStartupProgress(wet?94:86,wet?'正在绘制水流预览…':'正在预热锅炉房画面…');
        await yieldStartup();
        if(!wet){
          await foundryPost.compileWarmup(fraction=>{
            showStartupProgress(86+6*fraction,'正在预热锅炉房画面…');
          },{excludedRoots:unusedInFoundry,onBatch:foundryCompileBatches&& (batch=>foundryCompileBatches.push(batch))});
          showStartupProgress(92,'正在预热后处理…');
          await yieldStartup();
          await foundryPost.preparePost?.();
          showStartupProgress(92.5,'正在绘制锅炉房预览…');
          await yieldStartup();
        }
        foundryPost.render(true,foundryPreviewPasses&& (pass=>foundryPreviewPasses.push({wet,...pass})));
      },()=>showStartupProgress(93,'正在预热 GPU 水流和折射…'));
    }finally{
      enemyView.group.visible=false;
      mirrorReflections.update(camera);
      battle.reset('practice');
      arenaView.setMode('practice');
      player.position.copy(originalPosition);
      player.rotation.y=heading=originalHeading;
      orbit.yaw=originalYaw;
      updateCamera();
    }
    showStartupProgress(96,'正在等待 GPU 完成预热…');
    await yieldStartup();
    renderer.render(scene,camera);
    await waitForStartupGpu(renderer);
    showStartupProgress(100,'加载完成');
    loaded = true;
    document.getElementById('startup-loading')?.remove();if(homeScreen)homeScreen.hidden=false;
    const tutorialButton=document.getElementById("home-tutorial");if(tutorialButton)tutorialButton.disabled=false;
    if(practiceButton){practiceButton.disabled=false;practiceButton.textContent='练习场';}
    updateHomeRunButtons();
    arenaMenu.setReady();document.getElementById('developer-jump-go').disabled=false;document.getElementById('developer-equipment-get').disabled=false;
    if(!inPractice){orbit.yaw=Math.PI;updateCamera();}
    mixer.addEventListener('finished', event => {
      if (event.action === actions.Blink) {
        return;
      }
      if (activeJump && event.action === activeJump.action) {
        completeJump();
        // Keep held keys and velocity: landing must immediately resume locomotion.
        return;
      }
      if (!activeGesture || event.action !== activeGesture.action) return;
      const now = performance.now()/1000;
      if (activeDodge && event.action === activeDodge.action) {
        completeDodge(now);
        return;
      }
      if (combo.stage && isAttack(activeGesture.name)) {
        completeAttack(now);
        return;
      }
      // The clip reaching its final guard pose must not release a held button,
      // even when an attack or dodge has already been buffered.
      if(activeGesture.name==='Block' && blockHeldAt!==null) {
        return;
      }
      if (!activeGesture.persistent || commandBuffer.has(activeGesture.name)) finishCommand(activeGesture.name,now);
    });
    updateCamera();
  } catch (error) {
    loadingFailed=true;
    console.error('奶娃加载失败', error);
    if(startupStatus)startupStatus.textContent='加载失败，请刷新重试';
    if(practiceButton)practiceButton.textContent='加载失败 · 请重新启动';
  }
}
let previousTime = performance.now();
let nextFrameAt=previousTime;
renderer.setAnimationLoop(time => {
  profile?.raf(time);
  document.body?.classList.toggle('combat-cursor-hidden',combatPointerActive());
  if(!combatPointerActive()&&document.pointerLockElement===canvas)document.exitPointerLock?.();
  if(equipmentMenu.opened&&tutorial.active)tutorial.update(tutorialState(),[],battle);
  if(settings.opened||equipmentMenu.opened){previousTime=time;nextFrameAt=time;return;}
  if(restSite.opened){
    previousTime=time;nextFrameAt=time;
    restSite.update(camera,time/1000);renderer.render(scene,camera);return;
  }
  if(!inPractice){
    previousTime=time;nextFrameAt=time;
    return;
  }
  const frameLimit=Number(settings.values.fps);
  if(frameLimit>0){if(time<nextFrameAt-.1)return;const interval=1000/frameLimit;nextFrameAt=Math.max(nextFrameAt+interval,time-interval*.5);}else nextFrameAt=time;
  const dt = Math.min(Math.max((time - previousTime) / 1000, 0), 0.05);
  previousTime = time;
  profile?.begin(time);
  const combatStart = profile && performance.now();
  impactFeedback.update(dt);
  let battleEvents=[],externalWorldSpeed=1;
  if (loaded) {
    playerEffects.preparePose(throwGrip?.prepare);
    battle.debugHitboxes=Boolean(settings.values.hitboxes);
    const raging=battle.isRaging(),attackSpeed=PLAYER_STATS.attackSpeed*(1+(battle.gear?.attackSpeed??0))*(raging?RAGE_STATS.attackSpeed:1),worldSpeed=raging?RAGE_STATS.worldSpeed:1;
    externalWorldSpeed=worldSpeed;
    battleFrameTime=battle.enemyTime+dt*worldSpeed;
    updateControlState(time/1000);
    const input = currentMovement(time);
    updateLocomotion(input,dt);
    if (activeGesture?.name !== 'Laugh') {
      blinkCountdown -= dt;
      if (blinkCountdown <= 0) triggerGesture(gestures.find(spec => spec.name === 'Blink'));
    }
    if(activeAirAttack) {
      let left=dt;
      for(let i=0;i<8&&left>1e-9;i++){
        const timeline=activeAirAttack.timeline,t=activeAirAttack.elapsed;
        // Charge/fall follow attack speed; impact and get-up retain their own authored timing.
        const boundary=t<timeline.charge-1e-9?timeline.charge:t<timeline.landTime-1e-9?timeline.landTime:timeline.duration;
        const rate=airSlamRate(t,timeline,attackSpeed);
        const step=Math.min(left,Math.max(0,boundary-t)/rate);
        if(step<=1e-9)break;activeAirAttack.elapsed+=step*rate;left-=step;
      }
      activeAirAttack.sample=activeAirAttack.timeline.sample(activeAirAttack.elapsed);
      const {origin,direction,distance,sample}=activeAirAttack;
      player.position.x=origin.x+direction.x*distance*sample.drift;
      player.position.z=origin.z+direction.z*distance*sample.drift;
      activeGesture.action.time=activeAirAttack.sample.clipTime;
      if(sample.landed && !activeAirAttack.impacted) {
        activeAirAttack.impacted=true;
        impactFeedback.trigger();
        impactRing.position.set(player.position.x,.008,player.position.z);
      }
    } else if(activeGesture && isAttack(activeGesture.name)) {
      const intervalScale=PLAYER_STATS.attackInterval*(raging?RAGE_STATS.attackInterval:1);
      activeGesture.action.setEffectiveTimeScale(attackRate(activeGesture.name,activeGesture.action.time,attackSpeed,intervalScale,battle.chargeTimeScale));
      activeGesture.action.time=advanceAttackTime(activeGesture.name,activeGesture.action.time,dt,attackSpeed,intervalScale,battle.chargeTimeScale);
    }
    const wasLocked=!characterState.isFree;
    for(const mobility of [activeJump,activeDodge]) {
      if(!mobility)continue;
      mobility.elapsed+=dt;
      mobility.sample=mobilityTime(mobility.name,mobility.elapsed,mobility.action.getClip().duration);
      mobility.action.time=mobility.sample.time;
    }
    if(runAttackRecovery()){
      activeGesture.action.time=.5+.25*Math.min(1,(battle.time-activeGesture.recoveryStartedAt)/.5);
      if(commandBuffer.pending?.name==='Dodge'&&commandBuffer.has('RunAttack'))readyCommand=commandBuffer.take('RunAttack');
    }
    if(battle.counterCharge&&activeGesture?.name==='Charge'){activeGesture.action.paused=true;activeGesture.action.time=Math.min(.35,battle.counterChargeElapsed*1.75);}
    bodyBlend.update(dt);
    mixer.update(dt);
    if(activeJump) {
      const desired=jumpClearance(activeJump.name,activeJump.elapsed,activeJump.action.getClip().duration);
      // Move the common model root so every mesh and bone follows the same height.
      modelPivot.position.y+=desired-(floorProbe()-player.position.y);
      activeJump.height=desired;
      player.updateMatrixWorld(true);
    }
    if(activeJump?.sample?.finished) {
      completeJump();
      if(!readyCommand)updateLocomotion(currentMovement(time),0);
    }
    if(activeDodge?.sample?.finished)completeDodge(time/1000);
    if(activeAirAttack) {
      const desired=activeAirAttack.sample.height;
      modelPivot.position.y+=desired-(floorProbe()-player.position.y);
      player.updateMatrixWorld(true);
    }
    if(activeGesture && isAttack(activeGesture.name) && attackCanFinish(activeGesture.name,activeGesture.action.time,commandBuffer.has(activeGesture.name),PLAYER_STATS.attackInterval*(raging?RAGE_STATS.attackInterval:1))) {
      completeAttack(time/1000);
    }
    if(canDodgeFromHit()&&commandBuffer.pending?.name==='Dodge')readyCommand=commandBuffer.take('Hit');
    if (readyCommand) {
      const command = readyCommand;
      readyCommand = undefined;
      if(command.name==='Absorb')startEnergyAbsorption();
      else triggerGesture(gestures.find(spec => spec.name === command.name),command.aim);
      mixer.update(0);
    }
    if(wasLocked && characterState.isFree && !activeJump) {
      updateLocomotion(currentMovement(time),dt);
      mixer.update(0);
    }
    if (activeDodge) applyDodgeTravel(activeDodge.action.time);
    if (combo.stage && isAttack(activeGesture?.name ?? '')) {
      applyAttackTravel(activeGesture.action.time);
      battle.resolveAttack(activeGesture.action.time,battlePose());
    }
    battleEvents=updateBattle(dt,worldSpeed);
    if(battle.counterCharge&&battle.counterChargeElapsed>=3)releaseCounterCharge();
    tutorial.update(tutorialState(),battleEvents,battle);
    playerEffects.applyPose(battle,dt,battleEvents,activeGesture?.name==='Block');
    battleFrameTime=undefined;
  }
  profile?.mark('combatMs', performance.now() - combatStart);
  orbit.distance=advanceZoom(orbit.distance,targetDistance,dt);
  impactRingView.update(impactFeedback.elapsed);
  updateCamera(dt);
  playerEffects.updateSkills(battle,camera,battleEvents,activeGesture,currentAction,!activeGesture&&!activeDodge&&!activeJump,dt);
  battleHUD.updateTarget(battle,camera,settings.values.ui!=='none');
  for(let i=0;i<battle.enemies.length;i++){
    const view=enemyViews[i]??(enemyViews[i]=createEnemyView(scene));
    view.update(battle.enemies.length===1?battle:battle.viewOf(battle.enemies[i]),camera,dt*externalWorldSpeed,i===0?battleEvents:[]);
    if(settings.values.ui==='none')view.health.visible=false;
  }
  for(let i=battle.enemies.length;i<enemyViews.length;i++)enemyViews[i].group.visible=false;
  waveView.update(battle,rightHand,heading);enemyProjectileView.update(battle);hitboxView.update(battle,battleEvents,Boolean(settings.values.hitboxes));
  const occlusionStart = profile && performance.now();
  cameraOcclusion.update(camera,player.position,dt,combatCamera.blockers);
  profile?.mark('cameraOcclusionMs', performance.now() - occlusionStart);

  const waterStart = profile && performance.now();
  profile?.beginPass('gpuWaterMs');
  arenaView.reedField.update(battle.enemyTime);
  const waterSteps = arenaView.boiler.update(battle,player.position,settings.values.bindings,camera);
  profile?.endPass('gpuWaterMs');
  profile?.mark('waterMs', performance.now() - waterStart);
  profile?.mark('waterSteps', waterSteps ?? 0);
  playerEffects.updateGuard(battle,battleEvents,heading,dt);
  mirrorReflections.update(camera);
  if(arenaView.boiler.root.visible)arenaView.boiler.prepare(renderer);
  const renderStart = profile && performance.now();
  profile?.beginPass('gpuRenderMs');
  foundryPost.render(arenaView.boiler.root.visible);
  profile?.endPass('gpuRenderMs');
  profile?.mark('renderMs', performance.now() - renderStart);
  runGame?.tick(battle);
  profile?.end();
});
updateCamera();
loadPlayer();
