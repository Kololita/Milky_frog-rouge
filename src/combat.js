import {tunable} from './tuning-registry.js';
import {CHARACTER_HEIGHT} from './dodge.js';

export const isAttack = name => /^Attack[1-4]$/.test(name) || name==='RunAttack' || name==='AirAttack'||name==='CounterWave';
export const ATTACK_RATE=tunable('ATTACK_RATE',{CounterWave:1.45,Attack1:1.35,Attack2:1.45,Attack3:1.35,Attack4:1.45,RunAttack:1.4,runRecovery:.5,palmCharge:1,normalGap:.1});
export const ATTACK_TIMING=Object.freeze({
  CounterWave:{rate:1.45,end:1.18,link:1.18},
  Attack1:{rate:1.35,end:.66,link:.40},
  Attack2:{rate:1.45,end:.87,link:.59},
  Attack3:{rate:1.35,end:.97,link:.78},
  Attack4:{rate:1.45,end:1.18,link:1.18},
  RunAttack:{rate:1.4,end:.75,link:.50},
  AirAttack:{end:1.75,link:Infinity},
});
export const ATTACK_PHASES=Object.freeze({
  CounterWave:[[0,.35,'interval'],[.35,.83,'attack'],[.83,1.18,'interval']],
  Attack1:[[0,.36,'attack'],[.36,.66,'interval']],
  Attack2:[[0,.54,'attack'],[.54,.87,'interval']],
  Attack3:[[0,.73,'attack'],[.73,.97,'interval']],
  Attack4:[[0,.35,'interval'],[.35,.83,'attack'],[.83,1.18,'interval']],
  RunAttack:[[0,.50,'attack'],[.50,.75,'interval']],
});
export function attackPhase(name,time){return ATTACK_PHASES[name]?.find(phase=>time<phase[1]-1e-9)?.[2]??'interval';}
export function attackRate(name,time,attackSpeed=1,intervalScale=1,chargeScale=1) {
  const phase=attackPhase(name,time);
  const base=name==='RunAttack'&&phase==='interval'?ATTACK_RATE.runRecovery:['Attack4','CounterWave'].includes(name)&&time<.35?ATTACK_RATE.palmCharge:ATTACK_RATE[name]??1;
  return base*(phase==='attack'?attackSpeed:1/Math.max(.01,intervalScale))/(['Attack4','CounterWave'].includes(name)&&time<.35?Math.max(.01,chargeScale):1);
}
export function advanceAttackTime(name,time,dt,attackSpeed=1,intervalScale=1,chargeScale=1){
  let left=dt,current=time;
  for(let i=0;i<20&&left>1e-9;i++){
    const phase=ATTACK_PHASES[name]?.find(phase=>current<phase[1]-1e-9);
    if(!phase)break;
    const rate=attackRate(name,current,attackSpeed,intervalScale,chargeScale),step=Math.min(left,(phase[1]-current)/rate);
    current+=step*rate;left-=step;
  }
  return current;
}
export function attackCanFinish(name,time,queued,intervalScale=1) {
  const timing=ATTACK_TIMING[name];
  if(!timing)return false;
  const lastHit=name==='AirAttack'?0:({Attack1:.27,Attack2:.42,Attack3:.65,Attack4:.54,CounterWave:.54,RunAttack:.205}[name]??0);
  const link=name==='RunAttack'?timing.end:Math.max(lastHit,timing.link);
  return Boolean(time+1e-8>=timing.end || (queued && time+1e-8>=link));
}
export const DODGE_RATE=tunable('DODGE_RATE',{DodgeBackflip:1.18,DodgeRoll:1.25,DodgeSideL:1.3,DodgeSideR:1.3});
export const dodgeRate = name => DODGE_RATE[name]??1.3;
// Retain airborne poses and the full rotation; compress only preparation/recovery.
export const MOBILITY_TIMING=tunable('MOBILITY_TIMING',{
  Jump:{takeoff:.22,contact:.78,startup:.065,recovery:.12},
  JumpWalk:{takeoff:.14,contact:.78,startup:.045,recovery:.10},
  JumpRun:{takeoff:.14,contact:.78,startup:.045,recovery:.10},
  DodgeRoll:{takeoff:.14,contact:.84,startup:.035,recovery:.125},
  DodgeBackflip:{takeoff:.14,contact:.84,startup:.045,recovery:.11},
  DodgeSideL:{takeoff:.10,contact:.82,startup:.025,recovery:.08},
  DodgeSideR:{takeoff:.10,contact:.82,startup:.025,recovery:.08},
});
export function mobilityTime(name,elapsed,duration) {
  const p=MOBILITY_TIMING[name];
  const start=p.takeoff*duration,contact=p.contact*duration;
  const flight=(contact-start)/(name.startsWith('Dodge')?dodgeRate(name):1);
  const end=p.startup+flight+p.recovery,t=Math.max(0,elapsed);
  const time=t<p.startup ? start*t/p.startup : t<p.startup+flight
    ? start+(contact-start)*(t-p.startup)/flight
    : contact+(duration-contact)*Math.min(1,(t-p.startup-flight)/p.recovery);
  return {time:Math.min(duration,time),finished:t>=end,duration:end};
}
export const JUMP_TUNING=tunable('JUMP_TUNING',{height:CHARACTER_HEIGHT*.5});
export const JUMP_HEIGHT=CHARACTER_HEIGHT*.5;
// Match the authored takeoff/contact timing while controlling actual foot clearance.
export function jumpClearance(name,elapsed,duration) {
  const p=MOBILITY_TIMING[name];
  if(!p||!name.startsWith('Jump'))return 0;
  const flight=(p.contact-p.takeoff)*duration;
  const u=Math.max(0,Math.min(1,(elapsed-p.startup)/flight));
  return JUMP_TUNING.height*4*u*(1-u);
}
export const AIR_SLAM=tunable('AIR_SLAM',{charge:.5,lift:CHARACTER_HEIGHT*.5,impactHold:.2,recoveryRate:1,gravity:28,driftBase:.18,driftPerSpeed:.22,driftMax:.6});
export function airSlamRate(time,timeline,attackSpeed=1){return time<timeline.landTime-1e-9?attackSpeed:1;}
export function airDriftDistance(speed) {
  return Math.min(AIR_SLAM.driftMax,Math.max(AIR_SLAM.driftBase,Math.abs(speed)*AIR_SLAM.driftPerSpeed));
}

