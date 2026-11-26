import {createHingeWorkshop} from './hinge-workshop.js';
import * as THREE from 'three';
import {ASSEMBLY_BOARDS} from './assembly-board.js';
import {POTION_STATS} from './battle-values.js';
export const REST_ACTIONS=[{id:'restock',label:'休息'},{id:'upgrade',label:'升级装配台'},{id:'equipment',label:'升级'}];
export function createRestSite(scene,doc,{equipment=()=>null}={}){
 const group=new THREE.Group();group.name='林间休息处';group.visible=false;scene.add(group);
 const wood=new THREE.MeshStandardMaterial({color:'#88603d',roughness:.9}),dark=new THREE.MeshStandardMaterial({color:'#4d3929',roughness:1});
 const add=(geometry,material,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
 const seat=add(new THREE.BoxGeometry(1.05,.12,.50),wood,0,.38,-.14);seat.name='休息凳';
 for(const x of [-.40,.40])for(const z of [-.31,.04])add(new THREE.BoxGeometry(.10,.32,.10),dark,x,.16,z);
 for(const x of [-2.7,2.8,-3.8,3.9]){
  add(new THREE.CylinderGeometry(.13,.20,2,7),dark,x,1,-2.7);
  const leaves=new THREE.MeshStandardMaterial({color:x<0?'#3b6249':'#456a4d',roughness:1});
  add(new THREE.ConeGeometry(.85,1.8,7),leaves,x,2.1,-2.7);add(new THREE.ConeGeometry(.62,1.4,7),leaves,x,3.0,-2.7);
 }
 const stone=new THREE.MeshStandardMaterial({color:'#777d73',roughness:1});
 for(let i=0;i<8;i++){const a=i*Math.PI/4;add(new THREE.DodecahedronGeometry(.13),stone,1.6+Math.sin(a)*.35,.10,.1+Math.cos(a)*.35);}
 const ember=add(new THREE.OctahedronGeometry(.15),new THREE.MeshStandardMaterial({color:'#e7a34f',emissive:'#e47a29',emissiveIntensity:1.2}),1.6,.18,.1);
 const emberClock={value:0};
 ember.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
 ember.customDistanceMaterial=new THREE.MeshDistanceMaterial();
 for(const material of [ember.material,ember.customDepthMaterial,ember.customDistanceMaterial]){
  material.onBeforeCompile=shader=>{
   shader.uniforms.emberClock=emberClock;
   shader.vertexShader=`
    uniform float emberClock;
    vec3 rotateEmber(vec3 p){
     float a=emberClock*.4,c=cos(a),s=sin(a);
     return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);
    }
   `+shader.vertexShader
    .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=rotateEmber(objectNormal);')
    .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=rotateEmber(transformed);');
  };
 }
 const glow=new THREE.PointLight('#ffd3a0',1.8,5,2);glow.position.set(1.6,.5,.1);group.add(glow);
 const screen=doc.getElementById?.('rest-screen'),options=doc.getElementById?.('rest-options'),count=doc.getElementById?.('rest-potions');
 let opened=false,battle,leave,order,potionBonus,refill,completed,onProgress;
 const upgradeDialog=doc.getElementById?.('assembly-upgrade-dialog'),upgradeList=doc.getElementById?.('assembly-upgrade-list');
 const finish=()=>{const callback=leave;api.close();callback?.();};
 const workshop=createHingeWorkshop(doc,{equipment,finish:()=>complete('equipment')});
 function complete(action){
  if(order!=='forge'){finish();return;}
  completed.add(action);
  renderOptions();
  if(!options||[...options.children].every(button=>button.disabled))finish();
  else onProgress([...completed]);
 }
 function chooseUpgrade(){
  const menu=equipment();if(!menu||!upgradeDialog||!upgradeList)return;
  upgradeList.replaceChildren();for(const choice of menu.upgradeChoices()){
   const button=doc.createElement('button');button.type='button';button.disabled=choice.level>=choice.maxLevel;
   const name=doc.createElement('strong');name.textContent=button.disabled?`${choice.name}（满级）`:`${choice.name} → ${choice.item.name}+${choice.level+1}`;
   const preview=doc.createElement('span');preview.className='upgrade-board-preview';const masks=ASSEMBLY_BOARDS.get(choice.item.id).levels,current=masks[choice.level],next=masks[Math.min(choice.level+1,choice.maxLevel)];preview.style.gridTemplateColumns=`repeat(${next[0].length},18px)`;
   for(let y=0;y<next.length;y++)for(let x=0;x<next[0].length;x++){const cell=doc.createElement('i');cell.className=next[y][x]==='#'?(current[y][x]==='#'?'is-open':'is-new'):'is-closed';preview.append(cell);}
   button.append(name,preview);button.addEventListener('click',()=>{if(opened&&!button.disabled&&menu.upgrade(choice.item.id)){upgradeDialog.close();complete('upgrade');}});upgradeList.append(button);
  }upgradeDialog.showModal();
 }
 doc.getElementById?.('assembly-upgrade-close')?.addEventListener('click',()=>upgradeDialog.close());
 upgradeDialog?.addEventListener('keydown',event=>event.stopPropagation?.());
 const updateCount=()=>{if(count)count.textContent=`血瓶 ${battle.player.potions} / ${battle.potionCapacity}`;};
 function renderOptions(){
  if(!options)return;
  options.replaceChildren();
  for(const action of REST_ACTIONS){
   if((order==='forge'&&action.id==='restock')||(order==='restock'&&action.id!=='restock'))continue;
   const button=doc.createElement('button');button.type='button';button.textContent=action.label;
   if(action.id==='restock'&&refill)button.textContent='休息（补满血瓶）';
   else if(action.id==='restock'&&potionBonus)button.textContent=`休息（补 ${Math.max(0,POTION_STATS.restGain+potionBonus)} 瓶）`;
   if(action.id==='equipment')button.disabled=!workshop.canOpen('upgrade');
   if(order==='forge'&&action.id==='upgrade')button.disabled=!equipment()?.upgradeChoices().some(choice=>choice.level<choice.maxLevel);
   if(completed.has(action.id)){button.disabled=true;button.textContent+='（已完成）';}
   button.addEventListener('click',()=>{
    if(!opened||button.disabled)return;
    if(action.id==='upgrade'){chooseUpgrade();return;}
    if(action.id==='equipment'){workshop.open();return;}
    battle.refillPotions(refill?battle.potionCapacity-battle.player.potions:POTION_STATS.restGain+potionBonus);updateCount();complete('restock');
   });
   options.append(button);
  }
 }
 const api={group,seat,get opened(){return opened;},open(current,onLeave,{order:nextOrder,refill:fullRefill=false,potionBonus:bonus=0,actions=[],saveProgress=()=>{}}={}){
  battle=current;leave=onLeave;order=nextOrder;refill=fullRefill;potionBonus=bonus;completed=new Set(actions);onProgress=saveProgress;
  opened=true;group.visible=true;if(screen)screen.hidden=false;
  renderOptions();updateCount();
 },refresh(){if(opened){renderOptions();updateCount();}},close(){workshop.close();upgradeDialog?.close();opened=false;group.visible=false;if(screen)screen.hidden=true;leave=null;},update(camera,time){
  camera.position.set(2.5,1.9,4.3);camera.lookAt(0,.9,0);camera.updateMatrixWorld(true);glow.intensity=1.8+Math.sin(time*4)*.12;emberClock.value=time;
 }};
 doc.getElementById?.('rest-leave')?.addEventListener('click',finish);return api;
}

