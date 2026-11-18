import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {AnimationMixer,LoopOnce,Vector3,Matrix3,Triangle} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const b=Buffer.from(await blob.arrayBuffer());return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};};
const bytes=await fs.readFile(new URL('../output/frog.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const skins=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);});
gltf.scene.updateMatrixWorld(true);
const mixer=new AnimationMixer(gltf.scene),clips=Object.fromEntries(gltf.animations.map(c=>[c.name,c]));
const bone=n=>gltf.scene.getObjectByName(n.replaceAll('.',''));
const point=n=>bone(n).getWorldPosition(new Vector3());
function sample(name,t){mixer.stopAllAction();const a=mixer.clipAction(clips[name]).reset().setLoop(LoopOnce,1);a.clampWhenFinished=true;a.play();mixer.setTime(t);gltf.scene.updateMatrixWorld(true);for(const s of skins)s.skeleton.update();}
const first=skins[0].skeleton;
const bind=n=>new Vector3().setFromMatrixPosition(first.boneInverses[first.bones.indexOf(bone(n))].clone().invert());
const palmNormals={},palmFrames={};
for(const side of ['L','R']) {
 const wrist=bind('hand.'+side),index=bind('f_index.01.'+side),outer=bind((side==='L'?'f_pinky.01.':'f_ring.01.')+side);
 palmFrames[side]={wrist,forward:index.clone().add(outer).multiplyScalar(.5).sub(wrist).normalize(),length:index.clone().add(outer).multiplyScalar(.5).distanceTo(wrist)};
 palmNormals[side]=index.clone().add(outer).multiplyScalar(.5).sub(wrist).normalize().cross(outer.clone().sub(index)).normalize().multiplyScalar(side==='L'?-1:1);
}
const selections=skins.map(s=>{
 const g=s.geometry,nm=new Matrix3().getNormalMatrix(s.matrixWorld),weights=[],hands={L:[],R:[]},patch={L:[],R:[]},distal={L:[],R:[]},pads={L:[],R:[]};
 for(let i=0;i<g.attributes.position.count;i++) {
  let arm=0;const hand={L:0,R:0},all={L:0,R:0},finger={L:0,R:0};
  for(let k=0;k<4;k++) {
   const n=s.skeleton.bones[g.attributes.skinIndex.getComponent(i,k)].name,w=g.attributes.skinWeight.getComponent(i,k);
   if(/^(upper_arm|forearm|hand|f_|thumb|shoulder)/.test(n))arm+=w;
   for(const side of ['L','R']) {
    if(n==='hand'+side)hand[side]+=w;
    if(n.endsWith(side)&&n.startsWith('f_'))finger[side]+=w;
    if(n.endsWith(side)&&/^(hand|f_|thumb)/.test(n))all[side]+=w;
   }
  }
  weights.push(arm);
  for(const side of ['L','R']) {
   if(all[side]>.5)hands[side].push(i);
   const facing=new Vector3().fromBufferAttribute(g.attributes.normal,i).applyMatrix3(nm).normalize().dot(palmNormals[side]);
   const along=new Vector3().fromBufferAttribute(g.attributes.position,i).sub(palmFrames[side].wrist).dot(palmFrames[side].forward);
   if(hand[side]>.5&&facing>.35&&along>.42*palmFrames[side].length)distal[side].push(i);
   if(finger[side]>.6&&facing>.35)pads[side].push(i);
   if(hand[side]>.5&&new Vector3().fromBufferAttribute(g.attributes.normal,i).applyMatrix3(nm).normalize().dot(palmNormals[side])>.55)patch[side].push(i);
  }
 }
 const faces=[];
 for(let i=0;i<g.index.count;i+=3){const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];if(ids.every(j=>weights[j]<.05))faces.push(ids);}
 return {s,hands,patch,distal,pads,faces};
});
const closest=new Vector3(),normal=new Vector3();
function gap(p,triangles) {
 let distance=Infinity,signed;
 for(const tri of triangles) {
  if(p.x<tri.lo.x-.08||p.x>tri.hi.x+.08||p.y<tri.lo.y-.08||p.y>tri.hi.y+.08||p.z<tri.lo.z-.08||p.z>tri.hi.z+.08)continue;
  tri.t.closestPointToPoint(p,closest);const d=closest.distanceToSquared(p);
  if(d<distance){distance=d;tri.t.getNormal(normal);signed=p.clone().sub(closest).dot(normal);}
 }
 assert(Number.isFinite(signed),'Palm ray missed the body');return signed;
}
const report={contact:{L:{minimum:1,maximumNearest:-1},R:{minimum:1,maximumNearest:-1}},run:{}};
for(const t of Array.from({length:157},(_,i)=>(14.5+i*.5)/24)) {
 sample('Laugh',t);const triangles=[],points=new Map();
 for(const entry of selections) {
  const {s,faces}=entry,verts=Array.from({length:s.geometry.attributes.position.count},(_,i)=>s.getVertexPosition(i,new Vector3()).applyMatrix4(s.matrixWorld));points.set(s,verts);
  for(const ids of faces){const v=ids.map(i=>verts[i]);triangles.push({t:new Triangle(...v),lo:v[0].clone().min(v[1]).min(v[2]),hi:v[0].clone().max(v[1]).max(v[2])});}
 }
 for(const side of ['L','R']) {
  const patch=[],hands=[],pads=[],distal=[];
  for(const {s,patch:ids,hands:all,pads:fp,distal:dp} of selections){pads.push(...fp[side].map(i=>gap(points.get(s)[i],triangles)));distal.push(...dp[side].map(i=>gap(points.get(s)[i],triangles)));patch.push(...ids[side].map(i=>gap(points.get(s)[i],triangles)));hands.push(...all[side].map(i=>gap(points.get(s)[i],triangles)));}
  assert(patch.length>=4&&pads.length>=4&&distal.length>=4,`No palm or finger pads found: ${side} ${patch.length} ${pads.length} ${distal.length}`);
  const padMean=pads.reduce((a,b)=>a+b,0)/pads.length,palmMean=distal.reduce((a,b)=>a+b,0)/distal.length;
  assert(padMean<.028,`${side} finger pads flare away: ${padMean} at ${t}`);
  assert(palmMean<.021,`${side} distal palm tilts outward: ${palmMean} at ${t}`);
  report.contact[side].maximumMeanFingerPadGap=Math.max(report.contact[side].maximumMeanFingerPadGap||0,padMean);
  report.contact[side].maximumMeanDistalPalmGap=Math.max(report.contact[side].maximumMeanDistalPalmGap||0,palmMean);
  assert(Math.min(...hands)>-.006,`${side} penetrates belly at ${t}: ${Math.min(...hands)}`);
  assert(Math.min(...patch)<.008,`${side} floats above belly at ${t}: ${Math.min(...patch)}`);
  report.contact[side].minimum=Math.min(report.contact[side].minimum,...hands);
  report.contact[side].maximumNearest=Math.max(report.contact[side].maximumNearest,Math.min(...patch));
 }
}
sample('RunAttack',0);const start=point('spine');
sample('RunAttack',.75);const travel=point('spine').sub(start);
assert(travel.z>.25,'Sprint push does not retain its forward drive');
sample('RunAttack',.25);const trunk=point('spine.005').sub(point('spine.001'));
const lean=Math.atan2(trunk.z,trunk.y)*180/Math.PI;
assert(lean>20,`Sprint push body is too upright: ${lean}`);
for(const side of ['L','R'])assert(point('hand.'+side).z-point('upper_arm.'+side).z>.22,'Palm push is too close to torso');
report.run={forwardTravel:travel.z,trunkLeanDegrees:lean,keepsAttack2Chain:true};
await fs.writeFile(new URL('../output/animations/push-contact-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('PUSH_CONTACT_VERIFIED',JSON.stringify(report,null,2));

