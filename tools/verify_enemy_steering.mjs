import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {steerEnemy} from '../src/enemy-steering.js';
import {canBackThrow} from '../src/back-throw.js';
import {beginBossSequence} from '../src/samurai.js';
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
for(const fps of [30,60,144])for(const mode of ['practice','samurai']){
 const b=new Battle();b.reset(mode);const e=b.enemy,dt=1/fps;
 e.x=0;e.z=0;e.heading=0;const behind={x:0,z:-1.2,height:0,heading:0,invulnerable:true};
 steerEnemy(e,behind,dt);assert(Math.abs(e.heading)<e.turnRate*dt*.25);
 for(let i=0;i<fps*4;i++){
  const previous=e.heading;steerEnemy(e,behind,dt);
  assert(Math.abs(e.heading-previous)<=e.turnRate*dt+1e-9);
 }
 assert(Math.abs(delta(e.heading,Math.PI))<.01);
 e.heading=179*Math.PI/180;e.turnVelocity=0;steerEnemy(e,{x:Math.sin(-179*Math.PI/180),z:Math.cos(-179*Math.PI/180)},dt);
 assert(e.heading>179*Math.PI/180,'Yaw seam follows the long arc');
 e.heading=0;e.turnVelocity=0;e.state=mode==='samurai'?'circle':'recover';e.elapsed=mode==='samurai'?0:.4;e.circleDuration=10;
 for(let i=0;i<Math.floor(fps*.4);i++)b.update(dt,behind);
 assert(Math.abs(e.heading)<=e.turnRate*.4+1e-7);assert(canBackThrow(behind,e),'Turning removes the back-throw opening');
 if(mode==='practice'){e.state='windup';e.elapsed=.3;}
 else{beginBossSequence(b,'delay');e.elapsed=e.telegraph+.01;}
 e.heading=0;const expected=Math.atan2(behind.x-e.x,behind.z-e.z);b.update(dt,behind);assert(Math.abs(delta(e.heading,mode==='samurai'?expected:0))<1e-9,'Boss attacks must face the player; dummy keeps locked swing');
}
console.log('ENEMY_STEERING_VERIFIED: smooth speed limits, shortest arc, back-throw opening and locked swings at 30/60/144FPS');
