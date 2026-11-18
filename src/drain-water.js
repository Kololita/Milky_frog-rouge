import {createGpuDrainMotion} from './gpu-drain-motion.js';
import {createFluidDensitySolver} from './fluid-pressure.js';
import {drainHeight} from './drain-floor.js';
import {createWaterSurface} from './water-surface.js';
const COUNT=2400,STEP=1/90,RADIUS=11.35;
const MAX_GPU_STEPS=3,MAX_CPU_STEPS=2;
/** Fixed-step water particles: gravity, floor contact, viscosity and graded drains. */
export function createDrainWater(parent){
 const surface=createWaterSurface(parent),mesh=surface.mesh;
 const particles=[];let last=null,accumulator=0,emission=0,cursor=0,seed=71;
 let relaxFluidDensity;
 const pressureSettings={radius:.18,iterations:2,stiffness:.012,nearStiffness:.025};
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 function reset(){particles.length=0;accumulator=emission=0;cursor=0;}
 function simulate(dt,zones,time){
  for(const zone of zones){if(time>=zone.until||!Number.isFinite(zone.brokenAt))continue;emission+=dt*220;while(emission>=1){emission--;const angle=random()*Math.PI*2,speed=2.6+random()*1.6;const p={x:zone.x,y:.71,z:zone.z,vx:Math.cos(angle)*speed,vy:2+random()*2,vz:Math.sin(angle)*speed,age:0};if(particles.length<COUNT)particles.push(p);else particles[cursor++%COUNT]=p;}}
  for(const p of particles){p.solveX=p.x;p.solveY=p.y;p.solveZ=p.z;}
  relaxFluidDensity??=createFluidDensitySolver(COUNT);
  relaxFluidDensity(particles,pressureSettings);
  for(const p of particles){p.vx+=(p.x-p.solveX)/dt*.15;p.vy+=(p.y-p.solveY)/dt*.15;p.vz+=(p.z-p.solveZ)/dt*.15;}
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.age+=dt;
   const floorY=drainHeight(p.x,p.z);
   if(!p.channel&&floorY<0&&p.y<-.05){const gx=Math.round(p.x/4)*4,gz=Math.round(p.z/4)*4;p.channel=Math.abs(p.x-gx)<Math.abs(p.z-gz)?'z':'x';p.channelCenter=p.channel==='z'?gx:gz;}

   if(p.y>floorY+.005){p.vy-=9.81*dt;}else{
    p.y=floorY;p.vy=0;const gx=Math.round(p.x/4)*4,gz=Math.round(p.z/4)*4,dx=gx-p.x,dz=gz-p.z;
    if(Math.min(Math.abs(dx),Math.abs(dz))>.075){const x=Math.abs(dx)<Math.abs(dz);p.vx+=(x?dx*12:0)*dt;p.vz+=(x?0:dz*12)*dt;}
    else{const alongX=p.channel?p.channel==='x':Math.abs(dz)<Math.abs(dx);const outward=alongX?(Math.sign(p.x)||Math.sign(p.vx)||1):(Math.sign(p.z)||Math.sign(p.vz)||1);p.vx+=(alongX?outward*2.8:dx*28)*dt;p.vz+=(alongX?dz*28:outward*2.8)*dt;}
    const drag=Math.exp(-1.4*dt);p.vx*=drag;p.vz*=drag;
   }
   p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
   if(p.channel==='z'){p.x=Math.max(p.channelCenter-.12,Math.min(p.channelCenter+.12,p.x));if(Math.abs(p.x-p.channelCenter)>=.119)p.vx=0;}
   if(p.channel==='x'){p.z=Math.max(p.channelCenter-.12,Math.min(p.channelCenter+.12,p.z));if(Math.abs(p.z-p.channelCenter)>=.119)p.vz=0;}
   const nextFloor=drainHeight(p.x,p.z);if(p.y<nextFloor){p.y=nextFloor;p.vy=Math.abs(p.vy)*.08;}
   if(Math.hypot(p.x,p.z)>RADIUS||p.age>24){particles[i]=particles.at(-1);particles.pop();}
  }
 }
 let renderer,gpu,gpuUntil=-Infinity,tick=0;
 const emitters=new Float32Array(12),windows=new Float32Array(8);
 function prepare(value){
  if(renderer===value)return;
  gpu?.dispose();
  renderer=value;
  gpu=createGpuDrainMotion(value,60,40);
  surface.prepare(value,Boolean(gpu));
 }
 async function warmup(zones,draw){
  try{
   await gpu?.prepareShaders();
   await surface.prepareShaders();
   const active=zones.map(zone=>({...zone,brokenAt:0,until:1}));
   update(0,active);
   update(.025,active);
   await draw();
  }finally{
   reset();
   gpu?.reset();
   gpuUntil=-Infinity;
   last=null;
   tick=0;
   seed=71;
   surface.update(particles,[],0);
  }
 }
 function update(time,zones){
  if(last===null||time<last||time-last>1){
   reset();
   if(gpu&&Number.isFinite(gpuUntil))gpu.reset();
   gpuUntil=-Infinity;
   tick=0;
   surface.update(particles,zones,time);
   last=time;
  }
  accumulator+=Math.min(.1,time-last);
  last=time;
  const emitting=zones.some(zone=>Number.isFinite(zone.brokenAt)&&time<zone.until);
  if(!emitting&&(gpu?time>=gpuUntil:particles.length===0)){
   accumulator=0;
   surface.update(particles,zones,time);
   return 0;
  }
  const maxSteps=gpu?MAX_GPU_STEPS:MAX_CPU_STEPS;
  // Drop old visual simulation time instead of repeatedly catching up after a stall.
  accumulator=Math.min(accumulator,maxSteps*STEP);
  let pressureReady=false;
  if(gpu&&accumulator>=STEP){
   windows.fill(0);
   for(let i=0;i<Math.min(zones.length,4);i++){
    const zone=zones[i];
    if(!Number.isFinite(zone.brokenAt))continue;
    emitters[i*3]=zone.x;
    emitters[i*3+1]=.71;
    emitters[i*3+2]=zone.z;
    windows[i*2]=zone.brokenAt;
    windows[i*2+1]=zone.until;
    gpuUntil=Math.max(gpuUntil,zone.until+24);
   }
   gpu.setEmitters(emitters,windows);
  }
  let steps=0;
  while(steps<maxSteps&&accumulator+1e-9>=STEP){
   const stepTime=time-accumulator;
   if(gpu){
    if(stepTime<gpuUntil){
     if(!pressureReady){gpu.refreshPressure();pressureReady=true;}
     gpu.step(STEP,++tick,stepTime,STEP*220/(COUNT/4),surface.density);
    }
   }else simulate(STEP,zones,stepTime);
   accumulator=Math.max(0,accumulator-STEP);
   steps++;
  }
  surface.update(particles,zones,time,gpu&&time<gpuUntil?gpu.positions:null,tick);
  return steps;
 }
 return {mesh,prepare,warmup,update,setRefraction:surface.setRefraction,get count(){return particles.length;},get channelStats(){const water=particles.filter(p=>p.channel);return {count:water.length,escaped:water.filter(p=>drainHeight(p.x,p.z)>=0||p.y>.01).length};}};
}
