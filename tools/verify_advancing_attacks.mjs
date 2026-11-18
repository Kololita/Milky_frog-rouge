import assert from 'node:assert/strict';
import {gameFixture} from './game_fixture.mjs';

for(const fps of [30,60,144])for(const locked of [false,true])for(const rage of [false,true]){
 const g=await gameFixture(fps);g.freezeEnemy=true;
 g.read(`battle.enemy.x=0;battle.enemy.heading=Math.PI;heading=0;player.rotation.y=0;
  battle.enemy.z=ATTACK_STATS.RunAttack.range+battle.enemy.radius+attackMotion.RunAttack.evaluate(ATTACK_STATS.RunAttack.times[0])[2]*attackScale-.01;
  targetLock.target=${locked?'battle.enemy':'null'};${rage?'battle.player.energy=99;battle.player.rageUntil=battle.time+10;':''}
  combo.enter(2);playAttack(2,'RunAttack');`);
 const original=g.read('battle.enemy.health');assert(g.until('!activeGesture',2));assert(g.read('battle.enemy.health')<original,'Run attack misses');
 g.tick(.55);assert.equal(g.read('combo.stage'),0);
 assert(g.read('Math.hypot(battle.enemy.x-player.position.x,battle.enemy.z-player.position.z)>ATTACK_STATS.Attack1.range+battle.enemy.radius'),'Scenario does not require a forward step');
 const before=g.read('battle.enemy.health'),damage=g.read('battle.playerDamage(ATTACK_STATS.Attack1.motionMultiplier)');
 g.mouse(0);assert.equal(g.read('activeGesture?.name'),'Attack1');assert(g.until('!activeGesture',2));
 assert(Math.abs(g.read('battle.enemy.health')-(before-damage))<1e-6,`${fps}FPS lock=${locked} rage=${rage}: run push cannot link to a fresh jab`);
}
for(const fps of [30,60,144]){
 const g=await gameFixture(fps);g.freezeEnemy=true;
 g.read('battle.enemy.x=0;battle.enemy.z=.80;battle.enemy.heading=Math.PI;heading=0;player.rotation.y=0');
 g.mouse(0);
 for(let i=0;i<fps;i++){
  g.tickFrames(1);
  assert(g.read('player.position.z<battle.enemy.z'),'Advancing jab passes through enemy');
  assert(g.read('Math.hypot(battle.enemy.x-player.position.x,battle.enemy.z-player.position.z)>=PLAYER_STATS.radius+battle.enemy.radius-1e-5'),'Advancing jab penetrates collision body');
 }
 g.reset();g.read('battle.enemy.z=30;heading=Math.PI/2;player.rotation.y=heading');const start=g.read('player.position.x');
 g.mouse(0);g.until('!activeGesture',2);const travel=g.read('player.position.x')-start;
 assert(travel>.90&&travel<1.0,'Opening jab does not advance in the facing direction');
 const f1=g.read('Array.from(attackMotion.Attack1.evaluate(2))'),f2=g.read('Array.from(attackMotion.Attack2.evaluate(2))'),f3=g.read('Array.from(attackMotion.Attack3.evaluate(2))'),f4=g.read('Array.from(attackMotion.Attack4.evaluate(2))');
 assert(Math.abs(f1[0])+Math.abs(f2[0])+Math.abs(f3[0])+Math.abs(f4[0])<1e-5);
 assert(f2[2]>.09&&f3[2]>.14&&f4[2]>.21,'Later attacks did not gain forward travel');
 assert(Math.abs(f2[2]/.09-f3[2]/.144)<1e-4&&Math.abs(f3[2]/.144-f4[2]/.216)<1e-4,'Later attacks use inconsistent horizontal scales');
 g.reset();g.read('battle.enemy.z=30');g.mouse(0);g.tick(.08);g.read('restoreStanding()');const stopped=g.read('player.position.clone()');g.tick(.6);assert(g.read('player.position').distanceTo(stopped)<1e-6,'Cancelled jab continues moving');
}
console.log('ADVANCING_ATTACKS_VERIFIED: max-range sprint push -> expired combo -> fresh jab, locked/free/rage at 30/60/144FPS; later travel +20%, facing, contact collision and cancellation');
