import * as THREE from 'three';
import {createEffectInstances} from './effect-instances.js';
import {FISTWIND_STATS} from './battle-values.js';

export function createFistWindEffects(scene,model,player){
 const root=new THREE.Group();
 root.name='拳风风场';
 root.userData.cameraOcclusion=false;
 scene.add(root);
 const hands=['handL','handR'].map(name=>model.getObjectByName(name));
 const point=new THREE.Vector3();
 const clock={value:0},elapsed={value:0},radius={value:FISTWIND_STATS.fieldRadius};
 const material=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,
  uniforms:{clock,elapsed,radius},
  vertexShader:`
   uniform float clock,elapsed,radius;
   attribute vec4 origin;
   attribute vec3 flight;
   varying vec2 ribbonUv;
   varying float fade;
   void main(){
    ribbonUv=uv;
    float u=uv.x,width=(uv.y-.5)*sin(u*3.141593);
    vec3 p=origin.xyz;
    fade=1.;
    if(origin.w<0.){
     float id=flight.x;
     float angle=clock*(id==1.?-2.9:2.9)+id*2.094395+u*2.3;
     float r=radius+.06*sin(angle*2.+id)+width*.15;
     float wave=sin(angle+id*2.094395)*.39;
     p+=vec3(r*cos(angle),.88+wave+width*.13,r*sin(angle));
    }else{
     float t=clamp((elapsed-origin.w)/flight.z,0.,1.);
     vec2 forward=vec2(sin(flight.x),cos(flight.x));
     vec2 side=vec2(forward.y,-forward.x);
     p.xz+=forward*(flight.y*t-(1.-u)*.57)+side*(width*.23+sin(u*3.141593)*.19);
     p.y+=width*.18+.07*sin(u*3.141593);
     fade=1.-t;
    }
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
   }`,
  fragmentShader:`
   varying vec2 ribbonUv;
   varying float fade;
   void main(){
    float u=ribbonUv.x,v=ribbonUv.y;
    float taper=smoothstep(0.,.16,u)*(1.-smoothstep(.78,1.,u));
    float rim=1.-smoothstep(.10,.50,abs(v-.5));
    float streak=.66+.34*cos(v*16.+u*2.);
    gl_FragColor=vec4(.83,1.,.97,fade*taper*rim*streak*.78);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
 });
 const flights=[];
 const instances=createEffectInstances(root,{
  initialCapacity:16,copies:1,attributes:{origin:4,flight:3},
  layers:[{geometry:new THREE.PlaneGeometry(1,1,24,1),material}],
 });
 function clear(){flights.length=0;instances.commit(0);elapsed.value=0;}
 return {clear,update(battle,events,dt,lift=0){
  if(!battle.player.health){clear();return;}
  const active=battle.time<battle.player.fistwindUntil;
  clock.value=battle.time;elapsed.value+=dt;radius.value=FISTWIND_STATS.fieldRadius;
  for(const event of events){
   if(event.type==='windShot'){
    point.set(event.x,1,event.z);hands[event.hand]?.getWorldPosition(point);
    flights.push({x:point.x,y:point.y,z:point.z,heading:event.heading,range:event.range,start:elapsed.value-dt,duration:.22,launched:true});
   }else if(event.type==='windReflect'){
    flights.push({...event,range:.68,start:elapsed.value-dt,duration:.25});
   }
  }
  let alive=0,launched=0;
  for(const effect of flights)if(elapsed.value-effect.start<effect.duration){
   flights[alive++]=effect;if(effect.launched)launched++;
  }
  flights.length=alive;
  const {origin,flight}=instances.ensure(flights.length+3);
  let i=0;
  if(active){
   player.getWorldPosition(point);
   for(let ribbon=0;ribbon<3;ribbon++){
    if(ribbon>=Math.max(1,3-launched))break;
    origin.setXYZW(i,point.x,point.y+lift,point.z,-1);
    flight.setXYZ(i++,ribbon,0,0);
   }
  }
  for(const effect of flights){
   origin.setXYZW(i,effect.x,effect.y,effect.z,effect.start);
   flight.setXYZ(i++,effect.heading,effect.range,effect.duration);
  }
  instances.commit(i);
 }};
}
