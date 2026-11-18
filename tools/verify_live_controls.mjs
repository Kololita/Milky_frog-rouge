// Run the actual main.js event handlers and render loop with real GLB bones,
// replacing only the DOM and GPU renderer. Keys stay down without repeat events.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {extractAttackRootMotion} from '../src/attack-root-motion.js';
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};};
const bytes=await fs.readFile(new URL('../output/frog.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
let now=0,frame;
class Renderer {
 constructor(){this.shadowMap={};} setPixelRatio(){} setSize(){} render(){}
 setAnimationLoop(callback){frame=callback;}
}
const listeners=new Map(),canvasListeners=new Map(),buttons=[];
const classList={add(){},toggle(){}};
const canvas={addEventListener:(n,f)=>canvasListeners.set(n,f)};
const status={textContent:'',classList},container={append:b=>buttons.push(b)};
const context={THREE:{...THREE,WebGLRenderer:Renderer},performance:{now:()=>now},console,
 window:{innerWidth:610,innerHeight:745,devicePixelRatio:1,addEventListener:(n,f)=>listeners.set(n,f)},
 document:{hidden:false,addEventListener(){},querySelector:s=>s==='#scene'?canvas:s==='#status'?status:container,
 querySelectorAll:()=>buttons,createElement:()=>({dataset:{},classList,addEventListener(){}})},
};
for(const file of ['movement','attack-combo','dodge','direction','world-camera','control-tuning','locomotion-animation','character-state','command-buffer','shift-tap','action-blend','combat','floor-probe','assets','impact-feedback','battle-values','battle','enemy-view','battle-hud','defense','guard-effect','energy-absorption','rage-eyes']) {
 Object.assign(context,await import(new URL(`../src/${file}.js`,import.meta.url)));
}
Object.assign(context,await import('../src/settings.js'));
context.loadAnimatedModel=async()=>{
 const mixer=new THREE.AnimationMixer(gltf.scene);
 const motion=extractAttackRootMotion(gltf.animations,gltf.scene,/^(?:Attack[1-4]|RunAttack)$/);
 const dodgeMotion=extractAttackRootMotion(gltf.animations,gltf.scene,/^DodgeSide[LR]$/);
 return {model:gltf.scene,mixer,attackMotion:motion,dodgeMotion,...context.createModelActions(gltf.animations,mixer)};
};
const source=(await fs.readFile(new URL('../src/main.js',import.meta.url),'utf8')).replace(/^import .*;\r?$/gm,'');
vm.createContext(context);vm.runInContext(source,context);
for(let i=0;i<8;i++)await Promise.resolve();
const read=s=>vm.runInContext(s,context);
assert(read('loaded'),'Main did not load the test model');
read('battle.enabled=false'); // This suite isolates controls from enemy attacks.
function key(code,down=true){listeners.get(down?'keydown':'keyup')({code,repeat:false,ctrlKey:false,metaKey:false,altKey:false,preventDefault(){}});}
function tap(code){key(code);key(code,false);}
function mouse(button,down=true){(down?canvasListeners:listeners).get(down?'mousedown':'mouseup')({button,preventDefault(){}});}
let fps=60;
function tick(seconds){for(let i=0;i<Math.ceil(seconds*fps);i++){now+=1000/fps;frame(now);}}
function reset(){tap('Home');tick(.05);}
const report=[];
for(fps of [30,60,144]) {
 reset();mouse(2);assert.equal(read('activeGesture?.name'),'Block','Right down must immediately raise guard');
 tick(.15);mouse(2,false);assert.equal(read('activeGesture?.name'),'Block','Release must retain guard for four frames');tick(4/60);assert.notEqual(read('activeGesture?.name'),'Block');
 tick(.6);assert(read('characterState.isFree && !activeGesture'));
 report.push({fps,test:'guard-follows-mouse-down-and-window-up',passed:true});

 reset();tap('KeyJ');tick(.05);mouse(2);
 assert(read('activeGesture.name==="Block" && combo.stage===0'),'Guard must interrupt the combo');
 tick(.1);mouse(2,false);tap('KeyJ');assert.equal(read('activeGesture.name'),'Attack1','Short guard must start a new combo');
 report.push({fps,test:'short-guard-interrupts-combo',passed:true});

 reset();tap('KeyJ');tick(.05);mouse(2);tick(.75);
 assert(read('activeGesture.name==="Block" && combo.stage===0'),'Long guard must reset the combo while still held');
 mouse(2,false);tap('KeyJ');assert.equal(read('activeGesture.name'),'Attack1');
 report.push({fps,test:'long-guard-resets-combo',passed:true});

 reset();mouse(2);tap('KeyJ');assert(read('commandBuffer.has("Block")'));
 tick(1.5);assert.equal(read('activeGesture.name'),'Block','Animation completion must not release a held guard to run a queued attack');
 mouse(2,false);tick(1/fps);assert.equal(read('activeGesture.name'),'Attack1');
 report.push({fps,test:'guard-holds-final-pose-until-release-with-buffered-attack',passed:true});

 reset();tap('Space');tick(.1);mouse(2);assert(read('commandBuffer.pending?.name==="Block"'));
 mouse(2,false);assert(!read('commandBuffer.pending'));tick(1.3);
 assert(read('!activeJump && activeGesture?.name!=="Block" && characterState.isFree'),'Released airborne guard reappeared after landing');
 report.push({fps,test:'released-queued-guard-does-not-appear-after-landing',passed:true});

 reset();mouse(2);tap('KeyJ');listeners.get('blur')();tick(1/fps);
 assert(read('blockHeldAt===null && !activeGesture && !commandBuffer.pending'),'Focus loss leaves guard or a ghost attack stuck');
 report.push({fps,test:'focus-loss-releases-guard-and-clears-input',passed:true});

 reset();tap('KeyJ');tick(.10);key('KeyW');
 assert(!read('characterState.isFree'));tick(1.6);
 assert(read('characterState.isFree && !activeGesture && keys.has("KeyW")'));
 assert(read('player.position.z')>.1);assert(status.textContent.includes('行走'));
 report.push({fps,test:'held-W-after-attack-window',passed:true});

 reset();tap('KeyJ');key('KeyW');tick(.10);tap('KeyR');tick(.10);
 assert(read('characterState.isFree && keys.has("KeyW") && player.position.z>0'));
 report.push({fps,test:'R-retains-held-direction',passed:true});

 reset();tap('Space');tick(.45);tap('KeyJ');key('KeyW');
 tick(.2);assert.equal(read('activeAirAttack.sample.phase'),'charge');
 const chargeHeight=read('floorProbe()'),chargeZ=read('player.position.z');tick(.2);
 assert.equal(read('activeAirAttack.sample.phase'),'charge');
 assert(read('floorProbe()')>chargeHeight+.015,'Charge stops ascending');
 assert(read('player.position.z')>chargeZ+.01,'Charge stops moving forwards');
 let guard=0;while(read('activeAirAttack.sample.phase!=="impact"')&&guard++<fps)tick(1/fps);
 assert.equal(read('activeAirAttack.sample.phase'),'impact');
 const landingZ=read('player.position.z');tick(.1);
 assert.equal(read('activeAirAttack.sample.phase'),'impact');
 assert.equal(read('activeAirAttack.sample.clipTime'),.5);
 guard=0;while(read('activeAirAttack.sample.phase!=="backflip"')&&guard++<fps)tick(1/fps);
 assert.equal(read('activeAirAttack.sample.phase'),'backflip');
 while(read('activeAirAttack?.sample.phase==="backflip"')&&guard++<2*fps) {
  assert(Math.abs(read('player.position.z')-landingZ)<.001,'Recovery backflip drifts horizontally');tick(1/fps);
 }
 tick(.5);
 assert(read('characterState.isFree && !activeGesture && !activeAirAttack && combo.stage===0'));
 assert(read('player.position.z')>landingZ+.05,'Held W does not resume after the slam');
 assert(status.textContent.includes('行走'));
 report.push({fps,test:'moving-charge-impact-hold-slow-backflip-free-held-W',passed:true});
}
// Check the exact hold threshold and key-up without any intervening render frames.
fps=60;
for(const [hold,expected] of [[.01,1],[.7,1],[.701,1]]) {
 reset();tap('KeyJ');mouse(2);now+=hold*1000;mouse(2,false);tap('KeyJ');
 assert.equal(read('combo.stage'),expected,`Incorrect guard cutoff at ${hold}s`);
 report.push({fps,test:`guard-cutoff-${hold}s`,passed:true});
}
reset();tap('KeyJ');mouse(2);now+=400;mouse(2);now+=350;mouse(2,false);tap('KeyJ');
assert.equal(read('combo.stage'),1,'Duplicate mouse-down restarted the hold timer');
report.push({fps,test:'duplicate-down-does-not-reset-guard-timer',passed:true});
fps=60;reset();tap('Space');tick(.45);tap('KeyJ');tick(.2);tap('KeyJ');
assert(read('commandBuffer.has("AirAttack")'));
let guard=0;while(read('activeGesture?.name==="AirAttack"')&&guard++<180)tick(1/60);
assert(read('activeGesture?.name==="Attack1" && combo.stage===1'),'Air slam still forces Attack4');
report.push({fps,test:'queued-attack-starts-fresh-after-complete-backflip',passed:true});
await fs.writeFile(new URL('../output/animations/live-control-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('LIVE_CONTROLS_VERIFIED',report);
