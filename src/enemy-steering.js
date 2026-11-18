const clamp=(value,limit)=>Math.max(-limit,Math.min(limit,value));
/** Bounded angular speed, eased acceleration/deceleration and shortest-arc yaw. */
export function steerEnemy(enemy,target,dt,rate=enemy.turnRate){
  const dx=target.x-enemy.x,dz=target.z-enemy.z;
  if(dt<=0||Math.hypot(dx,dz)<1e-6)return;
  const error=Math.atan2(Math.sin(Math.atan2(dx,dz)-enemy.heading),Math.cos(Math.atan2(dx,dz)-enemy.heading));
  const limit=Math.max(0,rate),response=enemy.turnResponse,acceleration=enemy.turnAcceleration;
  const desired=clamp(error*response,limit),previous=clamp(enemy.turnVelocity??0,limit),decay=Math.exp(-acceleration*dt);
  let step=desired*dt+(previous-desired)*(1-decay)/acceleration;
  enemy.turnVelocity=desired+(previous-desired)*decay;
  if(step*error>=0&&Math.abs(step)>=Math.abs(error)){step=error;enemy.turnVelocity=0;}
  enemy.heading+=clamp(step,limit*dt);
}
