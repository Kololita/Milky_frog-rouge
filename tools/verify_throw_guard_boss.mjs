import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {BACK_THROW,canBackThrow,throwRecovery} from '../src/back-throw.js';
import {moveActorMotion} from '../src/actor-collision.js';
import {DODGE_DEFENSE} from '../src/battle-values.js';
import {dodgeInvulnerable} from '../src/defense.js';
import {beginBossSequence,SAMURAI_RECOVERY} from '../src/samurai.js';
import {gameFixture} from './game_fixture.mjs';
const pose={x:0,z:0,heading:0,height:0,guarding:false};
for(const [name,frames] of [['DodgeSideL',14],['DodgeSideR',14],['DodgeRoll',18],['DodgeBackflip',24]]){
 assert.equal(DODGE_DEFENSE[name].frames,frames);
 assert(dodgeInvulnerable(name,0));assert(dodgeInvulnerable(name,(frames-.001)/60));assert(!dodgeInvulnerable(name,frames/60));
}
const obstacle={x:0,z:1.6,radius:.55,health:900};
const blocked=moveActorMotion({x:0,z:0},{x:0,z:5},obstacle);assert(blocked.blocked&&blocked.z<.65);
assert(!moveActorMotion({x:1.5,z:0},{x:1.5,z:5},obstacle).blocked);
for(const fps of [30,60,144]){
 const b=new Battle();b.reset('samurai');b.enemy.z=1.7;b.enemy.heading=Math.PI;beginBossSequence(b,'quick');
 let swings=0;for(let i=0;i<fps*5;i++){
  b.update(1/fps,{...pose,invulnerable:true});swings+=b.takeEvents().filter(e=>e.type==='bossSwing').length;
  if(b.enemy.state==='circle')break;
 }
 assert.equal(swings,2,'Boss strike has a lingering/repeated hitbox');
 const before={x:b.enemy.x,z:b.enemy.z};b.update(.05,{...pose,x:.4,invulnerable:true});
 assert.equal(b.enemy.state,'circle');assert(Math.hypot(b.enemy.x-before.x,b.enemy.z-before.z)>.01);
 assert.equal(SAMURAI_RECOVERY.settle,.36);assert(b.enemy.circleDuration>=2&&b.enemy.circleDuration<=6);
 const g=await gameFixture(fps);g.freezeEnemy=true;
 g.read('battle.enemy.z=1.6;battle.enemy.heading=Math.PI;');g.key('KeyW');g.key('ShiftLeft');g.tick(.05);g.key('ShiftLeft',false);g.key('KeyW',false);
 assert(g.read('Boolean(activeDodge)'));g.tick(1.4);assert(g.read('player.position.z<battle.enemy.z'),'Roll tunneled through Boss');
 // A brief mouse tap still guards through the entire perfect window.
 g.reset();g.mouse(2);g.mouse(2,false);g.tick(.10);assert(g.read('battlePose().guarding'),'Minimum guard ends too early');
 g.tick(.10);assert(!g.read('battlePose().guarding'),'Short guard never ends');
 // Perfect parries may immediately release/repress, preserving the raised pose.
 g.reset();g.read('battle.enemy.z=1;battle.enemy.heading=Math.PI;');g.mouse(2);
 for(let i=0;i<5;i++){
  g.read('battle.strikePlayer(battlePose())');g.tickFrames(1);assert(g.read('blockAttemptPerfect'));
  g.mouse(2,false);g.mouse(2);assert(g.read('battlePose().guarding'));assert(g.read('battlePose().guardElapsed<.001'));
 }
 assert.equal(g.read('battle.player.health'),100);assert(g.events.filter(e=>e.type==='blocked'&&e.grade==='perfect').length>=5);
 // A non-perfect tap still has the mandatory vulnerability gap.
 g.reset();g.mouse(2);g.mouse(2,false);g.tick(.2);g.mouse(2);assert(!g.read('battlePose().guarding'));g.tick(.15);assert(g.read('battlePose().guarding'));
 // Paired execution cancels an in-progress Boss attack, then down/rise use
 // a fixed 3:1 split starting when the frog begins its recovery backflip.
 g.reset();g.read('battle.reset("samurai");battle.enemy.z=1.05;battle.enemy.heading=0;battle.enemy.state="windup";');g.tap('KeyJ');
 assert.equal(g.read('activeGesture.name'),'BackThrow');assert.equal(g.read('battle.enemy.state'),'thrown');
 g.key('KeyD');g.tap('KeyJ');g.mouse(2);assert.equal(g.read('activeGesture.name'),'BackThrow');
 g.tick(1.6);assert.equal(g.read('battle.enemy.health'),g.read('battle.enemy.maxHealth-75'));assert.equal(g.read('battle.enemy.state'),'down');
 g.tick(.3);const downUntil=g.read('battle.enemy.downUntil'),riseUntil=g.read('battle.enemy.riseUntil');
 assert(Math.abs((riseUntil-downUntil)-.8)<1e-7);assert(Math.abs(g.read('battle.enemy.riseDuration')-.8)<1e-7);
 g.tick(1.15);assert(!g.read('battle.backThrow'));assert(g.read('characterState.isFree'));
 g.read('battle.beginAttack("Attack4");battle.resolveAttack(1,{x:battle.enemy.x,z:battle.enemy.z,heading:0,height:0})');assert.equal(g.read('battle.enemy.health'),g.read('battle.enemy.maxHealth-75'));
 assert(g.until('battle.enemy.state==="rising"',2));
 g.read('battle.beginAttack("Attack4");battle.resolveAttack(1,{x:battle.enemy.x,z:battle.enemy.z,heading:0,height:0})');
 assert.equal(g.read('battle.enemy.state'),'rising');assert.equal(g.read('battle.enemy.health'),g.read('battle.enemy.maxHealth-115'));assert.equal(g.read('battle.enemy.riseUntil'),riseUntil);
 g.tick(.9);assert(!g.read('["down","rising","thrown"].includes(battle.enemy.state)'));
}
const target={x:0,z:0,heading:0,health:900,impactResistance:0};
for(const degrees of [0,49.99,50,50.01,100]){
 const a=degrees*Math.PI/180;assert.equal(canBackThrow({...pose,x:Math.sin(a),z:-Math.cos(a)},target),degrees<=50);
}
assert(!canBackThrow({...pose,z:-1.551},target));assert(!canBackThrow({...pose,z:-1},{...target,backThrowable:false}));
assert.equal(throwRecovery(target),4);assert.equal(throwRecovery({...target,impactResistance:1}),3.2);
{
 const b=new Battle();b.enemy.z=1;b.player.health=40;b.player.rageUntil=10;b.beginAttack('Attack3');b.resolveAttack(.66,pose);
 assert.equal(b.player.health,55);b.resolveAttack(.7,pose);assert.equal(b.player.health,55,'Same impact heals repeatedly');
 b.enemy.state='down';b.beginAttack('Attack1');b.resolveAttack(.3,pose);assert.equal(b.player.health,55,'Invulnerable target grants healing');
 b.enemy.state='idle';b.enemy.z=15;b.beginAttack('Attack1');b.resolveAttack(.3,pose);assert.equal(b.player.health,55,'Miss grants healing');
 b.enemy.z=1;b.launchWave(pose);b.updateWaves(.2);assert.equal(b.player.health,60,'Wave hit does not heal');
}
// Invulnerability uses the actual contact time inside a render frame.
{
 const b=new Battle();b.enemy.z=1;b.time=1;
 b.strikePlayer({...pose,dodgeName:'DodgeRoll',dodgeElapsed:18/60+.01},undefined,.02);assert.equal(b.player.health,100);
 b.strikePlayer({...pose,dodgeName:'DodgeRoll',dodgeElapsed:18/60+.01},undefined,0);assert.equal(b.player.health,88);
}
// A guard ending partway through a frame still protects an earlier contact,
// but never retroactively protects a later hit.
for(const lag of [.005,.015]){
 const b=new Battle();b.enemy.z=1;b.enemy.heading=Math.PI;b.time=1;
 b.strikePlayer({...pose,guarding:false,guardElapsed:Infinity,previousGuard:{elapsed:.18,endedAgo:.01,scale:1,heading:0}},undefined,lag);
 assert.equal(b.player.health,lag>.01?100:88);
}
{
 const b=new Battle();b.reset('samurai');b.enemy.z=1;b.enemy.heading=0;b.enemy.impactResistance=10;
 assert(b.beginBackThrow(pose));
 for(let i=0;i<160;i++)b.update(1/60,pose);
 assert(!['thrown','down','rising'].includes(b.enemy.state),'High resistance recovery waits for the hero animation');
}
console.log('THROW_GUARD_BOSS_VERIFIED: moving wait, one-shot strikes, swept dodges, 14/18/24 immunity, minimum guard/parry chains, paired throw/down/rise, per-hit rage healing');
