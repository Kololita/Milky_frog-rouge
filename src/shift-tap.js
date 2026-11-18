import {tunable} from './tuning-registry.js';
export const SHIFT_TUNING=tunable('SHIFT_TUNING',{tapMs:300,movingTapMs:200,sprintWalkMs:200});
export const SHIFT_TAP_MS = 300;
export const SHIFT_MOVING_TAP_MS=200;
export const SPRINT_WALK_MS=200;
export const isShift = code => code === 'ShiftLeft' || code === 'ShiftRight';
const directions = ['KeyW','KeyS','KeyA','KeyD'];
const WINDOW_EPSILON_MS = 1e-6;

/** Holding Shift sprints; only a quick release produces a dodge request. */
export class ShiftTap {
  constructor() { this.reset(); }
  reset() { this.held = new Set(); this.downAt = null; this.directionKeys = new Set();this.walkStartedAt=null;this.tapWindow=SHIFT_TUNING.tapMs; }
  updateWalk(now,keys,canMove=true){
    const moving=Number(keys.has('KeyW'))!==Number(keys.has('KeyS'))||Number(keys.has('KeyA'))!==Number(keys.has('KeyD'));
    if(moving&&canMove){if(this.walkStartedAt===null)this.walkStartedAt=now;}else this.walkStartedAt=null;
  }
  sprintTiming(now,keys,canMove=true){
    this.updateWalk(now,keys,canMove);
    if(this.walkStartedAt===null)return null;
    if(this.downAt===null){
      // A pose reset can cancel a pending dodge while Shift remains held.
      return keys.has('ShiftLeft')||keys.has('ShiftRight') ? {sprint:true,ramp:null} : null;
    }
    const elapsed=now-this.downAt;
    return {
      sprint:elapsed>this.tapWindow+WINDOW_EPSILON_MS,
      ramp:this.walkStartedAt<this.downAt+this.tapWindow
        ? {elapsed:elapsed/1000,duration:this.tapWindow/1000} : null,
    };
  }
  sprinting(now,keys,canMove=true){return this.sprintTiming(now,keys,canMove)?.sprint??false;}
  rememberDirections(keys) {
    if (!this.held.size) return;
    const forward = Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
    const right = Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
    const heldDirections = directions.filter(code => keys.has(code));
    if (forward || right) this.directionKeys = new Set(heldDirections);
    else if (heldDirections.length) this.directionKeys.clear();
  }
  press(code,now,keys) {
    if (!isShift(code) || this.held.has(code)) return;
    if (!this.held.size) { this.downAt = now; this.directionKeys = new Set();this.tapWindow=this.walkStartedAt!==null&&now-this.walkStartedAt>=SHIFT_TUNING.sprintWalkMs-WINDOW_EPSILON_MS?SHIFT_TUNING.movingTapMs:SHIFT_TUNING.tapMs; }
    this.held.add(code);
    this.rememberDirections(keys);
  }
  release(code,now,keys) {
    if (!this.held.has(code)) return null;
    this.rememberDirections(keys);
    this.held.delete(code);
    if (this.held.size) return null;
    const duration = now-this.downAt;
    const result = duration >= 0 && duration <= this.tapWindow+WINDOW_EPSILON_MS ? new Set(this.directionKeys) : null;
    this.downAt=null;this.directionKeys=new Set();
    return result;
  }
}
