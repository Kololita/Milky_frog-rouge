import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {gameFixture} from './game_fixture.mjs';
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const g=await gameFixture(60),point=new THREE.Vector3();
for(const [name,time] of [['grab',.2],['carry',.7],['throw',1.1],['apex',1.25],['sit',1.65],['flip',2.35],['rise',4.6]]){
 g.reset();g.read('battle.reset("samurai");battle.enemy.z=1.05;battle.enemy.heading=0;');g.tap('KeyJ');g.tick(time);
 const scene=new THREE.Scene();
 for(const root of g.read('[player,enemyView.body]')){
  root.updateWorldMatrix(true,true);
  root.traverseVisible(object=>{
   if(!object.isMesh)return;object.skeleton?.update();const geometry=object.geometry.clone(),positions=geometry.attributes.position;
   for(let i=0;i<positions.count;i++){object.getVertexPosition(i,point);point.applyMatrix4(object.matrixWorld);positions.setXYZ(i,point.x,point.y,point.z);}
   geometry.morphAttributes={};geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.computeVertexNormals();
   const material=Array.isArray(object.material)?object.material.map(m=>m.clone()):object.material.clone();
   for(const m of Array.isArray(material)?material:[material])if(m.map){m.name=`SourceMaterial::${m.name}`;m.map=null;}
   scene.add(new THREE.Mesh(geometry,material));
  });
 }
 const data=await new GLTFExporter().parseAsync(scene,{binary:true});
 await fs.writeFile(new URL(`../output/animations/backthrow-${name}-review.glb`,import.meta.url),Buffer.from(data));
}
console.log('BACKTHROW_REVIEW_EXPORTED');
