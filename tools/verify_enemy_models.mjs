import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ENEMY_MODEL_IDS,registerEnemyModel,createRiggedEnemy,enemyAnimationSample} from '../src/enemy-models.js';
import {createEnemyView} from '../src/enemy-view.js';
import {Battle} from '../src/battle.js';

const reports={};
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());assert.equal(b.toString('ascii',1,4),'PNG');return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};};
const bytes=async path=>{const b=await fs.readFile(new URL(path,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
for(const id of ENEMY_MODEL_IDS){
 const gltf=await new GLTFLoader().parseAsync(await bytes(`../public/models/enemies/${id}.glb`),'');registerEnemyModel(id,gltf);
 const source=await new GLTFLoader().parseAsync(await bytes(`../assets-source/blender/${id}_low.glb`),'');
 const triangles=root=>{let n=0;root.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});return n;};
 // Blender removes repeated-index invalid faces in the supplied low meshes.
 const authored=JSON.parse(await fs.readFile(new URL(`../assets-source/blender/rigged/${id}.json`,import.meta.url),'utf8').catch(()=>'{"triangles":0}'));
 assert.equal(triangles(gltf.scene),(['mirrorGuard','samurai','scythemoth','spitter'].includes(id)?authored.triangles:triangles(source.scene)-({raider:1,shellbug:0,lantern:1,stonekeeper:6,mirrorGuard:6,samurai:7,scythemoth:5,spitter:4})[id]),'Low-model topology was replaced or subdivided');
 const meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});assert(meshes.length);
 for(const m of meshes){
  const materials=Array.isArray(m.material)?m.material:[m.material];
  for(const material of materials){
   assert(material.map&&material.normalMap&&material.roughnessMap&&material.metalnessMap,`${id}: Missing baked PBR texture`);
   assert.equal(material.map.image.width,2048);assert.equal(material.map.colorSpace,THREE.SRGBColorSpace);
  }
  assert(m.geometry.attributes.uv&&m.geometry.attributes.tangent);
  assert.equal(m.skeleton.bones.length,({raider:20,shellbug:23,lantern:16,stonekeeper:50,mirrorGuard:52,samurai:52,scythemoth:29,spitter:25})[id]);
  const w=m.geometry.attributes.skinWeight,indices=m.geometry.attributes.skinIndex;
  for(let i=0;i<w.count;i++){
   const weights=new THREE.Vector4().fromBufferAttribute(w,i);assert(Math.abs(weights.x+weights.y+weights.z+weights.w-1)<1e-5);
   for(let j=0;j<4;j++)assert(indices.array[i*4+j]<m.skeleton.bones.length);
  }
 }
 const mixer=new THREE.AnimationMixer(gltf.scene);let maxStretch=0,minGround=Infinity,maxHeight=-Infinity;
 const walkFeet=[];
 for(const clip of gltf.animations){
  mixer.stopAllAction();const action=mixer.clipAction(clip).play();
  for(let k=0;k<=20;k++){
   action.time=clip.duration*k/20;mixer.update(0);gltf.scene.updateMatrixWorld(true);
   for(const m of meshes){
    m.skeleton.update();const geometry=m.geometry,v=geometry.attributes.position,points=[];
    for(let i=0;i<v.count;i++){
     const p=new THREE.Vector3().fromBufferAttribute(v,i);m.applyBoneTransform(i,p);assert(Number.isFinite(p.x+p.y+p.z));points.push(p);
     if(['Idle','Walk'].includes(clip.name)){minGround=Math.min(minGround,p.y);maxHeight=Math.max(maxHeight,p.y);}
    }
    const index=geometry.index;
    for(let i=0;i<index.count;i+=3)for(let edge=0;edge<3;edge++){
     const a=index.getX(i+edge),b=index.getX(i+(edge+1)%3),before=new THREE.Vector3().fromBufferAttribute(v,a).distanceTo(new THREE.Vector3().fromBufferAttribute(v,b));
     if(before>.01)maxStretch=Math.max(maxStretch,points[a].distanceTo(points[b])/before);
    }
   }
   if(['raider','shellbug'].includes(id)&&clip.name==='Walk'&&[5,15].includes(k)){
    const left=gltf.scene.getObjectByName(id==='raider'?'foot_L':'claw_L1'),right=gltf.scene.getObjectByName(id==='raider'?'foot_R':'claw_R1');
    walkFeet.push(left.getWorldPosition(new THREE.Vector3()).y-right.getWorldPosition(new THREE.Vector3()).y);
   }
  }
 }
 assert(maxStretch<(({raider:4.1,shellbug:2.2,lantern:4,stonekeeper:6,mirrorGuard:6,samurai:7,scythemoth:5,spitter:4})[id]),`${id}: stretched joint/stray vertex ${maxStretch}`);
 assert(minGround>-.012,`${id}: feet penetrate ground`);
 assert(maxHeight<({raider:1.58,shellbug:.61,lantern:1.2,stonekeeper:2.5,mirrorGuard:2,samurai:3.8,scythemoth:2.2,spitter:1.5})[id]);if(walkFeet.length)assert(walkFeet[0]*walkFeet[1]<0,'Feet do not alternate');
 reports[id]={triangles:triangles(gltf.scene),maxStretch,minGround,maxHeight};
 const first=createRiggedEnemy(id),second=createRiggedEnemy(id);assert(first.ready&&second.ready);
 const e={state:'idle',elapsed:0,moving:false};first.animate(e,0);second.animate(e,0);
 const rootName=({raider:'hand_L',shellbug:'claw_L1',lantern:'body',stonekeeper:'hand_L',mirrorGuard:'hand_R',samurai:'hand_R',scythemoth:'scythe_L_2',spitter:'head'})[id],before=second.model.getObjectByName(rootName).getWorldPosition(new THREE.Vector3());
 first.animate({...e,state:'chase',moving:true},.25);
 assert(second.model.getObjectByName(rootName).getWorldPosition(new THREE.Vector3()).distanceTo(before)<1e-9,'Cloned skeletons share transforms');
 assert.notEqual(first.mats[0],second.mats[0]);
}
for(const fps of [30,60,144])for(const id of ENEMY_MODEL_IDS){
 const battle=new Battle();battle.reset(id);battle.enemy.x=0;battle.enemy.z=battle.enemyStats.stopDistance;battle.enemy.heading=Math.PI;
 const view=createEnemyView(new THREE.Scene());let visibleAttack=false;
 for(let i=0;i<fps*5;i++){
  battle.update(1/fps,{x:0,z:0,height:0,heading:0,invulnerable:true});view.update(battle,new THREE.PerspectiveCamera(),1/fps);
  const entry=view.monsterVisuals.entries[id];assert(entry.rigged&&entry.ready&&entry.root.visible);assert(!view.body.visible);
  const sample=enemyAnimationSample(id,battle.enemy,battle.enemyTime);visibleAttack ||= ['Jab','Hook','Charge','Spikes','Pulse','Empower','Firebolt','Smash','Sweep','Quake','RockThrow','ShieldThrust','Parry','Riposte','ShieldThrow','CutLeft','CutRight','Thrust','Pounce','Shoot','TailSweep','Retreat','CrossLeft','CrossRight','Overhead','Rising','ShortThrust','LongThrust','RoundSweep','BuriedOverhead'].includes(sample.name);
  assert(Number.isFinite(entry.model.getObjectByName(({raider:'hand_L',shellbug:'claw_L1',lantern:'body',stonekeeper:'hand_L',mirrorGuard:'hand_R',samurai:'hand_R',scythemoth:'scythe_L_2',spitter:'head'})[id]).matrixWorld.elements[13]));
 }
 assert(visibleAttack);
 for(const state of ['dazed','dead','thrown','down','rising']){
  battle.enemy.state=state;battle.enemy.elapsed=.3;
  if(['thrown','down','rising'].includes(state))Object.assign(battle.enemy,{throwVisual:{pitch:Math.PI/2,center:.6},riseUntil:battle.enemyTime+.5,riseDuration:1});
  view.update(battle,new THREE.PerspectiveCamera(),1/fps);assert(Number.isFinite(view.monsterVisuals.entries[id].root.position.y));
 }
}
await fs.mkdir(new URL('../output/enemy-models/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../output/enemy-models/validation.json',import.meta.url),JSON.stringify(reports,null,2));
console.log('ENEMY_MODELS_VERIFIED: source low topology, normalized weights, independent skeletons, all required combat clips, deformation/ground/alternating feet, native combat rendering at 30/60/144FPS');


