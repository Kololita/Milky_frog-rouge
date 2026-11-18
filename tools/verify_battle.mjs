import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Battle,inAttackArea} from '../src/battle.js';
import {ATTACK_STATS,PLAYER_STATS,ENEMY_STATS,GUARD_STATS} from '../src/battle-values.js';
import {ATTACK_TIMING} from '../src/combat.js';

const pose={x:0,z:0,heading:0,height:0,landed:false,guarding:false,guardElapsed:25/60,invulnerable:false};
const report={attacks:[],defense:[],enemy:[]};
const close=(a,b)=>assert(Math.abs(a-b)<1e-5,`${a} != ${b}`);
for(const [name,stats] of Object.entries(ATTACK_STATS)) {
  assert(stats.times.at(-1)<ATTACK_TIMING[name].link || name==='AirAttack');
  for(const fps of [30,60,144]) {
    const b=new Battle();b.enemy.z=1;b.beginAttack(name);
    const p={...pose,landed:name==='AirAttack'};
    for(let time=0;time<1.3;time+=1/fps)b.resolveAttack(time,p);
    close(ENEMY_STATS.health-b.enemy.health,stats.damage*stats.times.length);
    assert.equal(b.takeEvents().filter(e=>e.type==='enemyHit').length,stats.times.length);
    b.resolveAttack(100,p);close(ENEMY_STATS.health-b.enemy.health,stats.damage*stats.times.length);
    report.attacks.push({name,fps,damage:stats.damage*stats.times.length,hits:stats.times.length});
  }
}
{
 const b=new Battle();b.enemy.z=-1;b.beginAttack('Attack1');b.resolveAttack(.3,pose);assert.equal(b.enemy.health,160);
 b.enemy.z=1;b.resolveAttack(.4,pose);assert.equal(b.enemy.health,160,'Missed punch became a delayed hit');
 b.beginAttack('Attack1');b.resolveAttack(.26,pose);b.cancelAttack();b.resolveAttack(.5,pose);assert.equal(b.enemy.health,160,'Cancelled punch still hits');
 b.beginAttack('Attack3');b.resolveAttack(.7,pose);assert.equal(b.enemy.health,136,'Frame skipping dropped multi-hit impacts');
 b.enemy.health=160;b.beginAttack('AirAttack');b.resolveAttack(.49,{...pose,height:.8});assert.equal(b.enemy.health,160,'Slam hits while ascending');
 b.enemy.z=-1;b.resolveAttack(.5,{...pose,landed:true});assert.equal(b.enemy.health,120,'Radial slam fails behind the player');
 b.beginAttack('Attack1');b.resolveAttack(.4,{...pose,height:1.2});assert.equal(b.enemy.health,120);
 report.attacks.push({missesConsumed:true,cancelStopsDamage:true,skippedFramesKeepThreeHits:true,slamOnlyOnLanding:true,radialHitsBehind:true});
}
{
 assert(inAttackArea(pose,0,{x:0,z:1},1,Math.PI/4));
 assert(!inAttackArea(pose,0,{x:0,z:-1},1,Math.PI/4));
 assert(!inAttackArea(pose,0,{x:0,z:3},1,Math.PI/4,.4));
 const b=new Battle();b.enemy.z=1;b.enemy.heading=Math.PI;
 for(let i=0;i<4;i++)b.strikePlayer({...pose,guarding:true});
 assert.equal(b.player.health,100);assert.equal(b.player.guard,4);
 b.strikePlayer({...pose,guarding:true});assert.equal(b.player.guard,0);assert.equal(b.player.health,94);
 const broken=b.takeEvents().find(e=>e.type==='guardBroken');assert.equal(broken.stun,.8);
 b.strikePlayer(pose);assert.equal(b.player.health,94,'Hit invulnerability is missing');
 b.time+=1;b.enemy.z=-1;b.enemy.heading=0;b.strikePlayer({...pose,guarding:true});assert.equal(b.player.health,82,'Guard blocks a rear strike');
 b.time+=1;b.strikePlayer({...pose,invulnerable:true});assert.equal(b.player.health,82,'Dodge immunity did not apply');
 b.strikePlayer({...pose,height:1});assert.equal(b.player.health,82,'High jump still hit by ground punch');
 b.enemy.z=10;b.strikePlayer(pose);assert.equal(b.player.health,82,'Out of range strike hits');
 b.time=0;b.player.lastGuardHit=0;b.enemy.z=30;b.player.guard=0;
 for(let i=0;i<12;i++)b.update(.05,pose);assert.equal(b.player.guard,0,'Guard regenerated before delay');
 for(let i=0;i<40;i++)b.update(.05,{...pose,guarding:true});assert.equal(b.player.guard,0,'Held guard regenerates');
 for(let i=0;i<100;i++)b.update(.05,pose);assert.equal(b.player.guard,100);
 report.defense.push({frontBlocked:12,guardCost:24,breakAfterHits:5,breakDamage:6,rearHits:true,dodgeImmunity:true,regenDelayedAndCapped:true});
}
for(const fps of [30,60,144]) {
 const b=new Battle();b.enemy.z=1.1;
 let firstHit=null;
 for(let i=0;i<fps*2;i++){b.update(1/fps,pose);if(b.player.health<100){firstHit=(i+1)/fps;break;}}
 assert(firstHit>=ENEMY_STATS.windup && firstHit<ENEMY_STATS.windup+.12,'Enemy hits before telegraph');
 assert.equal(b.player.health,88);
 b.enemy.state='windup';b.enemy.elapsed=.65;b.beginAttack('Attack1');b.resolveAttack(.27,pose);b.update(1/fps,pose);
 assert.equal(b.enemy.state,'hurt','Player hit fails to interrupt enemy windup');
 assert.equal(b.player.health,88);
 report.enemy.push({fps,firstHit,windupInterruptible:true});
}
{
 const b=new Battle();b.enemy.z=1;b.beginAttack('Attack4');b.enemy.health=32;b.resolveAttack(.55,pose);
 assert.equal(b.enemy.state,'dead');assert.equal(b.defeated,1);
 for(let i=0;i<61;i++)b.update(.05,pose);assert.equal(b.enemy.health,160);assert.equal(b.player.health,100);
 const c=new Battle();c.player.health=12;c.enemy.z=1;c.enemy.heading=Math.PI;c.strikePlayer(pose);
 assert.equal(c.player.health,0);assert(c.takeEvents().some(e=>e.type==='playerDefeated'));
 c.beginAttack('Attack4');c.resolveAttack(1,pose);assert.equal(c.enemy.health,160,'KO player can attack');
 for(let i=0;i<61;i++)c.update(.05,pose);assert.equal(c.player.health,100);assert.equal(c.player.guard,100);
 assert(c.takeEvents().some(e=>e.type==='playerRespawned'));
 const separation=c.separation({x:0,z:3.6,height:0});close(Math.hypot(separation.x,separation.z),PLAYER_STATS.radius+ENEMY_STATS.radius);
 report.enemy.push({deathAndRespawn:true,playerKOCannotAttack:true,playerRespawn:true,bodySeparation:true});
}
await fs.writeFile(new URL('../output/animations/battle-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('BATTLE_RULES_VERIFIED',JSON.stringify(report));
