import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import * as T from 'three';
let environment,textures,areaLightsReady;
function foundryEnvironment(){
 if(environment)return environment;
 const faces=Array.from({length:6},(_,i)=>{const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,0,128);g.addColorStop(0,i===2?'#bca786':'#6d7780');g.addColorStop(.45,'#49423b');g.addColorStop(1,'#262a2d');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);ctx.fillStyle=i===2?'#ffe2a3':'#acb9c4';ctx.fillRect(38,15,20,48);ctx.fillRect(84,15,12,48);return c;});environment=new T.CubeTexture(faces);environment.colorSpace=T.SRGBColorSpace;environment.needsUpdate=true;return environment;
}
function foundryTextures(){
 if(textures)return textures;
 const loader=new T.TextureLoader(),pending=[];
 function texture(name){
  let resolve,reject;
  pending.push(new Promise((success,failure)=>{resolve=success;reject=failure;}));
  const map=loader.load(`/textures/foundry/${name}.png`,resolve,undefined,reject);
  map.colorSpace=T.SRGBColorSpace;
  map.wrapS=map.wrapT=T.RepeatWrapping;
  map.anisotropy=8;
  return map;
 }
 const iron=texture('aged-iron-albedo');
 const floor=texture('worn-steel-floor');
 const panorama=texture('steelworks-panorama');panorama.repeat.set(3,1);
 const banner=texture('furnace-banner');banner.wrapS=banner.wrapT=T.ClampToEdgeWrapping;
 textures={iron,floor,panorama,banner,ready:Promise.all(pending)};
 return textures;
}
export const foundryTexturesReady=()=>foundryTextures().ready;
export function foundryFloor(){const map=foundryTextures().floor.clone();map.repeat.set(.25,.25);map.needsUpdate=true;const relief=map.clone();relief.colorSpace=T.NoColorSpace;return new T.MeshStandardMaterial({color:'#b9bdc0',map,bumpMap:relief,bumpScale:.003,roughnessMap:relief,roughness:.62,metalness:.72,envMap:foundryEnvironment(),envMapIntensity:1});}
export function foundryMetal(color,scale=2){
 const ironTexture=foundryTextures().iron;
 const map=ironTexture.clone();map.repeat.set(scale,scale);map.needsUpdate=true;
 // Clones created before loading must share the eventual image source.
 map.source=ironTexture.source;
 const bump=map.clone();bump.colorSpace=T.NoColorSpace;bump.source=ironTexture.source;
 const tint=new T.Color(color);const max=Math.max(tint.r,tint.g,tint.b,.01);tint.multiplyScalar(2.4/max);
 const material=new T.MeshStandardMaterial({color:tint,map,bumpMap:bump,bumpScale:.01,metalness:.72,roughness:.42,envMap:foundryEnvironment(),envMapIntensity:.65});
 const rgb=new T.Color(color);if(Math.max(rgb.r,rgb.g,rgb.b)-Math.min(rgb.r,rgb.g,rgb.b)<.12){material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat ironLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(vec3(ironLuma),diffuseColor.rgb,.25);');};material.customProgramCacheKey=()=> 'foundry-neutral-iron-v1';}
 return material;
}
export function addFoundryDetails(root){
 if(!areaLightsReady){RectAreaLightUniformsLib.init();areaLightsReady=true;}
 const {panorama,banner}=foundryTextures();
 const steel=foundryMetal('#55504a'),rust=foundryMetal('#7a5033'),black=foundryMetal('#282c2d'),gold=new T.MeshStandardMaterial({color:'#b58b37',metalness:.65,roughness:.5});
 const geometries=new Map(),batches=new Map(),pose=new T.Object3D();
 function mesh(Geometry,size,material,position,rotation){
  if(!geometries.has(Geometry))geometries.set(Geometry,new Map());
  const shapes=geometries.get(Geometry),shape=size.join(',');
  if(!shapes.has(shape))shapes.set(shape,new Geometry(...size));
  const geometry=shapes.get(shape),key=geometry.id+':'+material.id;
  if(!batches.has(key))batches.set(key,{geometry,material,matrices:[]});
  pose.position.set(...position);
  if(rotation)pose.rotation.set(...rotation);else pose.rotation.set(0,0,0);
  pose.updateMatrix();
  batches.get(key).matrices.push(pose.matrix.clone());
 }
 const box=(s,m,p,r)=>mesh(T.BoxGeometry,s,m,p,r);
 for(let i=0;i<24;i++){
  const a=i*Math.PI/12,s=Math.sin(a),c=Math.cos(a),at=(x,y,inset=0)=>[s*(11.2-inset)+c*x,y,c*(11.2-inset)-s*x];
  box([.16,6.5,.19],steel,at(-1.47,3.25),[0,a,0]);
  for(const y of [.35,2.35,5.6]){box([2.95,.12,.13],steel,at(0,y),[0,a,0]);for(const x of [-1.35,0,1.35])mesh(T.SphereGeometry,[.045,6,4],rust,at(x,y,.09));}
  for(const y of [1,3.2,5]){box([.3,.32,.12],black,at(-1.47,y,.1),[0,a,0]);for(const x of [-1.54,-1.4])mesh(T.SphereGeometry,[.035,6,4],rust,at(x,y,.18));}
  box([2.9,.065,.03],gold,at(0,.65,.15),[0,a,0]);
 }
 // Hanging textile, with a shaped hem and real shallow folds.
 const bannerMaterial=new T.MeshStandardMaterial({map:banner,roughness:1,side:T.DoubleSide,color:'#b9b5b0'}),bannerGeometry=new T.PlaneGeometry(1.16,2.32,20,36),points=bannerGeometry.attributes.position;
 for(let i=0;i<points.count;i++){const x=points.getX(i),y=points.getY(i),bottom=1-Math.min(1,(y+1.16)/.3);points.setZ(i,.035*Math.cos(x*13)+.012*Math.sin(y*5+x*4));points.setY(i,y+bottom*.17*(1-Math.abs(x)/.58));}bannerGeometry.computeVertexNormals();
 for(const index of [2,11,20]){const a=index*Math.PI/12,g=new T.Group();g.position.set(Math.sin(a)*10.97,3.6,Math.cos(a)*10.97);g.rotation.y=a+Math.PI;g.userData.cameraOcclusion=false;root.add(g);const flag=new T.Mesh(bannerGeometry,bannerMaterial);flag.castShadow=flag.receiveShadow=true;g.add(flag);const pole=new T.Mesh(new T.CylinderGeometry(.025,.025,1.46,12),gold);pole.rotation.z=Math.PI/2;pole.position.y=1.22;g.add(pole);for(const x of [-.7,.7]){const cap=new T.Mesh(new T.SphereGeometry(.045,12,8),gold);cap.position.set(x,1.22,0);g.add(cap);}}
 // Structural I-beams and triangular webbing, not round sticks.
 const unitBox=new T.BoxGeometry(1,1,1),beamBatches=new Map();
 function member(a,b,width,depth,material){
  const from=new T.Vector3(...a),to=new T.Vector3(...b),delta=to.clone().sub(from),mid=from.add(to).multiplyScalar(.5);
  const yAxis=delta.clone().normalize(),xAxis=new T.Vector3().crossVectors(new T.Vector3(0,1,0),yAxis);if(xAxis.lengthSq()<.001)xAxis.set(1,0,0);else xAxis.normalize();const zAxis=new T.Vector3().crossVectors(xAxis,yAxis);const rotation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(xAxis,yAxis,zAxis));const matrix=new T.Matrix4().compose(mid,rotation,new T.Vector3(width,delta.length(),depth));
  if(!beamBatches.has(material))beamBatches.set(material,[]);beamBatches.get(material).push(matrix);
 }
 function ibeam(a,b){const y=new T.Vector3(...b).sub(new T.Vector3(...a)).normalize(),x=new T.Vector3().crossVectors(new T.Vector3(0,1,0),y).normalize(),offset=new T.Vector3().crossVectors(x,y).multiplyScalar(.12);member(a,b,.045,.24,steel);for(const sign of [-1,1])member(a.map((v,i)=>v+offset.getComponent(i)*sign),b.map((v,i)=>v+offset.getComponent(i)*sign),.28,.045,black);}

 for(let i=0;i<12;i++){
  const a=i*Math.PI/6,s=Math.sin(a),c=Math.cos(a),point=(r,y)=>[s*r,y,c*r];
  ibeam(point(.6,6.35),point(11.2,6.35));ibeam(point(.6,8.12),point(11.2,6.45));
  for(let j=0;j<5;j++){const r=1+j*2;member(point(r,6.38),point(r+1.8,8.2-(r+1.8)*.155),.09,.09,steel);member(point(r+1.8,6.38),point(r+1.8,8.2-(r+1.8)*.155),.07,.09,steel);
   box([.34,.32,.06],black,point(r,6.4),[0,a,0]);for(const offset of [-.08,.08])mesh(T.SphereGeometry,[.035,8,6],rust,[s*r+c*offset,6.45,c*r-s*offset]);}
 }
 for(const [material,matrices]of beamBatches){const inst=new T.InstancedMesh(unitBox,material,matrices.length);matrices.forEach((matrix,i)=>inst.setMatrixAt(i,matrix));inst.castShadow=inst.receiveShadow=true;root.add(inst);}
 // Elevated roof seams follow the pitch of the enclosed ceiling.
 const seamLength=Math.hypot(11.5-.25,8.45-6.5);
 const seamGeometry=new T.CylinderGeometry(.025,.025,seamLength,8);
 const seamPose=new T.Object3D(),seamAxis=new T.Vector3(),up=new T.Vector3(0,1,0);
 for(let quadrant=0;quadrant<4;quadrant++){
  const seams=new T.InstancedMesh(seamGeometry,steel,6);
  seams.name='roof-seams';
  for(let i=0;i<6;i++){
   const a=(quadrant*6+i)*Math.PI/12,s=Math.sin(a),c=Math.cos(a);
   seamPose.position.set(s*5.875,7.475,c*5.875);
   seamPose.quaternion.setFromUnitVectors(up,seamAxis.set(s*11.25,-1.95,c*11.25).normalize());
   seamPose.updateMatrix();
   seams.setMatrixAt(i,seamPose.matrix);
  }
  seams.castShadow=true;
  root.add(seams);
 }
 const pendantRod=new T.Mesh(new T.CylinderGeometry(.055,.055,2.1,8),black);
 pendantRod.position.y=7.25;
 pendantRod.castShadow=true;
 root.add(pendantRod);
 for(const y of [2.1,2.2])mesh(T.TorusGeometry,[10.98,.027,6,96],rust,[0,y,0],[Math.PI/2,0,0]);
 // Distant matte panorama sits beyond real window openings; it never blocks gameplay.
 const outside=new T.Mesh(new T.CylinderGeometry(24,24,10,96,1,true),new T.MeshBasicMaterial({map:panorama,side:T.BackSide,color:'#b8c2cc'}));outside.position.y=4;outside.userData.cameraOcclusion=false;root.add(outside);
 // Perimeter drainage grate and slab fasteners.
 for(let i=0;i<240;i++){const a=i*Math.PI/120;box([.035,.055,.55],black,[Math.sin(a)*10.98,.015,Math.cos(a)*10.98],[0,a,0]);}
 for(let x=-10;x<=10;x+=4)for(let z=-10;z<=10;z+=4)for(const dx of [-1.7,1.7])for(const dz of [-1.7,1.7])if(Math.hypot(x+dx,z+dz)<10.7)mesh(T.CylinderGeometry,[.055,.055,.018,8],steel,[x+dx,.015,z+dz]);
 for(const {geometry,material,matrices}of batches.values()){const inst=new T.InstancedMesh(geometry,material,matrices.length);matrices.forEach((v,i)=>inst.setMatrixAt(i,v));inst.castShadow=inst.receiveShadow=true;root.add(inst);}
 const light=new T.SpotLight('#fff0db',650,25,1.35,.4,2);light.position.set(0,5.3,0);light.target.position.set(0,0,0);light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.near=.1;light.shadow.camera.far=25;light.shadow.normalBias=.018;light.shadow.bias=-.0001;root.add(light,light.target);
 for(let i=0;i<4;i++){const a=i*Math.PI/2,fill=new T.RectAreaLight('#c5daed',5,1.1,2.7);fill.position.set(Math.sin(a)*11.05,3.7,Math.cos(a)*11.05);fill.lookAt(0,2,0);fill.userData.lightingTier=1;root.add(fill);}
 // Broad warm bounce from the central pendant reveals rivets without washing out the floor.
 for(let i=0;i<4;i++){const a=i*Math.PI/2,bounce=new T.RectAreaLight('#ffe2b9',3.5,4,3);bounce.position.set(Math.sin(a)*2,4.4,Math.cos(a)*2);bounce.lookAt(Math.sin(a)*11,3.6,Math.cos(a)*11);bounce.userData.lightingTier=2;root.add(bounce);}
 return {steel,rust,black,gold};
}
