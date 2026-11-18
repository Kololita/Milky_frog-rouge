import {HalfFloatType,Vector2,Vector4,WebGLRenderTarget} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createLoadingBudget} from './loading-budget.js';
import {compileSceneInBatches,compileStartupQuad,compileStartupTarget,waitForStartupGpu} from './startup-warmup.js';
/** Only the foundry uses this restrained HDR glow; menus and other maps keep their renderer. */
export function createFoundryPost(renderer,scene,camera){
 const compileDirect=(onProgress,options)=>compileSceneInBatches(renderer,scene,camera,onProgress,options);
 if(!renderer.extensions.has('EXT_color_buffer_float')){
  return {setQuality(){},compileWarmup:compileDirect,render(){renderer.render(scene,camera);},dispose(){}};
 }
 const target=new WebGLRenderTarget(1,1,{type:HalfFloatType,samples:Math.min(2,renderer.capabilities.maxSamples)});
 const composer=new EffectComposer(renderer,target);composer.setPixelRatio(1);
 const base=new RenderPass(scene,camera);
 const bloom=new UnrealBloomPass(new Vector2(1,1),.18,.45,1.6);
 const output=new OutputPass();
 const passes=[['scene',base],['bloom',bloom],['output',output]];
 for(const [,pass] of passes)composer.addPass(pass);
 const size=new Vector2();let width=0,height=0,quality='high';
 function syncSize(){
  renderer.getDrawingBufferSize(size);
  if(width===size.x&&height===size.y)return;
  width=size.x;
  height=size.y;
  composer.setSize(width,height);
 }
 function drawComposer(onPass){
  if(!onPass){composer.render();return;}
  const draws=passes.map(([name,pass])=>({name,pass,draw:pass.render}));
  for(const {name,pass,draw} of draws){
   pass.render=function(...args){
    const start=performance.now(),first=renderer.info.programs.length;
    try{return draw.apply(this,args);}
    finally{onPass({name,ms:performance.now()-start,
     programs:renderer.info.programs.slice(first).map(program=>program.name)});}
   };
  }
  try{composer.render();}
  finally{for(const {pass,draw} of draws)pass.render=draw;}
 }
 function prepareOutput(){
  // Run the pass once with its real screen color space and tone-mapping defines.
  const previous=renderer.getRenderTarget();
  const face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
  const viewport=renderer.getViewport(new Vector4());
  const renderToScreen=output.renderToScreen;
  try{
   renderer.setRenderTarget(null);
   renderer.setViewport(0,0,1,1);
   output.renderToScreen=true;
   output.render(renderer,composer.writeBuffer,composer.readBuffer);
  }finally{
   output.renderToScreen=renderToScreen;
   renderer.setViewport(viewport);
   renderer.setRenderTarget(previous,face,mip);
  }
 }
 return {setBloomEnabled(enabled){bloom.enabled=enabled;},
 async preparePost(){
  if(quality==='off')return;
  syncSize();
  const budget=createLoadingBudget();
  const targets=[composer.renderTarget1,composer.renderTarget2];
  if(bloom.enabled)targets.push(bloom.renderTargetBright,...bloom.renderTargetsHorizontal,...bloom.renderTargetsVertical);
  for(const target of targets){
   renderer.initRenderTarget(target);
   await budget.checkpoint();
  }
  if(bloom.enabled){
   await compileStartupQuad(renderer,bloom.renderTargetBright,[bloom.materialHighPassFilter,
    ...bloom.separableBlurMaterials,bloom.compositeMaterial,bloom.blendMaterial]);
  }
  await waitForStartupGpu(renderer);
  prepareOutput();
 },
 compileWarmup(onProgress,options){
  if(quality==='off')return compileDirect(onProgress,options);
  syncSize();
  return compileStartupTarget(renderer,composer.readBuffer,scene,camera,onProgress,options);
 },setQuality(level){
  quality=level;
  const samples=level==='high'?Math.min(2,renderer.capabilities.maxSamples):0;
  for(const buffer of [composer.renderTarget1,composer.renderTarget2]){
   if(buffer.samples!==samples){buffer.dispose();buffer.samples=samples;}
  }
 },render(active,onPass){
  if(!active){renderer.render(scene,camera);return;}
  const previousScale=renderer.transmissionResolutionScale;
  renderer.transmissionResolutionScale=quality==='high'?.5:.35;
  try{
   if(quality==='off'){renderer.render(scene,camera);return;}
   syncSize();
   drawComposer(onPass);
  }finally{renderer.transmissionResolutionScale=previousScale;}
 },dispose(){composer.dispose();bloom.dispose();output.dispose();}};
}
