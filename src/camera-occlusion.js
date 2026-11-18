import * as THREE from 'three';
const excluded=mesh=>{for(let node=mesh;node;node=node.parent)if(node.userData.cameraOcclusion===false||!node.visible)return true;return false;};
const hullMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
function makeBoundsHull(geometry){
  geometry.computeBoundingBox();
  const bounds=geometry.boundingBox;
  if(bounds.isEmpty())return null;
  const size=bounds.getSize(new THREE.Vector3()).max(new THREE.Vector3(.005,.005,.005));
  const center=bounds.getCenter(new THREE.Vector3());
  return new THREE.BoxGeometry(size.x,size.y,size.z).translate(center.x,center.y,center.z);
}
/** Auto-discovers current/future scenery; instanced scenery fades per instance. */
export function createCameraOcclusion(scene){
  const cache=new WeakMap(),states=new Map(),hits=[],ray=new THREE.Raycaster(),focus=new THREE.Vector3(),end=new THREE.Vector3(),direction=new THREE.Vector3(),cameraPosition=new THREE.Vector3(),right=new THREE.Vector3();
  let candidates=[],scan=1,check=1;
  const hullCache=new WeakMap(),hulls=[];
  const handled=new Set(), rayBounds=new THREE.Box3(), proxyBounds=new THREE.Box3();
  const contacts=new Map(),forced=new Map(),groups=new Map(),groupHits=new Map();
  const noBlockers=new Map();
  function updateHulls(){
    hulls.length=0;
    handled.clear();
    for(const mesh of candidates){
      if(excluded(mesh))continue;
      let owner=mesh;
      for(let node=mesh;node;node=node.parent){
        if(node.userData.cameraHull){owner=node;break;}
      }
      if(handled.has(owner))continue;
      handled.add(owner);
      const definition=owner.userData.cameraHull;
      let cached=hullCache.get(owner);
      if(!cached||cached.definition!==definition){
        const geometries=owner.userData.cameraHull??[makeBoundsHull(mesh.geometry)].filter(Boolean);
        const proxies=geometries.map(geometry=>mesh.isInstancedMesh&&owner===mesh?
          new THREE.InstancedMesh(geometry,hullMaterial,mesh.count):new THREE.Mesh(geometry,hullMaterial));
        cached={definition,proxies};
        hullCache.set(owner,cached);
      }
      for(const proxy of cached.proxies){
        proxy.matrixWorld.copy(owner.matrixWorld);
        proxy.userData.fadeTarget=mesh;
        if(proxy.isInstancedMesh){
          proxy.instanceMatrix=mesh.instanceMatrix;
          if(proxy.count!==mesh.count||proxy.userData.matrixVersion!==mesh.instanceMatrix.version){
            proxy.count=mesh.count;
            proxy.boundingSphere=null;
            proxy.boundingBox=null;
            proxy.userData.matrixVersion=mesh.instanceMatrix.version;
          }
          if(!proxy.boundingBox)proxy.computeBoundingBox();
          proxyBounds.copy(proxy.boundingBox);
        }else{
          if(!proxy.geometry.boundingBox)proxy.geometry.computeBoundingBox();
          proxyBounds.copy(proxy.geometry.boundingBox);
        }
        if(!proxyBounds.isEmpty()&&proxyBounds.applyMatrix4(proxy.matrixWorld).intersectsBox(rayBounds))hulls.push(proxy);
      }
    }
  }
  const fadeClock={value:0};
  const probes=[];for(const height of [.25,.55,.85,1.15,1.4])for(const offset of [-.27,-.09,.09,.27])probes.push([offset,height]);
  function register(mesh){
    let state=states.get(mesh);if(state)return state;state=cache.get(mesh);
    if(state){
      state.blocked.clear();state.fade.value.set(1,1,0);
      mesh.material=Array.isArray(state.original)?state.materials:state.materials[0];
      if(mesh.isInstancedMesh)mesh.geometry=state.fadeGeometry;
      states.set(mesh,state);return state;
    }
    const fadeParams={value:new THREE.Vector3(1,1,0)};
    const declarations='uniform float cameraFadeClock;uniform vec3 cameraFadeParams;varying float vCameraFade;\n';
    const evaluate='mix(cameraFadeParams.y,cameraFadeParams.x,exp(-20.*max(0.,cameraFadeClock-cameraFadeParams.z)))';
    const originals=Array.isArray(mesh.material)?mesh.material:[mesh.material],materials=originals.map(original=>{const material=original.clone();material.onBeforeCompile=original.onBeforeCompile;material.customProgramCacheKey=original.customProgramCacheKey;
      if(material.isShaderMaterial){
        for(const [key,uniform]of Object.entries(original.uniforms))material.uniforms[key]=uniform;
        material.uniforms.cameraFadeClock=fadeClock;
        if(mesh.isInstancedMesh){
          material.vertexShader='attribute vec3 cameraFade;uniform float cameraFadeClock;varying float vCameraFade;\n'+
            material.vertexShader.replace(/void\s+main\s*\(\s*\)\s*\{/,match=>match+
              '\nvCameraFade=mix(cameraFade.y,cameraFade.x,exp(-20.*max(0.,cameraFadeClock-cameraFade.z)));');
          material.fragmentShader='varying float vCameraFade;\n'+material.fragmentShader.replace(
            '#include <tonemapping_fragment>','gl_FragColor.a*=vCameraFade;\n#include <tonemapping_fragment>');
        }else{
          material.uniforms.cameraFadeParams=fadeParams;
          material.vertexShader=declarations+material.vertexShader.replace(/void\s+main\s*\(\s*\)\s*\{/,match=>match+
            '\nvCameraFade='+evaluate+';');
          material.fragmentShader='varying float vCameraFade;\n'+material.fragmentShader.replace(
            '#include <tonemapping_fragment>','gl_FragColor.a*=vCameraFade;\n#include <tonemapping_fragment>');
        }
      }else if(!mesh.isInstancedMesh){
        const compile=original.onBeforeCompile,cacheKey=original.customProgramCacheKey();
        material.onBeforeCompile=function(shader,renderer){
          compile.call(this,shader,renderer);
          shader.uniforms.cameraFadeClock=fadeClock;
          shader.uniforms.cameraFadeParams=fadeParams;
          shader.vertexShader=declarations+shader.vertexShader.replace('#include <begin_vertex>',
            '#include <begin_vertex>\nvCameraFade='+evaluate+';');
          shader.fragmentShader='varying float vCameraFade;\n'+shader.fragmentShader.replace(
            '#include <alphatest_fragment>','diffuseColor.a*=vCameraFade;\n#include <alphatest_fragment>');
        };
        material.customProgramCacheKey=()=>cacheKey+'|camera-occlusion-mesh';
      }
      return material;});
    state={mesh,original:mesh.material,geometry:mesh.geometry,materials,fade:fadeParams,blocked:new Set(),fading:new Set()};
    if(mesh.isInstancedMesh){
      mesh.geometry=mesh.geometry.clone();
      const fade=new THREE.InstancedBufferAttribute(new Float32Array(mesh.count*3),3).setUsage(THREE.DynamicDrawUsage);
      fade.onUpload(()=>fade.clearUpdateRanges());
      for(let i=0;i<fade.count;i++)fade.setXYZ(i,1,1,0);
      mesh.geometry.setAttribute('cameraFade',fade);
      for(const material of materials){const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
        if(material.isShaderMaterial)continue;
        material.onBeforeCompile=(shader,renderer)=>{previous.call(material,shader,renderer);shader.uniforms.cameraFadeClock=fadeClock;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 cameraFade;uniform float cameraFadeClock;varying float vCameraFade;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCameraFade=mix(cameraFade.y,cameraFade.x,exp(-20.*max(0.,cameraFadeClock-cameraFade.z)));');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vCameraFade;').replace('#include <alphatest_fragment>','diffuseColor.a*=vCameraFade;\n#include <alphatest_fragment>');};
        material.customProgramCacheKey=()=>key()+'|camera-occlusion-instance';}
    }
    for(const material of materials){material.transparent=true;material.depthWrite=false;}
    mesh.material=Array.isArray(state.original)?materials:materials[0];state.fadeGeometry=mesh.geometry;cache.set(mesh,state);states.set(mesh,state);return state;
  }
  function restore(state){
    state.mesh.material=state.original;
    if(state.mesh.isInstancedMesh){
      const fade=state.fadeGeometry.attributes.cameraFade;
      for(const id of state.fading){
        fade.setXYZ(id,1,1,0);
        fade.addUpdateRange(id*fade.itemSize,fade.itemSize);
      }
      if(state.fading.size)fade.needsUpdate=true;
      state.mesh.geometry=state.geometry;
    }
    state.fading.clear();states.delete(state.mesh);
  }
  return {states,prepare(){scene.traverse(mesh=>{if(!mesh.isMesh||mesh.isSkinnedMesh)return;for(let node=mesh;node;node=node.parent)if(node.userData.cameraOcclusion===false)return;const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(mats.some(m=>!m.transparent&&m.opacity>.95))register(mesh);});},update(camera,anchor,dt,held=noBlockers){
    scan+=dt;check+=dt;fadeClock.value+=Math.max(0,dt);camera.getWorldPosition(cameraPosition);
    if(scan>=.4){scan=0;candidates=[];scene.traverse(mesh=>{if(!mesh.isMesh||mesh.isSkinnedMesh||excluded(mesh))return;const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(mesh.userData.cameraFadeGroup||states.has(mesh)||materials.some(m=>!m.transparent&&m.opacity>.95))candidates.push(mesh);});}
    if(check>=.05){check=0;scene.updateMatrixWorld();
      right.set(1,0,0).applyQuaternion(camera.quaternion);
      // Every probe segment lies inside the union of its two endpoints.
      rayBounds.set(cameraPosition,cameraPosition);
      for(const [offset,height] of probes){
        focus.set(anchor.x,anchor.y+height,anchor.z).addScaledVector(right,offset);
        rayBounds.expandByPoint(focus);
      }
      rayBounds.expandByScalar(1e-5);
      updateHulls();
      for(const state of states.values())state.blocked.clear();
      contacts.clear();
      let covered=0;
      for(const [offset,height] of probes){
        focus.set(anchor.x,anchor.y+height,anchor.z).addScaledVector(right,offset);
        end.copy(focus);direction.copy(end).sub(cameraPosition);ray.far=direction.length()-.02;ray.near=.02;ray.set(cameraPosition,direction.normalize());
        hits.length=0;ray.intersectObjects(hulls,false,hits);
        if(hits.length)covered++;
        for(const hit of hits){
          const target=hit.object.userData.fadeTarget;
          if(!contacts.has(target))contacts.set(target,new Set());
          contacts.get(target).add(hit.instanceId??0);
        }
      }
      if(covered/probes.length>=.75)for(const [mesh,ids]of contacts){const state=register(mesh);for(const id of ids)state.blocked.add(id);}
    }
    forced.clear();
    for(const [mesh,ids]of held){if(excluded(mesh))continue;forced.set(mesh,ids);}
    // Pillar bodies, trim and lanterns fade together, including individual instances.
    groups.clear();
    groupHits.clear();
    for(const [mesh,ids]of forced)groupHits.set(mesh,ids);
    for(const [mesh,state]of states)if(state.blocked.size)groupHits.set(mesh,state.blocked);
    for(const [mesh,ids]of groupHits){const key=mesh.userData.cameraFadeGroup;if(key){if(!groups.has(key))groups.set(key,new Set());for(const id of ids)groups.get(key).add(id);}}
    for(const mesh of candidates){const ids=groups.get(mesh.userData.cameraFadeGroup);if(ids&&!excluded(mesh))forced.set(mesh,ids);}
    for(const [mesh,ids]of forced){const state=register(mesh);for(const id of ids)state.blocked.add(id);}
    for(const state of states.values()){
      if(state.mesh.isInstancedMesh){
        const fade=state.mesh.geometry.attributes.cameraFade,time=fadeClock.value;
        let changed=false;
        for(const id of state.blocked)if(id>=0&&id<fade.count)state.fading.add(id);
        for(const i of state.fading){
          const goal=state.blocked.has(i)?0:1,instant=forced.get(state.mesh)?.has(i);
          const start=fade.getX(i),previousGoal=fade.getY(i),since=fade.getZ(i);
          if(goal!==previousGoal||(instant&&start!==0)){
            const current=instant?0:previousGoal+(start-previousGoal)*Math.exp(-20*Math.max(0,time-since-dt));
            fade.setXYZ(i,current,goal,Math.fround(time-Math.max(0,dt)));
            fade.addUpdateRange(i*fade.itemSize,fade.itemSize);
            changed=true;
          }
          if(goal===1&&(fade.getX(i)===1||time-fade.getZ(i)>.30)){
            state.fading.delete(i);
            fade.setXYZ(i,1,1,0);
            fade.addUpdateRange(i*fade.itemSize,fade.itemSize);
            changed=true;
          }
        }
        if(changed)fade.needsUpdate=true;
        if(!state.fading.size)restore(state);
        continue;
      }
      const fade=state.fade.value,time=fadeClock.value;
      const goal=state.blocked.has(0)?0:1,instant=forced.get(state.mesh)?.has(0);
      if(goal!==fade.y||(instant&&fade.x!==0)){
        const current=instant?0:fade.y+(fade.x-fade.y)*Math.exp(-20*Math.max(0,time-fade.z-dt));
        fade.set(current,goal,time-Math.max(0,dt));
      }
      if(goal===1&&(fade.x===1||time-fade.z>.30))restore(state);
    }
  },clear(){for(const state of states.values())restore(state);scan=1;check=1;}};
}
