import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {gameFixture} from './game_fixture.mjs';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const g=await gameFixture(60,{home:true,equipment:true,run:true});g.read('openRestSite(()=>{})');
const scene=new THREE.Scene(),point=new THREE.Vector3();
for(const root of g.read('[player,restSite.group]')){
 root.updateWorldMatrix(true,true);root.traverseVisible(object=>{
  if(!object.isMesh)return;object.skeleton?.update();const geometry=object.geometry.clone(),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){object.getVertexPosition(i,point).applyMatrix4(object.matrixWorld);positions.setXYZ(i,point.x,point.y,point.z);}
  delete geometry.morphAttributes.position;delete geometry.morphAttributes.normal;geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.computeVertexNormals();
  const mat=object.material.clone();if(mat.map){mat.name=`SourceMaterial::${mat.name}`;mat.map=null;}scene.add(new THREE.Mesh(geometry,mat));
 });
}
await fs.writeFile('output/rest-site-review.glb',Buffer.from(await new GLTFExporter().parseAsync(scene,{binary:true})));console.log('REST_REVIEW_EXPORTED');
