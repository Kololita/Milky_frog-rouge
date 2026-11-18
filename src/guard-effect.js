import {tunable} from './tuning-registry.js';
import * as THREE from 'three';
import {createEffectLight} from './effect-light.js';
import {createGpuPoints} from './gpu-particles.js';

export const GUARD_EFFECT=tunable('GUARD_EFFECT',{duration:.34,faceOpacity:.46,rimOpacity:.92,forwardOffset:.18,gold:'#ffd36a',silver:'#dce8f3',absorbStart:.035,absorbEnd:.20});

/** A brief shield at the blocking hand; no effect when merely raising guard. */
export function createGuardEffect(scene) {
  const group=new THREE.Group();group.name='格挡命中盾';group.visible=false;scene.add(group);
  const shape=new THREE.Shape();
  shape.moveTo(0,.36);shape.quadraticCurveTo(.15,.30,.29,.28);
  shape.lineTo(.27,-.05);shape.quadraticCurveTo(.22,-.24,0,-.38);
  shape.quadraticCurveTo(-.22,-.24,-.27,-.05);shape.lineTo(-.29,.28);
  shape.quadraticCurveTo(-.15,.30,0,.36);
  const faceMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:GUARD_EFFECT.faceOpacity,side:THREE.DoubleSide,depthWrite:false});
  const rimMaterial=new THREE.LineBasicMaterial({transparent:true,opacity:GUARD_EFFECT.rimOpacity,depthWrite:false});
  const shieldMotion={value:new THREE.Vector3()};
  for(const material of [faceMaterial,rimMaterial]){
    material.onBeforeCompile=shader=>{
      shader.uniforms.shieldMotion=shieldMotion;
      shader.vertexShader='uniform vec3 shieldMotion; varying float vShieldFade;\n'+shader.vertexShader.replace(
        '#include <begin_vertex>',`
        #include <begin_vertex>
        float progress=clamp(shieldMotion.x/shieldMotion.y,0.,1.);
        bool perfect=shieldMotion.z>.5;
        transformed*=perfect?max(.12,1.-progress*.88):1.+.14*progress;
        vShieldFade=perfect?1.-min(1.,shieldMotion.x/.10):pow(1.-progress,1.3);
        `);
      shader.fragmentShader='varying float vShieldFade;\n'+shader.fragmentShader.replace(
        '#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vShieldFade;');
    };
  }
  const face=new THREE.Mesh(new THREE.ShapeGeometry(shape,20),faceMaterial);face.renderOrder=3;group.add(face);
  const rim=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(shape.getPoints(32)),rimMaterial);rim.position.z=.002;rim.renderOrder=4;group.add(rim);
  const inner=rim.clone();inner.scale.setScalar(.84);group.add(inner);
  const glint=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-.07,0,.004),new THREE.Vector3(.07,0,.004),
    new THREE.Vector3(0,-.09,.004),new THREE.Vector3(0,.09,.004),
  ]),rimMaterial);glint.renderOrder=4;group.add(glint);
  const outline=shape.getPoints(32);
  const pointsCount=32;
  const pointUniforms={
    uTarget:{value:new THREE.Vector3()},uProgress:{value:0},
    uOrigin:{value:new THREE.Vector3()},uHeading:{value:0},
  };
  const points=createGpuPoints({count:pointsCount,color:GUARD_EFFECT.gold,size:.045,uniforms:pointUniforms,
    declarations:'uniform vec3 uTarget,uOrigin; uniform float uProgress,uHeading;',
    alpha:'absorption',
    transform:`
      float ease=1.0-pow(1.0-uProgress,2.0);
      vec3 start=uOrigin+vec3(position.x*cos(uHeading),position.y,-position.x*sin(uHeading));
      transformed=mix(start,uTarget,ease);
      transformed.y+=sin(3.14159265*uProgress)*.035*sin(seed*2.4);
      vParticleAlpha=1.0-.3*uProgress;
    `,
    samplePosition(i,target){
      const u=pointUniforms.uProgress.value,heading=pointUniforms.uHeading.value;
      const p=outline[Math.floor(i*outline.length/pointsCount)];
      target.set(p.x*Math.cos(heading),p.y,-p.x*Math.sin(heading))
        .add(pointUniforms.uOrigin.value).lerp(pointUniforms.uTarget.value,1-(1-u)**2);
      target.y+=Math.sin(Math.PI*u)*.035*Math.sin(i*2.4);
      return target;
    },
  });
  const pointsPosition=points.geometry.attributes.position;
  for(let i=0;i<pointsCount;i++){
    const p=outline[Math.floor(i*outline.length/pointsCount)];
    pointsPosition.setXYZ(i,p.x,p.y,0);
  }
  points.name='金盾汇入右手';points.visible=false;scene.add(points);
  const glow=new THREE.Group();glow.name='完美格挡右手金光';glow.visible=false;scene.add(glow);
  const coreMaterial=new THREE.MeshBasicMaterial({color:'#ffe7a1',transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false});
  const auraMaterial=new THREE.MeshBasicMaterial({color:'#ffc52f',transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false});
  const sphere=new THREE.SphereGeometry(1,16,12);
  const core=new THREE.Mesh(sphere,coreMaterial);core.scale.setScalar(.075);glow.add(core);
  const aura=new THREE.Mesh(sphere,auraMaterial);aura.scale.setScalar(.145);glow.add(aura);
  const sparkTime={value:0};
  const sparkMaterial=coreMaterial.clone();
  for(const material of [coreMaterial,auraMaterial]){
    material.onBeforeCompile=shader=>{
      shader.uniforms.guardPulseTime=sparkTime;
      shader.vertexShader='uniform float guardPulseTime;\n'+shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed*=1.+.10*sin(guardPulseTime*17.);');
    };
  }
  core.frustumCulled=aura.frustumCulled=false;
  sparkMaterial.onBeforeCompile=shader=>{
    shader.uniforms.sparkTime=sparkTime;
    shader.vertexShader='uniform float sparkTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      float id=float(gl_InstanceID);
      float angle=sparkTime*5.+id*6.283185/7.;
      float x=sparkTime*3.+id,y=sparkTime*4.;
      transformed=vec3(cos(y)*position.x+sin(y)*position.z,position.y,-sin(y)*position.x+cos(y)*position.z);
      transformed.yz=mat2(cos(x),sin(x),-sin(x),cos(x))*transformed.yz;
      transformed+=vec3(cos(angle)*.12,sin(angle*1.7)*.08,sin(angle)*.12);
    `);
  };
  const sparks=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.019),sparkMaterial,7);
  sparks.frustumCulled=false;
  glow.add(sparks);
  const light=createEffectLight(scene,'#ffd16a',.9);
  const forward=new THREE.Vector3(),handPosition=new THREE.Vector3(),palmPosition=new THREE.Vector3(),local=new THREE.Vector3();
  let age=Infinity,perfect=false,goldReward=false,cachedHand,cachedFinger;
  return {group,face,rim,points,glow,
    clear(){age=Infinity;group.visible=false;points.visible=false;glow.visible=false;light.intensity=0;},
    update(dt,events=[],hand,heading=0,counterReady=false,time=0) {
      age+=dt;
      light.intensity=0;
      if(!hand){group.visible=false;points.visible=false;glow.visible=false;return;}
      const incoming=events.some(e=>e.type==='blocked');
      if(!incoming&&!counterReady&&age>=GUARD_EFFECT.duration){group.visible=false;points.visible=false;glow.visible=false;return;}
      hand.getWorldPosition(handPosition);
      if(hand!==cachedHand){cachedHand=hand;cachedFinger=hand.getObjectByName('f_middle01R')??hand.getObjectByName('f_index01R');}
      const finger=cachedFinger;
      palmPosition.copy(handPosition);
      if(finger){finger.getWorldPosition(local);palmPosition.lerp(local,.6);}
      forward.set(Math.sin(heading),0,Math.cos(heading));
      for(const event of events) {
        if(event.type==='energyInterrupted'){age=Infinity;perfect=false;}
        if(event.type!=='blocked')continue;
        age=0;perfect=event.grade==='perfect';goldReward=perfect&&event.counterReady!==false;
        const color=perfect?GUARD_EFFECT.gold:GUARD_EFFECT.silver;
        faceMaterial.color.set(color);rimMaterial.color.set(color);
        if(perfect){
          pointUniforms.uOrigin.value.copy(handPosition).addScaledVector(forward,GUARD_EFFECT.forwardOffset);
          pointUniforms.uHeading.value=heading;
        }
      }
      const shieldDuration=perfect?GUARD_EFFECT.absorbEnd:GUARD_EFFECT.duration;
      group.visible=age<shieldDuration;
      if(group.visible) {
        group.position.copy(handPosition).addScaledVector(forward,GUARD_EFFECT.forwardOffset);
        group.rotation.set(0,heading,0);
        shieldMotion.value.set(age,shieldDuration,perfect?1:0);
      }
      points.visible=goldReward&&age>=GUARD_EFFECT.absorbStart&&age<GUARD_EFFECT.absorbEnd;
      if(points.visible) {
        const u=(age-GUARD_EFFECT.absorbStart)/(GUARD_EFFECT.absorbEnd-GUARD_EFFECT.absorbStart);
        pointUniforms.uTarget.value.copy(palmPosition);pointUniforms.uProgress.value=u;
      }
      glow.visible=counterReady;
      if(glow.visible) {
        glow.position.copy(palmPosition);
        light.position.copy(palmPosition);
        light.intensity=1.8;
        sparkTime.value=time;
      }
    },
  };
}
