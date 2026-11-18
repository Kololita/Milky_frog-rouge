import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {energyDamageMultiplier,POSE_STATS} from '../src/battle-values.js';
for(const [energy,bonus] of [[0,0],[16.5,.025],[33,.05],[66,.10],[98,.15*98/99],[99,.20]])assert(Math.abs(energyDamageMultiplier(energy)-1-bonus)<1e-9);
for(const fps of [30,60,144]){
 const b=new Battle();b.enemy.z=1;b.enemy.heading=Math.PI;
 const pose={x:0,z:0,heading:0,height:0,guarding:false};
 b.strikePlayer(pose);assert.equal(b.player.pose,80);
 b.enemy.z=30;
 for(let i=0;i<Math.floor(3*fps);i++)b.update(1/fps,pose);
 assert.equal(b.player.pose,80,'Recovered during three-second delay');
 while(b.time<3.1-1e-9)b.update(1/fps,pose);
 assert.equal(b.player.pose,82,'First tick must recover two pose');
 b.player.poseRegenRate=10;
 while(b.time<3.2-1e-9)b.update(1/fps,pose);
 assert.equal(b.player.pose,83,'Runtime recovery rate ignored');
 b.enemy.z=1;b.enemy.heading=Math.PI;b.strikePlayer({...pose,guarding:true,guardElapsed:0});
 assert.equal(b.player.pose,81);b.enemy.z=30;
 const before=b.player.pose;for(let i=0;i<Math.floor(3*fps);i++)b.update(1/fps,pose);
 assert.equal(b.player.pose,before,'Blocked hit failed to reset recovery delay');
}
assert.equal(POSE_STATS.regenRate,20);
console.log('POSE_ENERGY_VERIFIED: proportional damage, full bonus, unblocked cost, three-second wait, discrete ticks and configurable recovery');
