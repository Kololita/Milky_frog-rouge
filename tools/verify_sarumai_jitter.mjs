import assert from 'node:assert/strict';import fs from 'node:fs/promises';import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});const data=await fs.readFile('docs/sarumai.glb'),g=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.length),''),m=new T.AnimationMixer(g.scene);const names=['upper_arm_L','upper_arm_R','forearm_L','forearm_R','blade','root'],report={};
for(const c of g.animations){m.stopAllAction();const a=m.clipAction(c);a.play();const last=new Map(),steps={};let highest=-Infinity;
 for(let k=0;k<=120;k++){a.time=Math.min(c.duration-1e-7,k/120*c.duration);m.update(0);g.scene.updateMatrixWorld(true);
  for(const n of names){const q=g.scene.getObjectByName(n).quaternion.clone().normalize(),prev=last.get(n),step=prev?T.MathUtils.radToDeg(prev.angleTo(q)):0;last.set(n,q);steps[n]=Math.max(steps[n]??0,step);assert(step<(n==='root'?12.1:n==='blade'?8.1:6.1),`${c.name}/${n} jumps ${step} degrees`);}
  if(['CrossLeft','CrossRight','DoubleLeft','DoubleRight','RoundSweep'].includes(c.name))for(const side of ['L','R']){const elbow=g.scene.getObjectByName('forearm_'+side).getWorldPosition(new T.Vector3()),eye=g.scene.getObjectByName('head').getWorldPosition(new T.Vector3());const delta=elbow.y-eye.y;highest=Math.max(highest,delta);assert(delta<0,`${c.name}: elbow above eye line`);}
 }
 report[c.name]={maximumAngularStep:steps,elbowAboveHeadRoot:Number.isFinite(highest)?highest:null};
}
await fs.writeFile('output/sarumai-jitter-validation.json',JSON.stringify(report,null,2));console.log('SAMURAI_JITTER_AND_ELBOW_LIMITS_VERIFIED',JSON.stringify(report));
