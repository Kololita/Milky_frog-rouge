import { screenInputDirection } from './direction.js';
import {tunable} from './tuning-registry.js';

export const CHARACTER_HEIGHT = 1.55;
export const DODGE_TUNING=tunable('DODGE_TUNING',{rollDistance:CHARACTER_HEIGHT*1.5,backflipDistance:CHARACTER_HEIGHT*2,sideDistance:CHARACTER_HEIGHT,forwardAngle:Math.PI/3,backwardAngle:Math.PI*2/3});
export const DODGE_NAMES = ['DodgeRoll', 'DodgeBackflip', 'DodgeSideL', 'DodgeSideR'];

/** Free movement faces the requested direction first; links retain their facing. */
export function planDodge(keys, cameraForward, heading, free) {
  const direction=screenInputDirection(keys,cameraForward) ?? (free
    ? {x:Math.sin(heading),z:Math.cos(heading)} : screenDodgeDirection(keys,cameraForward));
  return planDirectionalDodge(direction,heading,free);
}

export function planDirectionalDodge(direction, heading, free) {
  const facing=free ? Math.atan2(direction.x,direction.z) : heading;
  return {...classifyDodge(direction,facing),direction,heading:facing};
}

/** Exact cone boundaries belong to forward/backward; the remaining sector is lateral. */
export function classifyDodge(direction, heading) {
  const yaw = Math.atan2(direction.x, direction.z);
  const delta = Math.atan2(Math.sin(yaw-heading),Math.cos(yaw-heading));
  const angle = Math.abs(delta);
  if (angle <= DODGE_TUNING.forwardAngle + 1e-10) return {name:'DodgeRoll',distance:DODGE_TUNING.rollDistance,facing:yaw};
  if (angle >= DODGE_TUNING.backwardAngle - 1e-10) return {name:'DodgeBackflip',distance:DODGE_TUNING.backflipDistance,facing:yaw+Math.PI};
  const left = Math.sin(delta)>0;
  return {name:left ? 'DodgeSideL' : 'DodgeSideR',distance:DODGE_TUNING.sideDistance,facing:yaw+(left ? -Math.PI/2 : Math.PI/2)};
}

/** Project WASD onto the horizontal axes of the camera visible when the dodge triggers. */
export function screenDodgeDirection(keys, cameraForward) {
  const input = screenInputDirection(keys,cameraForward);
  if (input) return input;
  const length = Math.hypot(cameraForward.x, cameraForward.z);
  const fx = length > 1e-6 ? cameraForward.x / length : 0;
  const fz = length > 1e-6 ? cameraForward.z / length : 1;
  return {x:-fx,z:-fz};
}

export function dodgeProgress(time, duration) {
  const u = Math.max(0,Math.min(1,time/duration));
  return u*u*(3-2*u);
}

export function dodgeEndHeading(name,direction,heading) {
  // A backward somersault lands looking away from the retreat direction.
  return name==='DodgeBackflip' ? Math.atan2(-direction.x,-direction.z) : heading;
}
export function dodgeVisualTurn(facing, heading, time, duration, endHeading=heading) {
  const target = facing-heading;
  const shortest = Math.atan2(Math.sin(target),Math.cos(target));
  const ease = u => {u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
  const endDelta=Math.atan2(Math.sin(endHeading-heading),Math.cos(endHeading-heading));
  return shortest * Math.min(ease(time/.13),ease((duration-time)/.15)) + endDelta*ease((time/duration-.64)/.36);
}

