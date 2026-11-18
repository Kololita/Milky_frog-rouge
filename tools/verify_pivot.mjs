import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {AnimationMixer,LoopOnce,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {pivotTurn} from '../src/movement.js';
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};};
const data=await fs.readFile(new URL('../output/frog.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
const mixer=new AnimationMixer(gltf.scene),skins=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);});
const bone=n=>gltf.scene.getObjectByName(n.replaceAll('.',''));
const point=n=>bone(n).getWorldPosition(new Vector3());
const report={};
for(const [name,sign] of [['PivotLeft',1],['PivotRight',-1]]) {
 const clip=gltf.animations.find(c=>c.name===name);assert(clip);
 mixer.stopAllAction();const action=mixer.clipAction(clip).reset().setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
 const samples=[];let minSkinY=Infinity,maxStepHeight=0;
 for(let i=0;i<=120;i++) {
  const phase=i/120;mixer.setTime(phase*clip.duration);gltf.scene.updateMatrixWorld(true);
  for(const skin of skins) {
   skin.skeleton.update();
   for(let v=0;v<skin.geometry.attributes.position.count;v++) {
    const p=skin.getVertexPosition(v,new Vector3()).applyMatrix4(skin.matrixWorld);
    assert([p.x,p.y,p.z].every(Number.isFinite));minSkinY=Math.min(minSkinY,p.y);
   }
  }
  samples.push(Object.fromEntries(['foot.L','foot.R','shin.L','shin.R','thigh.L','thigh.R'].map(n=>[n,point(n)])));
 }
 const firstSide=sign>0?'R':'L',secondSide=sign>0?'L':'R';
 const lift=s=>Math.max(...samples.map(p=>p['foot.'+s].y))-samples[0]['foot.'+s].y;
 for(const side of ['L','R']) assert(lift(side)>.025,`${name}: ${side} never lifts for a step`);
 const peak=s=>samples.reduce((best,p,i)=>p['foot.'+s].y>samples[best]['foot.'+s].y?i:best,0)/120;
 assert(peak(firstSide)<peak(secondSide),`${name}: footfalls not staggered`);
 const center=samples[0]['foot.L'].clone().add(samples[0]['foot.R']).multiplyScalar(.5);
 const world=(p,phase)=>p.clone().sub(center).applyAxisAngle(new Vector3(0,1,0),sign*Math.PI*pivotTurn(phase)).add(center);
 // During the second foot's planted interval the character rotates above it.
 const planted=samples.slice(28,65).map((p,i)=>world(p['foot.'+secondSide],(28+i)/120));
 assert(Math.max(...planted.map(p=>p.distanceTo(planted[0])))<.025,`${name}: planted foot slides excessively`);
 assert(minSkinY>-.035,`${name}: floor penetration ${minSkinY}`);
 report[name]={duration:clip.duration,firstStep:firstSide,firstPeak:peak(firstSide),secondPeak:peak(secondSide),footLifts:{L:lift('L'),R:lift('R')},minimumSkinY:minSkinY,groundedPivot:true};
}
await fs.writeFile(new URL('../output/animations/pivot-verification.json',import.meta.url),JSON.stringify(report,null,2));console.log('PIVOTS_VERIFIED',report);
