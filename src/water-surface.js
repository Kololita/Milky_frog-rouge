import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {DRAIN} from './drain-floor.js';
import {BOILER_VALVES} from './cooling.js';
import {compileStartupTarget} from './startup-warmup.js';
import * as T from 'three';
const N=512,SIZE=22.7;
export function createWaterSurface(parent){
 const densityTarget=new T.WebGLRenderTarget(N,N,{depthBuffer:false,minFilter:T.LinearFilter,magFilter:T.LinearFilter});
 const texture=densityTarget.texture;
 const densityScene=new T.Scene(), densityCamera=new T.Camera();
 const positions=new T.BufferAttribute(new Float32Array(2400*3),3).setUsage(T.DynamicDrawUsage);
 const densityGeometry=new T.BufferGeometry();
 densityGeometry.setAttribute('position',positions);
 const gpuPositions={value:null};
 const airborneGeometry=new T.BufferGeometry();
 airborneGeometry.setAttribute('position',positions);
 const airborne=new T.Points(airborneGeometry,new T.ShaderMaterial({
  uniforms:{gpuPositions},transparent:true,depthWrite:false,
  vertexShader:`
   uniform sampler2D gpuPositions;
   varying float opacity;
   void main(){
    vec4 particle=texelFetch(gpuPositions,ivec2(gl_VertexID%60,gl_VertexID/60),0);
    if(particle.w<=0.||particle.y<.06){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=1.;opacity=0.;return;}
    vec4 view=modelViewMatrix*vec4(particle.xyz,1.);
    float variation=fract(float(gl_VertexID)*.618034);
    gl_PointSize=clamp((10.+variation*16.)/max(1.,-view.z),1.,5.);
    opacity=mix(.3,.8,variation)*smoothstep(.06,.18,particle.y);
    gl_Position=projectionMatrix*view;
   }`,
  fragmentShader:`
   varying float opacity;
   void main(){
    vec2 p=gl_PointCoord-.5;
    float edge=1.-smoothstep(.28,.5,length(p));
    float glint=exp(-45.*dot(p-vec2(-.13,.14),p-vec2(-.13,.14)));
    gl_FragColor=vec4(mix(vec3(.49,.63,.72),vec3(1.),glint),edge*opacity);
   }`
 }));
 airborne.frustumCulled=false;
 airborne.visible=false;
 airborne.userData.cameraOcclusion=false;
 parent.add(airborne);
 const densityPoints=new T.Points(densityGeometry,new T.ShaderMaterial({
  transparent:true,depthTest:false,depthWrite:false,blending:T.AdditiveBlending,
  uniforms:{gpuPositions},
  vertexShader:`
   uniform sampler2D gpuPositions;
   varying float top;
   void main(){
    vec3 p=position;
    #ifdef GPU_DRAIN
     vec4 particle=texelFetch(gpuPositions,ivec2(gl_VertexID%60,gl_VertexID/60),0);
     if(particle.w<=0.||particle.y>.018){
      gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=1.;top=0.;return;
     }
     p=particle.xyz;
    #endif
    top=p.y>-.05?1.:0.;
    gl_Position=vec4(p.x,-p.z,0.,11.35);
    gl_PointSize=mix(14.,6.,top);
   }`,
  fragmentShader:`varying float top;void main(){vec2 d=(gl_PointCoord-.5)*mix(7.,3.,top);float density=exp(-dot(d,d)*.23)*.255;gl_FragColor=vec4(density*(1.-top),density*top,0.,1.);}`
 }));
 densityPoints.frustumCulled=false;densityScene.add(densityPoints);
 const clearColor=new T.Color();
 let renderer,projectedRevision=-1;
 const clock={value:0};
 const material=new T.MeshPhysicalMaterial({color:'#f0fbff',metalness:0,roughness:.075,transmission:.98,thickness:.09,ior:1.333,attenuationColor:'#b7e3df',attenuationDistance:8,transparent:true,depthWrite:false,side:T.FrontSide});
 material.onBeforeCompile=shader=>{
  shader.uniforms.waterDensity={value:texture};shader.uniforms.waterClock=clock;
  shader.vertexShader='varying vec2 waterUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nwaterUv=uv;');
  shader.fragmentShader='varying vec2 waterUv;uniform sampler2D waterDensity;uniform float waterClock;\n'+shader.fragmentShader
   .replace('#include <color_fragment>','#include <color_fragment>\nvec2 drainP=(waterUv-.5)*22.7;vec2 drainD=abs(drainP-4.*floor(drainP/4.+.5));if((min(drainD.x,drainD.y)>.145&&length(drainP)<10.75)||length(drainP)>11.35)discard;float waterCoverage=smoothstep(.015,.12,texture2D(waterDensity,waterUv).r);if(waterCoverage<.01)discard;diffuseColor.a*=waterCoverage;')
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec2 p=(waterUv-.5)*22.7;
    vec2 gd=abs(p-4.*floor(p/4.+.5));
    vec2 lane=exp(-vec2(gd.y,gd.x)*24.);
    vec2 direction=normalize(sign(p+vec2(.001))*lane+vec2(.0001));
    if(length(p)>10.75)direction=normalize(vec2(-p.y,p.x));
    vec2 crossFlow=vec2(-direction.y,direction.x);
    float along=dot(p,direction),across=dot(p,crossFlow);
    float footprint=max(length(fwidth(p)),.0001);
    float ripple=sin(along*18.-waterClock*9.+sin(across*13.))*.09;
    ripple+=sin(along*51.-waterClock*21.+across*23.)*.045*(1.-smoothstep(.015,.06,footprint));
    ripple+=sin(along*113.-waterClock*39.+sin(across*37.))*.02*(1.-smoothstep(.005,.025,footprint));
    vec2 slope=direction*ripple+crossFlow*(sin(across*42.+along*9.-waterClock*5.)*.025);
    normal=normalize(mat3(viewMatrix)*vec3(-slope.x,1.,-slope.y));
    float densityHere=texture2D(waterDensity,waterUv).r;
    float bank=smoothstep(.08,.145,min(gd.x,gd.y));
    float streak=pow(.5+.5*sin(along*27.-waterClock*13.+sin(across*35.)),6.);
    float foam=bank*streak*smoothstep(.08,.35,densityHere)*.60;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.85,.94,.95),foam);
    roughnessFactor=mix(roughnessFactor,.28,foam);
    totalEmissiveRadiance+=foam*vec3(.035,.045,.05);
   `)
   .replace('#include <transmission_fragment>',T.ShaderChunk.transmission_fragment.replace('material.transmission = transmission;', 'material.transmission = transmission * (1.0 - foam * .85);'));
 };
 material.customProgramCacheKey=()=> 'drain-water-flow-detail-v3';

 const surface=new T.Mesh(new T.PlaneGeometry(SIZE,SIZE),material);surface.rotation.x=-Math.PI/2;surface.position.y=DRAIN.water+.10;surface.userData.cameraOcclusion=false;surface.visible=false;parent.add(surface);
 // Only moving water particles paint this thin runoff film; dry slabs have no overlay.
 const runoffMaterial=material.clone();runoffMaterial.thickness=.008;runoffMaterial.roughness=.045;
 runoffMaterial.onBeforeCompile=shader=>{material.onBeforeCompile(shader);shader.fragmentShader=shader.fragmentShader.replace('texture2D(waterDensity,waterUv).r','texture2D(waterDensity,waterUv).g');shader.fragmentShader=shader.fragmentShader.replace('if((min(drainD.x,drainD.y)>.145&&length(drainP)<10.75)||length(drainP)>11.35)discard;','if(min(drainD.x,drainD.y)<.17||length(drainP)>10.73)discard;');};runoffMaterial.customProgramCacheKey=()=> 'foundry-runoff-v3';
 const runoff=new T.Mesh(surface.geometry,runoffMaterial);runoff.rotation.x=-Math.PI/2;runoff.position.y=.007;runoff.visible=false;runoff.userData.cameraOcclusion=false;parent.add(runoff);
 const jetMaterial=new T.MeshPhysicalMaterial({color:'#f3fcff',metalness:0,roughness:.065,transmission:1,thickness:.018,ior:1.333,attenuationColor:'#b7e3df',attenuationDistance:8,transparent:true,opacity:.9,depthWrite:false});
 jetMaterial.onBeforeCompile=shader=>{shader.uniforms.waterClock=clock;shader.vertexShader='uniform float waterClock;attribute float jetIndex;attribute vec2 jetWindow;varying vec2 jetUv;varying float waterOpacity;\n'+shader.vertexShader
   .replace('#include <uv_vertex>','#include <uv_vertex>\njetUv=uv;waterOpacity=jetWindow.y<jetWindow.x?0.:clamp((waterClock-jetWindow.x)/.15,0.,1.)*clamp((jetWindow.y+.35-waterClock)/.35,0.,1.);')
   .replace('#include <beginnormal_vertex>',`
    #include <beginnormal_vertex>
    float angle=jetIndex*6.283185/9.+sin(jetIndex*9.)*.14;
    float speed=2.7+mod(jetIndex,3.)*.36;
    float vy=2.3+mod(jetIndex,2.)*.35;
    float t=uv.x*(vy+sqrt(vy*vy+2.*9.81*.66))/9.81;
    vec3 horizontal=vec3(cos(angle),0.,sin(angle));
    vec3 tangent=normalize(horizontal*speed+vec3(0.,vy-9.81*t,0.));
    vec3 side=vec3(sin(angle),0.,-cos(angle));
    float theta=-uv.y*6.283185;
    objectNormal=side*cos(theta)+cross(tangent,side)*sin(theta);
   `)
   .replace('#include <begin_vertex>',`
    #include <begin_vertex>
    float radius=.062-.035*uv.x+.007*sin(uv.x*57.-waterClock*10.)+.003*sin(uv.x*113.-waterClock*17.);
    transformed=horizontal*speed*t+vec3(0.,.71+vy*t-4.905*t*t,0.)+objectNormal*radius;
   `);shader.fragmentShader='varying vec2 jetUv;varying float waterOpacity;uniform float waterClock;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(waterOpacity<=0.)discard;diffuseColor.a*=waterOpacity*(1.-smoothstep(.96,1.,jetUv.x));').replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nfloat ripple=sin(jetUv.x*210.-waterClock*19.+sin(jetUv.y*25.))*0.12+sin(jetUv.x*83.-waterClock*11.+jetUv.y*19.)*.07;normal=normalize(normal+normalize(dFdx(vViewPosition))*ripple+normalize(dFdy(vViewPosition))*sin(jetUv.y*38.+jetUv.x*150.-waterClock*15.)*.055);');};
 jetMaterial.customProgramCacheKey=()=> 'drain-jet-transmission-v7';
 for(const waterMaterial of [material,runoffMaterial,jetMaterial])waterMaterial.userData.reflectionIntensity=1.2;
 const sprayGeometry=new T.BufferGeometry(),seeds=new Float32Array(540*3);for(let i=0;i<540;i++){seeds[i*3]=i%9;seeds[i*3+1]=(i*.61803399)%1;seeds[i*3+2]=(i*.41421356)%1;}sprayGeometry.setAttribute('position',new T.BufferAttribute(seeds,3));
 const sprayMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{waterClock:clock},vertexShader:`uniform float waterClock;varying float opacity;void main(){float j=position.x,a=j*6.283185/9.+sin(j*9.)*.14+(position.z-.5)*.025,vy=2.3+mod(j,2.)*.35,speed=2.7+mod(j,3.)*.36;float end=(vy+sqrt(vy*vy+2.*9.81*.66))/9.81,t=fract(position.y+waterClock*1.7)*end;vec3 p=vec3(cos(a)*speed*t,.71+vy*t-4.905*t*t,sin(a)*speed*t);if(position.z<.55){float st=fract(position.y+waterClock*3.7)*.25,sa=a+position.y*6.283;vec3 landing=vec3(cos(a)*speed*end,.025,sin(a)*speed*end);p=landing+vec3(cos(sa)*st*1.5,1.3*st-4.905*st*st,sin(sa)*st*1.5);}vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(16./max(1.,-mv.z),.8,3.5);opacity=smoothstep(0.,.18,t)*.58;gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying float opacity;void main(){float a=pow(max(0.,1.-length(gl_PointCoord-.5)*2.),1.5)*opacity;gl_FragColor=vec4(.85,.92,.95,a);}`});
 const groups=[];
 const jetGeometries=[];
 for(let j=0;j<9;j++){
  const geometry=new T.PlaneGeometry(1,1,72,12);
  geometry.setAttribute('jetIndex',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(j),1));
  jetGeometries.push(geometry);
 }
 const jetGeometry=mergeGeometries(jetGeometries);
 jetGeometry.boundingSphere=new T.Sphere(new T.Vector3(0,.7,0),4);
 for(const geometry of jetGeometries)geometry.dispose();
 const windows=new T.InstancedBufferAttribute(new Float32Array(BOILER_VALVES.length*2),2).setUsage(T.DynamicDrawUsage);
 jetGeometry.setAttribute('jetWindow',windows);
 const jets=new T.InstancedMesh(jetGeometry,jetMaterial,BOILER_VALVES.length);
 jets.frustumCulled=false;
 jets.userData.cameraOcclusion=false;
 jets.visible=false;
 const translation=new T.Matrix4();
 const instanceSources=new Int8Array(BOILER_VALVES.length).fill(-1);
 jets.count=0;
 parent.add(jets);
 function addSource(zone){
  const group=new T.Group();
  group.position.set(zone.x,0,zone.z);
  group.userData.cameraOcclusion=false;
  group.visible=false;
  const spray=new T.Points(sprayGeometry,sprayMaterial);
  spray.frustumCulled=false;
  group.add(spray);
  parent.add(group);
  groups.push(group);
  return group;
 }
 for(const zone of BOILER_VALVES)addSource(zone);
 return {mesh:surface,get density(){return surface.visible?texture:null;},
  prepareShaders(){return compileStartupTarget(renderer,densityTarget,densityScene,densityCamera);},
  setRefraction(enabled){
   material.transmission=runoffMaterial.transmission=enabled ? .98 : 0;
   jetMaterial.transmission=enabled ? 1 : 0;
   material.color.set(enabled ? '#f0fbff' : '#347389');
   runoffMaterial.color.copy(material.color);
   jetMaterial.color.set(enabled ? '#f3fcff' : '#42798b');
   material.opacity=enabled ? 1 : .30;
   runoffMaterial.opacity=enabled ? 1 : .17;
   jetMaterial.opacity=enabled ? .9 : .27;
  },
  prepare(value,useGpu){
   renderer=value;
   projectedRevision=-1;
   if(useGpu) densityPoints.material.defines.GPU_DRAIN=1;
   else delete densityPoints.material.defines.GPU_DRAIN;
   densityPoints.material.needsUpdate=true;
  },update(particles,zones,time,simulationTexture=null,revision=-1){
 clock.value=time;
 let activeJets=0,windowsChanged=false,instancesChanged=false;
 for(let i=0;i<groups.length;i++){
  const zone=zones[i],group=groups[i];
  const valid=Number.isFinite(zone?.brokenAt);
  const start=valid?Math.fround(zone.brokenAt):1;
  const end=valid?Math.fround(zone.until):0;
  group.visible=valid&&time>zone.brokenAt&&time<zone.until+.35;
  if(!group.visible)continue;
  const slot=activeJets++;
  if(instanceSources[slot]!==i){
   instanceSources[slot]=i;
   jets.setMatrixAt(slot,translation.makeTranslation(zone.x,0,zone.z));
   instancesChanged=true;
  }
  if(windows.getX(slot)!==start||windows.getY(slot)!==end){
   windows.setXY(slot,start,end);
   windowsChanged=true;
  }
 }
 if(windowsChanged)windows.needsUpdate=true;
 if(instancesChanged)jets.instanceMatrix.needsUpdate=true;
 jets.count=activeJets;
 jets.visible=activeJets>0;
 let count=0,channel=false,top=false;
 for(const p of particles){
  if(p.y>.018)continue;
  const runoff=p.y>-.05;
  positions.setXYZ(count++,p.x,p.y,p.z);
  if(runoff)top=true;else channel=true;
 }
 const gpu=Boolean(simulationTexture);
 gpuPositions.value=simulationTexture;
 airborne.visible=gpu;
 if(gpu)count=positions.count;
 surface.visible=Boolean(renderer&&(gpu||channel));runoff.visible=Boolean(renderer&&(gpu||top));
 if(!gpu)projectedRevision=-1;
 if(!renderer||!count)return;
 if(gpu&&revision>=0&&revision===projectedRevision)return;
 if(!gpu){positions.clearUpdateRanges();positions.addUpdateRange(0,count*3);positions.needsUpdate=true;}
 densityGeometry.setDrawRange(0,count);
 const previousTarget=renderer.getRenderTarget(),alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear;
 renderer.getClearColor(clearColor);
 try{
  renderer.setRenderTarget(densityTarget);renderer.setClearColor(0,0);renderer.autoClear=true;
  renderer.render(densityScene,densityCamera);
  projectedRevision=gpu?revision:-1;
 }finally{
  renderer.setRenderTarget(previousTarget);renderer.setClearColor(clearColor,alpha);renderer.autoClear=autoClear;
 }
 }};
}
