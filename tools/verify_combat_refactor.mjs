import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {ATTACK_STATS,PLAYER_STATS,ENEMY_STATS,WAVE_STATS} from '../src/battle-values.js';
import {BACK_THROW} from '../src/back-throw.js';
import {SAMURAI_MOVES,SAMURAI_STATS} from '../src/samurai.js';
import {moveActorMotion} from '../src/actor-collision.js';
import {gameFixture} from './game_fixture.mjs';
const pose={x:0,z:0,heading:0,height:0,landed:true};
assert.equal(PLAYER_STATS.attackPower,10);assert.equal(BACK_THROW.motionMultiplier,7.5);
const expected={Attack1:5,Attack2:6,Attack3:4,Attack4:20,CounterWave:20,RunAttack:6,AirAttack:15};
for(const [name,base] of Object.entries(expected))for(const power of [5,10,12.5])for(const empowered of [false,true]){
 const b=new Battle();b.player.attackPower=power;b.player.energy=empowered?99:0;b.player.rageUntil=empowered?10:0;
 b.enemy.z=1;b.enemy.health=b.enemy.maxHealth=10000;b.enemy.superArmor=true;
 const stats=ATTACK_STATS[name];assert(!('damage' in stats));b.beginAttack(name);b.resolveAttack(1,pose);
 const damage=Math.round(base*(power/5)*(empowered?1.2:1)*100)/100;
 const hits=b.takeEvents().filter(e=>e.type==='enemyHit');assert.equal(hits.length,stats.times.length);
 assert(hits.every(e=>e.damage===damage));assert.equal(b.enemy.health,10000-damage*stats.times.length);
}
{
 const b=new Battle();b.enemy.z=1;b.enemy.superArmor=true;const wave=b.launchWave(pose);assert.equal(wave.damage,36);
 b.player.attackPower=20;b.updateWaves(.2);assert.equal(b.enemy.health,ENEMY_STATS.health-36,'Wave did not snapshot power at launch');
 assert.equal(b.launchWave(pose).damage,72);assert.equal(WAVE_STATS.motionMultiplier,3.6);
}
for(const power of [5,10]){
 const b=new Battle();b.reset('samurai');b.enemy.z=1;b.enemy.heading=0;b.player.attackPower=power;
 assert(b.beginBackThrow(pose));for(let i=0;i<96;i++)b.update(1/60,pose);
 assert.equal(b.enemy.health,SAMURAI_STATS.health-power*7.5);
}
{
 const b=new Battle();b.player.attackPower=999;b.enemy.z=1;b.enemy.heading=Math.PI;b.strikePlayer(pose);
 assert.equal(b.player.health,88,'Enemy damage depends on the frog attack power');
 const damages=Object.values(SAMURAI_MOVES).flat().map(move=>Math.round(move.motionMultiplier*SAMURAI_STATS.attackPower*100)/100);
 assert.deepEqual(damages,[16.8,19.2,33.6,19.2,20.4,16.8,36,28.8,30,42]);
}
// Contact times remain exactly 3.3 seconds apart, including changing frame rates.
for(const intervals of [[1/30],[1/60],[1/120],[1/144],[.04,.01,.025,1/144]]){
 const b=new Battle();b.enemy.z=1.2;b.enemy.heading=Math.PI;const contacts=[];
 const strike=b.strikePlayer.bind(b);b.strikePlayer=(p,attack,lag=0)=>{contacts.push(b.time-lag);strike(p,attack,lag);};
 let i=0;while(b.time<20)b.update(intervals[i++%intervals.length],{...pose,invulnerable:true});
 assert(contacts.length>=6);for(let j=1;j<contacts.length;j++)assert(Math.abs(contacts[j]-contacts[j-1]-3.3)<1e-7);
}
assert.equal(ENEMY_STATS.windup,.7);assert.equal(ENEMY_STATS.windup+ENEMY_STATS.recovery,3.3);
const obstacle={x:0,z:1.6,radius:.55,health:900};
const straight=moveActorMotion({x:0,z:0},{x:0,z:5},obstacle);assert(straight.blocked&&straight.z<.65);
for(const side of [-1,1]){
 const edge=moveActorMotion({x:.6*side,z:0},{x:.6*side,z:5},obstacle);
 assert(edge.blocked&&edge.z>3&&Math.abs(edge.x)>.95,'Grazing roll sticks at first contact');
}
for(const fps of [30,60,144]){
 const g=await gameFixture(fps);g.freezeEnemy=true;
 g.read('battle.reset("samurai");battle.enemy.z=1.6;battle.enemy.heading=Math.PI;player.position.x=.6;');
 g.key('KeyW');g.key('ShiftLeft');g.tick(.05);g.key('ShiftLeft',false);g.key('KeyW',false);
 assert.equal(g.read('activeDodge?.name'),'DodgeRoll');
 let frames=0;while(g.read('Boolean(activeDodge)')&&frames++<fps*2){
  g.tickFrames(1);assert(g.read('Math.hypot(player.position.x-battle.enemy.x,player.position.z-battle.enemy.z)')>=.95-1e-6,'Roll penetrates enemy body');
 }
 assert(g.read('player.position.z>battle.enemy.z'),'Actual roll cannot slide past the edge');
 assert(g.read('Math.abs(player.position.x)>.95'));
}
console.log('COMBAT_REFACTOR_VERIFIED: per-actor power/motion multipliers, buffs/wave snapshot/75-damage throw, exact half-frequency dummy, substep edge sliding at 30/60/144FPS');
