import * as T from 'three';
import {createEffectInstances} from './effect-instances.js';

/** The three additive shells of every orb share one GPU draw. */
export function createWaveView(scene){
 const root=new T.Group();
 root.name='气功光球';root.userData.cameraOcclusion=false;scene.add(root);
 const point=new T.Vector3(),clock={value:0};
 const material=new T.ShaderMaterial({
  transparent:true,blending:T.AdditiveBlending,depthWrite:false,
  uniforms:{clock,colors:{value:['#fffce1','#ffe7a1','#eebd4a'].map(color=>new T.Color(color))}},
  vertexShader:`
   uniform float clock;
   uniform vec3 colors[3];
   attribute vec4 orb;
   attribute float waveFade;
   varying vec4 glow;
   void main(){
    int shell=gl_InstanceID%3;
    float radius=shell==0?.12:shell==1?.20:.29;
    float opacity=shell==0?.95:shell==1?.52:.13;
    float scale=1.15+.03*sin(clock*22.);
    float fade=clamp(waveFade,0.,1.);
    if(orb.w>=0.){
     float pulse=orb.w>=1.?max(0.,1.-fract(orb.w)/.16):0.;
     scale=(.8+.12*min(orb.w,3.))*(1.+pulse*.22);
     fade=smoothstep(0.,.2,orb.w)*(.8+pulse*.2);
    }
    glow=vec4(colors[shell],opacity*fade);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(orb.xyz+position*radius*scale,1.);
   }`,
  fragmentShader:`
   varying vec4 glow;
   void main(){
    gl_FragColor=glow;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`
 });
 const instances=createEffectInstances(root,{
  initialCapacity:8,copies:3,
  attributes:{orb:4,waveFade:1},
  layers:[{geometry:new T.SphereGeometry(1,24,16),material}],
 });
 return {root,update(battle,hand=null,heading=0){
  const preparing=Boolean(battle.counterCharge)||(battle.attack?.name==='CounterWave'&&!battle.attack.waveReleased);
  const charging=Boolean(preparing&&battle.player.health>0&&hand);
  const count=battle.waves.length+Number(charging);
  const {orb,waveFade}=instances.ensure(count);
  clock.value=battle.time;
  let index=0;
  if(charging){
   hand.getWorldPosition(point);
   point.x+=Math.sin(heading)*.16;point.z+=Math.cos(heading)*.16;
   orb.setXYZW(index++,point.x,point.y,point.z,battle.counterCharge?battle.counterChargeElapsed:3);
   battle.counterOrbOrigin={x:point.x,y:point.y,z:point.z};
  }else battle.counterOrbOrigin=null;
  for(const wave of battle.waves){
   orb.setXYZW(index,wave.x,wave.visualY??(wave.yMin+wave.yMax)/2,wave.z,-1);
   waveFade.setX(index++,(wave.range-wave.travel)/.6);
  }
  instances.commit(count);
 }};
}
