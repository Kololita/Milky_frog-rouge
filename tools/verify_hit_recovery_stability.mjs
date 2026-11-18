import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {Quaternion} from 'three';import {gameFixture} from './game_fixture.mjs';
const g=await gameFixture(),m=g.read('mixer'),model=m.getRoot(),actions=g.read('actions');m.stopAllAction();actions.Idle.reset().play();m.update(0);const neutral=new Map(['handL','handR','metarig'].map(n=>[n,model.getObjectByName(n).quaternion.clone()]));const report={};
for(const [name,start,settled]of [['HitSit',1.5,2.25],['HitLaunch',3,5.5]]){
 m.stopAllAction();const a=actions[name];a.reset().play();let previous=new Map(),maxJointStep=0,maxChestStep=0;const duration=a.getClip().duration;
 for(let f=Math.ceil(start*60);f<duration*60;f++){
  a.time=f/60;m.update(0);model.updateMatrixWorld(true);
  for(const n of ['upper_armL','forearmL','handL','upper_armR','forearmR','handR','spine001']){
   const q=model.getObjectByName(n).quaternion.clone(),old=previous.get(n),step=old?q.angleTo(old):0;
   assert(step<.3,`${name}/${n}: recovery snap ${step} at ${f/60}`);maxJointStep=Math.max(maxJointStep,step);if(n==='spine001')maxChestStep=Math.max(maxChestStep,step);previous.set(n,q);
  }
  if(f/60>=settled)for(const n of ['handL','handR'])assert(model.getObjectByName(n).quaternion.angleTo(neutral.get(n))<.001,'Wrist flips again after returning to neutral');
  const root=model.getObjectByName('metarig').quaternion;assert(Math.abs(root.y)<1e-6&&Math.abs(root.z)<1e-6,'Fall root adds yaw/roll during recovery');
 }
 report[name]={maxJointStepDegrees:maxJointStep*180/Math.PI,maxChestStepDegrees:maxChestStep*180/Math.PI,neutralWristAfter:settled};
}
await fs.writeFile('output/player-hit-recovery-verification.json',JSON.stringify(report,null,2));console.log('HIT_RECOVERY_STABILITY_VERIFIED',report);
