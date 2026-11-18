import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {SAMURAI_COMBOS,SAMURAI_EVADE,SAMURAI_MOVES,beginBossSequence,bossBladeWarning,samuraiSequence,samuraiSequenceWait,samuraiWaitMultiplier} from '../src/samurai.js';
import {canBackThrow} from '../src/back-throw.js';
import {enemyAnimationSample} from '../src/enemy-models.js';
const pose={x:0,z:0,height:0,heading:0,guarding:false,guardElapsed:0,invulnerable:false};
for(const fps of [30,60,144]){
 const b=new Battle();b.reset('samurai');const e=b.enemy;e.x=0;e.z=1.6;e.heading=Math.PI;
 e.state='bait';e.elapsed=0;e.baitAttackIntent=b.attackIntent;
 b.update(1/fps,pose);assert.equal(e.state,'bait','Bait dodges before an attack');
 b.noteAttackInput();b.update(1/fps,pose);assert.equal(e.state,'evade');assert(!e.damageable);assert(e.invulnerable);
 assert.equal(b.impactEnemy(3,pose),false);assert.equal(canBackThrow({...pose,x:e.x,z:e.z+1},e,b.time),false);
 const health=e.health;b.beginAttack('Attack1');b.resolveAttack(.66,pose);assert.equal(e.health,health);
 const start={x:e.x,z:e.z},forward={x:Math.sin(e.heading),z:Math.cos(e.heading)};
 for(let f=0;f<fps&&e.state==='evade';f++)b.update(1/fps,pose);
 assert.equal(e.pattern,'counter');assert(e.damageable);assert.equal(e.move.impactLevel,2);assert(e.move.unblockable);
 const dx=e.x-start.x,dz=e.z-start.z;assert(dx*forward.x+dz*forward.z<0,'Dodge is not backward');
 assert(dx*Math.cos(Math.PI)-dz*Math.sin(Math.PI)>0,'Dodge is not to the samurai right');
 assert(Math.abs(Math.hypot(dx,dz)-SAMURAI_EVADE.distance)<1e-6);
 assert.equal(e.telegraph,SAMURAI_EVADE.counterPause);assert.equal(enemyAnimationSample('samurai',e,0).name,'CounterThrust');
 let hit=0,clock=0;const entry={x:e.x,z:e.z};
 while(e.state==='windup'){
  b.update(1/fps,{...pose,invulnerable:true});clock+=1/fps;
  hit+=b.takeEvents().filter(x=>x.type==='bossSwing').length;
 }
 assert.equal(hit,1);assert(clock>=SAMURAI_EVADE.counterPause+.32-1e-6);
 assert(Math.hypot(e.x-entry.x,e.z-entry.z)>0,'Counter does not lunge');
 for(const phase of [1,2,3])for(const name of ['quick','double']){
  const c=new Battle();c.reset('samurai');c.enemy.phase=phase;c.enemy.z=1.5;beginBossSequence(c,name);
  const expected=c.enemy.sequence.length,times=[];let t=0;
  while(t<12){c.update(1/fps,{...pose,invulnerable:true});t+=1/fps;
   for(const event of c.takeEvents())if(event.type==='bossSwing')times.push(t);
   if(times.length===expected)break;
  }
  assert.equal(times.length,expected,`${name}/${phase}: missing independent hits`);
  assert(times[1]-times[0]>=.40,`${name}: cuts overlap`);
 }
}
// Red warnings and guard bypass use the same move flag for every phase.
for(const moves of Object.values(SAMURAI_MOVES))for(const move of moves){
 const b=new Battle();b.reset('samurai');const e=b.enemy;e.x=0;e.z=1.2;e.heading=Math.PI;e.move=move;
 e.state='windup';e.telegraph=1;e.elapsed=.85;
 const unblockable=move.motion.includes('thrust')||move.motion==='buried-overhead';
 assert.equal(bossBladeWarning(e),unblockable);
 e.elapsed=.70;assert.equal(bossBladeWarning(e),false);
 const before=b.player.health;b.strikePlayer({...pose,guarding:true,guardElapsed:.01},move);
 const events=b.takeEvents();
 if(unblockable){assert(b.player.health<before);assert(!events.some(x=>x.type==='blocked'));assert(!b.player.counterReady);}
 else assert(events.some(x=>x.type==='blocked'&&x.grade==='perfect'));
}
const wait=(name,phase)=>samuraiSequenceWait({sequence:samuraiSequence(name,phase),seed:7391});
assert(wait('heavy',1)>wait('thrust',1));assert.equal(wait('double',3),wait('double',1)*.75);
for(const name of Object.keys(SAMURAI_MOVES))for(const phase of [1,2,3])assert.equal(wait(name,phase),SAMURAI_COMBOS[name].recoveryWait*samuraiWaitMultiplier(phase));
for(const fps of [30,60,144]){
 const b=new Battle();b.reset('samurai');b.enemy.z=1.5;beginBossSequence(b,'thrust');
 for(let i=0;i<fps*4&&b.enemy.state!=='circle';i++)b.update(1/fps,{...pose,invulnerable:true});
 assert.equal(b.enemy.state,'circle');assert.equal(b.enemy.circleDuration,1);
}
// Changing a routine's own parameter must work independently of its move type.
const previous=SAMURAI_COMBOS.heavy.recoveryWait;
try {SAMURAI_COMBOS.heavy.recoveryWait=1.25;assert.equal(wait('heavy',1),1.25);}
finally {SAMURAI_COMBOS.heavy.recoveryWait=previous;}
console.log('SAMURAI_EVADE_VERIFIED: 30/60/144 FPS, evasive counter, separate cuts, unblockable cues and authored per-combo recovery waits');
