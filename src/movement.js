import { screenInputDirection } from './direction.js';
import { MOVEMENT } from './control-tuning.js';

export function nextBlinkDelay(random = Math.random) {
  return 10 + random() * 3;
}

export function movementInput(keys, cameraForward = {x:0,z:1}) {
  const direction = screenInputDirection(keys,cameraForward);
  return {
    direction,
    move: direction ? 1 : 0,
    sprint: Boolean(direction) && (keys.has('ShiftLeft') || keys.has('ShiftRight')),
  };
}

export function jumpForMovement(input, velocity) {
  if (!input.move && Math.abs(velocity) <= MOVEMENT.stopSpeed) return 'Jump';
  return input.sprint ? 'JumpRun' : 'JumpWalk';
}

export const TURN_RATE = MOVEMENT.turnRate;
export const REVERSE_ANGLE = MOVEMENT.reverseAngle;
export function angleDelta(target, heading) {
  return Math.atan2(Math.sin(target-heading), Math.cos(target-heading));
}
const smooth = t => { const u=Math.max(0,Math.min(1,t)); return u*u*(3-2*u); };
// The same two-step timing is baked into PivotLeft / PivotRight in Blender.
export function pivotTurn(phase) {
  return .75*smooth((phase-.20)/.37)+.25*smooth((phase-.57)/.37);
}

function approachSpeed(velocity,move,target,dt) {
  const response=!move ? MOVEMENT.braking : target<velocity ? MOVEMENT.speedDown : MOVEMENT.acceleration;
  const decay=Math.exp(-response*dt);
  const next=target+(velocity-target)*decay;
  return {velocity:!move&&next<MOVEMENT.stopSpeed ? 0 : next,
    distance:target*dt+(velocity-target)*(1-decay)/response};
}

function advanceSpeed(velocity,input,dt) {
  const ramp=input.sprintRamp;
  if(input.move&&ramp){
    const frameStart=ramp.elapsed-dt;
    // A capped frame delta can skip the end of the acceleration window.
    if(frameStart>=ramp.duration)return {velocity:MOVEMENT.runSpeed,distance:MOVEMENT.runSpeed*dt};
    const start=Math.max(0,frameStart),end=Math.min(ramp.elapsed,ramp.duration);
    if(end>start){
      // Integrate the parts before, inside and after the Shift window separately.
      const walk=approachSpeed(velocity,input.move,MOVEMENT.walkSpeed,Math.max(0,-frameStart));
      const rampTime=end-start;
      const next=end===ramp.duration ? MOVEMENT.runSpeed
        : walk.velocity+(MOVEMENT.runSpeed-walk.velocity)*rampTime/(ramp.duration-start);
      return {velocity:next,distance:walk.distance+(walk.velocity+next)*.5*rampTime+
        MOVEMENT.runSpeed*Math.max(0,ramp.elapsed-ramp.duration)};
    }
  }
  const target=input.move*(input.sprint ? MOVEMENT.runSpeed : MOVEMENT.walkSpeed);
  return approachSpeed(velocity,input.move,target,dt);
}

export function advanceMovement(state, input, dt, blocked = false, { airborne = false, facingHeading = null } = {}) {
  if (blocked) return {heading:state.heading,velocity:0,dx:0,dz:0,pivot:null,turnTarget:null};
  // Locked walking strafes in the input direction independently of body facing.
  // Keep the travel direction while braking, rather than drifting toward the target.
  if(Number.isFinite(facingHeading)) {
    const travelHeading=input.direction ? Math.atan2(input.direction.x,input.direction.z) : state.turnTarget??state.heading;
    const {velocity,distance}=advanceSpeed(state.velocity,input,dt);
    return {heading:facingHeading,velocity,dx:Math.sin(travelHeading)*distance,dz:Math.cos(travelHeading)*distance,
      pivot:null,turnTarget:input.direction||velocity>0 ? travelHeading : null};
  }
  let pivot = airborne ? null : state.pivot;
  const targetHeading = input.direction ? Math.atan2(input.direction.x,input.direction.z) : state.heading;
  const delta = angleDelta(targetHeading,state.heading);
  const turnTarget=input.direction ? targetHeading : null;
  const newAim=state.turnTarget==null || Math.abs(angleDelta(targetHeading,state.turnTarget))>1e-4;
  if (!pivot && !airborne && input.direction && newAim && state.velocity > MOVEMENT.reverseMinSpeed && Math.abs(delta) >= MOVEMENT.reverseAngle) {
    pivot = { from:state.heading, delta, speed:state.velocity, elapsed:0,
      duration:state.velocity>MOVEMENT.runPivotSpeed ? MOVEMENT.runPivotDuration : MOVEMENT.walkPivotDuration, name:delta>=0 ? 'PivotLeft' : 'PivotRight' };
  }
  if (pivot) {
    const elapsed=Math.min(pivot.duration,pivot.elapsed+dt), brake=pivot.duration*.20;
    // Integrate the short brake exactly; both steps after braking stay in place.
    const brakeDistance = t => pivot.speed*brake/3*(1-(1-Math.min(t/brake,1))**3);
    const distance=brakeDistance(elapsed)-brakeDistance(pivot.elapsed);
    const heading=pivot.from+pivot.delta*pivotTurn(elapsed/pivot.duration);
    const result={ heading, velocity:pivot.speed*(1-Math.min(elapsed/brake,1))**2,
      dx:Math.sin(pivot.from)*distance, dz:Math.cos(pivot.from)*distance,
      pivot:elapsed<pivot.duration ? {...pivot,elapsed} : null,turnTarget };
    if (!result.pivot) {
      // Consume this frame's remaining time, without an intermediate Idle frame.
      const remaining=Math.max(0,dt-(pivot.duration-pivot.elapsed));
      const next=advanceMovement(result,input,remaining,false,{airborne});
      return {...next,dx:result.dx+next.dx,dz:result.dz+next.dz,pivotCompleted:true};
    }
    return result;
  }
  let heading = state.heading;
  if (input.direction) {
    const limit = MOVEMENT.turnRate*dt;
    const eased=delta*(1-Math.exp(-MOVEMENT.turnResponse*dt));
    heading += Math.max(-limit,Math.min(limit,eased));
    if (Math.abs(delta)<=limit && Math.abs(angleDelta(targetHeading,heading))<MOVEMENT.turnSnap) heading+=angleDelta(targetHeading,heading);
  }
  const {velocity,distance}=advanceSpeed(state.velocity,input,dt);
  return { heading, velocity, dx:Math.sin(heading)*distance, dz:Math.cos(heading)*distance,pivot:null,turnTarget };
}

