/** WASD in the horizontal plane of the visible camera; no input gives null. */
export function screenInputDirection(keys, cameraForward) {
  const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
  const right = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  if (!forward && !right) return null;
  const length = Math.hypot(cameraForward.x,cameraForward.z);
  const fx = length > 1e-6 ? cameraForward.x/length : 0;
  const fz = length > 1e-6 ? cameraForward.z/length : 1;
  const x = fx*forward-fz*right, z = fz*forward+fx*right;
  const magnitude = Math.hypot(x,z);
  return {x:x/magnitude,z:z/magnitude};
}

/** One correction per attack stage, along the shortest turn to its aim. */
export function attackHeading(heading, aim, stage) {
  if (!aim) return heading;
  const target = Math.atan2(aim.x,aim.z);
  const delta = Math.atan2(Math.sin(target-heading),Math.cos(target-heading));
  const limit = stage === 1 ? Math.PI*2 : Math.PI/2;
  return heading+Math.max(-limit,Math.min(limit,delta));
}
