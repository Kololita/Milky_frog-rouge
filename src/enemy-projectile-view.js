import * as THREE from 'three';
import {createEffectInstances} from './effect-instances.js';

export function createEnemyProjectileView(scene){
 const root=new THREE.Group();
 root.name='敌方远程攻击';
 root.userData.cameraOcclusion=false;
 scene.add(root);
 const clock={value:0},color=new THREE.Color();
 function createMaterial(spin){
  const material=new THREE.MeshBasicMaterial();
  material.onBeforeCompile=shader=>{
   shader.uniforms.shotTime=clock;
   shader.uniforms.shotSpin={value:spin};
   shader.vertexShader='uniform float shotTime,shotSpin;attribute vec4 shotPose;attribute float shotScale;\n'+shader.vertexShader
    .replace('#include <begin_vertex>',`
     #include <begin_vertex>
     float a=shotTime*shotSpin,c=cos(a),s=sin(a);
     vec3 p=position*shotScale;
     p.xy=mat2(c,s,-s,c)*p.xy;
     c=cos(shotPose.w);s=sin(shotPose.w);
     transformed=shotPose.xyz+vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);
    `);
  };
  return material;
 }
 // Allocate instance colors up front so the first projectile uses the same
 // shader variant as prewarming and shares its color upload across layers.
 const instances=createEffectInstances(root,{
  initialCapacity:32,
  attributes:{shotPose:4,shotScale:1,instanceColor:3},
  layers:[
   {geometry:new THREE.OctahedronGeometry(.16),material:createMaterial(10)},
   {geometry:new THREE.TorusGeometry(.23,.025,5,24),material:createMaterial(-8)},
  ],
 });
 return {root,update(battle){
  const shots=battle.enemyProjectiles;
  if(!shots.length){instances.commit(0);return;}
  const {shotPose,shotScale,instanceColor}=instances.ensure(shots.length);
  clock.value=battle.enemyTime;
  for(let i=0;i<shots.length;i++){
   const shot=shots[i];
   shotPose.setXYZW(i,shot.x,shot.height,shot.z,shot.heading);
   shotScale.setX(i,shot.radius/.15);
   color.set(shot.color);
   instanceColor.setXYZ(i,color.r,color.g,color.b);
  }
  instances.commit(shots.length);
 }};
}
