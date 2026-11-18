// Use the demo's exact action split and the exported skin to check facial pokes.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { AnimationMixer, Vector3, Ray, LoopOnce } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createModelActions } from '../src/assets.js';
import { ActionBlend } from '../src/action-blend.js';
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};};
const bytes=await fs.readFile(process.argv[2]??new URL('../output/frog.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const skins=[];let face;
gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);if(o.isBone&&o.name==='face')face=o;});
gltf.scene.updateMatrixWorld(true);
const helpers=skins.filter(o=>/^Frog_(?:eyelid|mouth|laugh)_/.test(o.name));
const hasRealMouth=skins.some(o=>o.material.name==='Frog oral lining');
const body=skins.filter(o=>!helpers.includes(o));
if(process.argv.includes('--check-lip-seam')){
 assert(!gltf.scene.getObjectByName('Frog_fine_mouth_contour'),'Standalone dark contour mesh is still present');
 assert(!skins.some(mesh=>mesh.material.name==='Frog dark mouth contour'));
 const lip=skins.find(mesh=>mesh.material.name==='Frog mouth skin');
 const lining=skins.find(mesh=>mesh.material.name==='Frog oral lining');
 const coordinate=(mesh,i)=>new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).toArray().map(v=>v.toFixed(7)).join(',');
 const edge=(a,b)=>[a,b].sort().join('|');
 const liningEdges=new Set(boundaryLoops(lining).flatMap(loop=>{
  const members=new Set(loop),out=[];
  for(let i=0;i<lining.geometry.index.count;i+=3){
   const face=[0,1,2].map(j=>lining.geometry.index.getX(i+j));
   for(let j=0;j<3;j++)if(members.has(face[j])&&members.has(face[(j+1)%3]))out.push(edge(coordinate(lining,face[j]),coordinate(lining,face[(j+1)%3])));
  }
  return out;
 }));
 const liningByPosition=new Map();
 for(let i=0;i<lining.geometry.attributes.position.count;i++)liningByPosition.set(coordinate(lining,i),i);
 const seam=boundaryLoops(lip).find(loop=>loop.length===30&&loop.every(i=>liningByPosition.has(coordinate(lip,i))));
 assert(seam,'Expected the welded 30-point lip border in the exported asset');
 const seamSet=new Set(seam);
 for(let i=0;i<lip.geometry.index.count;i+=3){
  const face=[0,1,2].map(j=>lip.geometry.index.getX(i+j));
  for(let j=0;j<3;j++)if(seamSet.has(face[j])&&seamSet.has(face[(j+1)%3]))assert(liningEdges.has(edge(coordinate(lip,face[j]),coordinate(lip,face[(j+1)%3]))),'Split primitive has a missing shared lip edge');
 }
 let maxGap=0;
 const clip=gltf.animations.find(clip=>clip.name==='Laugh');
 const testMixer=new AnimationMixer(gltf.scene),play=testMixer.clipAction(clip).setLoop(LoopOnce,1);
 play.play();
 for(let frame=0;frame<=240;frame++){
  testMixer.setTime(Math.min(clip.duration-1e-6,clip.duration*frame/240));
  gltf.scene.updateMatrixWorld(true);
  for(const i of seam){
   const j=liningByPosition.get(coordinate(lip,i));
   const a=lip.getVertexPosition(i,new Vector3()).applyMatrix4(lip.matrixWorld);
   const b=lining.getVertexPosition(j,new Vector3()).applyMatrix4(lining.matrixWorld);
   maxGap=Math.max(maxGap,a.distanceTo(b));
  }
 }
 assert(maxGap<1e-6,`Oral lining separates from lip by ${maxGap}`);
 console.log('EXPORTED_LIP_SEAM_VERIFIED',{points:seam.length,samples:241,maxGap});
 testMixer.stopAllAction();
 gltf.scene.updateMatrixWorld(true);
}
const bindFace=face.matrixWorld.clone(),bindMeshInverse=body[0].matrixWorld.clone().invert();
const mixer=new AnimationMixer(gltf.scene);const {actions,faceActions}=createModelActions(gltf.animations,mixer);
const ray=new Ray(new Vector3(),new Vector3(0,0,-1)),hit=new Vector3();
function positions(obj,map){return Array.from({length:obj.geometry.attributes.position.count},(_,i)=>obj.getVertexPosition(i,new Vector3()).applyMatrix4(obj.matrixWorld).applyMatrix4(map));}
function triangles(obj,v){const idx=obj.geometry.index;const result=[];for(let i=0;i<idx.count;i+=3){const a=v[idx.getX(i)],b=v[idx.getX(i+1)],c=v[idx.getX(i+2)];if(Math.max(a.y,b.y,c.y)<.80)continue;result.push({a,b,c,x0:Math.min(a.x,b.x,c.x),x1:Math.max(a.x,b.x,c.x),y0:Math.min(a.y,b.y,c.y),y1:Math.max(a.y,b.y,c.y)});}return result;}
function front(tris,p){ray.origin.set(p.x,p.y,5);let z=-Infinity;for(const t of tris){if(p.x<t.x0-1e-7||p.x>t.x1+1e-7||p.y<t.y0-1e-7||p.y>t.y1+1e-7)continue;if(ray.intersectTriangle(t.a,t.b,t.c,false,hit))z=Math.max(z,hit.z);}return z;}
function boundaryLoops(obj){
 const edges=new Map(),idx=obj.geometry.index;
 for(let i=0;i<idx.count;i+=3){const v=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];for(let j=0;j<3;j++){const a=v[j],b=v[(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');edges.set(key,(edges.get(key)||0)+1);}}
 const neighbors=new Map();for(const [key,count] of edges){if(count!==1)continue;const [a,b]=key.split(',').map(Number);for(const [v,w] of [[a,b],[b,a]]){if(!neighbors.has(v))neighbors.set(v,[]);neighbors.get(v).push(w);}}
 const visited=new Set(),loops=[];for(const start of neighbors.keys()){if(visited.has(start))continue;const loop=[],stack=[start];while(stack.length){const v=stack.pop();if(visited.has(v))continue;visited.add(v);loop.push(v);stack.push(...neighbors.get(v));}loops.push(loop);}return loops;
}
function sample(minima){
 gltf.scene.updateMatrixWorld(true);for(const s of skins)s.skeleton.update();
 const map=bindMeshInverse.clone().multiply(bindFace).multiply(face.matrixWorld.clone().invert());
 const tris=body.flatMap(o=>triangles(o,positions(o,map)));let checked=0;
 const helperTriangles={};
 for(const obj of helpers){
  if(hasRealMouth && ['Frog_laugh_tongue','Frog_laugh_teeth'].includes(obj.name))continue;
  if(Math.max(...obj.morphTargetInfluences)<.002)continue;
  const v=positions(obj,map),ts=triangles(obj,v);helperTriangles[obj.name]=ts;
  for(const t of ts){
   if(t.b.clone().sub(t.a).cross(t.c.clone().sub(t.a)).length()<1e-11)continue;
   for(const p of [t.a,t.b,t.c,t.a.clone().add(t.b).add(t.c).multiplyScalar(1/3)]){
    const z=front(tris,p);assert(Number.isFinite(z),`Face ray missed ${obj.name}`);
    const clearance=p.z-z;minima[obj.name]=Math.min(minima[obj.name]??1,clearance);checked++;
    assert(clearance>-.0001,`${obj.name} penetrates skin: ${clearance}`);
   }
  }
 }
 return checked;
}
const report={};
for(const kind of ['BlinkIdle','BlinkWalk','LaughStandalone','LaughCrossfade','LaughWalkCrossfade','LaughRunCrossfade']){
 const blend=new ActionBlend();
 mixer.stopAllAction();mixer.setTime(0);
 for(const a of [...Object.values(actions),...Object.values(faceActions)])a.reset().setEffectiveWeight(1);
 const duration=kind.startsWith('Blink')?actions.Blink.getClip().duration:actions.Laugh.getClip().duration;
 if(kind.startsWith('Blink')){actions[kind==='BlinkWalk'?'Walk':'Idle'].play();actions.Blink.setLoop(LoopOnce,1).play();}
 else {const base=actions[kind.includes('Walk')?'Walk':kind.includes('Run')?'Run':'Idle'];base.play();actions.Laugh.setLoop(LoopOnce,1).play();faceActions.Laugh.setLoop(LoopOnce,1).play();if(kind.endsWith('Crossfade')){blend.to(base,.18);blend.to(actions.Laugh,.18);}else base.stop();}
 const minima={};let checked=0;
 for(let i=0;i<=84;i++){if(kind.endsWith('Crossfade'))blend.update(i?duration/84:0);mixer.setTime(duration*i/84);checked+=sample(minima);}
 report[kind]={samples:85,surfacePointsChecked:checked,minimumClearance:minima};
 console.log(kind,'valid',checked);
}
if(hasRealMouth){
 const lining=skins.find(o=>o.material.name==='Frog oral lining');
 const wallBoundaries=boundaryLoops(lining);assert(wallBoundaries.length===2,'Mouth lining should have two closed boundary loops');
 const tongue=skins.find(o=>o.name==='Frog_laugh_tongue');const teeth=skins.find(o=>o.name==='Frog_laugh_teeth');const depths=[],heights=[];let visibleDentalSamples=0;
 mixer.stopAllAction();mixer.setTime(0);actions.Laugh.reset().setEffectiveWeight(1).setLoop(LoopOnce,1).play();faceActions.Laugh.reset().setEffectiveWeight(1).setLoop(LoopOnce,1).play();
 for(const t of Array.from({length:207},(_,i)=>actions.Laugh.getClip().duration*i/206)){
  mixer.setTime(t);gltf.scene.updateMatrixWorld(true);for(const s of skins)s.skeleton.update();
  const mouthMesh=body.find(o=>o.morphTargetDictionary?.LaughOpen!==undefined);
  if((mouthMesh?.morphTargetInfluences[mouthMesh.morphTargetDictionary.LaughOpen]??0)<.12)continue;
  const map=bindFace.clone().multiply(face.matrixWorld.clone().invert());
  const wall=positions(lining,map),zmax=Math.max(...wall.map(p=>p.z));
  const lip=wallBoundaries.map(ids=>ids.map(i=>wall[i])).sort((a,b)=>b.reduce((s,p)=>s+p.z,0)/b.length-a.reduce((s,p)=>s+p.z,0)/a.length)[0];const x=lip.reduce((a,p)=>a+p.x,0)/lip.length;
  const top=Math.max(...lip.map(p=>p.y)),bottom=Math.min(...lip.map(p=>p.y));const middle=(top+bottom)/2;
  const tris=body.flatMap(o=>triangles(o,positions(o,map)));const back=front(tris,new Vector3(x,middle,0));const depth=zmax-back;
  assert(depth>.015,`Physical mouth blocked in GLB at ${t}: ${depth}`);depths.push(depth);heights.push(top-bottom);
  function inside(p,poly){let result=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;}return result;}
  const tip=positions(tongue,map);assert(Math.max(...tip.map(p=>p.z))<zmax-.005,'Tongue protrudes out of mouth');
  if(teeth){
   const crowns=positions(teeth,map);
   for(const p of crowns)if(!inside(p,lip))assert(front(tris,p)>=p.z-.00015,`Dental crown leaks outside aperture at ${t}: ${p.toArray()}`);
   assert(Math.max(...crowns.map(p=>p.z))<zmax-.003,'Teeth protrude out of mouth');
   const x0=Math.min(...tip.map(p=>p.x)),x1=Math.max(...tip.map(p=>p.x));const nearCrowns=[];
   for(let j=0;j<crowns.length;j+=16){const tooth=crowns.slice(j,j+16);if(Math.min(...tooth.map(p=>p.x))<=x1 && Math.max(...tooth.map(p=>p.x))>=x0)nearCrowns.push(...tooth);}
   const dentalGap=Math.min(...nearCrowns.map(p=>p.z))-Math.max(...tip.map(p=>p.z));
   assert(dentalGap>.002,`Tongue intersects teeth in GLB at ${t}: ${dentalGap}`);

   if(crowns.some(p=>front(tris,p)<p.z-.001))visibleDentalSamples++;
  }
 }
 report.trueMouth={samples:depths.length,openingDepthRange:[Math.min(...depths),Math.max(...depths)],openingHeightRange:[Math.min(...heights),Math.max(...heights)],volumetricTongue:true};
 console.log('TRUE_MOUTH_GLB_VALID',report.trueMouth);
 if(teeth){
  assert(visibleDentalSamples>0,'Teeth do not appear in Laugh');
  mixer.setTime(0);gltf.scene.updateMatrixWorld(true);for(const s of skins)s.skeleton.update();
  const map=bindFace.clone().multiply(face.matrixWorld.clone().invert());const tris=body.flatMap(o=>triangles(o,positions(o,map)));
  for(const p of positions(teeth,map))assert(front(tris,p)>=p.z-.0001,'Teeth exposed through closed face');
  report.simpleTeeth={vertices:teeth.geometry.attributes.position.count,visibleDentalSamples,hiddenWhenClosed:true};console.log('SIMPLE_TEETH_GLB_VALID',report.simpleTeeth);
 }
}
// Closed-mouth regression across the whole action library, including flips.
if(hasRealMouth){
 const teeth=skins.find(o=>o.name==='Frog_laugh_teeth');
 const tongue=skins.find(o=>o.name==='Frog_laugh_tongue');
 const counts={};
 for(const clip of gltf.animations){
  mixer.stopAllAction();mixer.setTime(0);
  const action=mixer.clipAction(clip).reset().setEffectiveWeight(1).setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
  let checked=0;
  for(let i=0;i<=12;i++){
   mixer.setTime(clip.duration*i/12);gltf.scene.updateMatrixWorld(true);for(const obj of skins)obj.skeleton.update();
   const open=body.find(o=>o.morphTargetDictionary?.LaughOpen!==undefined);
   const amount=open?.morphTargetInfluences[open.morphTargetDictionary.LaughOpen]??0;
   if(amount>.0001)continue;
   const map=bindFace.clone().multiply(face.matrixWorld.clone().invert());
   const tris=body.flatMap(o=>triangles(o,positions(o,map)));
   for(const obj of [teeth,tongue])for(const p of positions(obj,map)){
    const skin=front(tris,p);
    assert(Number.isFinite(skin)&&skin>=p.z-.00015,`${obj.name} exposed in closed ${clip.name} at ${i}/12: ${p.z-skin}`);
    checked++;
   }
  }
  counts[clip.name]=checked;
 }
 report.closedMouthLibrary={clips:Object.keys(counts).length,points:counts};
 console.log('ALL_ACTIONS_CLOSED_MOUTH_VALID',report.closedMouthLibrary.clips);
}
// R/cancel restores the neutral mouth immediately while the body blends out.
if(hasRealMouth){
 const parts=skins.filter(o=>['Frog_laugh_teeth','Frog_laugh_tongue'].includes(o.name));
 const cases={};
 for(const target of ['Idle','Walk','Run']){
  mixer.stopAllAction();mixer.setTime(0);
  actions.Laugh.reset().setEffectiveWeight(1).setLoop(LoopOnce,1).play();
  faceActions.Laugh.reset().setEffectiveWeight(1).setLoop(LoopOnce,1).play();
  const time=actions.Laugh.getClip().duration*.48;mixer.setTime(time);
  const blend=new ActionBlend();blend.to(actions.Laugh,.14);
  actions[target].reset().setEffectiveWeight(0).play();blend.to(actions[target],.14);faceActions.Laugh.stop();
  let checked=0;
  for(let i=0;i<=18;i++){
   blend.update(i?1/120:0);mixer.update(i?1/120:0);sample({});
   const map=bindFace.clone().multiply(face.matrixWorld.clone().invert());
   const tris=body.flatMap(o=>triangles(o,positions(o,map)));
   for(const obj of parts)for(const p of positions(obj,map)){
    assert(front(tris,p)>=p.z-.00015,`Cancelled Laugh leaks ${obj.name} into ${target}`);checked++;
   }
  }
  cases[target]=checked;
 }
 report.cancelledLaugh=cases;console.log('CANCELLED_LAUGH_MOUTH_VALID',cases);
}
await fs.writeFile(new URL('../output/animations/threejs-face-verification.json',import.meta.url),JSON.stringify(report,null,2));
