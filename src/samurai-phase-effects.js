import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SAMURAI_TRANSITION,samuraiStrikeActive} from './samurai.js';
import {ATTACK_PREVIEW_LEAD,attackWarningActive,attackWarningColor,attackWarningStart,warningPulseGLSL} from './attack-warning.js';

function windingGlow(start,end,{strands,coreRadius,haloRadius,speed,coreColor,haloColor}){
 const group=new THREE.Group();
 const clock={value:0},orbitSpeed={value:speed};
 function rotateOrbit(shader){
  shader.uniforms.ringClock=clock;
  shader.uniforms.ringSpeed=orbitSpeed;
  shader.vertexShader='uniform float ringClock,ringSpeed;\n'+shader.vertexShader.replace('#include <project_vertex>',`
   float ringAngle=ringClock*ringSpeed;
   float ringCos=cos(ringAngle),ringSin=sin(ringAngle);
   transformed.xz=mat2(ringCos,-ringSin,ringSin,ringCos)*transformed.xz;
   #include <project_vertex>
  `);
 }
 const paths=[];
 for(let strand=0;strand<strands;strand++){
  const points=[];
  for(let i=0;i<=90;i++){
   const u=i/90,a=u*Math.PI*2*Math.max(.75,(end-start)*1.3)+strand*Math.PI*2/strands,r=.073+.012*Math.sin(u*11+strand);
   points.push(new THREE.Vector3(Math.cos(a)*r,start+(end-start)*u,Math.sin(a)*r));
  }
  const curve=new THREE.CatmullRomCurve3(points);
  curve.getLength();paths.push(curve);
 }
 const count=strands*2,orbRadius=coreRadius*1.1+.008;
 const core=new THREE.InstancedMesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:'#fff4c8',transparent:true,opacity:.92,depthWrite:false,blending:THREE.AdditiveBlending}),count);
 const halo=new THREE.InstancedMesh(core.geometry,new THREE.MeshBasicMaterial({color:coreColor,transparent:true,opacity:.20,depthWrite:false,blending:THREE.AdditiveBlending}),count);
 core.name='flow_lights_core';halo.name='flow_lights_halo';
 const samples=128, data=new Float32Array(samples*strands*4);
 const point=new THREE.Vector3();
 for(let path=0;path<strands;path++){
  for(let i=0;i<samples;i++){
   paths[path].getPointAt(i/(samples-1),point).toArray(data,(path*samples+i)*4);
  }
 }
 const orbit=new THREE.DataTexture(data,samples,strands,THREE.RGBAFormat,THREE.FloatType);
 orbit.needsUpdate=true;
 const ribbonGeometry=new THREE.PlaneGeometry(1,1,100,5);
 for(const [radius,opacity,color] of [[coreRadius,.70,coreColor],[haloRadius,.15,haloColor]]){
  const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});
  material.onBeforeCompile=shader=>{
   shader.uniforms.ribbonPath={value:orbit};
   shader.uniforms.ribbonRadius={value:radius};
   shader.vertexShader=`
    uniform sampler2D ribbonPath;
    uniform float ribbonRadius;
    vec3 ribbonPoint(float t){
     float index=clamp(t,0.,1.)*127.;
     int cell=int(index);
     return mix(texelFetch(ribbonPath,ivec2(cell,gl_InstanceID),0).xyz,
                texelFetch(ribbonPath,ivec2(min(127,cell+1),gl_InstanceID),0).xyz,fract(index));
    }
   `+shader.vertexShader.replace('#include <begin_vertex>',`
    #include <begin_vertex>
    vec3 tangent=normalize(ribbonPoint(uv.x+.008)-ribbonPoint(uv.x-.008));
    vec3 side=normalize(cross(tangent,vec3(1.,0.,0.)));
    float turn=-uv.y*6.2831853;
    vec3 radial=side*cos(turn)+cross(tangent,side)*sin(turn);
    transformed=ribbonPoint(uv.x)+radial*ribbonRadius;
   `);
   rotateOrbit(shader);
  };
  const ribbon=new THREE.InstancedMesh(ribbonGeometry,material,strands);
  ribbon.frustumCulled=false;ribbon.renderOrder=3;group.add(ribbon);
 }
 for(const [mesh,haloPass] of [[core,false],[halo,true]]){
  mesh.frustumCulled=false;mesh.renderOrder=4;group.add(mesh);
  mesh.material.onBeforeCompile=shader=>{
   shader.uniforms.orbit={value:orbit};
   shader.uniforms.orbitTime=clock;
   shader.uniforms.orbitSpeed={value:speed};
   shader.uniforms.orbRadius={value:orbRadius};
   shader.uniforms.orbHalo={value:haloPass};
   shader.vertexShader='uniform sampler2D orbit;uniform float orbitTime,orbitSpeed,orbRadius;uniform bool orbHalo;\n'+shader.vertexShader
    .replace('#include <begin_vertex>',`
     #include <begin_vertex>
     int path=gl_InstanceID/2;
     float id=float(gl_InstanceID);
     float u=fract(orbitTime*orbitSpeed*.12+mod(id,2.)*.5+float(path)*.19);
     float samplePosition=u*127.;
     int cell=int(floor(samplePosition));
     vec3 a=texelFetch(orbit,ivec2(cell,path),0).xyz;
     vec3 b=texelFetch(orbit,ivec2(min(cell+1,127),path),0).xyz;
     float fade=smoothstep(0.,.07,u)*(1.-smoothstep(.93,1.,u));
     float scale=orbRadius*fade*(orbHalo?2.25*(1.+.10*sin(orbitTime*6.+id)):1.);
     transformed=mix(a,b,fract(samplePosition))+position*scale;
    `);
   rotateOrbit(shader);
  };
 }
 group.userData.updateFlow=time=>{clock.value=time;};
 return group;
}

