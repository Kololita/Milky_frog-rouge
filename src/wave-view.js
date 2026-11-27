import * as T from 'three';
import {COUNTER_CHARGE} from './battle-values.js';
import {createEffectInstances} from './effect-instances.js';

const orbPalettes={
 normal:['#fffce1','#ffe7a1','#eebd4a'],
 water:['#eefeff','#74dfff','#278ee6'],
 fire:['#fff1d2','#ffa044','#f34623'],
 electric:['#f4f8ff','#c3b5ff','#7565ff'],
};
const orbPaletteIndex=Object.fromEntries(Object.keys(orbPalettes).map((element,index)=>[element,index]));

/** The three additive shells of every orb share one GPU draw. */
export function createWaveView(scene){
 const root=new T.Group();
 root.name='气功光球';root.userData.cameraOcclusion=false;scene.add(root);
 const point=new T.Vector3(),clock={value:0},maxStages={value:COUNTER_CHARGE.maxStages};
 const material=new T.ShaderMaterial({
  transparent:true,blending:T.AdditiveBlending,depthWrite:false,
  uniforms:{clock,maxStages,colors:{value:Object.values(orbPalettes).flat().map(color=>new T.Color(color))}},
  vertexShader:`
   uniform float clock,maxStages;
   uniform vec3 colors[12];
   attribute vec4 orb;
   attribute float waveFade;
   attribute float orbElement;
   varying vec4 glow;
   void main(){
    int shell=gl_InstanceID%3;
    float radius=shell==0?.12:shell==1?.20:.29;
    float opacity=shell==0?.95:shell==1?.52:.13;
    float scale=1.15+.03*sin(clock*22.);
    float fade=clamp(waveFade,0.,1.);
    if(orb.w>=0.){
     float pulse=orb.w>=1.?max(0.,1.-fract(orb.w)/.16):0.;
     scale=(.8+.12*min(orb.w,maxStages))*(1.+pulse*.22);
     fade=smoothstep(0.,.2,orb.w)*(.8+pulse*.2);
    }
    glow=vec4(colors[3*int(orbElement)+shell],opacity*fade);
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
  attributes:{orb:4,waveFade:1,orbElement:1},
  layers:[{geometry:new T.SphereGeometry(1,24,16),material}],
 });
 return {root,update(battle,hand=null,heading=0){
  const preparing=Boolean(battle.counterCharge)||(battle.attack?.name==='CounterWave'&&!battle.attack.waveReleased);
  const charging=Boolean(preparing&&battle.player.health>0&&hand);
  const count=battle.waves.length+Number(charging);
  const {orb,waveFade,orbElement}=instances.ensure(count);
  clock.value=battle.time;
  maxStages.value=COUNTER_CHARGE.maxStages;
  let index=0;
  if(charging){
   hand.getWorldPosition(point);
   point.x+=Math.sin(heading)*.16;point.z+=Math.cos(heading)*.16;
   orbElement.setX(index,orbPaletteIndex[battle.chargedOrbElement]??0);
   orb.setXYZW(index++,point.x,point.y,point.z,battle.counterCharge?battle.counterChargeStageProgress:maxStages.value);
   battle.counterOrbOrigin={x:point.x,y:point.y,z:point.z};
  }else battle.counterOrbOrigin=null;
  for(const wave of battle.waves){
   orb.setXYZW(index,wave.x,wave.visualY??(wave.yMin+wave.yMax)/2,wave.z,-1);
   orbElement.setX(index,orbPaletteIndex[wave.element]??0);
   waveFade.setX(index++,(wave.range-wave.travel)/.6);
  }
  instances.commit(count);
 }};
}
