import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createRiggedEnemy,registerEnemyModel} from '../src/enemy-models.js';
import {createMonsterEffects} from '../src/monster-effects.js';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const bytes=await fs.readFile('docs/sarumai.glb'),g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
registerEnemyModel('samurai',g);
for(const [name,phase,state,elapsed] of [['phase1',1,'idle',0],['phase2',2,'idle',0],['phase3',3,'idle',0],['lightning',2,'transition',2.2]]){
 const actor=createRiggedEnemy('samurai');assert(actor.ready);
 const fx=createMonsterEffects('samurai'),world=new T.Scene();world.add(actor.root);actor.root.add(fx.root);
 const e={health:2200,phase,state,elapsed,transitionDuration:5,transitionStrikeAt:2.2,transitionHit:state==='transition',lightningAt:state==='transition'?10:-Infinity};
 actor.animate(e,10);world.updateMatrixWorld(true);fx.animate(e,10,0,0,0,actor.model);world.updateMatrixWorld(true);
 const aura=fx.root.getObjectByName('samurai_orbiting_blade_glow');assert.equal(aura.visible,phase>=2);
 const phase2=fx.root.getObjectByName('phase2_full_orbits'),phase3=fx.root.getObjectByName('phase3_full_orbits');
 assert.equal(phase2.visible,phase===2);assert.equal(phase3.visible,phase===3);
 for(const group of [phase2,phase3]){
  const bounds=new T.Box3().setFromBufferAttribute(group.children[0].geometry.attributes.position);
  assert(bounds.min.y>.15&&bounds.max.y<1.70,'Aura reaches the guard/hand or extends past the blade tip');
  const color=group.children[0].material.color;assert(color.r>color.g&&color.g>color.b,'Aura should be yellow');
 }
 assert(phase3.children.length>phase2.children.length,'Phase three needs more strands');
 assert(phase3.children[0].geometry.parameters.radius>phase2.children[0].geometry.parameters.radius,'Phase three needs thicker strands');
 assert(phase3.userData.orbitSpeed>phase2.userData.orbitSpeed,'Phase three should orbit faster');
 if(phase>=2){
  const group=phase>=3?phase3:phase2,orbs=group.getObjectByName('flow_lights_core'),matrix=new T.Matrix4(),before=new T.Vector3();
  orbs.getMatrixAt(0,matrix);before.setFromMatrixPosition(matrix);
  group.userData.updateFlow(10.2);orbs.getMatrixAt(0,matrix);
  assert(before.distanceTo(new T.Vector3().setFromMatrixPosition(matrix))>.01,'Light orbs do not flow along the tracks');
  for(let i=0;i<orbs.count;i++){
   orbs.getMatrixAt(i,matrix);const point=new T.Vector3().setFromMatrixPosition(matrix);
   assert(point.y>=.20&&point.y<=1.64,'Light orb leaves the blade section');
   const path=group.children[Math.floor(i/2)*2].geometry.parameters.path;let nearest=Infinity;
   for(let k=0;k<=150;k++)nearest=Math.min(nearest,point.distanceTo(path.getPointAt(k/150)));
   assert(nearest<.025,'Light orb leaves its winding track');
  }
 }
 const bolt=fx.root.getObjectByName('samurai_sky_lightning');assert.equal(bolt.visible,state==='transition');
 if(state==='transition'){
  const tip=actor.model.getObjectByName('blade').localToWorld(new T.Vector3(0,1.58,0));
  assert(tip.distanceTo(bolt.getWorldPosition(new T.Vector3()))<1e-5,'Lightning misses the raised blade tip');
 }
 const output=new T.Scene();
 fx.root.traverseVisible(o=>{
  if(!o.isMesh||o.material.isShaderMaterial)return;
  const mat=new T.MeshStandardMaterial({color:o.material.color,emissive:o.material.color,emissiveIntensity:.8,transparent:true,opacity:o.material.opacity,roughness:.7});
  for(let i=0;i<(o.isInstancedMesh?o.count:1);i++){
   const matrix=o.matrixWorld.clone();
   if(o.isInstancedMesh){const instance=new T.Matrix4();o.getMatrixAt(i,instance);matrix.multiply(instance);}
   const geo=o.geometry.clone();geo.applyMatrix4(matrix);output.add(new T.Mesh(geo,mat));
  }
 });
 if(name!=='phase1')await fs.writeFile(`output/samurai-${name}-fx.glb`,Buffer.from(await new GLTFExporter().parseAsync(output,{binary:true})));
 if(state==='transition'){fx.animate(e,10.4,0,0,0,actor.model);assert(!bolt.visible,'Lightning does not fade');}
}
console.log('SAMURAI_PHASE_EFFECTS_VERIFIED: blade-only yellow orbits, flowing light orbs, stronger phase three and lightning alignment');