/** Preallocated segmented bolts hug the moving blade, with no per-swing geometry allocation. */
function swingLightning(){
 const group=new THREE.Group();group.name='samurai_swing_lightning';
 const geometry=new THREE.CylinderGeometry(1,1,1,5),capacity=56;
 const core=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color:'#fff9d4',transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending}),capacity);
 const halo=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color:'#efc853',transparent:true,opacity:.23,depthWrite:false,blending:THREE.AdditiveBlending}),capacity);
 const strike={value:new THREE.Vector3()};
 for(const [mesh,radiusScale] of [[core,1],[halo,3]]){
  mesh.frustumCulled=false;
  group.add(mesh);
  mesh.material.onBeforeCompile=shader=>{
   shader.uniforms.strike=strike;
   shader.uniforms.radiusScale={value:radiusScale};
   shader.vertexShader=`
    uniform vec3 strike;
    uniform float radiusScale;
    vec3 boltPoint(float branch,float segment){
     float u=segment/8.,angle=branch*2.399+strike.x*.37;
     float r=.075+sin(3.14159265*u)*strike.z;
     float y=.23+mod(branch*.173+strike.x*.071,.85)+u*.42;
     float jitter=(segment==0.||segment==8.)?0.:sin(segment*13.3+branch*7.1+strike.x*3.7)*.045;
     return vec3(cos(angle)*(r+jitter),y,sin(angle)*(r-jitter));
    }
   `+shader.vertexShader.replace('#include <begin_vertex>',`
    #include <begin_vertex>
    float id=float(gl_InstanceID),branch=floor(id/8.),segment=mod(id,8.);
    vec3 start=boltPoint(branch,segment),end=boltPoint(branch,segment+1.);
    vec3 delta=end-start,axis=normalize(delta);
    vec3 rotation=cross(vec3(0.,1.,0.),axis);
    vec3 local=position*vec3(strike.y*radiusScale,length(delta),strike.y*radiusScale);
    transformed=(start+end)*.5+local+cross(rotation,local)+cross(rotation,cross(rotation,local))/(1.+axis.y);
   `);
  };
 }
 group.userData.update=(phase,time)=>{
  const branches=phase>=3?7:3,width=phase>=3?.010:.005,speed=phase>=3?23:12;
  core.count=halo.count=branches*8;
  group.userData.branches=branches;group.userData.width=width;group.userData.speed=speed;
  strike.value.set(Math.floor(time*speed),width,phase>=3?.32:.18);
 };
 return group;
}

