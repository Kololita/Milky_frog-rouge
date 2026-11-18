import {tunable} from './tuning-registry.js';
import {AnimationClip,QuaternionKeyframeTrack,VectorKeyframeTrack,Quaternion} from 'three';
export const BACK_THROW=tunable('BACK_THROW',{range:1.55,halfAngle:Math.PI*50/180,motionMultiplier:7.5,slamTakeoff:.95,slamApex:1.25,slamHeight:1.05,impact:1.55,flipStart:1.85,duration:3,recovery:4,regrabProtection:1});
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const u=clamp(x);return u*u*(3-2*u);};
const mix=(a,b,u)=>a+(b-a)*u;
export function canBackThrow(pose,enemy,now=0) {
  if(!enemy||enemy.throwProtected||enemy.invulnerable||enemy.health<=0||enemy.backThrowable===false||(enemy.bodyPlan==='nonhumanoid'&&!enemy.throwOverride)||pose.height>.1||['thrown','down','rising','dead'].includes(enemy.state))return false;
  if(now<(enemy.backThrowImmuneUntil??0)-1e-9)return false;
  const dx=pose.x-enemy.x,dz=pose.z-enemy.z,d=Math.hypot(dx,dz);
  return d>1e-5&&d<=BACK_THROW.range+1e-9&&(-dx*Math.sin(enemy.heading)-dz*Math.cos(enemy.heading))/d>=Math.cos(BACK_THROW.halfAngle)-1e-9;
}
export const throwRecovery=enemy=>BACK_THROW.recovery*.8**Math.max(0,Math.floor(enemy.impactResistance??0));
export const backThrowLandingTime=()=>BACK_THROW.flipStart+(BACK_THROW.duration-BACK_THROW.flipStart)/1.15;
/** Paired choreography in world space, shared by gameplay and offline review. */
export function sampleBackThrow(throwState,time) {
  const {origin,targetOrigin,heading}=throwState,fx=Math.sin(heading),fz=Math.cos(heading);
  const anchor={x:targetOrigin.x-fx*.78,z:targetOrigin.z-fz*.78};
  const landing={x:anchor.x-fx*1.02,z:anchor.z-fz*1.02};
  const reach=smooth(time/.22),turn=smooth((time-.22)/.5),lift=smooth((time-.22)/.58),heave=smooth((time-.8)/.45);
  let x=mix(origin.x,anchor.x,reach),z=mix(origin.z,anchor.z,reach);
  const sit=smooth((time-BACK_THROW.slamTakeoff)/(BACK_THROW.impact-BACK_THROW.slamTakeoff)),flip=clamp((time-BACK_THROW.flipStart)/(backThrowLandingTime()-BACK_THROW.flipStart));
  x=mix(x,landing.x+fx*.23,sit)+fx*1.5*smooth(flip);
  z=mix(z,landing.z+fz*.23,sit)+fz*1.5*smooth(flip);
  const carry={x:anchor.x+fx*.08,z:anchor.z+fz*.08};
  const targetX=mix(mix(targetOrigin.x,carry.x,lift),landing.x,heave),targetZ=mix(mix(targetOrigin.z,carry.z,lift),landing.z,heave);
  const standing=(throwState.targetScale??1)*.83;
  const center=mix(mix(standing,1.9,lift),.29,heave)+.28*Math.sin(Math.PI*heave);
  const ascent=clamp((time-BACK_THROW.slamTakeoff)/(BACK_THROW.slamApex-BACK_THROW.slamTakeoff));
  const descent=clamp((time-BACK_THROW.slamApex)/(BACK_THROW.impact-BACK_THROW.slamApex));
  const leap=time<BACK_THROW.slamApex?BACK_THROW.slamHeight*(1-(1-ascent)**2):BACK_THROW.slamHeight*(1-descent*descent);
  const contact=.32*smooth((time-BACK_THROW.slamApex)/.3)*(1-smooth((time-BACK_THROW.flipStart)/.2));
  return {hero:{x,z,heading:heading+Math.PI*turn,height:leap+contact+.92*Math.sin(Math.PI*flip),landed:time>=backThrowLandingTime()-1e-9,time:Math.min(time,BACK_THROW.duration)},
    enemy:{x:targetX,z:targetZ,center,pitch:mix(-Math.PI*.5*lift,-Math.PI/2,heave),heading:heading+Math.PI*turn}};
}
/** Reuse authored joint poses, with a new timed grab/lift/heave/sit/backflip clip. */
export function createBackThrowClip(clips) {
  const byName=new Map(clips.map(clip=>[clip.name,clip]));
  if(!['Idle','RunAttack','AirAttack','Sit'].every(name=>byName.has(name)))return null;
  const poses=[[0,'Idle',0],[.22,'RunAttack',.10],[.75,'AirAttack',.20],[.95,'RunAttack',.23],[1.10,'AirAttack',.20],[1.25,'AirAttack',.30],
    [1.45,'Sit',1.6],[1.55,'Sit',1.8],[1.85,'Sit',1.8],[1.99,'AirAttack',.70],
    [2.20,'AirAttack',.96],[2.45,'AirAttack',1.20],[2.70,'AirAttack',1.48],[2.87,'AirAttack',1.73],[3,'Idle',0]];
  const tracks=[],reference=byName.get('Idle');
  for(const track of reference.tracks){
    if(!/\.(?:quaternion|position)$/.test(track.name)||track.name==='jaw.position')continue;
    const quaternion=track.name.endsWith('.quaternion'),values=[],times=[],q=new Quaternion(),prev=new Quaternion();
    for(const [time,name,at] of poses){
      // Keep the feet planted while lifting. AirAttack supplies raised arms,
      // while its seated legs/root would be unsuitable for carrying a target.
      let sourceName=name,sourceTime=at;
      if(time===.75&&!/^(?:upper_arm|forearm|hand|shoulder|f_|thumb)/.test(track.name)){sourceName=byName.has('Crouch')?'Crouch':'Idle';sourceTime=.18;}
      if(time===.75&&/^(?:f_|thumb)/.test(track.name)){sourceName='RunAttack';sourceTime=.10;}
      const source=byName.get(sourceName).tracks.find(t=>t.name===track.name)??track;
      const value=Array.from(source.createInterpolant().evaluate(Math.min(sourceTime,byName.get(sourceName).duration)));
      if(quaternion){q.fromArray(value).normalize();if(times.length&&q.dot(prev)<0)q.set(-q.x,-q.y,-q.z,-q.w);q.toArray(value);prev.copy(q);}
      const authored=[0,.95,1.25,1.55,1.85,3],adjusted=[0,BACK_THROW.slamTakeoff,BACK_THROW.slamApex,BACK_THROW.impact,BACK_THROW.flipStart,BACK_THROW.duration];
      let segment=0;while(segment<authored.length-2&&time>authored[segment+1])segment++;
      const retimed=adjusted[segment]+(adjusted[segment+1]-adjusted[segment])*(time-authored[segment])/(authored[segment+1]-authored[segment]);
      times.push(retimed);values.push(...value);
    }
    tracks.push(new (quaternion?QuaternionKeyframeTrack:VectorKeyframeTrack)(track.name,times,values));
  }
  return new AnimationClip('BackThrow',BACK_THROW.duration,tracks);
}
