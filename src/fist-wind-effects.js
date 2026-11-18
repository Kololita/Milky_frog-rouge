import * as THREE from 'three';
import {createEffectInstances} from './effect-instances.js';

export function createFistWindEffects(scene,model){
 const root=new THREE.Group();root.name='拳风白气';root.userData.cameraOcclusion=false;scene.add(root);
 const hands=['handL','handR'].map(name=>model.getObjectByName(name));
 const point=new THREE.Vector3();
 const clock={value:0},elapsed={value:0};
 const material=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,
  uniforms:{clock,elapsed,strength:{value:.13}},
  vertexShader:`
   uniform float clock,elapsed;
   attribute vec4 origin;
   attribute vec2 flight;
   varying vec3 p;
   void main(){
    p=position;
    float id=float(gl_InstanceID%7);
    vec3 center=origin.xyz,local;
    if(origin.w<0.){
     float a=clock*2.5+id*6.283185/7.;
     center+=vec3(cos(a)*.09,sin(a*.7)*.045,sin(a)*.075);
     local=position*vec3(.075,.055,.085);
    }else{
     if(id==6.){gl_Position=vec4(2.,2.,2.,1.);return;}
     float u=clamp((elapsed-origin.w)/.18,0.,1.);
     float s=sin(flight.x),c=cos(flight.x);
     center+=vec3(s,0.,c)*flight.y*u;
     local=position*vec3(.10-id*.009,.07,.13)+vec3(0.,0.,-id*.06);
     local=vec3(c*local.x+s*local.z,local.y,-s*local.x+c*local.z)*(1.+.8*u);
    }
    gl_Position=projectionMatrix*modelViewMatrix*vec4(center+local,1.);
   }`,
  fragmentShader:`
   varying vec3 p;
   uniform float clock,strength;
   void main(){
    float mist=.55+.22*sin(p.x*8.+clock*3.)*sin(p.y*7.-clock*2.)+.15*sin(p.z*11.+clock);
    float edge=pow(max(0.,1.-abs(p.z)),2.);
    gl_FragColor=vec4(.92,.97,.96,max(0.,mist*edge*strength));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
 });
 const shots=[];
 const instances=createEffectInstances(root,{
  initialCapacity:16,copies:7,
  attributes:{origin:4,flight:2},
  layers:[{geometry:new THREE.SphereGeometry(1,10,8),material}],
 });
 function clear(){shots.length=0;instances.commit(0);elapsed.value=0;}
 return {clear,update(battle,events,dt){
  if(!battle.player.health){clear();return;}
  const active=battle.time<battle.player.fistwindUntil;
  clock.value=battle.time;
  elapsed.value+=dt;
  for(const e of events)if(e.type==='windShot'){
   point.set(e.x,1,e.z);
   hands[e.hand]?.getWorldPosition(point);
   shots.push({x:point.x,y:point.y,z:point.z,start:elapsed.value-dt,heading:e.heading,range:e.range});
  }
  let alive=0;
  for(const shot of shots)if(elapsed.value-shot.start<.18)shots[alive++]=shot;
  shots.length=alive;
  const {origin,flight}=instances.ensure(shots.length+hands.length);
  let i=0;
  if(active)for(const hand of hands){
   if(!hand)continue;
   hand.getWorldPosition(point);
   origin.setXYZW(i++,point.x,point.y,point.z,-1);
  }
  for(const shot of shots){
   origin.setXYZW(i,shot.x,shot.y,shot.z,shot.start);
   flight.setXY(i++,shot.heading,shot.range);
  }
  instances.commit(i);
 }};
}
