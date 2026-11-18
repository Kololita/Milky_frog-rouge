import {CAMERA} from '../src/control-tuning.js';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PerspectiveCamera,Group,Vector3} from 'three';
import {screenInputDirection,attackHeading} from '../src/direction.js';
import {AttackCombo} from '../src/attack-combo.js';
import {CommandBuffer} from '../src/command-buffer.js';
import {worldCameraPose,pointerYaw} from '../src/world-camera.js';

const radians=d=>d*Math.PI/180, degrees=r=>r*180/Math.PI;
const aim=d=>({x:Math.sin(radians(d)),z:Math.cos(radians(d))});
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
function close(a,b){assert(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);}
assert.equal(screenInputDirection(new Set(),{x:0,z:1}),null);
assert.equal(screenInputDirection(new Set(['KeyW','KeyS','KeyA','KeyD']),{x:0,z:1}),null);
for(const cameraYaw of [0,45,90,179,270]){
 const forward=aim(cameraYaw);
 for(const [keys,offset] of [[['KeyW'],0],[['KeyS'],180],[['KeyA'],90],[['KeyD'],-90],[['KeyW','KeyD'],-45]]){
  const d=screenInputDirection(new Set(keys),forward);
  close(delta(Math.atan2(d.x,d.z),radians(cameraYaw+offset)),0);
  for(const start of [-179,-90,0,37,179,540]){
   const first=attackHeading(radians(start),d,1);
   close(delta(first,Math.atan2(d.x,d.z)),0);
   for(const stage of [2,3,4]){
    const turned=attackHeading(radians(start),d,stage);
    assert(Math.abs(turned-radians(start))<=radians(90)+1e-9);
    assert(Math.abs(delta(Math.atan2(d.x,d.z),turned))<=Math.abs(delta(Math.atan2(d.x,d.z),radians(start)))+1e-9);
   }
  }
 }
}
// Repeated segments approach the requested direction without overshooting.
let heading=0;
const turns=[];
for(const stage of [2,3,4]){heading=attackHeading(heading,aim(90),stage);turns.push(degrees(heading));}
close(degrees(heading),90);
assert.deepEqual(turns.map(Math.round),[90,90,90]);
close(degrees(attackHeading(radians(175),aim(-175),2)),185);
close(attackHeading(1.23,null,1),1.23);

// The latest valid pre-input retains its direction after release/camera change.
const combo=new AttackCombo(),buffer=new CommandBuffer(),input=aim(90);
assert.equal(combo.press(0,aim(0)),1);
buffer.push('Attack','Attack1',input);
input.x=0;input.z=1;
combo.finish(.75);assert.equal(combo.press(.75,buffer.take('Attack1').aim),2);
close(delta(Math.atan2(combo.aim.x,combo.aim.z),radians(90)),0);
buffer.push('Attack','Attack2',aim(-90));combo.finish(1.71);
assert.equal(combo.press(1.71,buffer.take('Attack2').aim),3);close(delta(Math.atan2(combo.aim.x,combo.aim.z),radians(-90)),0);
buffer.push('Attack','Attack3',null);combo.finish(2.75);
assert.equal(combo.press(2.75,buffer.take('Attack3').aim),4);assert.equal(combo.aim,null);
combo.finish(4.2);assert.equal(buffer.pending,null);
combo.press(10,aim(180));combo.finish(10.75);assert.equal(combo.press(11.2,aim(90)),2);
combo.reset();assert.equal(combo.aim,null);

// Translation tracks the character; heading never changes camera orientation.
const orbit={yaw:.3,pitch:.55,distance:9};
const camera=new PerspectiveCamera(48,16/9,.1,110),player=new Group();
function placeCamera(){const pose=worldCameraPose(orbit,player.position);camera.position.set(pose.position.x,pose.position.y,pose.position.z);camera.lookAt(pose.target.x,pose.target.y,pose.target.z);camera.updateMatrixWorld(true);}
placeCamera();const rotation=camera.quaternion.clone(),offset=camera.position.clone().sub(player.position);
const landmark=new Vector3(2,0,1),screen=landmark.clone().project(camera);
for(let i=0;i<90;i++){
 player.position.set(i*.025,0,i*.04);player.rotation.y=attackHeading(i*.03,aim(180),1);player.updateMatrixWorld(true);
 placeCamera();assert(camera.quaternion.angleTo(rotation)<1e-7,'Character turning rotates the camera');
 close(camera.position.clone().sub(player.position).distanceTo(offset),0);
 const center=player.position.clone().add(new Vector3(0,CAMERA.targetHeight,0)).project(camera);
 close(center.x,0);close(center.y,0);
}
assert(landmark.clone().project(camera).distanceTo(screen)>.2,'Environment does not translate during movement');
const stillPosition=camera.position.clone();player.rotation.y+=Math.PI;placeCamera();
close(camera.position.distanceTo(stillPosition),0);assert(camera.quaternion.angleTo(rotation)<1e-7);
orbit.yaw=pointerYaw(orbit.yaw,0);placeCamera();assert(camera.quaternion.angleTo(rotation)<1e-7,'Idle/vertical mouse movement rotates view');
orbit.yaw=pointerYaw(orbit.yaw,80);placeCamera();assert(camera.quaternion.angleTo(rotation)>.3,'Horizontal mouse movement does not orbit');
const report={firstAttackFacesInput:true,laterAttackTurnLimitDegrees:90,consecutiveCorrectionsDegrees:turns,queuedDirectionsCaptured:true,characterRemainsCentered:true,headingDoesNotOrbitCamera:true,horizontalMouseControlsOrbit:true};
await fs.writeFile(new URL('../output/animations/direction-camera-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('DIRECTION_AND_WORLD_CAMERA_VERIFIED',report);
