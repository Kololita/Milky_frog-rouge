import * as THREE from 'three';

/** Keep Three's point sizing, fog and color pipeline; animate vertices on GPU. */
export function createGpuPoints({count,color,size,uniforms={},declarations='',transform='',alpha='',vertexColors=false,samplePosition}) {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));
  geometry.setAttribute('seed',new THREE.BufferAttribute(Float32Array.from({length:count},(_,i)=>i),1));
  const material=new THREE.PointsMaterial({color,size,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=`attribute float seed;\n${declarations}\n${alpha?'varying float vParticleAlpha;':''}\n${shader.vertexShader}`
      .replace('#include <begin_vertex>',`#include <begin_vertex>\n${transform}`);
    shader.fragmentShader=`${alpha?'varying float vParticleAlpha;':''}\n${shader.fragmentShader}`
      .replace('#include <color_fragment>',`#include <color_fragment>\n${alpha?'diffuseColor.a *= vParticleAlpha;':''}\nif (dot(gl_PointCoord-.5,gl_PointCoord-.5)>.25 || diffuseColor.a<.001) discard;`);
  };
  material.customProgramCacheKey=()=>`${declarations}|${transform}|${alpha}`;
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;
  points.userData.samplePosition=samplePosition;
  points.userData.gpuAnimated=true;
  return points;
}

/** One persistent draw for all overlapping impact bursts. Upload only on hits. */
export function createImpactParticles(scene) {
  const capacity=192,uniforms={uTime:{value:0}},launch=new Float32Array(capacity*2),birth=new Float32Array(capacity).fill(-1000),colors=new Float32Array(capacity*3);
  const points=createGpuPoints({count:capacity,color:0xffffff,size:.07,uniforms,vertexColors:true,
    declarations:'uniform float uTime; attribute vec2 launch; attribute float birth;',alpha:'lifetime',
    transform:`
      float age=uTime-birth;
      vParticleAlpha=age>=0.0 && age<.32 ? 1.0-age/.32 : 0.0;
      float t=clamp(age,0.0,.32);
      float angle=launch.x*6.28318530718;
      vec3 velocity=vec3(sin(angle)*1.3,.7+launch.y*.3,cos(angle)*1.3);
      transformed=position+velocity*t+vec3(0.0,-2.0*t*t,0.0);
    `,
    samplePosition(i,target){
      const t=Math.min(.32,Math.max(0,uniforms.uTime.value-birth[i]));
      const angle=launch[i*2]*Math.PI*2;
      target.fromBufferAttribute(points.geometry.attributes.position,i);
      target.x+=Math.sin(angle)*1.3*t;
      target.y+=(.7+launch[i*2+1]*.3)*t-2*t*t;
      target.z+=Math.cos(angle)*1.3*t;
      return target;
    },
  });
  points.name='GPU命中粒子';points.visible=false;scene.add(points);
  const {geometry}=points,position=geometry.attributes.position.array,color=new THREE.Color();
  geometry.setAttribute('launch',new THREE.BufferAttribute(launch,2));geometry.setAttribute('birth',new THREE.BufferAttribute(birth,1));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  let cursor=0,time=0,lastBirth=-1000;
  return {points,clear(){birth.fill(-1000);geometry.attributes.birth.needsUpdate=true;lastBirth=-1000;points.visible=false;},update(dt,events) {
    time+=dt;uniforms.uTime.value=time;let changed=false;
    for(const event of events) {
      if(!['enemyHit','blocked','playerHit','guardBroken'].includes(event.type)&&!(event.type==='enemyImpact'&&event.source==='parry'))continue;
      color.set(event.type==='blocked'?(event.grade==='perfect'?'#ffd36a':'#dce8f3'):event.type==='enemyHit'?'#ffe0a0':'#e88a75');
      const count=event.strong?9:5;
      for(let i=0;i<count;i++) {
        const n=cursor++%capacity,j=n*3;
        position[j]=event.x;position[j+1]=.85;position[j+2]=event.z;
        launch[n*2]=i/count;launch[n*2+1]=i%3;
        color.toArray(colors,j);birth[n]=time;
      }
      lastBirth=time;changed=true;
    }
    if(changed)for(const name of ['position','launch','birth','color'])geometry.attributes[name].needsUpdate=true;
    points.visible=time-lastBirth<.32;
  }};
}
