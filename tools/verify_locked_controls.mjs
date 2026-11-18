import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gameFixture} from './game_fixture.mjs';
import {advanceMovement,movementInput} from '../src/movement.js';
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const close=(a,b,tolerance=1e-7)=>assert(Math.abs(delta(a,b))<tolerance,`${a} differs from ${b}`);
// Strafing and retreat keep full, normalized movement speed and never pivot.
for(const fps of [30,60,144])for(const codes of [['KeyW'],['KeyS'],['KeyA'],['KeyD'],['KeyW','KeyA'],['KeyW','KeyD'],['KeyS','KeyA'],['KeyS','KeyD']]){
 const input=movementInput(new Set(codes));let state={heading:0,velocity:1.2},x=0,z=0;
 for(let i=0;i<fps;i++){
  state=advanceMovement(state,input,1/fps,false,{facingHeading:.35});x+=state.dx;z+=state.dz;
  close(state.heading,.35);assert.equal(state.pivot,null);
 }
 assert(Math.abs(x-input.direction.x*1.2)<1e-7&&Math.abs(z-input.direction.z*1.2)<1e-7);
 const braking=advanceMovement(state,{move:0,direction:null,sprint:false},1/fps,false,{facingHeading:.35});
 assert(braking.dx*input.direction.x+braking.dz*input.direction.z>0,'Braking changes travel direction');
}
const g=await gameFixture();g.freezeEnemy=true;
function setup(){
 g.reset();g.read('battle.reset("samurai");battle.enemy.x=0;battle.enemy.z=6;targetLock.target=battle.enemy;orbit.yaw=0;updateCamera();');
}
const facingTarget=()=>close(g.read('heading'),g.read('Math.atan2(battle.enemy.x-player.position.x,battle.enemy.z-player.position.z)'));
for(const code of ['KeyW','KeyS','KeyA','KeyD']){
 setup();g.key(code);g.tickFrames(1);facingTarget();assert(g.read('velocity>0'));
 assert(g.read(code==='KeyW'?'player.position.z>0':code==='KeyS'?'player.position.z<0':code==='KeyA'?'player.position.x>0':'player.position.x<0'));
 assert(!g.read('pivot'));
 g.key(code,false);
}
setup();g.key('KeyS');g.tick(.25);g.key('ShiftLeft');g.tick(.35);
assert(g.read('currentMovement().sprint'));close(g.read('heading'),Math.PI,.01);
g.key('ShiftLeft',false);g.tickFrames(1);facingTarget();assert(!g.read('activeDodge'));
// Every ground attack, including later stages (>90° turn) and special attacks,
// chooses the current target over held/captured direction keys.
for(const [stage,name] of [[1,'Attack1'],[2,'Attack2'],[3,'Attack3'],[4,'Attack4'],[2,'RunAttack'],[4,'CounterWave']]){
 setup();g.read(`heading=Math.PI;combo.enter(${stage},{x:0,z:-1});playAttack(${stage},'${name}');`);facingTarget();
}
setup();g.key('KeyS');g.tap('KeyJ');assert.equal(g.read('activeGesture.name'),'Attack1');facingTarget();
g.tap('KeyJ');g.read('battle.enemy.x=4;battle.enemy.z=-3;');
assert(g.until('activeGesture?.name==="Attack2"',3),'Buffered second attack did not execute');facingTarget();
setup();g.key('KeyS');g.tap('Space');assert(g.read('activeJump'));
g.tap('KeyJ');assert.equal(g.read('activeGesture.name'),'AirAttack');facingTarget();
assert(g.read('activeAirAttack.direction.z>0.99'),'Air attack drifts in the held retreat direction');
setup();g.read('targetLock.clear();heading=0;combo.enter(2,{x:0,z:-1});playAttack(2);');close(g.read('heading'),Math.PI/2);
setup();g.read('battle.enemy.health=0;heading=0;combo.enter(2,{x:0,z:-1});playAttack(2);');close(g.read('heading'),Math.PI/2);
// Home settings is a normal menu item; the in-game entry remains a gear.
const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
const menu=html.match(/<nav class="home-menu"[\s\S]*?<\/nav>/)?.[0];
assert(menu?.includes('<button id="home-settings" type="button">设置</button>'));
assert(!/id="home-settings"[^>]*settings-open/.test(html));
assert(/id="settings-open"[^>]*settings-open/.test(html));
console.log('LOCKED_CONTROLS_VERIFIED: home settings, 8-way facing-independent walk, sprint, all attack variants, live buffered targeting, unlocked fallback');
