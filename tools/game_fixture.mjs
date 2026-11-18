import {ENEMY_MODEL_IDS,registerEnemyModel} from '../src/enemy-models.js';
// Real GLB, main.js inputs, enemy meshes and mixer. Only the browser/GPU are replaced.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {extractAttackRootMotion} from '../src/attack-root-motion.js';

let enemyAssetsLoaded;
async function fixtureEnemyAssets(){
 return enemyAssetsLoaded??=Promise.all(ENEMY_MODEL_IDS.map(async id=>{const data=await fs.readFile(new URL(`../public/models/enemies/${id}.glb`,import.meta.url));registerEnemyModel(id,await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),''));}));
}
export async function gameFixture(fps=60,{home=false,equipment=false,run=false}={}) {
 globalThis.self=globalThis;
 globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};};
 const data=await fs.readFile(new URL('../output/frog.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 let now=0,frame;const events=[],listeners=new Map(),canvasListeners=new Map(),documentListeners=new Map(),buttons=[];
 const addListener=(map,name,fn)=>{const previous=map.get(name);map.set(name,previous?event=>{previous(event);fn(event);}:fn);};
 const element=()=>({textContent:'',dataset:{},disabled:false,style:{values:{},setProperty(k,v){this.values[k]=v;}},attributes:{},setAttribute(k,v){this.attributes[k]=v;},classList:{add(){},remove(){},toggle(){}},listeners:new Map(),addEventListener(name,fn){this.listeners.set(name,fn);},children:[],get innerHTML(){return this._html??'';},set innerHTML(value){this._html=value;this.children=[];},append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},focus(){},showModal(){this.open=true;},close(){this.open=false;}});
 const canvas={...element(),addEventListener:(n,f)=>addListener(canvasListeners,n,f)},status=element(),container={append:b=>buttons.push(b)},hud=new Map();
 for(const id of ['battle-hud','player-health','player-guard','health-value','guard-value','enemy-value','battle-feed','energy-value','player-energy','rage-filter','combo-damage'])hud.set(id,element());
 if(run){hud.set('buff-status',element());for(const id of ['home-new-game','run-screen','run-map-canvas','run-map-scroll','run-floor','run-result','run-result-title','run-result-next','run-exit','loot-dialog','loot-choices','loot-confirm','loot-inventory','assembly-upgrade-dialog','assembly-upgrade-list','assembly-upgrade-close','rest-screen','rest-options','rest-potions','rest-leave','potion-use','potion-count'])hud.set(id,element());hud.get('run-screen').hidden=true;hud.get('run-map-scroll').clientHeight=700;}
 if(equipment)for(const id of ['equipment-effects','assembly-board','assembly-pieces','assembly-status','equipment-add','equipment-clear','equipment-recycle','equipment-dialog','equipment-start','equipment-slots','equipment-picker','equipment-list','equipment-picker-title','equipment-close','equipment-picker-close','skill-activation-icon'])hud.set(id,element());
 if(home)for(const id of ['app','home-screen','home-practice','home-settings','return-home','home-arena','boss-arena-dialog','arena-encounters','arena-close','home-samurai'])hud.set(id,element());
 class Renderer {constructor(){this.shadowMap={};}setPixelRatio(){}setSize(){}render(){}setAnimationLoop(f){frame=f;}}
 const context={THREE:{...THREE,WebGLRenderer:Renderer},performance:{now:()=>now},console,traceBattle:(type,data)=>events.push({type,...data}),
 window:{innerWidth:960,innerHeight:700,devicePixelRatio:1,addEventListener:(n,f)=>addListener(listeners,n,f)},
 document:{hidden:false,addEventListener:(n,f)=>addListener(documentListeners,n,f),getElementById:id=>hud.get(id),querySelector:s=>s==='#scene'?canvas:s==='#status'?status:container,querySelectorAll:()=>buttons,createElement:element}};
 for(const file of ['movement','attack-combo','dodge','direction','world-camera','control-tuning','locomotion-animation','character-state','command-buffer','shift-tap','action-blend','combat','floor-probe','assets','impact-feedback','battle-values','battle','enemy-view','battle-hud','defense','guard-effect','energy-absorption','rage-eyes','back-throw','actor-collision','throw-grip','home-art'])Object.assign(context,await import(new URL(`../src/${file}.js`,import.meta.url)));
 Object.assign(context,await import('../src/fist-wind-effects.js'),await import('../src/settings.js'),await import('../src/parry-recoil.js'),await import('../src/developer-settings.js'),await import('../src/equipment.js'),await import('../src/skill-effects.js'),await import('../src/hitbox-view.js'),await import('../src/run-ui.js'),await import('../src/rest-site.js'),await import('../src/arena-menu.js'));
 context.loadAnimatedModel=async()=>{
  const mixer=new THREE.AnimationMixer(gltf.scene);
  return {model:gltf.scene,mixer,attackMotion:extractAttackRootMotion(gltf.animations,gltf.scene,/^(?:Attack[1-4]|RunAttack)$/),dodgeMotion:extractAttackRootMotion(gltf.animations,gltf.scene,/^DodgeSide[LR]$/),...context.createModelActions(gltf.animations,mixer)};
 };
 await fixtureEnemyAssets();context.loadEnemyModels=async()=>{};
 vm.createContext(context);vm.runInContext((await fs.readFile(new URL('../src/main.js',import.meta.url),'utf8')).replace(/^import .*;\r?$/gm,''),context);
 for(let i=0;i<8;i++)await Promise.resolve();
 const read=s=>vm.runInContext(s,context);
 if(!read('loaded'))throw new Error('Fixture failed to load the character');
 read('const originalEmit=battle.emit.bind(battle);battle.emit=(type,data={})=>{traceBattle(type,data);originalEmit(type,data)}');
 const key=(code,down=true)=>listeners.get(down?'keydown':'keyup')({code,repeat:false,ctrlKey:false,altKey:false,metaKey:false,preventDefault(){}});
 const tap=code=>{key(code);key(code,false);};
 const mouse=(button,down=true)=>(down?canvasListeners:listeners).get(down?'mousedown':'mouseup')({button,preventDefault(){}});
 let freezeEnemy=false;
 function tickFrames(count) {
  for(let i=0;i<count;i++) {
   if(freezeEnemy)read('if(battle.enemy.health>0&&!["dazed","knockback","thrown","down","rising"].includes(battle.enemy.state)){battle.enemy.state="hurt";battle.enemy.stun=100;battle.enemy.elapsed=0;}');
   now+=1000/fps;frame(now);
  }
 }
 const tick=seconds=>tickFrames(Math.ceil(seconds*fps));
 const until=(predicate,max=4)=>{let i=0;while(!read(predicate)&&i++<max*fps)tick(1/fps);return read(predicate);};
 const reset=()=>{tap('Home');events.length=0;tick(1/fps);};
 return {read,key,tap,mouse,tick,tickFrames,until,reset,events,hud,context,listeners,canvasListeners,documentListeners,get now(){return now;},set freezeEnemy(v){freezeEnemy=v;}};
}
