import assert from 'node:assert/strict';import fs from 'node:fs/promises';import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {gameFixture} from './game_fixture.mjs';import {ENEMY_MODEL_PROFILES,enemyAnimationSample} from '../src/enemy-models.js';
await gameFixture();const reports={};
for(const id of ['mirrorGuard','samurai','scythemoth','spitter']){
 const data=await fs.readFile(`public/models/enemies/${id}.glb`),g=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.length),''),mixer=new THREE.AnimationMixer(g.scene),meshes=[];g.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 const sample=(name,t)=>{mixer.stopAllAction();const a=mixer.clipAction(g.animations.find(c=>c.name===name));assert(a,`${id}/${name} missing`);a.play();a.time=t;mixer.update(0);g.scene.updateMatrixWorld(true);for(const m of meshes)m.skeleton.update();};
 const point=(name,length=0)=>{const bone=g.scene.getObjectByName(name);assert(bone,`${id}/${name} missing`);return bone.localToWorld(new THREE.Vector3(0,length,0));};
 for(const [motion,name] of Object.entries(ENEMY_MODEL_PROFILES[id].motions)){sample(name,.625);const e={state:'windup',move:{motion},elapsed:1.7,telegraph:1,swingDuration:1};assert.equal(enemyAnimationSample(id,e,0).name,name);assert(Math.abs(enemyAnimationSample(id,e,0).phase-.625)<1e-8);}
 let rigidError=0;
 const rigidMeshes=meshes.filter(m=>/_blade$|_shield$|_scabbard$/.test(m.name));
 for(const clip of g.animations)for(const t of [0,.2,.45,.52,.625,.70,.9,1]){sample(clip.name,t);for(const m of rigidMeshes){const v=m.geometry.attributes.position,index=m.geometry.index;for(let k=0;k<index.count-1;k+=15){const a=index.getX(k),b=index.getX(k+1),ra=new THREE.Vector3().fromBufferAttribute(v,a),rb=new THREE.Vector3().fromBufferAttribute(v,b),d=ra.distanceTo(rb);if(d<.005)continue;m.applyBoneTransform(a,ra);m.applyBoneTransform(b,rb);rigidError=Math.max(rigidError,Math.abs(ra.distanceTo(rb)/d-1));}}}
 assert(rigidError<.001,`${id}: rigid weapon/armor stretches`);
 const result={clips:g.animations.length,bones:meshes[0].skeleton.bones.length,rigidError};
 if(id==='samurai'){
  assert.equal(meshes[0].skeleton.bones.filter(b=>b.name.startsWith('finger_')).length,28);
  const length=1.704;sample('Overhead',.45);const raised=point('blade',length);sample('Overhead',.625);const contact=point('blade',length);assert(raised.y>2.6&&contact.y<raised.y-1,'Overhead does not descend from above');assert(contact.z>point('blade').z+.5,'Overhead blade leads backwards');
  let previous=null,maxRise=0;
  for(let k=48;k<=62;k++){sample('Overhead',k/100);const tip=point('blade',length);if(previous)maxRise=Math.max(maxRise,tip.y-previous.y);previous=tip;}console.log('downstrokeRise',maxRise);assert(maxRise<.02,'Overhead rises during strike');
  for(const name of ['CrossLeft','CrossRight','ShortThrust','LongThrust']){sample(name,.625);const tip=point('blade',length);assert(tip.z>point('blade').z+.85,`${name}: blade does not pass through forward contact position`);}
  sample('Extract',.05);const planted=point('blade',length);sample('Extract',.55);assert(point('blade',length).distanceTo(planted)<.025,'Planted blade moves before extraction');
  let maxGripError=0;for(const clip of ['Overhead','BuriedOverhead','RisingLeft','RisingRight'])for(const t of [.1,.45,.625,.85]){sample(clip,t);const grip=point('blade'),direction=point('blade',length).sub(grip).normalize(),support=point('hand_L',.123);maxGripError=Math.max(maxGripError,support.distanceTo(grip.addScaledVector(direction,-.14)));}
  result.maxSupportGripError=maxGripError;result.maxDownstrokeRise=maxRise;assert(maxGripError<.03,'Supporting hand leaves the hilt');
 }else if(id==='mirrorGuard'){
  assert(g.scene.getObjectByName('mirrorGuard_shield'));sample('ShieldThrust',.625);assert(point('blade',.82).z>point('blade').z+.6,'Short blade thrust points away from enemy');
  assert.equal(enemyAnimationSample(id,{state:'windup',move:{kind:'parry'},parryGlowUntil:1,parryFeedbackStart:0,parryFeedbackDuration:.35},.1).name,'ParryPush');
 }else if(id==='spitter'){
  sample('TailSweep',.625);const tip=point('tail_5',.194);result.tailContactHeight=tip.y;assert(tip.y>.15&&tip.y<.75,'Tail sweep misses the authored low attack height');
  sample('Shoot',.625);assert(point('head',.18).z>.45,'Muzzle is not forward');
 }else{
  for(const clip of ['Thrust','Pounce']){sample(clip,.625);const left=point('scythe_L_2',.44),right=point('scythe_R_2',.44);assert(left.x<right.x,'Mantis blades cross through each other');assert(left.z>.7&&right.z>.7,'Mantis strikes behind its body');}
 }
 let maxAngularStep=0,angularWorst=null;
 for(const clip of g.animations){const previous=new Map();for(let k=0;k<=100;k++){sample(clip.name,k/100);for(const bone of meshes[0].skeleton.bones){const q=bone.getWorldQuaternion(new THREE.Quaternion());if(previous.has(bone.name)){const delta=q.angleTo(previous.get(bone.name));if(delta>maxAngularStep){maxAngularStep=delta;angularWorst={clip:clip.name,bone:bone.name,t:k/100};}}previous.set(bone.name,q);}}}
 result.maxAngularStep=maxAngularStep;result.angularWorst=angularWorst;console.log(id,maxAngularStep,angularWorst);assert(maxAngularStep<1.1,`${id}: rotation snaps or reverses between adjacent samples`);
 reports[id]=result;
}
await fs.writeFile('output/enemy-models/roster-action-validation.json',JSON.stringify(reports,null,2));console.log(reports);console.log('NEW_ROSTER_VERIFIED: phase-aligned forward contact, overhead arc, dual grip, planted extraction, low tail strike, rigid sword/shield, mantis separation and parry feedback');

