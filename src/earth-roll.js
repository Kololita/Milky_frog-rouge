const epsilon=1e-7;

// Normal points away from the obstacle, toward the center of the rolling ball.
function sweepCircle(position,dx,dz,radius,obstacle){
 const x=position.x-obstacle.x,z=position.z-obstacle.z;
 const distance=Math.hypot(x,z),clearance=radius+obstacle.radius;
 const length=Math.hypot(dx,dz);
 if(distance<clearance-epsilon){
  return {time:0,nx:distance>epsilon?x/distance:-dx/length,nz:distance>epsilon?z/distance:-dz/length,offset:clearance-distance};
 }
 const dot=x*dx+z*dz,a=length*length,discriminant=dot*dot-a*(distance*distance-clearance*clearance);
 if(dot>=0||discriminant<0)return null;
 const time=Math.max(0,(-dot-Math.sqrt(discriminant))/a);
 if(time>1)return null;
 return {time,nx:(x+dx*time)/clearance,nz:(z+dz*time)/clearance,offset:0};
}

function sweepBoundary(position,dx,dz,radius,boundary){
 const outside=t=>{
  const x=position.x+dx*t,z=position.z+dz*t;
  return Math.hypot(x,z)+radius-boundary(x,z);
 };
 if(outside(1)<=0)return null;
 let lo=0,hi=1;
 for(let i=0;i<14;i++){
  const mid=(hi+lo)/2;
  if(outside(mid)>0)hi=mid;else lo=mid;
 }
 const x=position.x+dx*lo,z=position.z+dz*lo,distance=Math.hypot(x,z);
 return {time:lo,nx:-x/distance,nz:-z/distance,offset:Math.max(0,outside(lo))};
}

export function advanceEarthRoll(roll,position,direction,dt,obstacles,{boundary,onContact,onTravel}={}){
 const {radius,acceleration,drag,maxSpeed}=roll.stats;
 // Linear drag with exact velocity integration keeps the acceleration consistent across frame rates.
 const decay=Math.exp(-drag*dt);
 const inputScale=drag>epsilon?-Math.expm1(-drag*dt)/drag:dt;
 roll.vx=roll.vx*decay+(direction?.x??0)*acceleration*inputScale;
 roll.vz=roll.vz*decay+(direction?.z??0)*acceleration*inputScale;
 const speed=Math.hypot(roll.vx,roll.vz);
 if(speed>maxSpeed){roll.vx*=maxSpeed/speed;roll.vz*=maxSpeed/speed;}

 const travel=(dx,dz)=>{position.x+=dx;position.z+=dz;onTravel?.(dx,dz);};
 let remaining=dt;
 for(let i=0;i<8&&remaining>epsilon;i++){
  const dx=roll.vx*remaining,dz=roll.vz*remaining;
  if(Math.hypot(dx,dz)<epsilon)break;
  let hit=boundary?sweepBoundary(position,dx,dz,radius,boundary):null;
  for(const obstacle of obstacles){
   const contact=sweepCircle(position,dx,dz,radius,obstacle);
   if(contact&&(!hit||contact.time<hit.time))hit={...contact,obstacle};
  }
  if(!hit){travel(dx,dz);break;}
  const {time,nx,nz,offset,obstacle}=hit;
  travel(dx*time,dz*time);
  position.x+=nx*(offset+epsilon*8);position.z+=nz*(offset+epsilon*8);
  const normalSpeed=roll.vx*nx+roll.vz*nz;
  if(normalSpeed<-epsilon){
   // Contact can add an outward speed; the tangential component is untouched.
   const impulse=-2*normalSpeed+(onContact?.(obstacle)??0);
   roll.vx+=impulse*nx;
   roll.vz+=impulse*nz;
  }
  remaining*=1-time;
 }
}