/** Detached ribbons orbit the weapon; the blade's own surface stays unchanged. */
export function createSamuraiPhaseEffects(root){
 const aura=new THREE.Group();aura.name='samurai_orbiting_blade_glow';aura.matrixAutoUpdate=false;root.add(aura);
 // The guard ends at ~0.10m in blade-bone space; leave room for the soft halo.
 const phase2=windingGlow(.20,1.64,{strands:2,coreRadius:.006,haloRadius:.020,speed:2.2,coreColor:'#ffe49a',haloColor:'#d5a64d'});
 const phase3=windingGlow(.20,1.64,{strands:4,coreRadius:.011,haloRadius:.034,speed:4.8,coreColor:'#ffeab3',haloColor:'#e8b957'});
 phase2.name='phase2_full_orbits';phase3.name='phase3_full_orbits';aura.add(phase2,phase3);
 const slashLightning=swingLightning();aura.add(slashLightning);
 const bolt=new THREE.Group();bolt.name='samurai_sky_lightning';root.add(bolt);
 const boltAge={value:0},boltPaths=[];
 for(let branch=0;branch<3;branch++){
  const points=[];
  for(let i=0;i<=16;i++){
   const u=i/16,spread=(1-u)*(.18+branch*.09);
   points.push(new THREE.Vector3(Math.sin(i*2.7+branch*3)*spread,6.5*(1-u),Math.cos(i*3.3+branch)*spread));
  }
  boltPaths.push(new THREE.CatmullRomCurve3(points,false,'centripetal'));
 }
 for(const [width,opacity,color] of [[.018,1,'#e5ffe7'],[.060,.20,'#8fe7a1']]){
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});
  mat.onBeforeCompile=shader=>{
   shader.uniforms.boltAge=boltAge;
   shader.fragmentShader='uniform float boltAge;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
    #include <color_fragment>
    diffuseColor.a=min(1.,diffuseColor.a*exp(-boltAge*11.)*(1.+.2*sin(boltAge*80.)));
   `);
  };
  const parts=boltPaths.map(path=>new THREE.TubeGeometry(path,48,width,5,false));
  bolt.add(new THREE.Mesh(mergeGeometries(parts),mat));
  for(const part of parts)part.dispose();
 }
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  uniforms:{groundPhase:{value:new THREE.Vector3()},groundRadius:{value:1},clock:{value:0},warningTint:{value:new THREE.Color()}},
  vertexShader:'varying vec2 p;uniform float groundRadius;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position*groundRadius,1.);}',
  fragmentShader:`varying vec2 p;uniform vec3 groundPhase,warningTint;uniform float clock;
  ${warningPulseGLSL}
  void main(){
   float power=groundPhase.z>0.? .12+.2*min(1.,groundPhase.x/max(.01,groundPhase.y))+.28*warningPulse(groundPhase.y-groundPhase.x):max(0.,1.-groundPhase.x/.65);
   float r=length(p),a=atan(p.y,p.x);float rim=exp(-pow((r-.94)/.035,2.));
   float veins=pow(max(0.,sin(a*13.+r*17.-clock*12.)),18.)*(1.-smoothstep(.3,1.,r));
   vec3 tint=groundPhase.z>0.?warningTint:vec3(.48,.82,.58);
   gl_FragColor=vec4(tint,(rim*.7+veins*.6)*power);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`,
 }));
 ground.name='samurai_lightning_radius';ground.rotation.x=-Math.PI/2;ground.position.y=.025;ground.frustumCulled=false;root.add(ground);
 const inverse=new THREE.Matrix4(),position=new THREE.Vector3();
 return {update(e,time,model){
  const blade=model?.getObjectByName('blade'),alive=e.health>0&&e.state!=='dead';
  aura.visible=Boolean(alive&&blade&&e.phase>=2);phase2.visible=e.phase===2;phase3.visible=e.phase>=3;
  root.updateWorldMatrix(true,false);
  if(blade){
   inverse.copy(root.matrixWorld).invert();aura.matrix.multiplyMatrices(inverse,blade.matrixWorld);
   position.set(0,1.58,0).applyMatrix4(blade.matrixWorld).applyMatrix4(inverse);bolt.position.copy(position);
  }
  slashLightning.visible=Boolean(alive&&blade&&e.phase>=2&&samuraiStrikeActive(e));
  if(slashLightning.visible)slashLightning.userData.update(e.phase,time);
  if(aura.visible){const phase=e.phase>=3?phase3:phase2;phase.userData.updateFlow(time);}
  const age=time-(e.lightningAt??-Infinity);
  bolt.visible=Boolean(alive&&blade&&age>=0&&age<.32);
  if(bolt.visible)boltAge.value=age;
  const preparing=e.state==='transition'&&!e.transitionHit&&attackWarningActive(e.elapsed,e.transitionStrikeAt);
  ground.visible=alive&&(preparing||age>=0&&age<.65);
  if(ground.visible){
   if(preparing)ground.material.uniforms.warningTint.value.set(attackWarningColor(e.move));
   ground.material.uniforms.groundRadius.value=SAMURAI_TRANSITION.radius;
   ground.material.uniforms.clock.value=time;
   const warningElapsed=preparing?Math.max(0,e.elapsed-attackWarningStart(e.transitionStrikeAt)):age;
   ground.material.uniforms.groundPhase.value.set(warningElapsed,ATTACK_PREVIEW_LEAD,preparing?1:0);
  }
 }};
}
