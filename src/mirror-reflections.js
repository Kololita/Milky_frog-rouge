import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {compileStartupTarget} from './startup-warmup.js';

function attachMirrorVertexTransform(source,mirror){
 if(source.geometry.morphAttributes.position?.length)return null;
 const localFromSource={value:new T.Matrix4()};
 const skinned=source.isSkinnedMesh;
 const uniforms=mirror.material.uniforms;
 uniforms.localFromSource=localFromSource;
 let skinning='';
 if(skinned){
  if(!source.skeleton.boneTexture)source.skeleton.computeBoneTexture();
  mirror.geometry.setAttribute('mirrorSkinIndex',source.geometry.getAttribute('skinIndex'));
  mirror.geometry.setAttribute('mirrorSkinWeight',source.geometry.getAttribute('skinWeight'));
  uniforms.mirrorBones={value:source.skeleton.boneTexture};
  uniforms.mirrorBind={value:source.bindMatrix};
  uniforms.mirrorInverseBind={value:source.bindMatrixInverse};
  skinning=`
   uniform sampler2D mirrorBones;
   uniform mat4 mirrorBind,mirrorInverseBind;
   attribute vec4 mirrorSkinIndex,mirrorSkinWeight;
   mat4 mirrorBone(float index){
    int width=textureSize(mirrorBones,0).x;
    int offset=int(index)*4;
    ivec2 uv=ivec2(offset%width,offset/width);
    return mat4(texelFetch(mirrorBones,uv,0),texelFetch(mirrorBones,uv+ivec2(1,0),0),
                texelFetch(mirrorBones,uv+ivec2(2,0),0),texelFetch(mirrorBones,uv+ivec2(3,0),0));
   }`;
 }
 mirror.material.vertexShader='uniform mat4 localFromSource;\n'+skinning+mirror.material.vertexShader
  .replace('vUv = textureMatrix * vec4( position, 1.0 );',`
   vec4 sourceVertex=vec4(position,1.);
   ${skinned?`
    vec4 bound=mirrorBind*sourceVertex;
    vec4 deformed=mirrorBone(mirrorSkinIndex.x)*bound*mirrorSkinWeight.x
      +mirrorBone(mirrorSkinIndex.y)*bound*mirrorSkinWeight.y
      +mirrorBone(mirrorSkinIndex.z)*bound*mirrorSkinWeight.z
      +mirrorBone(mirrorSkinIndex.w)*bound*mirrorSkinWeight.w;
    sourceVertex=vec4((mirrorInverseBind*deformed).xyz,1.);
   `:''}
   vec4 mirrorVertex=localFromSource*sourceVertex;
   vUv=textureMatrix*mirrorVertex;
  `)
  .replace('modelViewMatrix * vec4( position, 1.0 )','modelViewMatrix * mirrorVertex');
 return localFromSource.value;
}
export function createMirrorReflections(renderer,scene){
 const entries=new Map(),p=[new T.Vector3(),new T.Vector3(),new T.Vector3()],x=new T.Vector3(),y=new T.Vector3(),z=new T.Vector3(),matrix=new T.Matrix4(),inverse=new T.Matrix4(),temp=new T.Vector3();
 const frustum=new T.Frustum(),viewProjection=new T.Matrix4(),bounds=new T.Box3();
 let sceneSize=-1,reflectionSize=1024,reflectionSamples=4,frozen=false;
 function configureTarget(target){
  const size=Math.min(reflectionSize,renderer.capabilities.maxTextureSize);
  const floatColor=renderer.extensions.has('EXT_color_buffer_float');
  const samples=Math.min(reflectionSamples,renderer.capabilities.maxSamples);
  const type=floatColor?T.HalfFloatType:T.UnsignedByteType;
  if(target.samples!==samples||target.texture.type!==type){
   target.dispose();
   target.samples=samples;target.texture.type=type;
  }
  target.setSize(size,size);
 }
 function register(root=scene){
  root.traverse(o=>{if(!o.isMesh||!o.name.startsWith('MirrorFacet_')||entries.has(o))return;
   const geometry=o.geometry.clone(),mirror=new Reflector(geometry,{textureWidth:1024,textureHeight:1024,color:0xbac4ce,clipBias:.0001,multisample:4});mirror.name='ShieldMirror';mirror.userData.cameraOcclusion=false;mirror.userData.cameraCollision=false;mirror.frustumCulled=false;scene.add(mirror);
   configureTarget(mirror.getRenderTarget());
   const render=mirror.onBeforeRender;
   mirror.onBeforeRender=function(...args){
    if(frozen)return;
    for(const e of entries.values()){e.wasVisible=e.mirror.visible;e.mirror.visible=false;}
    const shadowUpdate=renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate=false;
    try{render.apply(this,args);}finally{
     renderer.shadowMap.autoUpdate=shadowUpdate;
     for(const e of entries.values())e.mirror.visible=e.wasVisible;
    }
   };
   const material=o.material,materialWasVisible=material.visible;
   material.visible=false;
   entries.set(o,{mirror,material,materialWasVisible,localFromSource:attachMirrorVertexTransform(o,mirror)});
  });
  sceneSize=scene.children.length;
 }
 return {register,setFrozen(value){frozen=value;},async compileWarmup(camera,onProgress){
  const visible=[...entries.values()].filter(entry=>entry.mirror.visible);
  if(!visible.length)return;
  const excludedRoots=new Set(visible.map(entry=>entry.mirror));
  await compileStartupTarget(renderer,visible[0].mirror.getRenderTarget(),scene,camera,onProgress,
   {visibleOnly:true,excludedRoots});
 },setQuality(quality){
  reflectionSize={low:256,medium:512,high:1024}[quality];
  reflectionSamples={low:0,medium:2,high:4}[quality];
  for(const {mirror} of entries.values())configureTarget(mirror.getRenderTarget());
 },update(camera){
  if(scene.children.length!==sceneSize)register();
  if(camera){
   camera.updateWorldMatrix(true,false);
   viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
   frustum.setFromProjectionMatrix(viewProjection);
  }
  for(const [source,{mirror,material,materialWasVisible,localFromSource}]of entries){
   let visible=true,attached=false;
   for(let o=source;o;o=o.parent){
    if(!o.visible)visible=false;
    if(o===scene){attached=true;break;}
   }
   if(!attached){
    material.visible=materialWasVisible;
    mirror.removeFromParent();
    mirror.geometry.dispose();
    mirror.dispose();
    entries.delete(source);
    continue;
   }
   mirror.visible=visible;
   if(!visible)continue;
   source.updateWorldMatrix(true,false);
   if(source.isSkinnedMesh)source.skeleton.bones[0]?.updateWorldMatrix(true,true);
   if(camera){
    bounds.makeEmpty();
    const count=source.geometry.attributes.position.count;
    for(let i=0;i<count;i++)bounds.expandByPoint(source.getVertexPosition(i,temp).applyMatrix4(source.matrixWorld));
    if(!frustum.intersectsBox(bounds)){mirror.visible=false;continue;}
   }
   if(source.isSkinnedMesh)source.skeleton.update();
   for(let i=0;i<3;i++)source.getVertexPosition(i,p[i]).applyMatrix4(source.matrixWorld);
   x.subVectors(p[1],p[0]).normalize();z.subVectors(p[2],p[0]);z.crossVectors(x,z).normalize();y.crossVectors(z,x).normalize();matrix.makeBasis(x,y,z);mirror.quaternion.setFromRotationMatrix(matrix);mirror.position.copy(p[0]);
   mirror.updateMatrixWorld(true);
   if(localFromSource){
    localFromSource.copy(mirror.matrixWorld).invert().multiply(source.matrixWorld);
   }else{
    inverse.copy(matrix).invert();const position=mirror.geometry.attributes.position;
    for(let i=0;i<position.count;i++){source.getVertexPosition(i,temp).applyMatrix4(source.matrixWorld).sub(p[0]).applyMatrix4(inverse);position.setXYZ(i,temp.x,temp.y,temp.z);}
    position.needsUpdate=true;
   }
  }
 }};
}
