import { COMBO } from './control-tuning.js';

/** Stage progression only; action-scoped pre-inputs are owned by CommandBuffer. */
export class AttackCombo {
  constructor() { this.reset(); }
  reset() { this.stage = 0; this.finishedAt = -Infinity; this.finished = false; this.aim = null; }
  enter(stage,aim=null) {
    this.reset();this.stage=stage;this.aim=aim ? {x:aim.x,z:aim.z} : null;
  }
  press(now, aim = null) {
    this.expire(now);
    const capturedAim = aim ? {x:aim.x,z:aim.z} : null;
    if (!this.stage) { this.stage = 1; this.aim = capturedAim; return 1; }
    if (this.stage >= 4) return 0;
    if (this.finished) { this.finished = false; this.aim = capturedAim; return ++this.stage; }
    return 0;
  }
  finish(now) {
    this.finished = true;
    this.finishedAt = now;
    return this.expire(now);
  }
  expire(now) {
    if (this.finished && (this.stage === 4 || now - this.finishedAt > COMBO.inputWindow+1e-9)) { this.reset(); return -1; }
    return 0;
  }
}