/** Clearance is measured from the rendered feet at the instant J is pressed. */
export class AirSlam {
  constructor(height,chargeScale=1) {
    this.start=Math.max(0,height);this.lift=AIR_SLAM.lift;this.apex=this.start+this.lift;
    this.charge=AIR_SLAM.charge*Math.max(.01,chargeScale);this.fall=Math.sqrt(2*this.apex/AIR_SLAM.gravity);
    this.fallStart=this.charge;
    this.landTime=this.fallStart+this.fall;
    this.recoveryStart=this.landTime+AIR_SLAM.impactHold;
    this.duration=this.recoveryStart+1.25/AIR_SLAM.recoveryRate;
  }
  sample(elapsed) {
    const t=Math.max(0,elapsed);
    if(t<this.charge) {
      const u=t/this.charge,progress=1-(1-u)**2;
      return {height:this.start+this.lift*progress,drift:progress,clipTime:.22*u,phase:'charge',landed:false,finished:false};
    }
    if(t<this.landTime) {
      const u=(t-this.fallStart)/this.fall;
      return {height:this.apex*(1-u*u),drift:1,clipTime:.22+.28*u,phase:'slam',landed:false,finished:false};
    }
    if(t<this.recoveryStart) {
      return {height:0,drift:1,clipTime:.5,phase:'impact',landed:true,finished:false};
    }
    const clipTime=Math.min(1.75,.5+(t-this.recoveryStart)*AIR_SLAM.recoveryRate);
    const flip=Math.max(0,Math.min(1,(clipTime-.70)/.78));
    return {height:.42*Math.sin(Math.PI*flip),drift:1,clipTime,phase:flip>0&&flip<1?'backflip':'recover',landed:true,finished:t>=this.duration};
  }
}
