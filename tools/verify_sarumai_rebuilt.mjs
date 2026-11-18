import assert from 'node:assert/strict';import fs from 'node:fs/promises';import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {createRiggedEnemy,registerEnemyModel,ENEMY_MODEL_PROFILES} from '../src/enemy-models.js';import {createMonsterEffects} from '../src/monster-effects.js';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
const bytes=await fs.readFile('docs/sarumai.glb');const g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');registerEnemyModel('samurai',g);const enemy=createRiggedEnemy('samurai');assert(enemy.ready);const effects=createMonsterEffects('samurai');const scene=new THREE.Scene();scene.add(enemy.root,effects.root);const mixer=new THREE.AnimationMixer(g.scene);let maxAngle=0,maxWalkUpperError=0;
const sample=(name,phase)=>{mixer.stopAllAction();const c=g.animations.find(c=>c.name===name);assert(c,name);const a=mixer.clipAction(c);a.play();a.time=Math.min(c.duration-1e-6,phase*c.duration);mixer.update(0);g.scene.updateMatrixWorld(true);};
const head=n=>g.scene.getObjectByName(n).getWorldPosition(new THREE.Vector3());
const tail=n=>{const b=g.scene.getObjectByName(n),h=b.userData.source_rest_head,t=b.userData.source_rest_tail;assert(h&&t,n);return b.localToWorld(new THREE.Vector3(0,new THREE.Vector3(...h).distanceTo(new THREE.Vector3(...t)),0));};
sample('Idle',0);const upperNames=['head','chest','upper_arm_L','upper_arm_R','forearm_L','forearm_R','hand_L','hand_R','blade'];const upper=new Map(upperNames.map(n=>[n,g.scene.getObjectByName(n).matrixWorld.clone()]));
for(const clip of g.animations)for(let f=0;f<=60;f++){
 sample(clip.name,f/60);
 for(const side of ['L','R']){const fore=tail('forearm_'+side).sub(head('forearm_'+side));for(let d=0;d<5;d++){const dir=tail(`finger_${side}_${d}_${d===0?1:2}`).sub(head(`finger_${side}_${d}_0`));const angle=THREE.MathUtils.radToDeg(dir.angleTo(fore));maxAngle=Math.max(maxAngle,angle);assert(angle<=60.02,`${clip.name} ${f}: finger ${side}${d}: ${angle}`);}}
 if(clip.name==='Walk')for(const n of upperNames){const a=upper.get(n).elements,b=g.scene.getObjectByName(n).matrixWorld.elements;for(let i=0;i<16;i++)maxWalkUpperError=Math.max(maxWalkUpperError,Math.abs(a[i]-b[i]));}
 g.scene.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite),`${clip.name}: invalid transform`));
}
assert(maxWalkUpperError<1e-4,'Walking changes the ready upper body');
for(const motion of Object.keys(ENEMY_MODEL_PROFILES.samurai.motions))for(const state of ['windup','recover','idle'])for(let f=0;f<=60;f++){
 const e={state,move:{motion},elapsed:f/60,telegraph:.45,swingDuration:.25,recovery:.5,health:100};enemy.animate(e,f/60);effects.animate(e,f/60,.5,.5,.5,enemy.model);
}
const report={animations:g.animations.map(c=>c.name),maxFingerAngle:maxAngle,maxWalkUpperMatrixError:maxWalkUpperError,runtimeEffects:'passed'};await fs.writeFile('output/sarumai-three-animation-validation.json',JSON.stringify(report,null,2));console.log(report);
