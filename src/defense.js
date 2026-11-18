import {COMBAT_FPS,DODGE_DEFENSE,GUARD_TIERS} from './battle-values.js';

// Half-open windows preserve exact authored frame counts at the 60Hz baseline.
export function dodgeInvulnerable(name,elapsed) {
  const window=DODGE_DEFENSE[name];
  if(!window||!Number.isFinite(elapsed))return false;
  const frame=elapsed*COMBAT_FPS;
  return frame>=window.startFrame-1e-8 && frame<window.startFrame+window.frames-1e-8;
}
export function guardTier(elapsed=Infinity,perfectScale=1) {
  // elapsed is wall-clock seconds, converted to 60Hz reference frames.
  // For example, 10 reference frames = 1/6 s at both 30 and 144 render FPS.
  const frame=Math.max(0,Number.isFinite(elapsed)?elapsed:Infinity)*COMBAT_FPS;
  const scale=Math.max(0,Math.min(1,Number.isFinite(perfectScale)?perfectScale:1));
  return GUARD_TIERS.find((tier,index)=>frame<=(index===0?tier.maxFrames*scale:tier.maxFrames)+1e-8);
}
