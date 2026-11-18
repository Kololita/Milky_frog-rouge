export {createCombatCamera} from './combat-camera.js';
import { CAMERA,TARGET_LOCK } from './control-tuning.js';
export {createCameraOcclusion} from './camera-occlusion.js';
/** Translate with the character, while keeping orbit angles in world space. */
export function worldCameraPose(orbit, anchor = {x:0,y:0,z:0}) {
  const target = {x:anchor.x,y:anchor.y+CAMERA.targetHeight,z:anchor.z};
  const yaw = orbit.yaw+Math.PI;
  const horizontal = orbit.distance*Math.cos(orbit.pitch);
  return { target, position:{
    x:target.x+Math.sin(yaw)*horizontal,
    y:target.y+orbit.distance*Math.sin(orbit.pitch),
    z:target.z+Math.cos(yaw)*horizontal,
  }};
}

export function pointerYaw(yaw,deltaX) { return yaw-deltaX*CAMERA.yawSensitivity; }
export function advanceZoom(distance,target,dt) {
  const next=target+(distance-target)*Math.exp(-CAMERA.zoomResponse*dt);
  return Math.abs(next-target)<.0001 ? target : next;
}

const yawDelta=(target,current)=>Math.atan2(Math.sin(target-current),Math.cos(target-current));
/** Horizontal angle at the enemy: enemy→frog versus enemy→camera. */
export function targetLockAngle(player,enemy,cameraPosition) {
  const ax=player.x-enemy.x,az=player.z-enemy.z;
  const bx=cameraPosition.x-enemy.x,bz=cameraPosition.z-enemy.z;
  if(Math.hypot(ax,az)<1e-8||Math.hypot(bx,bz)<1e-8)return 0;
  return Math.atan2(Math.abs(ax*bz-az*bx),ax*bx+az*bz);
}

/** Camera-only lock with a dead zone and a latched, shortest-arc recenter. */
export class TargetLock {
  constructor(){this.clear();}
  clear(){this.target=null;this.correcting=false;}
  toggle(enemy) {
    if(this.target){this.clear();return false;}
    if(!enemy||enemy.health<=0)return false;
    this.target=enemy;this.correcting=false;return true;
  }
  switchDirection(direction,enemies,player,orbit) {
    if(!this.target||!direction)return null;
    const pose=worldCameraPose(orbit,player);
    const angle=enemy=>Math.atan2((enemy.x-pose.position.x)*Math.cos(orbit.yaw)-(enemy.z-pose.position.z)*Math.sin(orbit.yaw),(enemy.x-pose.position.x)*Math.sin(orbit.yaw)+(enemy.z-pose.position.z)*Math.cos(orbit.yaw));
    const current=angle(this.target);
    const candidates=enemies.filter(e=>e!==this.target&&e.health>0).map(enemy=>({enemy,offset:angle(enemy)-current,angle:angle(enemy)})).filter(e=>Math.abs(e.angle)<Math.PI/2&&e.offset*direction>.025).sort((a,b)=>Math.abs(a.offset)-Math.abs(b.offset));
    if(!candidates.length)return null;
    this.target=candidates[0].enemy;this.correcting=true;return this.target;
  }
  update(orbit,player,dt,{playerAlive=true,fov=48,aspect=16/9}={}) {
    const enemy=this.target;
    if(!enemy)return;
    if(!playerAlive||enemy.health<=0||![enemy.x,enemy.z].every(Number.isFinite)){this.clear();return;}
    const dx=enemy.x-player.x,dz=enemy.z-player.z;
    if(Math.hypot(dx,dz)<TARGET_LOCK.minTargetDistance)return;
    const pose=worldCameraPose(orbit,player),goal=Math.atan2(dx,dz);
    const angle=targetLockAngle(player,enemy,pose.position),delta=yawDelta(goal,orbit.yaw);
    // The triangle angle alone is small for very distant enemies, even when
    // they are behind the camera. Also protect the visible screen bounds.
    const ex=enemy.x-pose.position.x,ez=enemy.z-pose.position.z,ey=player.y+.8-pose.position.y;
    const forward=ex*Math.sin(orbit.yaw)+ez*Math.cos(orbit.yaw);
    const depth=forward*Math.cos(orbit.pitch)-ey*Math.sin(orbit.pitch);
    const side=Math.abs(ex*Math.cos(orbit.yaw)-ez*Math.sin(orbit.yaw));
    const up=ey*Math.cos(orbit.pitch)+forward*Math.sin(orbit.pitch);
    const horizontalLimit=depth*Math.tan(fov*Math.PI/360)*aspect*TARGET_LOCK.screenMargin;
    const verticalLimit=depth*Math.tan(fov*Math.PI/360)*TARGET_LOCK.screenMargin;
    if(angle>TARGET_LOCK.tolerance+1e-9||depth<=0||side>horizontalLimit||Math.abs(up)>verticalLimit)this.correcting=true;
    if(!this.correcting)return;
    const elapsed=Math.max(0,Math.min(dt,.05));
    if(elapsed===0)return;
    const error=Math.abs(delta);
    if(error<=TARGET_LOCK.settledAngle){orbit.yaw+=delta;this.correcting=false;return;}
    const step=Math.min(error*(1-Math.exp(-TARGET_LOCK.response*elapsed)),TARGET_LOCK.maxYawRate*elapsed);
    orbit.yaw+=Math.sign(delta)*step;
  }
}
