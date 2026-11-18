import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gameFixture} from './game_fixture.mjs';
const report=[];
for(const fps of [30,60,144]) {
 const game=await gameFixture(fps);const {read,reset,mouse,tick,tickFrames,until,tap,hud,events}=game;
 reset();mouse(2);read('battle.enemy.z=1.05;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.elapsed=.7');tickFrames(1);
 assert(read('battle.player.counterReady&&battle.enemy.state==="hurt"'));assert(hud.get('battle-feed').textContent.includes('可推掌反击'));
 mouse(0);assert.equal(read('activeGesture.name'),'Attack4','Held right button blocks perfect counter');assert(read('activeGesture.counter&&combo.stage===4'));
 assert(!read('battle.player.counterReady'));mouse(2,false);assert.equal(read('activeGesture.name'),'Attack4');
 assert(until('!activeGesture',2));assert.equal(read('battle.enemy.health'),128);
 mouse(0);assert.equal(read('activeGesture.name'),'Attack1','One perfect guard grants multiple finishers');

 reset();mouse(2);read('battle.enemy.z=1.05;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.elapsed=.7');tickFrames(1);
 mouse(2,false);mouse(0);assert.equal(read('activeGesture.name'),'Attack4','Release loses the counter reward');
 reset();mouse(2);read('battle.enemy.z=1.05;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.elapsed=.7');tickFrames(1);
 mouse(2,false);tap('Space');assert(read('battle.player.counterReady'),'Jump incorrectly clears the 3s counter');

 reset();read('battle.enemy.z=1.15;battle.enemy.state="windup";battle.enemy.elapsed=.1;combo.enter(3);playAttack(3)');
 tickFrames(1);assert(until('battle.enemy.health<160',.4));
 assert.equal(read('battle.enemy.state'),'windup');assert.equal(read('battle.enemy.knockZ'),0);assert(read('battle.enemy.elapsed>.1'));

 reset();read('battle.enemy.z=30');tap('Space');tick(.25);mouse(0);read('battle.enemy.x=player.position.x;battle.enemy.z=player.position.z+1.1;battle.enemy.state="hurt";battle.enemy.stun=10;');
 assert(until('battle.enemy.state==="knockback"',2));const beforePush=read('battle.enemy.z');assert(until('battle.enemy.state==="dazed"',.4));assert(read('battle.enemy.z')>beforePush+1.19);assert.equal(read('battle.enemy.health'),120);
 assert(read('enemyView.dazeStars.visible'));const position=read('({x:battle.enemy.x,z:battle.enemy.z})');
 const starBefore=read('enemyView.dazeStars.children[0].position.clone()'),impactAt=game.now;
 tick(.2);assert.equal(read('battle.enemy.state'),'dazed');assert.equal(read('battle.enemy.x'),position.x);assert.equal(read('battle.enemy.z'),position.z);
 assert(read('enemyView.dazeStars.children[0].position').distanceTo(starBefore)>.02,'Daze stars do not orbit');
 assert(until('battle.enemy.state!=="dazed"',.9));assert(!read('enemyView.dazeStars.visible'));
 const dazeDuration=(game.now-impactAt)/1000;assert(Math.abs(dazeDuration-1)<1e-6,'Daze does not last 1s');

 reset();read('battle.enemy.z=1;battle.enemy.superArmor=true;combo.enter(1);playAttack(1,"AirAttack");battle.resolveAttack(.5,{...battlePose(),landed:true});');tickFrames(1);
 assert.equal(read('battle.enemy.health'),120);assert.notEqual(read('battle.enemy.state'),'dazed');assert(!read('enemyView.dazeStars.visible'));
 report.push({fps,parryStaggersEnemy:true,heldAndReleasedCounterAttack4:true,counterConsumedOnce:true,otherActionKeepsThreeSecondCounter:true,tripleDamageWithoutImpact:true,slamDamage:40,dazeDuration,enemyStationary:true,starsOrbitAndClear:true,armorTakesDamageWithoutDaze:true});
}
await fs.writeFile(new URL('../output/animations/live-impact-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('LIVE_IMPACTS_VERIFIED',JSON.stringify(report));
