import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gameFixture} from './game_fixture.mjs';
const report=[];
for(const fps of [30,60,144]) {
 const game=await gameFixture(fps);const {read,tap,key,tick,reset,mouse,canvasListeners,hud}=game;
 game.freezeEnemy=true;reset();read('battle.enemy.x=3;battle.enemy.z=0;heading=.37;player.rotation.y=heading;');
 const heading=read('heading');tap('KeyQ');assert(read('targetLock.target===battle.enemy'));
 assert(read('lockRing.visible'));
 const yaw=read('orbit.yaw');canvasListeners.get('pointerenter')({clientX:100});canvasListeners.get('pointermove')({clientX:500});assert.equal(read('orbit.yaw'),yaw,'Mouse rotates locked camera');
 game.listeners.get('keydown')({code:'KeyQ',repeat:true,preventDefault(){}});assert(read('Boolean(targetLock.target)'),'Key repeat toggles lock off');
 tick(1);assert(Math.abs(read('heading')-Math.PI/2)<1e-7,'Idle locked facing does not track target');
 assert(Math.abs(read('orbit.yaw')-Math.PI/2)<1e-7);assert(hud.get('enemy-value').textContent.includes('锁定'));
 const center=read('player.position.clone().add(new THREE.Vector3(0,CAMERA.targetHeight,0)).project(camera)');
 assert(Math.abs(center.x)<1e-7&&Math.abs(center.y)<1e-7,'Lock moves frog away from frame center');
 const enemyScreen=read('new THREE.Vector3(battle.enemy.x,.8,battle.enemy.z).project(camera)');assert(Math.abs(enemyScreen.x)<1&&Math.abs(enemyScreen.y)<1,'Enemy not visible after recenter');
 assert(!canvasListeners.has('wheel'),'Wheel zoom should remain removed');
 tap('KeyQ');assert(!read('targetLock.target'));const unlocked=read('orbit.yaw');canvasListeners.get('pointermove')({clientX:510});assert(Math.abs(read('orbit.yaw')-unlocked+.04)<1e-7,'Unlock causes a stale mouse-position jump');

 reset();read('battle.enemy.x=0;battle.enemy.z=3.6;');tap('KeyQ');key('KeyA');tick(.8);key('KeyA',false);tick(.6);
 assert(read('player.position.x')>.1,'Lock prevents movement');
 assert(read('targetLock.target===battle.enemy'));
 const aim=read('Math.atan2(battle.enemy.x-player.position.x,battle.enemy.z-player.position.z)');
 assert(Math.abs(read('heading')-aim)<1e-7,'Locked walking does not face target');

 reset();mouse(0);tick(.07);const stage=read('combo.stage'),action=read('activeGesture.name');tap('KeyQ');
 assert.equal(read('combo.stage'),stage);assert.equal(read('activeGesture.name'),action,'Q interrupts combat');
 read('battle.enemy.health=0');tick(1/fps);assert(!read('targetLock.target')&&!read('lockRing.visible'));
 read('battle.spawnEnemy()');tick(.1);assert(!read('targetLock.target'),'Enemy respawn silently reacquires lock');
 tap('KeyQ');assert(read('Boolean(targetLock.target)'));tap('Home');assert(!read('targetLock.target'));
 tap('KeyQ');read('battle.player.health=0');tick(1/fps);assert(!read('targetLock.target'));
 report.push({fps,qToggle:true,mouseIgnoredWhenLocked:true,walkFacesTarget:true,frogCentered:true,enemyVisible:true,wheelZoomRemoved:true,moveWhileLocked:true,noMouseJumpAfterUnlock:true,qKeepsCombo:true,targetDeathAndPlayerDeathUnlock:true,noAutomaticRespawnLock:true});
}
await fs.writeFile(new URL('../output/animations/live-target-lock-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('LIVE_TARGET_LOCK_VERIFIED',JSON.stringify(report));
