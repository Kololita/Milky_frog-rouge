import * as THREE from 'three';
import {ENERGY_STATS} from './battle-values.js';
import {createGpuPoints} from './gpu-particles.js';
import {createEffectLight} from './effect-light.js';

const smooth=(a,b,x)=>{const u=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return u*u*(3-2*u);};

/** Right-arm pose layered after locomotion; its changes are restored each frame. */
export function createEnergyAbsorption(scene) {
  const count=48,rainUniforms={uHand:{value:new THREE.Vector3()},uPlayer:{value:new THREE.Vector3()},uProgress:{value:0}};
  const rain=createGpuPoints({count,color:'#ffdc70',size:.042,uniforms:rainUniforms,
    declarations:'uniform vec3 uHand; uniform vec3 uPlayer; uniform float uProgress;',
    transform:`float angle=seed*2.39996; float phase=fract(uProgress*1.7+seed/48.0);
      vec3 origin=uHand+vec3(cos(angle)*.14,0.0,sin(angle)*.14);
      vec3 target=uPlayer+vec3(cos(angle)*.40,.66+mod(seed,3.0)*.13,sin(angle)*.33);
      transformed=mix(origin,target,phase);`,
    samplePosition(i,target){const a=i*2.39996,p=(rainUniforms.uProgress.value*1.7+i/count)%1;
      return target.copy(rainUniforms.uHand.value).add(new THREE.Vector3(Math.cos(a)*.14,0,Math.sin(a)*.14))
        .lerp(new THREE.Vector3(Math.cos(a)*.40,.66+(i%3)*.13,Math.sin(a)*.33).add(rainUniforms.uPlayer.value),p);},
  });
  const material=rain.material;rain.name='吸收能量金光雨';rain.visible=false;scene.add(rain);
  const light=createEffectLight(scene,'#ffd15c',2);
  let rig,player,upper,forearm,hand;
  const saved=new Map(),fingers=new Map(),materials=new WeakSet();
  const glowTiming={value:new THREE.Vector2(-1,ENERGY_STATS.duration)};
  let poseApplied=false;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),right=new THREE.Vector3(),forward=new THREE.Vector3();
  const target=new THREE.Vector3(),axis=new THREE.Vector3(),guide=new THREE.Vector3(),elbow=new THREE.Vector3(),start=new THREE.Vector3(),end=new THREE.Vector3();
  const parentQ=new THREE.Quaternion(),worldQ=new THREE.Quaternion(),delta=new THREE.Quaternion(),gold=new THREE.Color('#ffc845');
  const aimFrom=new THREE.Vector3(),aimTo=new THREE.Vector3(),solvedUpper=new THREE.Quaternion(),solvedForearm=new THREE.Quaternion();
  function aim(bone,child,destination) {
    bone.getWorldPosition(start);child.getWorldPosition(end);
    const from=aimFrom.copy(end).sub(start).normalize(),to=aimTo.copy(destination).sub(start).normalize();
    delta.setFromUnitVectors(from,to);bone.getWorldQuaternion(worldQ);worldQ.premultiply(delta);
    bone.parent.getWorldQuaternion(parentQ);bone.quaternion.copy(parentQ.invert().multiply(worldQ));
    bone.updateWorldMatrix(false,true);
  }
  function prepare() {
    if(poseApplied){for(const [bone,q] of saved)bone.quaternion.copy(q);poseApplied=false;}
    glowTiming.value.x=-1;
  }
  return {rain,light,
    bind(model,owner) {
      rig=model;player=owner;upper=rig.getObjectByName('upper_armR');forearm=rig.getObjectByName('forearmR');hand=rig.getObjectByName('handR');
      rig.traverse(o=>{
        if(o.isBone&&/^(?:f_|thumb).*R$/.test(o.name))fingers.set(o,o.quaternion.clone());
        if(o.isMesh&&!/^Frog_/.test(o.name))for(const m of (Array.isArray(o.material)?o.material:[o.material])){
          if(!m.emissive||materials.has(m))continue;
          materials.add(m);
          const compile=m.onBeforeCompile,cacheKey=m.customProgramCacheKey();
          const baseColor={value:m.emissive.clone()},baseIntensity={value:m.emissiveIntensity};
          m.onBeforeCompile=function(shader,renderer){
            compile.call(this,shader,renderer);
            Object.assign(shader.uniforms,{glowTiming,absorbGold:{value:gold},absorbBaseColor:baseColor,absorbBaseIntensity:baseIntensity});
            shader.fragmentShader='uniform vec2 glowTiming;uniform vec3 absorbGold,absorbBaseColor;uniform float absorbBaseIntensity;\n'+shader.fragmentShader
              .replace('#include <emissivemap_fragment>',`
               float glow=smoothstep(.48,.78,glowTiming.x)*(1.-smoothstep(.94,glowTiming.y,glowTiming.x));
               if(glow>0.)totalEmissiveRadiance=mix(absorbBaseColor,absorbGold,glow)*(absorbBaseIntensity+glow*1.25);
               #include <emissivemap_fragment>
              `);
          };
          m.customProgramCacheKey=()=>cacheKey+':gpu-energy-glow';
          m.needsUpdate=true;
        }
      });
      for(const bone of [upper,forearm,hand,...fingers.keys()])if(bone&&!saved.has(bone))saved.set(bone,new THREE.Quaternion());
    },
    prepare,
    clear(){prepare();rain.visible=false;light.intensity=0;},
    update(elapsed,time=0) {
      rain.visible=false;light.intensity=0;
      if(elapsed===null||!upper||!forearm||!hand)return;
      const weight=smooth(0,ENERGY_STATS.raiseEnd,elapsed)*(1-smooth(ENERGY_STATS.glowEnd,ENERGY_STATS.duration,elapsed));
      upper.updateWorldMatrix(true,true);
      upper.getWorldPosition(a);forearm.getWorldPosition(b);hand.getWorldPosition(c);
      const l1=a.distanceTo(b),l2=b.distanceTo(c),length=(l1+l2)*.98;
      player.getWorldQuaternion(parentQ);
      right.set(-1,0,0).applyQuaternion(parentQ);forward.set(0,0,1).applyQuaternion(parentQ);
      axis.set(0,1,0).addScaledVector(right,.16).addScaledVector(forward,.10).normalize();
      target.copy(a).addScaledVector(axis,length);
      const projection=(l1*l1-l2*l2+length*length)/(2*length),bend=Math.sqrt(Math.max(0,l1*l1-projection*projection));
      guide.copy(right).addScaledVector(forward,.4);guide.addScaledVector(axis,-guide.dot(axis)).normalize();
      elbow.copy(a).addScaledVector(axis,projection).addScaledVector(guide,bend);
      for(const [bone,q] of saved)q.copy(bone.quaternion);
      poseApplied=true;
      aim(upper,forearm,elbow);aim(forearm,hand,target);
      solvedUpper.copy(upper.quaternion);solvedForearm.copy(forearm.quaternion);
      upper.quaternion.slerpQuaternions(saved.get(upper),solvedUpper,weight);
      forearm.quaternion.slerpQuaternions(saved.get(forearm),solvedForearm,weight);
      for(const [bone,q] of fingers)bone.quaternion.slerp(q,weight);
      upper.updateWorldMatrix(false,true);
      hand.getWorldPosition(c);
      const glow=smooth(.48,.78,elapsed)*(1-smooth(.94,ENERGY_STATS.duration,elapsed));
      glowTiming.value.set(elapsed,ENERGY_STATS.duration);
      light.position.copy(player.position);light.position.y+=.9;light.intensity=glow*2;
      rain.visible=elapsed>=ENERGY_STATS.raiseEnd&&elapsed<ENERGY_STATS.rainEnd;
      if(rain.visible) {
        const u=(elapsed-ENERGY_STATS.raiseEnd)/(ENERGY_STATS.rainEnd-ENERGY_STATS.raiseEnd);
        rainUniforms.uHand.value.copy(c);rainUniforms.uPlayer.value.copy(player.position);rainUniforms.uProgress.value=u;
        material.opacity=Math.min(1,(1-u)*4);
      }
    },
  };
}
