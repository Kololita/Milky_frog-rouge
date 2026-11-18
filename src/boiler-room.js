import {createGpuHealthBar} from './gpu-health-bar.js';
import {loadFoundryProps,cloneFoundryProp} from './foundry-props.js';
import {createFurnaceInterior} from './furnace-interior.js';
import {createDrainFloor} from './drain-floor.js';
import {createDrainWater} from './drain-water.js';
import {createLavaMaterial} from './lava-material.js';
import {compileStartupTarget} from './startup-warmup.js';
import {preloadFoundryReflection,PROBE_SIZE,uploadFoundryReflection} from './foundry-reflection.js';
import * as T from 'three';
import {BOILER_VALVES} from './cooling.js';
export function createBoilerRoom(scene,doc){
 const root=new T.Group();root.name='锅炉房';root.visible=false;scene.add(root);
 const add=(geo,mat,x,y,z)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
 const floor=new T.Group();floor.userData.cameraOcclusion=false;root.add(floor);
 createDrainFloor(floor);
 const drainWater=createDrainWater(root);
 const lava=createLavaMaterial(),stream=createLavaMaterial();stream.uniforms.vertical.value=1;stream.uniforms.clock=lava.uniforms.clock;lava.uniforms.surfaceRadius.value=2.2;
 const interior=createFurnaceInterior(root,add,lava,stream);
 const valves=BOILER_VALVES.map(v=>{
  const assembly=new T.Group();assembly.position.set(v.x,0,v.z);assembly.name='Cooling valve';root.add(assembly);
  const baseHull=new T.BoxGeometry(.70,.16,.64).translate(0,.08,0);
  const wheelHull=new T.BoxGeometry(.56,.56,.10).translate(0,.46,.4);
  const stemHull=new T.CylinderGeometry(.20,.23,.67,8).translate(0,.46,0);
  const capHull=new T.BoxGeometry(.45,.44,.44).translate(.10,1.09,0);
  const brokenHull=[baseHull,wheelHull,stemHull];
  const intactHull=[...brokenHull,capHull];
  assembly.userData.cameraHull=intactHull;
  const bar=createGpuHealthBar({width:.72,height:.09,fillWidth:.68,fillHeight:.05,background:'#253a3b',color:'#75b7bb',depth:.005});
  bar.group.position.set(v.x,1.55,v.z);
  bar.group.userData.cameraOcclusion=false;
  root.add(bar.group);
  return {assembly,health:bar.group,bar,intactHull,brokenHull};
 });
 const ready=Promise.all([interior.ready,loadFoundryProps()]).then(()=>{
  for(const view of valves){const prop=cloneFoundryProp('valve');prop.traverse(part=>{if(part.isMesh)part.userData.cameraFadeGroup='cooling-valve-'+view.assembly.id;});view.assembly.add(prop);view.intact=prop.getObjectByName('ValveIntact');view.broken=prop.getObjectByName('ValveBroken');if(!view.intact||!view.broken)throw Error('Valve state meshes missing');view.broken.visible=false;}
 });
 const originalLighting=new Map();
 function roomLighting(active){for(const light of scene.children){if(!light.isDirectionalLight&&!light.isHemisphereLight)continue;if(!originalLighting.has(light))originalLighting.set(light,light.intensity);light.intensity=active?(light.isDirectionalLight?.18:1.4):originalLighting.get(light);}}
 let reflection,filteredReflection,pmrem,reflectionKey,reflectionRequest,reflectionSource;
 let lightingQuality='high',reflectionSize=PROBE_SIZE;
 const probeSize=renderer=>Math.min(reflectionSize,renderer.capabilities.maxCubemapSize);
 const probeKey=renderer=>`${lightingQuality}:${probeSize(renderer)}`;
 function beginReflection(renderer,size){
  const visible=scene.children.map(o=>[o,o.visible]),background=scene.background,fog=scene.fog,wasActive=root.visible;roomLighting(true);
  const reflectedMaterials=new Set();
  root.traverse(object=>{
   for(const material of Array.isArray(object.material)?object.material:[object.material]){
    if(material?.isMeshStandardMaterial&&filteredReflection&&material.envMap===filteredReflection.texture)reflectedMaterials.add(material);
   }
  });
  for(const material of reflectedMaterials){material.envMap=null;material.needsUpdate=true;}
  const hadRoomReflection=lava.uniforms.hasRoomReflection.value;
  lava.uniforms.hasRoomReflection.value=false;
  const target=new T.WebGLCubeRenderTarget(size,{type:renderer.extensions.has('EXT_color_buffer_float')?T.HalfFloatType:T.UnsignedByteType});
  const probe=new T.CubeCamera(.08,40,target);probe.position.set(0,2,0);
  for(const [o]of visible)o.visible=o===root||o.isLight;
  scene.background=new T.Color('#9eabb6');
  scene.fog=null;
  scene.updateMatrixWorld(true);
  return {target,probe,restore(){
   for(const [o,v]of visible)o.visible=v;
   scene.background=background;
   scene.fog=fog;
   roomLighting(wasActive);
   lava.uniforms.hasRoomReflection.value=hadRoomReflection;
   for(const material of reflectedMaterials){material.envMap=filteredReflection.texture;material.needsUpdate=true;}
  }};
 }
 function setReflection(renderer,target,key,source){
  const filtered=target.texture.type===T.HalfFloatType
   ? (pmrem??=new T.PMREMGenerator(renderer)).fromCubemap(target.texture)
   : null;
  const previous=reflection;
  const previousFiltered=filteredReflection;
  reflection=target;
  filteredReflection=filtered;
  reflectionKey=key;
  reflectionSource=source;
  lava.uniforms.roomReflection.value=reflection.texture;
  lava.uniforms.hasRoomReflection.value=true;
  const materials=new Set();
  root.traverse(o=>{
   for(const material of Array.isArray(o.material)?o.material:[o.material]){
    if(material?.isMeshStandardMaterial)materials.add(material);
   }
  });
  for(const material of materials){
   material.envMap=filtered?.texture??null;
   material.envMapIntensity=material.userData.reflectionIntensity??(material.transmission?1.2:.85);
   material.needsUpdate=true;
  }
  previous?.dispose();
  previousFiltered?.dispose();
 }
 async function captureReflection(renderer,size,onProgress){
  const capture=beginReflection(renderer,size);
  const previousTarget=renderer.getRenderTarget();
  const previousFace=renderer.getActiveCubeFace();
  const previousMip=renderer.getActiveMipmapLevel();
  let completed=false;
  try{
   const {probe,target}=capture;
   if(onProgress){
    probe.coordinateSystem=renderer.coordinateSystem;
    probe.updateCoordinateSystem();
    probe.updateMatrixWorld(true);
    await compileStartupTarget(renderer,target,scene,probe.children[0],onProgress,{visibleOnly:true});
   }
   probe.update(renderer,scene);
   completed=true;
   return target;
  }finally{
   renderer.setRenderTarget(previousTarget,previousFace,previousMip);
   capture.restore();
   if(!completed)capture.target.dispose();
  }
 }
 async function refreshReflection(renderer,onProgress){
  const key=probeKey(renderer),size=probeSize(renderer);
  const data=await preloadFoundryReflection(lightingQuality);
  if(key!==probeKey(renderer))return;
  const target=data?uploadFoundryReflection(renderer,size,data):await captureReflection(renderer,size,onProgress);
  try{
   if(key===probeKey(renderer))setReflection(renderer,target,key,data?'baked':'capture');
  }finally{
   if(reflection!==target)target.dispose();
  }
 }
 async function prepareStartup(renderer,onProgress){
  drainWater.prepare(renderer);
  await refreshReflection(renderer,onProgress);
 }
 function prepare(renderer){
  const key=probeKey(renderer);
  if(reflectionKey===key||reflectionRequest)return;
  reflectionRequest=refreshReflection(renderer).catch(error=>{
   reflectionKey=key;
   console.warn('Foundry reflection update failed',error);
  }).finally(()=>{reflectionRequest=null;});
 }
 async function readReflection(renderer,target=reflection){
  const size=target.width,faceValues=size*size*4;
  const data=target.texture.type===T.HalfFloatType?new Uint16Array(faceValues*6):new Uint8Array(faceValues*6);
  for(let face=0;face<6;face++){
   const offset=face*faceValues;
   await renderer.readRenderTargetPixelsAsync(target,0,0,size,size,data.subarray(offset,offset+faceValues),face);
  }
  return data;
 }
 async function bakeReflection(renderer,lighting){
  const lights=root.children.filter(child=>child.userData.lightingTier!=null);
  const visibility=lights.map(light=>light.visible);
  const tier={low:0,medium:1,high:2}[lighting];
  for(const light of lights)light.visible=light.userData.lightingTier<=tier;
  let target;
  try{
   if(!renderer.extensions.has('EXT_color_buffer_float'))throw Error('HDR reflection baking requires half-float rendering');
   target=await captureReflection(renderer,PROBE_SIZE);
   return await readReflection(renderer,target);
  }finally{
   target?.dispose();
   lights.forEach((light,i)=>{light.visible=visibility[i];});
  }
 }
 function setQuality(lighting,reflections){
  lightingQuality=lighting;
  const tier={low:0,medium:1,high:2}[lighting];
  for(const child of root.children){
   if(child.userData.lightingTier!=null)child.visible=child.userData.lightingTier<=tier;
  }
  reflectionSize={low:64,medium:128,high:256}[reflections];
 }
 async function warmup(draw,onWaterStart){
  const states=valves.map(view=>[view.intact.visible,view.broken.visible,view.health.visible]);
  try{
   await draw(false);
   for(const view of valves){
    view.intact.visible=false;
    view.broken.visible=true;
    view.health.visible=false;
   }
   onWaterStart?.();
   await drainWater.warmup(BOILER_VALVES,()=>draw(true));
  }finally{
   for(let i=0;i<valves.length;i++){
    const view=valves[i];
    [view.intact.visible,view.broken.visible,view.health.visible]=states[i];
   }
  }
 }
 return {root,ready,prepare,prepareStartup,preloadReflection:()=>preloadFoundryReflection(lightingQuality),bakeReflection,
 readReflection,reflectionInfo:()=>({key:reflectionKey,source:reflectionSource,filtered:Boolean(filteredReflection)}),
 warmup,setQuality,setRefraction:drainWater.setRefraction,hide(){roomLighting(false);root.visible=false;delete scene.userData.cameraBoundary;},setMode(active){roomLighting(active);root.visible=active;if(active)scene.userData.cameraBoundary={radius:11.45,margin:.3};else delete scene.userData.cameraBoundary;},update(battle,position,bindings,camera){
 if(!root.visible)return 0;
 lava.uniforms.clock.value=battle.enemyTime;
 const waterSteps=drainWater.update(battle.enemyTime,battle.coolingValves);
 for(let i=0;i<valves.length;i++){
  const source=battle.coolingValves[i],view=valves[i],broken=source?.health<=0,time=battle.enemyTime;
  if(view.intact){view.intact.visible=!broken;view.broken.visible=broken;}
  view.assembly.userData.cameraHull=broken?view.brokenHull:view.intactHull;
  view.health.visible=Boolean(source)&&!broken&&(source.health<source.maxHealth||Math.hypot(position.x-source.x,position.z-source.z)<4);
  if(source){view.bar.setFraction(source.health/source.maxHealth);view.bar.fill.color.set(time<source.flashUntil?'#ffe6aa':'#75b7bb');}

 }
 return waterSteps;
 }};
}
