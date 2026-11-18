import * as THREE from 'three';
import {CAMERA} from './control-tuning.js';
/** Shared framing for every arena. Scenery obstruction is handled by camera-occlusion. */
export function createCombatCamera(scene){
 const goal=new THREE.Vector3(),desired=new THREE.Vector3(),look=new THREE.Vector3(),right=new THREE.Vector3(),side=new THREE.Vector3();
 let initialized=false,boomFraction=1;
 const blockers=new Map();
 return {blockers,reset(){initialized=false;boomFraction=1;blockers.clear();},update(pose,orbit,anchor,enemy,dt=0){
  const elapsed=Math.max(0,Math.min(dt,.1));
  desired.set(pose.position.x,pose.position.y+CAMERA.elevation,pose.position.z);
  right.set(Math.cos(orbit.yaw),0,-Math.sin(orbit.yaw));desired.addScaledVector(right,CAMERA.shoulderOffset);
  goal.set(pose.target.x,pose.target.y+CAMERA.lookHeight,pose.target.z);
  if(enemy&&enemy.health>0){
   side.set(enemy.x-anchor.x,0,enemy.z-anchor.z);const distance=side.length(),forward=side.x*Math.sin(orbit.yaw)+side.z*Math.cos(orbit.yaw);
   // Do not pull an unlocked view toward targets behind the camera.
   const visibility=THREE.MathUtils.clamp((forward/Math.max(.001,distance)-.15)/.6,0,1);
   const weight=CAMERA.enemyLookWeight*visibility*Math.min(1,CAMERA.focusRange/Math.max(.001,distance));
   goal.x+=side.x*weight;goal.z+=side.z*weight;
   const enemyHeight=(enemy.uiHeight??1.8)*.6;
   goal.y+=THREE.MathUtils.clamp(enemyHeight-CAMERA.targetHeight,-.25,.4)*weight;
  }
  if(!initialized||dt<=0)look.copy(goal);else look.lerp(goal,1-Math.exp(-CAMERA.lookResponse*elapsed));
  const boundary=scene.userData.cameraBoundary;
  if(boundary){
   const px=anchor.x,pz=anchor.z,dx=desired.x-px,dz=desired.z-pz,a=dx*dx+dz*dz;
   const limit=r=>{if(a<1e-8)return 1;const b=px*dx+pz*dz,c=px*px+pz*pz-r*r;return THREE.MathUtils.clamp((-b+Math.sqrt(Math.max(0,b*b-a*c)))/a,0,1);};
   const hard=limit(boundary.radius-boundary.margin),soft=limit(boundary.radius-boundary.margin-.55);
   const response=soft<boomFraction?8:CAMERA.collisionReturnResponse;
   boomFraction+=(soft-boomFraction)*(1-Math.exp(-response*elapsed));boomFraction=Math.min(boomFraction,hard);
   desired.x=px+dx*boomFraction;desired.z=pz+dz*boomFraction;
   const pivotY=anchor.y+CAMERA.targetHeight;desired.y=pivotY+(desired.y-pivotY)*boomFraction;
  }else boomFraction=1;
  initialized=true;
  return {position:{x:desired.x,y:desired.y,z:desired.z},target:{x:look.x,y:look.y,z:look.z}};
 }};
}
