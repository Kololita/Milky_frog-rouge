/** Retarget an interrupted blend from its actual weights, with no pose-weight jump. */
export class ActionBlend {
  constructor() { this.reset(); }
  reset() { this.weights=new Map();this.transition=null; }
  to(next,duration) {
    if (!this.weights.size) {
      next.setEffectiveWeight(1);
      this.weights.set(next,1);
      return;
    }
    const from=new Map(this.weights);
    if (!from.has(next)) from.set(next,0);
    this.weights=new Map(from);
    for (const [action,weight] of from) action.setEffectiveWeight(weight);
    this.transition={from,next,duration,elapsed:0};
  }
  update(dt) {
    const blend=this.transition;
    if (!blend) return;
    blend.elapsed+=dt;
    const u=Math.min(1,blend.elapsed/blend.duration),ease=u*u*(3-2*u);
    for (const [action,start] of blend.from) {
      const weight=start+((action===blend.next?1:0)-start)*ease;
      action.setEffectiveWeight(weight);
      this.weights.set(action,weight);
      if (u===1 && action!==blend.next) {
        action.stop();
        this.weights.delete(action);
      }
    }
    if (u===1) this.transition=null;
  }
}
