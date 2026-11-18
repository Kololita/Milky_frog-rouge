// Real main.js inputs, mixer and GLB; only DOM and GPU output are replaced.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {extractAttackRootMotion} from '../src/attack-root-motion.js';
import {MOBILITY_TIMING,mobilityTime} from '../src/combat.js';
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};};
const data=await fs.readFile(new URL('../output/frog.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
for(const [name,p] of Object.entries(MOBILITY_TIMING)) {
 const duration=gltf.animations.find(c=>c.name===name).duration;
 assert.equal(mobilityTime(name,0,duration).time,0);
 assert(Math.abs(mobilityTime(name,p.startup,duration).time-p.takeoff*duration)<1e-7);
 let previous=-1;
 for(let i=0;i<=500;i++) {
  const sample=mobilityTime(name,i/240,duration);
  assert(sample.time>=previous&&sample.time<=duration,'Mobility retiming rewinds or overshoots');previous=sample.time;
 }
 assert.equal(previous,duration,'Recovery skips the final pose');
}
let now=0,frame,fps=60;
class Renderer {constructor(){this.shadowMap={};}setPixelRatio(){}setSize(){}render(){}setAnimationLoop(f){frame=f;}}
const listeners=new Map(),buttons=[],classList={add(){},toggle(){}};
const canvasListeners=new Map();
const canvas={addEventListener:(n,f)=>canvasListeners.set(n,f)},status={textContent:'',classList},container={append:b=>buttons.push(b)};
const context={THREE:{...THREE,WebGLRenderer:Renderer},performance:{now:()=>now},console,
 window:{innerWidth:610,innerHeight:745,devicePixelRatio:1,addEventListener:(n,f)=>listeners.set(n,f)},
 document:{hidden:false,addEventListener(){},querySelector:s=>s==='#scene'?canvas:s==='#status'?status:container,
 querySelectorAll:()=>buttons,createElement:()=>({dataset:{},classList,addEventListener(){}})}};
for(const file of ['movement','attack-combo','dodge','direction','world-camera','control-tuning','locomotion-animation','character-state','command-buffer','shift-tap','action-blend','combat','floor-probe','assets','impact-feedback','battle-values','battle','enemy-view','battle-hud','defense','guard-effect','energy-absorption','rage-eyes'])Object.assign(context,await import(new URL(`../src/${file}.js`,import.meta.url)));
Object.assign(context,await import('../src/settings.js'));
context.loadAnimatedModel=async()=>{
 const mixer=new THREE.AnimationMixer(gltf.scene);
 return {model:gltf.scene,mixer,attackMotion:extractAttackRootMotion(gltf.animations,gltf.scene,/^(?:Attack[1-4]|RunAttack)$/),
 dodgeMotion:extractAttackRootMotion(gltf.animations,gltf.scene,/^DodgeSide[LR]$/),...context.createModelActions(gltf.animations,mixer)};
};
vm.createContext(context);vm.runInContext((await fs.readFile(new URL('../src/main.js',import.meta.url),'utf8')).replace(/^import .*;\r?$/gm,''),context);
for(let i=0;i<8;i++)await Promise.resolve();
const read=s=>vm.runInContext(s,context);
assert(read('loaded'));
read('battle.enabled=false'); // Keep this movement regression independent of AI.
function key(code,down=true){listeners.get(down?'keydown':'keyup')({code,repeat:false,ctrlKey:false,metaKey:false,altKey:false,preventDefault(){}});}
function tap(code){key(code);key(code,false);}
function guard(down=true){(down?canvasListeners:listeners).get(down?'mousedown':'mouseup')({button:2,preventDefault(){}});}
function tick(seconds){for(let i=0;i<Math.ceil(seconds*fps);i++){now+=1000/fps;frame(now);}}
function reset(){tap('Home');tick(.05);}
function dodge(){key('ShiftLeft');tick(.05);key('ShiftLeft',false);}
function until(predicate,limit=3){let i=0;while(!read(predicate)&&i++<limit*fps)tick(1/fps);return read(predicate);}
const report={startup:[],links:[],dodges:[],continuity:[]};
const extended=[];
for(fps of [30,60,144]) {
 for(const [name,codes] of [['Jump',[]],['JumpWalk',['KeyW']],['JumpRun',['KeyW','ShiftLeft']]]) {
  reset();for(const code of codes)key(code);tick(.2);tap('Space');
  let rise=0;while(read('floorProbe()')<.02&&rise<1){tick(1/fps);rise+=1/fps;}
  report.startup.push({fps,name,visibleRise:rise});
 }
 reset();tap('KeyJ');tick(.1);tap('Space');
 report.links.push({fps,link:'attack -> jump',accepted:until('Boolean(activeJump)',1)});
 reset();dodge();tick(.1);tap('Space');
 report.links.push({fps,link:'roll -> jump',accepted:until('Boolean(activeJump)',2)});
 reset();tap('Space');tick(.3);dodge();
 report.links.push({fps,link:'jump -> roll',accepted:until('Boolean(activeDodge)',2)});
 if(!process.argv.includes('--baseline')) {
  // Tail of a chain window permits a new jump immediately; it is not a cooldown.
  reset();tap('KeyJ');assert(until('!activeGesture',1));assert(!read('characterState.isFree'));
  tap('Space');assert(read('Boolean(activeJump)'),'Attack link window blocks a jump');
  // Replaying the identical Jump action must reset its time and play exactly once.
  tick(.15);tap('Space');assert(read('commandBuffer.has(activeJump.name)'));
  assert(until('activeJump?.elapsed<.05',2));
  tick(1.3);assert(read('!activeJump && !commandBuffer.pending'));
  // A dodge queued while airborne waits for actual landing rather than cancelling it.
  reset();tap('Space');tick(.25);key('ShiftLeft');tick(.05);key('ShiftLeft',false);
  assert(read('activeJump && !activeDodge && commandBuffer.has(activeJump.name)'));
  assert(until('Boolean(activeDodge)',2));assert(read('floorProbe()')>-.015);
  // Release-only Shift behavior remains unchanged.
  reset();key('KeyW');key('ShiftLeft');tick(.3);assert(!read('activeDodge'));
  key('ShiftLeft',false);assert(!read('activeDodge'),'Long Shift hold became a dodge');
  report.continuity.push({fps,jumpFromChainWindow:true,sameJumpResets:true,airborneDodgeWaitsForLanding:true,runHoldDoesNotDodge:true});

  reset();tap('KeyJ');tick(.10);guard();
  assert.equal(read('activeGesture?.name'),'Block');tick(.6);
  assert(read('combo.stage===0'),'Guard must clear the combo');
  guard(false);tap('KeyJ');assert(read('activeGesture?.name==="Attack1" && combo.stage===1'));
  for(const [code,name] of [['KeyA','DodgeSideL'],['KeyD','DodgeSideR']]) {
   reset();tap('KeyJ');tick(.1);key(code);dodge();key(code,false);
   assert(until(`activeDodge?.name==='${name}'`,1));
   assert(read('combo.stage===0'),'Side dodge must reset the combo');
   assert(until('!activeDodge',2));tap('KeyJ');
   assert(read('activeGesture?.name==="Attack1" && combo.stage===1'),'Attack after side dodge must start fresh');
  }
  reset();tap('KeyJ');tick(.1);key('KeyS');dodge();key('KeyS',false);
  assert(until('activeDodge?.name==="DodgeBackflip"',1));assert(until('!activeDodge',2));
  assert(Math.cos(read('heading'))>.999,'Backward dodge lands facing the retreat direction');
  assert(Math.abs(read('modelPivot.rotation.y'))<1e-7);
  reset();tap('Space');tick(.3);tap('KeyJ');
  assert(until('impactFeedback.count>0 && Boolean(activeAirAttack?.impacted)',2));
  const count=read('impactFeedback.count');
  assert(read('impactRing.visible && impactRing.material.opacity>0'));
  tick(.3);assert.equal(read('impactFeedback.count'),count,'Slam retriggers feedback every frame');
  tick(.2);assert(!read('impactRing.visible'));assert(read('impactFeedback.sample().x===0 && impactFeedback.sample().y===0'));
  extended.push({fps,blockInterruptsCombo:true,bothSideDodgesInterruptCombo:true,backflipFacesAwayFromRetreat:true,impactFiresOnceAndSettles:true});
  reset();key('KeyW');key('ShiftLeft');tick(.3);
  const pushStart=read('player.position.z');tap('KeyJ');
  assert(read('activeGesture?.name==="RunAttack" && combo.stage===2'));
  assert(until('activeGesture?.name!=="RunAttack"',1));
  const pushDistance=read('player.position.z')-pushStart;
  assert(pushDistance>.35,'Running shove is too short in the actual controller');
  tap('KeyJ');assert(read('activeGesture?.name==="Attack3" && combo.stage===3'));
  extended.at(-1).runningPushDistance=pushDistance;
  extended.at(-1).runningPushLinksToTriplePunch=true;

  for(const [name,direction] of [['DodgeRoll',{x:0,z:1}],['DodgeBackflip',{x:0,z:-1}],['DodgeSideL',{x:1,z:0}],['DodgeSideR',{x:-1,z:0}]]) {
   reset();read(`characterState.begin('Attack1');characterState.finish('Attack1',performance.now()/1000);startDodge(${JSON.stringify(direction)})`);
   assert.equal(read('activeDodge.name'),name);
   const distance=read('activeDodge.distance'),duration=read('activeDodge.duration');
   let elapsed=0,firstTravel=0,minFloor=Infinity,lastTime=-1;
   while(read('Boolean(activeDodge)')&&elapsed<2) {
    tick(1/fps);elapsed+=1/fps;
    if(!firstTravel&&read('Math.hypot(player.position.x,player.position.z)')>.05)firstTravel=elapsed;
    minFloor=Math.min(minFloor,read('floorProbe()'));
    const time=read('currentAction.time');
    if(read('activeDodge')) {assert(time>=lastTime,'Dodge rewinds during retiming');lastTime=time;}
    for(const weight of read('[...bodyBlend.weights.values()]'))assert(weight>=0&&weight<=1);
   }
   assert(!read('activeDodge'),'Dodge never completes');
   assert(firstTravel<=.1,`${name} starts moving too slowly: ${firstTravel}`);
   assert(Math.abs(read('Math.hypot(player.position.x,player.position.z)')-distance)<.001,'Retiming changes dodge distance');
   assert(minFloor>-.03,`${name} penetrates the floor: ${minFloor}`);
   report.dodges.push({fps,name,firstTravel,duration:elapsed,minimumFloor:minFloor,authoredDuration:duration});
  }
 }
}
if(process.argv.includes('--baseline')) {
 await fs.writeFile(new URL('../output/animations/mobility-before.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));process.exit();
}
for(const test of report.startup)assert(test.visibleRise<=.14,`${test.name} is slow to leave the ground: ${test.visibleRise}`);
for(const test of report.links)assert(test.accepted,`${test.link} input was dropped at ${test.fps} FPS`);
report.extended=extended;
await fs.writeFile(new URL('../output/animations/mobility-link-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('MOBILITY_LINKS_VERIFIED',JSON.stringify(report,null,2));
