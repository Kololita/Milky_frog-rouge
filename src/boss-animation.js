const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
const neutral={armX:0,armY:0,armZ:-.25,elbowX:-.6,offArmX:-.3,offArmZ:.15,offElbowX:-.8,torsoX:0,torsoY:0,torsoZ:0,height:0};
const poseKeys=Object.keys(neutral);
const mix=(a,b,t)=>{const result={};for(const key of poseKeys)result[key]=a[key]+(b[key]-a[key])*t;return result;};
const pose=values=>({...neutral,...values});
const profiles={
  'cross-left':[
    pose({armX:-1.1,armY:.3,armZ:-1.0,elbowX:-.5,torsoY:.85,torsoX:-.06}),
    pose({armX:-1.15,armY:-.3,armZ:.60,elbowX:-.25,torsoY:-.7,torsoX:.12}),
    pose({armX:-.7,armY:-.5,armZ:.85,elbowX:-.35,torsoY:-.9,torsoX:.15}),
  ],
  'cross-right':[
    pose({armX:-1.05,armY:-.4,armZ:.65,elbowX:-.65,torsoY:-.8,torsoX:.06}),
    pose({armX:-1.15,armY:.3,armZ:-.95,elbowX:-.2,torsoY:.7,torsoX:.12}),
    pose({armX:-.7,armY:.5,armZ:-1.1,elbowX:-.3,torsoY:.9}),
  ],
  overhead:[
    pose({armX:-2.5,armZ:-.25,elbowX:-.75,offArmX:-2.1,offArmZ:.3,offElbowX:-.8,torsoX:-.15,torsoY:.1}),
    pose({armX:-.5,armZ:-.20,elbowX:-.4,offArmX:-.8,offElbowX:-.5,torsoX:.30,torsoY:-.1}),
    pose({armX:.15,armZ:-.1,elbowX:-.25,offArmX:-.3,torsoX:.35,torsoY:-.15}),
  ],
  rising:[
    pose({armX:.15,armY:.2,armZ:-.75,elbowX:-.25,torsoX:.24,torsoY:-.65}),
    pose({armX:-1.9,armY:-.15,armZ:.15,elbowX:-.55,torsoX:-.08,torsoY:.5}),
    pose({armX:-2.2,armZ:.3,elbowX:-.8,torsoX:-.12,torsoY:.65}),
  ],
  'short-thrust':[
    pose({armX:-.45,armZ:-.15,elbowX:-1.5,torsoY:.45,torsoX:-.05}),
    pose({armX:-1.5,armZ:-.15,elbowX:-.1,torsoY:-.35,torsoX:.22}),
    pose({armX:-1.35,armZ:-.15,elbowX:-.2,torsoY:-.4,torsoX:.25}),
  ],
  'long-thrust':[
    pose({armX:-.6,armZ:-.25,elbowX:-1.55,offArmX:-1.2,torsoY:.65,torsoX:-.15}),
    pose({armX:-1.5,armZ:-.05,elbowX:-.05,offArmX:.3,torsoY:-.45,torsoX:.32}),
    pose({armX:-1.4,armZ:-.05,elbowX:-.15,offArmX:.35,torsoY:-.5,torsoX:.36}),
  ],
  'round-sweep':[
    pose({armX:-1.1,armY:.5,armZ:-1,elbowX:-.45,torsoY:-1.1,torsoX:.1}),
    pose({armX:-1.2,armY:-.5,armZ:.7,elbowX:-.15,torsoY:1.1,torsoX:.12}),
    pose({armX:-.9,armY:-.6,armZ:.9,elbowX:-.2,torsoY:1.35,torsoX:.15}),
  ],
};
/** Author one continuous path through preparation, contact and recovery. */
export function bossAnimationPose(enemy){
  if(enemy.move?.motion==='buried-overhead'){
    const gather=pose({armX:-1.3,armZ:.65,elbowX:-.9,offArmX:-1.2,offArmZ:-.55,offElbowX:-1,torsoX:.08,height:-.035});
    const raised=pose({armX:-2.65,armZ:.80,elbowX:-.45,offArmX:-2.4,offArmZ:-.65,offElbowX:-.5,torsoX:-.18,height:.035});
    const buried=pose({armX:.10,armZ:.65,elbowX:-.10,offArmX:-.35,offElbowX:-.4,torsoX:.32,height:-.06});
    if(enemy.state==='windup'){
      if(enemy.elapsed<enemy.telegraph){
        const u=enemy.elapsed/enemy.telegraph;
        return u<.16?mix(neutral,gather,smooth(u/.16)):mix(gather,raised,smooth((u-.16)/.84));
      }
      const u=(enemy.elapsed-enemy.telegraph)/enemy.swingDuration;
      return mix(raised,buried,smooth(u*u));
    }
    if(enemy.state==='recover'&&enemy.extracting){
      const u=Math.min(1,enemy.elapsed/enemy.recovery);
      const strain=pose({...buried,torsoX:.32-.08*Math.sin(u*Math.PI),height:-.06+.025*Math.sin(u*Math.PI*4)});
      return mix(strain,neutral,smooth((u-.7)/.3));
    }
  }
  const alias={'double-left':'cross-left','double-right':'cross-right','counter-thrust':'long-thrust'};
  const [raised,contact,follow]=profiles[alias[enemy.move?.motion]??enemy.move?.motion]??profiles.overhead;
  if(enemy.state==='windup'){
    if(enemy.elapsed<enemy.telegraph)return mix(neutral,raised,smooth(enemy.elapsed/Math.min(.32,enemy.telegraph)));
    return mix(raised,contact,smooth((enemy.elapsed-enemy.telegraph)/enemy.swingDuration));
  }
  if(enemy.state==='recover'&&enemy.move){
    if(enemy.elapsed<.12)return mix(contact,follow,smooth(enemy.elapsed/.12));
    return mix(follow,neutral,smooth((enemy.elapsed-.12)/Math.min(.24,Math.max(.01,enemy.recovery-.12))));
  }
  return {...neutral};
}
