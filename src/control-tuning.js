import {tunable} from './tuning-registry.js';
// Feel parameters live here; authored poses and combat rules stay independent.
export const MOVEMENT=tunable('MOVEMENT',{
  walkSpeed:1.2, runSpeed:2.8,
  acceleration:18, speedDown:20, braking:26, stopSpeed:.05,
  turnRate:Math.PI*6, turnResponse:55, turnSnap:Math.PI/360,
  reverseAngle:Math.PI*150/180, reverseMinSpeed:.5,
  walkPivotDuration:.42, runPivotDuration:.46, runPivotSpeed:1.8,
});
export const ANIMATION=tunable('ANIMATION',{
  walkRate:1.1, runRate:1.2, minWalkStride:.62, minRunStride:.68,
  runExitSpeed:2.05, rateResponse:20,
  startFade:.10, stopFade:.12, gaitFade:.13, pivotFade:.055,
  combatFade:.055, dodgeFade:.035, jumpFade:.045, recoveryFade:.12, expressionFade:.18,
});
export const BLOCK=tunable('BLOCK',{
  raiseDuration:.1,raiseClipFraction:.5,releaseGrace:4/60,
  reblockVulnerability:8/60,repeatPenaltyWindow:.5,repeatPerfectScale:.75,
});
export const COMBO=tunable('COMBO',{ inputWindow:.5 });
export const CAMERA=tunable('CAMERA',{
  yawSensitivity:.004, zoomResponse:20,
  initialDistance:5.5, pitch:.43, targetHeight:1.0,
  elevation:.35, lookHeight:.18, shoulderOffset:.55,
  enemyLookWeight:.28, focusRange:5, lookResponse:8,
  collisionRadius:.25, collisionPullResponse:4.5, collisionReturnResponse:4, collisionReleaseDelay:.22,
});
export const TARGET_LOCK=tunable('TARGET_LOCK',{
  tolerance:Math.PI*20/180,response:14,maxYawRate:Math.PI*2.5,
  settledAngle:Math.PI*.25/180,minTargetDistance:.25,screenMargin:.92,
});
