import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {SAMURAI_COMBOS,SAMURAI_TRANSITION,beginBossSequence,samuraiSequence} from '../src/samurai.js';
import {canBackThrow} from '../src/back-throw.js';
import {enemyAnimationSample} from '../src/enemy-models.js';
import {gameFixture} from './game_fixture.mjs';
const safe={x:0,z:0,heading:0,height:0,guarding:false,invulnerable:true};
for(const fps of [30,60,144]){
 const b=new Battle();b.reset('samurai');const e=b.enemy;e.z=1.2;e.health=e.maxHealth*.75;
 b.update(1/fps,safe);assert.equal(e.state,'transition');assert.equal(e.phase,1);assert.equal(e.transitionTo,2);
 assert(e.superArmor);assert(e.damageable);assert.equal(e.damageTakenMultiplier,.6);
 assert(!canBackThrow({...safe,z:e.z+1,height:0},e,b.time));
 const before=e.health;b.damageEnemy(e,100,{label:'test',impactLevel:3,origin:safe});assert.equal(before-e.health,60);assert.equal(e.state,'transition');
 for(let i=0;i<10;i++)b.impactEnemy(1,safe,'parry');assert.equal(e.state,'transition');assert.equal(e.stun,0);
 assert.equal(enemyAnimationSample('samurai',e,b.enemyTime).name,'PhaseShift');
 let elapsed=0,strikes=0;
 while(e.state==='transition'){
  b.update(1/fps,safe);elapsed+=1/fps;
  const events=b.takeEvents();strikes+=events.filter(x=>x.type==='bossLightning').length;
  if(elapsed<SAMURAI_TRANSITION.strikeAt-1/fps)assert.equal(e.phase,1);
 }
 assert.equal(e.phase,2);assert.equal(strikes,1);assert(Math.abs(elapsed-5)<=1/fps+1e-7);
 assert(!e.superArmor);assert.equal(e.damageTakenMultiplier,1);
 e.health=e.maxHealth*.4;b.update(1/fps,safe);assert.equal(e.state,'transition');assert.equal(e.transitionTo,3);
 for(let i=0;i<fps*5+2&&e.state==='transition';i++)b.update(1/fps,safe);
 assert.equal(e.phase,3);assert.notEqual(e.state,'transition');
 // Reaching a threshold mid-combo lets the current cut settle, then replaces the next cut.
 const c=new Battle();c.reset('samurai');c.enemy.z=1.2;beginBossSequence(c,'quick');c.enemy.health=c.enemy.maxHealth*.75;
 let swings=0;
 for(let i=0;i<fps*3&&c.enemy.state!=='transition';i++){
  c.update(1/fps,safe);swings+=c.takeEvents().filter(x=>x.type==='bossSwing').length;
 }
 assert.equal(swings,1);assert.equal(c.enemy.state,'transition');
}
for(const [name,combo] of Object.entries(SAMURAI_COMBOS))for(const phase of [1,2,3]){
 assert(Math.abs(samuraiSequence(name,phase).recoveryWait-combo.recoveryWait*[1,.9,.75][phase-1])<1e-10);
}
// Lightning is a one-time radial hit; dodge immunity and distance still work.
for(const [distance,invulnerable,shouldHit] of [[1,false,true],[1,true,false],[4,false,false]]){
 const b=new Battle();b.reset('samurai');b.enemy.z=distance;b.enemy.health=b.enemy.maxHealth*.75;
 const pose={...safe,invulnerable,guarding:true,guardElapsed:.01};
 b.update(1/60,pose);b.takeEvents();b.enemy.elapsed=SAMURAI_TRANSITION.strikeAt-1/60;b.update(1/60,pose);
 const hits=b.takeEvents().filter(x=>x.type==='playerHit');assert.equal(hits.length,shouldHit?1:0);
 if(shouldHit){assert.equal(hits[0].stun,1);assert.equal(hits[0].knockback,0);assert(hits[0].stunned);assert(!b.player.counterReady);}
}
const b=new Battle();b.reset('samurai');beginBossSequence(b,'quick');
for(let i=0;i<6;i++)b.impactEnemy(1,safe,'parry');
assert.equal(b.enemy.state,'windup');assert(!('parryPoise' in b.enemy));assert(!b.takeEvents().some(x=>x.type==='bossStagger'));
const g=await gameFixture(60);
g.read('battle.reset("samurai");battle.enemy.health=battle.enemy.maxHealth*.75;battle.enemy.x=player.position.x;battle.enemy.z=player.position.z+1.2;');
assert(g.until('activeGesture?.name==="Hit"',4),'Lightning did not interrupt the player in the game loop');
g.tick(.8);assert.equal(g.read('activeGesture?.name'),'Hit');
g.tick(.25);assert.notEqual(g.read('activeGesture?.name'),'Hit','Lightning stun exceeds its 1s duration');
console.log('SAMURAI_PHASES_VERIFIED: queued 5s transitions, armor/40% reduction/throw protection, radial lightning stun, no parry counter, 90%/75% waits at 30/60/144FPS');
