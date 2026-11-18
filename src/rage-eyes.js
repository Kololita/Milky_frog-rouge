import {BufferAttribute,Matrix4,Vector3} from 'three';

// Source-space eye fitting measured from the restored, unmodified frog mesh.
const BIND_TO_SOURCE=[
  .9860031008720398,0,0,0, 0,0,.9860031008720398,0,
  0,-.9860031008720398,0,0, .027586815878748894,.00220570620149374,.014869298785924911,1,
];
const shaderCommon=`
uniform float rageEyeActive;
varying vec3 vRageEyeSource;
float rageEyeMaskValue(){
  bool leftEye=vRageEyeSource.x>0.0;
  vec2 center=leftEye?vec2(.0814166667,.9733333333):vec2(-.0806666667,.9729166667);
  vec2 radii=leftEye?vec2(.0279166667,.0300000000):vec2(.0275000000,.0295833333);
  vec2 q=(vRageEyeSource.xz-center)/radii;
  return rageEyeActive*(1.0-smoothstep(1.12,1.18,length(q)))*step(vRageEyeSource.y,.270);
}`;

/** Runtime-only red eye overlay. The GLB geometry, texture and rig stay untouched. */
export function createRageEyes(model) {
  const uniforms={rageEyeActive:{value:0}},toSource=new Matrix4().fromArray(BIND_TO_SOURCE),skins=[];
  model.traverse(object=>{if(object.isSkinnedMesh&&object.material?.name==='Original frog baked colors')skins.push(object);});
  for(const skin of skins) {
    const position=skin.geometry.attributes.position,data=new Float32Array(position.count*3),point=new Vector3();
    for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i).applyMatrix4(toSource).toArray(data,i*3);}
    skin.geometry.setAttribute('rageEyeSourcePosition',new BufferAttribute(data,3));
    const material=skin.material.clone(),previous=material.onBeforeCompile;
    material.onBeforeCompile=(shader,renderer)=>{
      previous.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader
        .replace('#include <common>','#include <common>\nattribute vec3 rageEyeSourcePosition;\nvarying vec3 vRageEyeSource;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvRageEyeSource=rageEyeSourcePosition;');
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <common>',`#include <common>\n${shaderCommon}`)
        .replace('#include <map_fragment>','#include <map_fragment>\nfloat rageEyeMask=rageEyeMaskValue();\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0,0.0,0.0),rageEyeMask);')
        .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(.72,0.0,0.0)*rageEyeMask;');
    };
    material.customProgramCacheKey=()=> 'frog-rage-eyes-v1';
    skin.material=material;
  }
  return {uniforms,skins,update(active){uniforms.rageEyeActive.value=active?1:0;}};
}
