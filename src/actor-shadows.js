const configured=new WeakSet();

/** Strip shadow coordinates and sampling from actor color shaders. Casting uses separate depth materials. */
export function skipActorShadows(material){
 if(configured.has(material))return;
 configured.add(material);
 const compile=material.onBeforeCompile;
 const key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);
  shader.vertexShader='#undef USE_SHADOWMAP\n'+shader.vertexShader;
  shader.fragmentShader='#undef USE_SHADOWMAP\n'+shader.fragmentShader;
 };
 material.customProgramCacheKey=()=>key+'|actor-no-shadow-sampling';
 material.needsUpdate=true;
}