const {Battle}=await import('../src/battle.js');const {createEnemyView}=await import('../src/enemy-view.js');
for(const id of ['mirrorGuard','samurai','scythemoth','spitter']){
 const battle=new Battle();battle.reset(id);const e=battle.enemy,view=createEnemyView(new THREE.Scene()),camera=new THREE.PerspectiveCamera();
 const move=id==='samurai'?Object.values((await import('../src/samurai.js')).SAMURAI_MOVES)[0][0]:battle.enemyStats.moves[0];
 Object.assign(e,{move,state:'windup',elapsed:move.prepare+move.swing*.7,telegraph:move.prepare,swingDuration:move.swing,windup:move.windup,flash:0});view.update(battle,camera,1/60);const root=view.monsterVisuals.entries[id].root;
 if(id==='mirrorGuard'){e.move=battle.enemyStats.moves[1];e.elapsed=.1;view.update(battle,camera,1/60);assert(root.getObjectByName('mirror_parry_halo').visible);e.parryGlowUntil=1;e.parryFeedbackStart=0;view.update(battle,camera,1/60);assert.equal(root.getObjectByName('mirror_parry_halo').material.color.getHex(),0xd7b866);}
 if(id==='samurai'){assert(root.getObjectByName('samurai_blade_trail').visible);const blade=root.getObjectByName('samurai_blade');assert.equal(blade.material.emissive.getHex(),0xc32d24);e.state='idle';view.update(battle,camera,1/60);assert(!root.getObjectByName('samurai_blade_trail').visible);assert.equal(blade.material.emissive.getHex(),0x345c86);}
 if(id==='scythemoth'){assert(root.getObjectByName('mantis_left_trail').visible);assert(!root.getObjectByName('mantis_right_trail').visible);}
 if(id==='spitter'){e.elapsed=move.prepare*.9;view.update(battle,camera,1/60);assert(root.getObjectByName('spitter_muzzle_charge').visible);}
}
console.log('NEW_ROSTER_EFFECTS_VERIFIED: parry halo/gold feedback, blade warning/trails, independent mantis blades and muzzle charge survive model replacement');
