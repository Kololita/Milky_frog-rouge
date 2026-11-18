import * as T from 'three';

/** Apply a world-space vertical correction from the probe texture at draw time. */
export function applyGpuFloorOffset(material,offset){
 const compile=material.onBeforeCompile;
 const key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);
  Object.assign(shader.uniforms,offset);
  shader.vertexShader='uniform sampler2D floorHeightMap;uniform float floorDesired;uniform bool floorEnabled;\n'+shader.vertexShader
   .replace('#include <project_vertex>',`
    #include <project_vertex>
    float floorOffsetY=0.;
    if(floorEnabled){
     vec4 floorSample=texelFetch(floorHeightMap,ivec2(0),0);
     if(floorSample.a>0.){
      floorOffsetY=floorDesired-floorSample.r;
      mvPosition.xyz+=viewMatrix[1].xyz*floorOffsetY;
      gl_Position=projectionMatrix*mvPosition;
     }
    }
   `)
   .replace('#include <worldpos_vertex>',`
    #include <worldpos_vertex>
    #if defined(USE_ENVMAP) || defined(DISTANCE) || defined(USE_SHADOWMAP) || defined(USE_TRANSMISSION) || NUM_SPOT_LIGHT_COORDS > 0
     worldPosition.y+=floorOffsetY;
    #endif
   `);
 };
 material.customProgramCacheKey=()=>key+'|gpu-floor-offset';
 material.needsUpdate=true;
}

export function createGpuFloorAlignment(renderer,model){
 const probe=createGpuFloorProbe(renderer,model);
 if(!probe)return null;
 const offset={floorHeightMap:{value:probe.target.texture},floorDesired:{value:0},floorEnabled:{value:false}};
 const materials=new Set();
 model.traverse(mesh=>{
  if(!mesh.isMesh)return;
  mesh.frustumCulled=false;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(material);
  if(mesh.castShadow){
   mesh.customDepthMaterial??=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
   mesh.customDistanceMaterial??=new T.MeshDistanceMaterial();
   materials.add(mesh.customDepthMaterial);
   materials.add(mesh.customDistanceMaterial);
  }
 });
 for(const material of materials)applyGpuFloorOffset(material,offset);
 return {
  prepare(originY,desired){
   probe.compute(originY);
   offset.floorDesired.value=desired;
   offset.floorEnabled.value=true;
  },
  clear(){offset.floorEnabled.value=false;}
 };
}

/** Reduces skinned vertices to the lowest world-space height in a 1×1 target. */
export function createGpuFloorProbe(renderer,model){
 if(!renderer.extensions.has('EXT_color_buffer_float'))return null;
 const scene=new T.Scene(),camera=new T.Camera(),probes=[];
 const referenceY={value:0};
 const target=new T.WebGLRenderTarget(1,1,{type:T.FloatType,depthBuffer:true});
 const material=new T.ShaderMaterial({
  uniforms:{referenceY},depthTest:true,depthWrite:true,
  vertexShader:`
   uniform float referenceY;
   varying float height;
   #include <common>
   #include <morphtarget_pars_vertex>
   #include <skinning_pars_vertex>
   void main(){
    #include <skinbase_vertex>
    #include <begin_vertex>
    #include <morphtarget_vertex>
    #include <skinning_vertex>
    height=(modelMatrix*vec4(transformed,1.)).y-referenceY;
    gl_Position=vec4(0.,0.,clamp(height/16.,-.999,.999),1.);
    gl_PointSize=1.;
   }`,
  fragmentShader:`
   varying float height;
   void main(){gl_FragColor=vec4(height,0.,0.,1.);}
  `,
 });
 model.traverse(source=>{
  if(!source.isSkinnedMesh||/^Frog_(?:eyelid|mouth|laugh)_/.test(source.name))return;
  const geometry=new T.BufferGeometry();
  for(const attribute of ['position','skinIndex','skinWeight'])geometry.setAttribute(attribute,source.geometry.getAttribute(attribute));
  geometry.morphAttributes=source.geometry.morphAttributes;
  geometry.morphTargetsRelative=source.geometry.morphTargetsRelative;
  const proxy=new T.Points(geometry,material);
  proxy.isSkinnedMesh=true;
  proxy.bindMatrix=source.bindMatrix;
  proxy.bindMatrixInverse=source.bindMatrixInverse;
  proxy.skeleton=source.skeleton;
  proxy.morphTargetInfluences=source.morphTargetInfluences;
  proxy.matrixAutoUpdate=false;
  proxy.frustumCulled=false;
  scene.add(proxy);
  probes.push({source,proxy});
 });
 const clear=new T.Color();
 return {
  compute(originY){
   referenceY.value=originY;
   model.updateWorldMatrix(true,true);
   for(const {source,proxy} of probes)proxy.matrix.copy(source.matrixWorld);
   const previous=renderer.getRenderTarget(),alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear;
   renderer.getClearColor(clear);
   try{
    renderer.setRenderTarget(target);
    renderer.setClearColor(0,0);
    renderer.autoClear=true;
    renderer.render(scene,camera);
   }finally{
    renderer.setRenderTarget(previous);
    renderer.setClearColor(clear,alpha);
    renderer.autoClear=autoClear;
   }
   return target.texture;
  },
  target,
  dispose(){target.dispose();material.dispose();for(const {proxy} of probes)proxy.geometry.dispose();}
 };
}
