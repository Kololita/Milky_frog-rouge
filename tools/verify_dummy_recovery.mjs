import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {ENEMY_STATS} from '../src/battle-values.js';
const pose={x:0,z:0,heading:0,height:0,invulnerable:true};
for(const fps of [30,60,144]){
 const b=new Battle(),dt=1/fps;b.enemy.z=1.2;b.enemy.heading=Math.PI;
 while(b.enemy.state!=='recover')b.update(dt,pose);
 const origin={x:b.enemy.x,z:b.enemy.z,heading:b.enemy.heading};
 const target={...pose,x:3,z:-1};
 while(b.enemy.elapsed<ENEMY_STATS.settle-dt-1e-8)b.update(dt,target);
 assert.equal(b.enemy.x,origin.x);assert.equal(b.enemy.z,origin.z);assert.equal(b.enemy.heading,origin.heading);
 for(let i=0;i<fps*.6;i++)b.update(dt,target);
 assert.equal(b.enemy.state,'recover');assert(b.enemy.moving);
 assert(Math.hypot(b.enemy.x-origin.x,b.enemy.z-origin.z)>.3);
 assert(Math.abs(b.enemy.heading-origin.heading)>.1);
 assert(!b.takeEvents().some(e=>e.type==='playerHit'));
 const age=b.enemy.elapsed;b.update(dt,{...pose,x:-3,z:1});
 assert(Math.abs(b.enemy.elapsed-age-dt)<1e-8,'Changing direction restarts the attack cooldown');
 while(b.enemy.state==='recover')b.update(dt,target);
 assert(b.enemy.elapsed<.1,'Recovery timer leaked into the new attack');
}
console.log('DUMMY_RECOVERY_VERIFIED: planted follow-through, mobile/turning cooldown, unchanged timer at 30/60/144FPS');
