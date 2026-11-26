import {createFlames,updateWaterClip,waterClipGLSL} from './flame-view.js';
import {ATTACK_PREVIEW_LEAD,attackWarningActive,attackWarningColor,attackWarningPulse,attackWarningStart,recoveryStrikeTime} from './attack-warning.js';
import {samuraiStrikeActive} from './samurai.js';
import {createSamuraiPhaseEffects} from './samurai-phase-effects.js';
import {MOB_RULES} from './monster-rules.js';
import * as THREE from 'three';

const clamp=x=>Math.max(0,Math.min(1,x));
const active=e=>['windup','recover'].includes(e.state);
function ring(root,name,color){
 // Feathered, irregular dust/light front rather than a solid neon torus.
 const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
  uniforms:{tint:{value:new THREE.Color(color)},opacity:{value:.5},clock:{value:0},
   shape:{value:new THREE.Vector4(1,0,0,0)},motion:{value:new THREE.Vector2()},
   fade:{value:new THREE.Vector3(0,1,1)}},
  vertexShader:`varying vec2 p;uniform vec4 shape;uniform vec2 motion;uniform float clock;
   void main(){
    p=uv*2.-1.;
    float angle=clock*shape.w;
    float c=cos(angle),s=sin(angle);
    vec2 xy=mat2(c,s,-s,c)*position.xy*(shape.x+shape.y*motion.x+shape.z*motion.y);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(xy,position.z,1.);
   }`,
  fragmentShader:`varying vec2 p;uniform vec3 tint,fade;uniform float opacity,clock;
   void main(){float a=atan(p.y,p.x),r=length(p);float edge=.78+.018*sin(a*9.+clock*2.)+.012*sin(a*17.-clock);
   float rim=exp(-pow((r-edge)/.036,2.));float mist=exp(-pow((r-edge+.07)/.10,2.))*.28;
   float grain=.68+.18*sin(a*23.+r*31.-clock*3.)+.10*sin(a*41.-clock);
   float strength=(opacity+fade.x*clamp(fade.y,0.,1.))*clamp(fade.z,0.,1.);
   float alpha=(rim+mist)*grain*strength*(1.-smoothstep(.92,1.,r));
   gl_FragColor=vec4(tint,alpha);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   }`});
 Object.defineProperty(mat,'opacity',{get(){return this.uniforms.opacity.value;},set(v){if(this.uniforms)this.uniforms.opacity.value=v;},configurable:true});
 mat.color=mat.uniforms.tint.value;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2.5,2.5),mat);mesh.name=name;mesh.frustumCulled=false;root.add(mesh);return mesh;
}
function motes(root,name,color,count=28){
 const motion={value:new THREE.Vector4()};
 const envelope={value:new THREE.Vector4(0,0,0,1)};
 const material=new THREE.MeshStandardMaterial({color,roughness:.8,metalness:.05,transparent:true,opacity:.6,depthWrite:false});
 material.onBeforeCompile=shader=>{
  shader.uniforms.moteMotion=motion;
  shader.uniforms.moteEnvelope=envelope;
  shader.fragmentShader='uniform vec4 moteEnvelope;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
    #include <color_fragment>
    diffuseColor.a=(opacity+moteEnvelope.y*moteEnvelope.z)*clamp(moteEnvelope.w,0.,1.);
  `);
  shader.vertexShader='uniform vec4 moteMotion, moteEnvelope;\n'+shader.vertexShader
   .replace('#include <beginnormal_vertex>',`
    #include <beginnormal_vertex>
    float i=float(gl_InstanceID),phase=moteMotion.z;
    vec3 c=cos(vec3(i+phase,i*.6,phase*.4)),s=sin(vec3(i+phase,i*.6,phase*.4));
    mat3 rx=mat3(1.,0.,0.,0.,c.x,s.x,0.,-s.x,c.x);
    mat3 ry=mat3(c.y,0.,-s.y,0.,1.,0.,s.y,0.,c.y);
    mat3 rz=mat3(c.z,s.z,0.,-s.z,c.z,0.,0.,0.,1.);
    mat3 spin=rx*ry*rz;
    objectNormal=spin*objectNormal;
   `)
   .replace('#include <begin_vertex>',`
    #include <begin_vertex>
    float seed=fract(i*.61803398875);
    float angle=i*2.399963+phase*.25;
    float radius=(moteMotion.x+moteEnvelope.x*moteEnvelope.z)*(.55+.45*seed);
    bool scatter=moteMotion.w>.5;
    float lift=scatter?sin(3.141593*clamp(phase,0.,1.))*(.12+.25*seed):(.5+.5*sin(phase*2.+i))*.18;
    float size=(scatter?.018:.009)*(.6+seed);
    transformed=spin*position*size+vec3(sin(angle)*radius,moteMotion.y+lift,cos(angle)*radius);
   `);
 };
 material.customProgramCacheKey=()=> 'gpu-monster-motes';
 const mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),material,count);
 mesh.name=name;mesh.frustumCulled=false;root.add(mesh);
 return {mesh,envelope:envelope.value,update(radius,height,phase,scatter=false){
  motion.value.set(radius,height,phase,scatter?1:0);
 }};
}
function curvedSpine(){
 const positions=[],indices=[],uv=[];const rows=8,sides=8;
 for(let j=0;j<=rows;j++)for(let i=0;i<=sides;i++){
  const t=j/rows,a=i/sides*Math.PI*2,r=.065*Math.pow(1-t,1.15);
  positions.push(Math.cos(a)*r+.055*t*t,t-.5,Math.sin(a)*r);uv.push(i/sides,t);
 }
 for(let j=0;j<rows;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+sides+1;indices.push(a,b,a+1,a+1,b,b+1);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.addGroup(0,6*sides*3,0);geo.addGroup(6*sides*3,indices.length-6*sides*3,1);geo.computeVertexNormals();return geo;
}
function shellbug(root){
 const mat=[new THREE.MeshStandardMaterial({color:'#48534d',metalness:.45,roughness:.43}),new THREE.MeshStandardMaterial({color:'#9b8665',metalness:.35,roughness:.5})];
 const motion={value:new THREE.Vector4()};
 for(const material of mat){
  material.onBeforeCompile=shader=>{
   shader.uniforms.spikeMotion=motion;
   shader.vertexShader=`
    uniform vec4 spikeMotion;
    vec3 spinSpike(vec3 p,vec3 axis){
     vec3 crossAxis=cross(vec3(0.,1.,0.),axis);
     return p+cross(crossAxis,p)+cross(crossAxis,cross(crossAxis,p))/(1.+axis.y);
    }
   `+shader.vertexShader.replace('#include <beginnormal_vertex>',`
    #include <beginnormal_vertex>
    float angle=float(gl_InstanceID)*.5235987756;
    vec3 radial=vec3(sin(angle),0.,cos(angle));
    vec3 axis=normalize(radial+vec3(0.,.12,0.));
    float extension=(.04+.08*spikeMotion.y+.88*smoothstep(0.,1.,spikeMotion.z))*(1.-spikeMotion.w);
    float spikeLength=max(.02,spikeMotion.x-.43)*extension;
    objectNormal=spinSpike(objectNormal*vec3(1.,1./max(.0001,spikeLength),1.),axis);
   `).replace('#include <begin_vertex>',`
    #include <begin_vertex>
    transformed=spinSpike(position*vec3(1.,spikeLength,1.),axis)+radial*(.43+spikeLength*.5)+vec3(0.,.32,0.);
   `);
  };
 }
 const spikes=new THREE.InstancedMesh(curvedSpine(),mat,12);
 spikes.name='shellbug_spike_effect';spikes.frustumCulled=false;root.add(spikes);
 return (e,time,prep,strike,recover)=>{
  spikes.visible=active(e)&&e.move?.motion==='spikes';
  if(!spikes.visible)return;
  const hitAt=(e.telegraph??0)+(e.swingDuration??.3)*MOB_RULES.hitProgress;
  const burst=e.state==='recover'?1:(e.elapsed-hitAt+.035)/.035;
  motion.value.set(e.move?.reach??1,prep,burst,recover);
 };
}
function lantern(root){
 const pulse=ring(root,'lantern_attack_pulse','#d4c49a');
 const pulseUniforms=pulse.material.uniforms;
 const glowMotion={value:new THREE.Vector3()};
 const auraMat=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{glowMotion},
  vertexShader:`
   varying vec3 n,v;
   uniform vec3 glowMotion;
   void main(){
    float scale=1.+glowMotion.x*glowMotion.z;
    vec4 p=modelViewMatrix*vec4(position*scale,1.);
    n=normalize(normalMatrix*normal);v=normalize(-p.xyz);
    gl_Position=projectionMatrix*p;
   }`,
  fragmentShader:`
   varying vec3 n,v;
   uniform vec3 glowMotion;
   void main(){
    float strength=(.12+.28*glowMotion.x)*(1.-glowMotion.y);
    float rim=pow(1.-abs(dot(normalize(n),normalize(v))),2.);
    gl_FragColor=vec4(.85,.65,.32,rim*strength);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`
 });
 const aura=new THREE.Mesh(new THREE.SphereGeometry(.29,24,16),auraMat);
 aura.name='lantern_charge_glow';aura.position.y=.55;aura.frustumCulled=false;root.add(aura);
 const sparks=motes(root,'lantern_embers','#c7a369');
 return (e,time,prep,strike,recover)=>{
  const casting=active(e),buff=e.move?.kind==='buff',ranged=e.move?.kind==='projectile';
  pulse.visible=casting&&(e.state!=='recover'||e.elapsed<.35);
  pulse.material.color.set(buff?'#c9aa68':'#d4c49a');pulse.material.uniforms.clock.value=time;
  const recovering=e.state==='recover';
  pulse.material.opacity=recovering?.45:.12;
  pulseUniforms.fade.value.set(recovering?0:.23,prep,recovering?1-e.elapsed/.35:1);
  pulse.position.set(0,buff?.55:ranged?.55:.06-(e.height??0),ranged?.25:0);
  pulse.rotation.x=buff||ranged?0:Math.PI/2;
  const reach=e.move?.reach??2.05;
  if(ranged)pulseUniforms.shape.value.set(.3,.3,0,0);
  else if(buff)pulseUniforms.shape.value.set(.4,.6,1,2);
  else pulseUniforms.shape.value.set(reach*.2,reach*.8,0,0);
  pulseUniforms.motion.value.set(ranged||buff?prep:clamp(e.elapsed/Math.max(.01,e.windup)),strike);
  aura.visible=casting;glowMotion.value.set(prep,recover,buff ? .35 : .15);
  sparks.mesh.visible=casting;sparks.mesh.material.opacity=.2;
  sparks.envelope.set(buff ? .15 : 0,.4,prep,1-recover);
  sparks.update(buff ? .32 : .24,.42,time);
 };
}
function stonekeeper(root){
 const quake=ring(root,'stonekeeper_quake_effect','#9e927e');quake.rotation.x=Math.PI/2;quake.position.y=.035;
 const debris=motes(root,'stonekeeper_ground_debris','#77756e',24);
 // One ground decal for all fissures. Branches open from the embedded head outwards.
 const fractureMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{growth:{value:0}},vertexShader:`varying vec2 ground;void main(){ground=(uv-.5)*2.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
 varying vec2 ground;uniform float growth;
 void main(){
  float r=length(ground),a=atan(ground.y,ground.x),sector=floor(a*1.4324+.5);
  float bend=.28*sin(r*17.+sector*8.)+.13*sin(r*39.+sector);
  float lane=abs(fract(a*1.4324+.5+bend*.36)-.5)*r;
  float branch=abs(fract(a*1.4324+.5+bend*.36+.5*max(r-.32,0.)*sin(sector+1.))-.5)*r;
  float d=min(lane,branch+.004);
  float width=mix(.026,.002,r),edge=max(fwidth(d),.001);
  float alpha=(1.-smoothstep(width,width+edge,d))*(1.-smoothstep(growth-.09,growth,r));
  gl_FragColor=vec4(mix(vec3(.028,.018,.012),vec3(.60,.42,.26),smoothstep(width*.45,width,d)),alpha);
 }`});
 const fissures=new THREE.Mesh(new THREE.PlaneGeometry(1,1),fractureMaterial);
 fissures.rotation.x=-Math.PI/2;fissures.visible=false;root.add(fissures);
 return (e,time)=>{
  const swinging=e.swingDuration??0;
  const release=e.move?.recoveryStrike;
  const releaseAt=release?recoveryStrikeTime(release):Infinity;
  const extracting=e.state==='recover'&&e.elapsed>=releaseAt;
  const age=extracting?e.elapsed-releaseAt:e.state==='recover'?e.elapsed+swinging*(1-MOB_RULES.hitProgress):e.elapsed-e.telegraph-swinging*MOB_RULES.hitProgress;
  const struck=Boolean(e.hitResolved),progress=struck?clamp(age/.5):0;
  const show=active(e)&&['quake','smash','stomp'].includes(e.move?.motion)&&progress<1;
  const radius=extracting?e.move.recoveryStrike.attack.reach:e.move?.motion==='smash'?1:e.move?.reach??1.8;
  const offset=e.move?.motion==='smash'?e.move.recoveryStrike:null;
  quake.position.set(offset?.side??0,.035,offset?.forward??0);
  debris.mesh.position.set(offset?.side??0,0,offset?.forward??0);
  fissures.visible=Boolean(extracting&&age<.60);
  if(fissures.visible){
   fissures.position.set(offset.side,.025,offset.forward);
   fissures.scale.setScalar(radius*2);
   fractureMaterial.uniforms.growth.value=Math.min(1,age/.18);
  }
  quake.visible=show;
  debris.mesh.visible=show&&struck;
  if(!show)return;
  quake.material.uniforms.shape.value.set(.25,Math.max(.3,radius)-.25,0,0);
  quake.material.uniforms.motion.value.x=progress;
  quake.material.uniforms.clock.value=time;
  quake.material.uniforms.opacity.value=struck?.65:.08;
  quake.material.uniforms.fade.value.set(0,1,1-progress);
  if(struck){
   debris.mesh.material.opacity=.7;
   debris.envelope.set(radius,0,progress,1-progress);
   debris.update(.35,.04,progress,true);
  }
 };
}
function weaponTrail(root,name,color){
 const count=10,positions=new Float32Array(count*6),uv=[],indices=[];
 for(let i=0;i<count;i++){uv.push(i/(count-1),0,i/(count-1),1);if(i<count-1){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
 const history=new Float32Array(count*6);
 const historyWindow=new THREE.Vector2(0,1);
 const material=new THREE.ShaderMaterial({
  side:THREE.DoubleSide,transparent:true,depthWrite:false,
  uniforms:{tint:{value:new THREE.Color(color)},history:{value:history},historyWindow:{value:historyWindow}},
  vertexShader:`
   varying vec2 t;
   uniform vec3 history[${count*2}];
   uniform vec2 historyWindow;
   void main(){
    t=uv;
    int sampleIndex=min(gl_VertexID/2,int(historyWindow.y)-1);
    int slot=(int(historyWindow.x)+sampleIndex)%${count};
    vec3 endpoint=history[slot*2+gl_VertexID%2];
    gl_Position=projectionMatrix*modelViewMatrix*vec4(endpoint,1.);
   }`,
  fragmentShader:'varying vec2 t;uniform vec3 tint;void main(){gl_FragColor=vec4(tint,.30*t.x*t.x*sin(t.y*3.14159));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
 });
 const trail=new THREE.Mesh(geometry,material);trail.name=name;trail.frustumCulled=false;root.add(trail);
 const a=new THREE.Vector3(),b=new THREE.Vector3();let written=0,cursor=0,cachedModel,cachedName,cachedBone;
 return {update(model,boneName,length,show){
  if(model!==cachedModel||boneName!==cachedName){cachedModel=model;cachedName=boneName;cachedBone=model?.getObjectByName(boneName);}const bone=cachedBone;trail.visible=Boolean(show&&bone);if(!trail.visible){written=cursor=0;return;}
  root.updateWorldMatrix(true,false);a.set(0,length*.70,0);b.set(0,length,0);bone.localToWorld(a);bone.localToWorld(b);root.worldToLocal(a);root.worldToLocal(b);
  a.toArray(history,cursor*6);b.toArray(history,cursor*6+3);
  cursor=(cursor+1)%count;written=Math.min(count,written+1);
  historyWindow.set((cursor-written+count)%count,written);
 }};
}
function mirrorGuard(root){
 const halo=ring(root,'mirror_parry_halo','#a7bbc2');halo.scale.set(.28,.38,1);
 const trail=weaponTrail(root,'mirror_blade_trail','#afb6b9');
 return (e,time,prep,strike,recover,model)=>{
  const success=time<(e.parryGlowUntil??-Infinity);
  const parry=e.move?.kind==='parry'&&e.state==='windup'&&e.elapsed>=e.move.parryStart&&e.elapsed<=e.move.parryEnd;
  halo.visible=success||parry;halo.material.color.set(success?'#d7b866':'#a7bbc2');halo.material.opacity=success?.7:.32;halo.material.uniforms.clock.value=time;
  const shield=model?.getObjectByName('shield');if(shield){root.updateWorldMatrix(true,false);shield.getWorldPosition(halo.position);root.worldToLocal(halo.position);halo.position.z+=.10;}else halo.position.set(-.35,1.10,.35);
  trail.update(model,'blade',.82,e.state==='windup'&&e.elapsed>=e.telegraph&&e.move?.kind==='melee');
  const plate=model?.getObjectByName('mirrorGuard_shield');if(plate){plate.visible=true; const materials=Array.isArray(plate.material)?plate.material:[plate.material];for(const mat of materials){mat.emissive.set(success?'#c2973d':'#168aff');mat.emissiveIntensity=success?.65:e.move?.motion==='shield-throw'&&e.state==='windup'?.8:.08;}}
 };
}
function samurai(root){
 const trail=weaponTrail(root,'samurai_blade_trail','#9faebb');
 const phaseEffects=createSamuraiPhaseEffects(root);
 return (e,time,prep,strike,recover,model)=>{
  phaseEffects.update(e,time,model);
  trail.update(model,'blade',1.70,samuraiStrikeActive(e));
 };
}
function scythemoth(root){
 const left=weaponTrail(root,'mantis_left_trail','#b4b898'),right=weaponTrail(root,'mantis_right_trail','#b4b898');
 return (e,time,prep,strike,recover,model)=>{const strikeNow=e.state==='windup'&&e.elapsed>=e.telegraph,both=['thrust','pounce'].includes(e.move?.motion);left.update(model,'scythe_L_2',.45,strikeNow&&(both||e.move?.motion==='cut-left'));right.update(model,'scythe_R_2',.45,strikeNow&&(both||e.move?.motion==='cut-right'));};
}
function spitter(root){
 const charge=ring(root,'spitter_muzzle_charge','#91a6ac');
 const uniforms=charge.material.uniforms;
 uniforms.shape.value.x=.10;
 charge.material.opacity=.12;
 return (e,time,prep,strike,recover,model)=>{
  charge.visible=active(e)&&e.move?.motion==='shoot'&&(e.state!=='recover'||e.elapsed<.15);
  if(!charge.visible)return;
  uniforms.clock.value=time;
  uniforms.fade.value.set(.30,prep,1-recover);
  const head=model?.getObjectByName('head');
  if(head){
   charge.position.set(0,.20,0);
   head.localToWorld(charge.position);
   root.worldToLocal(charge.position);
  }else charge.position.set(0,.9,.65);
 };
}
function cinderWarden(root){
 const stream=createFlames(root,{count:42,radius:0,height:0});stream.root.name='boiler_flame_cone';
 for(let i=0;i<stream.root.children.length;i++){const m=stream.root.children[i],z=.55+(i%14)*.46,spread=Math.tan(Math.PI/8)*z;m.position.set(((i*7%11)/10-.5)*spread*1.8,.45+(i%4)*.23,z);m.scale.set(1+z*.55,1,1);m.rotation.y=i%2?Math.PI/2:0;}
 const flowGeometry=new THREE.BufferGeometry(),spread=Math.tan(Math.PI/8)*7;
 flowGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.4,-spread,0,7,spread,0,7],3));flowGeometry.setAttribute('uv',new THREE.Float32BufferAttribute([.5,0,0,1,1,1],2));
 const flowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{water0:{value:new THREE.Vector3()},water1:{value:new THREE.Vector3()},water2:{value:new THREE.Vector3()},water3:{value:new THREE.Vector3()},clock:{value:0}},vertexShader:'varying vec3 waterWorld;varying vec2 v;void main(){v=uv;vec3 p=position+vec3(0.,.45+.35*float(gl_InstanceID),0.);waterWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',fragmentShader:waterClipGLSL+'varying vec3 waterWorld;varying vec2 v;void main(){if(waterClips(waterWorld.xz,16.))discard;float edge=pow(max(0.,1.-abs(v.x*2.-1.)),.5);float wave=.55+.25*sin(v.y*36.-clock*18.+sin(v.x*22.+clock*3.));float fade=(1.-smoothstep(.65,1.,v.y));vec3 c=mix(vec3(1.,.72,.23),vec3(.95,.26,.04),v.y);gl_FragColor=vec4(c,edge*fade*wave*.25);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
 const flow=new THREE.InstancedMesh(flowGeometry,flowMaterial,3);
 flowMaterial.forceSinglePass=true;
 flow.name='boiler_breath_flow';flow.frustumCulled=false;root.add(flow);
 const aura=createFlames(root,{count:52,radius:1.7,height:.22});aura.root.name='boiler_fire_ring';
 const ringClip={uniforms:{clock:{value:0},center:{value:new THREE.Vector2()},
  water0:{value:new THREE.Vector3()},water1:{value:new THREE.Vector3()},
  water2:{value:new THREE.Vector3()},water3:{value:new THREE.Vector3()}}};
 const ringUniforms=ringClip.uniforms;
 const ringMaterial=new THREE.MeshBasicMaterial({color:'#db873d',transparent:true,opacity:.18,side:THREE.DoubleSide,forceSinglePass:true,depthWrite:false});
 ringMaterial.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,ringUniforms);
  shader.vertexShader=waterClipGLSL+'uniform vec2 center;\n'+shader.vertexShader.replace('#include <project_vertex>',`
   #include <project_vertex>
   if(waterClips(center,5.95*5.95))
    gl_Position=vec4(2.,2.,2.,1.);
  `);
 };
 const ringMesh=new THREE.Mesh(new THREE.RingGeometry(1.45,1.95,64),ringMaterial);
 ringMesh.name='boiler_fire_ring_ground';ringMesh.rotation.x=-Math.PI/2;ringMesh.position.y=.025;root.add(ringMesh);
 const warning=ring(root,'boiler_pressure_warning','#fff');warning.rotation.x=-Math.PI/2;warning.position.y=.03;
 warning.material.toneMapped=false;
 return (e,time)=>{
  const channel=e.state==='windup'&&e.move?.kind==='channel',shooting=channel&&e.elapsed>=e.telegraph;
  flow.visible=shooting&&e.health>0;flowMaterial.uniforms.clock.value=time;updateWaterClip(flowMaterial,e.waterZones);stream.update(shooting&&e.health>0,time,.9,e.waterZones);
  const auraActive=Boolean(e.activeAura)&&e.health>0;
  aura.update(auraActive,time,.8,e.waterZones);
  ringMesh.visible=auraActive;
  if(auraActive){
   ringUniforms.clock.value=time;
   ringUniforms.center.value.set(e.x,e.z);
   updateWaterClip(ringClip,e.waterZones);
  }
  const cast=e.state==='windup'&&e.move?.kind==='aura';
  const impactAt=e.hitAt??e.telegraph;
  warning.visible=(channel||cast)&&attackWarningActive(e.elapsed,impactAt);
  if(warning.visible){
   const uniforms=warning.material.uniforms;
   uniforms.tint.value.set(attackWarningColor(cast?e.move.aura.hit:e.move));
   uniforms.clock.value=time;
   warning.material.opacity=.2+.25*attackWarningPulse(e);
   uniforms.fade.value.set(.5,clamp((e.elapsed-attackWarningStart(impactAt))/ATTACK_PREVIEW_LEAD),1);
   uniforms.shape.value.x=cast?2.2:.95;
  }
 };
}
const factories={cinderWarden,shellbug,lantern,stonekeeper,mirrorGuard,samurai,scythemoth,spitter};
/** Gameplay feedback is independent of whether the body is procedural or imported. */
export function createMonsterEffects(id){
 const root=new THREE.Group();root.name=`${id}_effects`;const animate=factories[id]?.(root)??(()=>{});
 root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
 return {root,animate};
}
