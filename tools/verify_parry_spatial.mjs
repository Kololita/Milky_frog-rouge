import assert from 'node:assert/strict';
import {Battle,inAttackArea} from '../src/battle.js';
import {beginBossSequence} from '../src/samurai.js';
import {gameFixture} from './game_fixture.mjs';
const neutral={x:0,z:0,heading:0,height:0,guarding:false};
for(const fps of [30,60,144]){
 const g=await gameFixture(fps);g.freezeEnemy=true;
 g.read('battle.enemy.z=1.5;battle.enemy.heading=Math.PI;heading=Math.PI;player.rotation.y=heading');
 g.tap('KeyQ');g.mouse(2);
 assert(Math.abs(g.read('heading'))<1e-8,'Locked guard faces away from opponent');
 g.read('battle.strikePlayer(battlePose())');assert.equal(g.read('battle.player.health'),100);assert(g.events.some(event=>event.type==='blocked'&&event.grade==='perfect'));

 const b=new Battle();b.reset('samurai');b.enemy.z=1.2;b.enemy.heading=Math.PI;beginBossSequence(b,'thrust');
 const pressAt=b.enemy.windup-.15;
 let blocked=false;
 for(let frame=0;frame<fps*2;frame++){
  const next=b.time+1/fps;b.update(1/fps,{...neutral,guarding:next>=pressAt,guardElapsed:next-pressAt});
  assert(b.enemy.z>=.95-1e-7,'Lunge passes through player');
  if(b.takeEvents().some(event=>event.type==='blocked'&&event.grade==='perfect')){blocked=true;break;}
 }
 assert(blocked,`Close-range thrust cannot be parried at ${fps}FPS`);
}
for(const scale of [1,.8])for(const fps of [30,60,144]){
 const b=new Battle();b.reset('samurai');b.time=1;b.enemy.z=1.8;b.enemy.heading=Math.PI;beginBossSequence(b,'quick');
 const dt=1/fps,untilImpact=dt*scale*.3;b.enemy.elapsed=b.enemy.windup-untilImpact;
 const lag=dt-untilImpact/scale;
 b.update(dt,{...neutral,guarding:true,guardElapsed:10/60+lag});
 assert(b.takeEvents().some(event=>event.type==='blocked'&&event.grade==='perfect'),'Frame overshoot incorrectly closes perfect window');
 const late=new Battle();late.enemy.z=1;late.enemy.heading=Math.PI;late.time=1;
 late.strikePlayer({...neutral,guarding:true,guardElapsed:.01},late.enemyStats,.02);
 assert.equal(late.player.health,88,'Retroactive guard blocks a hit before button press');
}
// A hit crossing a render frame must use its exact contact time. Exercise each
// tier boundary with fixed and changing frame durations, including world slow-down.
for(const scale of [1,.8])for(const dt of [1/30,1/60,1/90,1/120,1/144,1/240,.027,.011]){
 for(const [frames,grade] of [[10,'perfect'],[10.001,'precise'],[18,'precise'],[18.001,'good'],[30,'good'],[30.001,'normal'],[60,'normal'],[60.001,'late']]){
  const b=new Battle();b.reset('samurai');b.time=2;b.enemy.z=1.8;b.enemy.heading=Math.PI;beginBossSequence(b,'quick');
  const untilImpact=dt*scale*.3,lag=dt-untilImpact/scale;b.enemy.elapsed=b.enemy.windup-untilImpact;
  b.update(dt,{...neutral,guarding:true,guardElapsed:frames/60+lag},scale);
  assert.equal(b.takeEvents().find(e=>e.type==='blocked')?.grade,grade,`Guard tier changed with dt=${dt}, scale=${scale}, frame=${frames}`);
 }
}
const edgeAngle=70*Math.PI/180,target={x:Math.sin(edgeAngle)*1.5,z:Math.cos(edgeAngle)*1.5};
assert(!inAttackArea({x:0,z:0},0,target,2,Math.PI/3));
assert(inAttackArea({x:0,z:0},0,target,2,Math.PI/3,.4),'Sector ignores player collision radius at side edge');
const rear=new Battle();rear.enemy.z=-1;rear.enemy.heading=0;rear.strikePlayer({...neutral,guarding:true,guardElapsed:0});assert.equal(rear.player.health,88,'Rear guard became omnidirectional');
console.log('PARRY_SPATIAL_VERIFIED: locked facing, collision-stopped lunge, precise impact clock at 30/60/144FPS, circular target overlap, no retroactive or rear guard');
