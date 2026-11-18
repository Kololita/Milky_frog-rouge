import assert from 'node:assert/strict';import * as THREE from 'three';import {createCombatCamera,worldCameraPose} from '../src/world-camera.js';import {CAMERA} from '../src/control-tuning.js';
const player={x:0,y:0,z:0},orbit={yaw:0,pitch:CAMERA.pitch,distance:5.5};const results=[];
for(const distance of [3.5,5.5,8])for(const aspect of [9/16,16/9]){
 const scene=new THREE.Scene(),rig=createCombatCamera(scene),camera=new THREE.PerspectiveCamera(48,aspect,.1,110),enemy={x:0,z:2.5,health:100,uiHeight:2.42},o={...orbit,distance};const pose=rig.update(worldCameraPose(o,player),o,player,enemy,0);camera.position.copy(pose.position);camera.lookAt(new THREE.Vector3().copy(pose.target));camera.updateMatrixWorld();const frog=new THREE.Vector3(0,.8,0).project(camera),foe=new THREE.Vector3(0,1.2,2.5).project(camera);
 assert(frog.y<-.05,'Player should sit below the center');assert(foe.y>frog.y+.15,'Enemy overlaps the player vertically');assert(Math.abs(foe.x)<.95&&Math.abs(foe.y)<.95,'Enemy outside frame');assert(pose.position.y>worldCameraPose(o,player).position.y,'Camera not elevated');results.push({distance,aspect,playerY:frog.y,enemyY:foe.y});
}
// Environment collision, including instance-aware geometry and actor exclusions.
for(const instanced of [false,true]){
 const scene=new THREE.Scene(),geo=new THREE.BoxGeometry(6,8,.4),mat=new THREE.MeshBasicMaterial();let wall;
 if(instanced){wall=new THREE.InstancedMesh(geo,mat,1);wall.setMatrixAt(0,new THREE.Matrix4().makeTranslation(0,2,-2));}else{wall=new THREE.Mesh(geo,mat);wall.position.set(0,2,-2);}scene.add(wall);
 const rig=createCombatCamera(scene),nominal=worldCameraPose(orbit,player);wall.position.x=20;const full=rig.update(nominal,orbit,player,null,0);wall.position.x=0;const blocked=rig.update(nominal,orbit,player,null,1/60);assert(blocked.position.z>full.position.z&&blocked.position.z<full.position.z+.5,'Camera pull-in should be gradual');assert(rig.blockers.has(wall),'Transition must retain the transparent obstacle');
 for(let i=0;i<180;i++)rig.update(nominal,orbit,player,null,1/60);
 const close=rig.update(nominal,orbit,player,null,1/60);assert(close.position.z>-1.8,'Camera does not converge in front of wall');wall.visible=false;let released;for(let i=0;i<30;i++)released=rig.update(nominal,orbit,player,null,1/60);assert(released.position.z<close.position.z&&released.position.z>nominal.position.z,'Camera recovery snaps');
 for(let i=0;i<180;i++)rig.update(nominal,orbit,player,null,1/60);
 wall.visible=true;wall.userData.cameraOcclusion=false;rig.reset();assert(rig.update(nominal,orbit,player,null,0).position.z<-4,'Actor treated as scenery');
}
// Focus switches are damped and converge equally at 30/60/144 fps.
const ends=[];for(const fps of [30,60,144]){const rig=createCombatCamera(new THREE.Scene()),p=worldCameraPose(orbit,player);rig.update(p,orbit,player,null,0);let last=p.target.x;for(let i=0;i<fps;i++){const s=rig.update(p,orbit,player,{x:2,z:3,health:100},1/fps);assert(Math.abs(s.target.x-last)<.15);last=s.target.x;}ends.push(last);}assert(Math.max(...ends)-Math.min(...ends)<1e-6);
console.log('COMBAT_CAMERA_VERIFIED',JSON.stringify({framing:results,focusAcrossFrameRates:ends}));
