// Export the actual runtime primitive enemy for offline visual inspection.
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createEnemyView} from '../src/enemy-view.js';
import {Battle} from '../src/battle.js';
import {beginBossSequence} from '../src/samurai.js';
globalThis.FileReader=class {
 readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
};
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,2,6);camera.lookAt(0,.8,0);camera.updateMatrixWorld(true);
const view=createEnemyView(scene),battle=new Battle();battle.enemy.x=0;battle.enemy.z=0;battle.enemy.heading=0;
for(const state of (process.argv.length>2?process.argv.slice(2):['idle','windup'])) {
 const boss=state.startsWith('samurai');battle.reset(boss?'samurai':'practice');battle.enemy.x=0;battle.enemy.z=0;battle.enemy.heading=0;
 if(boss&&state!=='samurai-idle'){
  const pattern=['quick','mixed','thrust','sweep'].find(name=>state.includes(name))??'delay';
  beginBossSequence(battle,pattern);battle.enemy.elapsed=battle.enemy.telegraph*.9;
  if(state.includes('contact'))battle.enemy.elapsed=battle.enemy.windup;
  if(state.includes('follow')){battle.enemy.state='recover';battle.enemy.recovery=.36;battle.enemy.elapsed=.1;}
 }
 else{battle.enemy.state=boss?'idle':state;battle.enemy.elapsed=state==='windup'?.6:0;}
 battle.time=.12;
 view.update(battle,camera,0);scene.updateMatrixWorld(true);
 const data=await new GLTFExporter().parseAsync(scene,{binary:true});
 await fs.writeFile(new URL(`../output/animations/enemy-${state}-review.glb`,import.meta.url),Buffer.from(data));
}
console.log('ENEMY_REVIEW_EXPORTED');
