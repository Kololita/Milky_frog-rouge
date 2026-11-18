import {MOVEMENT,ANIMATION} from './control-tuning.js';
export const isGait = name => name==='Walk' || name==='Run';
export function gaitTransitionPhase(action, to) {
  return action && isGait(action.getClip().name) && isGait(to) ? (action.time/action.getClip().duration)%1 : null;
}

export function locomotionName(input, velocity, previousName, blocked=false) {
  if (blocked || !input.move) return 'Idle';
  return input.sprint || (previousName==='Run' && velocity>ANIMATION.runExitSpeed) ? 'Run' : 'Walk';
}
export function locomotionRate(name, velocity) {
  const run=name==='Run', speed=run ? MOVEMENT.runSpeed : MOVEMENT.walkSpeed;
  const ratio=Math.max(run ? ANIMATION.minRunStride : ANIMATION.minWalkStride,Math.min(1,velocity/speed));
  return (run ? ANIMATION.runRate : ANIMATION.walkRate)*ratio;
}
export function transitionDuration(from='', to='') {
  if (to.startsWith('Dodge')) return ANIMATION.dodgeFade;
  if (to.startsWith('Attack') || to==='RunAttack' || to==='AirAttack' || to==='CounterWave' || to==='Block') return ANIMATION.combatFade;
  if (to.startsWith('Pivot') || from.startsWith('Pivot')) return ANIMATION.pivotFade;
  if (to.startsWith('Jump')) return ANIMATION.jumpFade;
  if (isGait(from) && isGait(to)) return ANIMATION.gaitFade;
  if (to==='Idle') return ANIMATION.stopFade;
  if (from==='Idle' && isGait(to)) return ANIMATION.startFade;
  if (isGait(to)) return ANIMATION.recoveryFade;
  return ANIMATION.expressionFade;
}
