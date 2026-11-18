import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {BACK_THROW,canBackThrow,sampleBackThrow} from '../src/back-throw.js';
import {beginBossSequence,SAMURAI_AIM} from '../src/samurai.js';
import {gameFixture} from './game_fixture.mjs';
for(const mode of ['practice','samurai']){
 const b=new Battle();b.reset(mode);const e=b.enemy;e.x=0;e.z=0;e.state='rising';e.riseUntil=.01;e.riseDuration=1;
 b.update(.02,{x:2,z:0,heading:0,height:0,invulnerable:true});
 assert.equal(e.heading,Math.PI/2);assert.equal(e.turnVelocity,0);
 const rear={x:e.x-Math.sin(e.heading),z:e.z-Math.cos(e.heading),height:0};
 assert(!canBackThrow(rear,e,b.time));b.time=e.backThrowImmuneUntil-.001;assert(!b.beginBackThrow(rear));
 b.time=e.backThrowImmuneUntil;assert(b.beginBackThrow(rear));
}
const state={origin:{x:0,z:0},targetOrigin:{x:0,z:1},heading:0,targetScale:1.35};
assert.equal(sampleBackThrow(state,BACK_THROW.slamTakeoff).hero.height,0);
assert(sampleBackThrow(state,BACK_THROW.slamApex).hero.height>=1.05);
assert(sampleBackThrow(state,1.45).hero.height<sampleBackThrow(state,BACK_THROW.slamApex).hero.height);
assert(Math.abs(sampleBackThrow(state,BACK_THROW.impact).hero.height-.32)<1e-8);
assert.equal(SAMURAI_AIM['buried-overhead'].rate,Math.PI*150/180);
{
 const b=new Battle();b.reset('samurai');b.enemy.x=0;b.enemy.z=0;b.enemy.heading=0;beginBossSequence(b,'thrust');
 b.update(1/60,{x:0,z:-4,heading:0,height:0,invulnerable:true});assert(Math.abs(b.enemy.heading-Math.PI)<1e-8);
}
const g=await gameFixture(60);g.freezeEnemy=true;g.mouse(2);g.tick(.15);
const before=g.read('modelPivot.getObjectByName("forearmR").getWorldPosition(new THREE.Vector3())');
const combat=g.read('JSON.stringify([battle.enemy,player.position,battle.player,battle.events])');
g.read('parryRecoil.prepare();parryRecoil.update(0,[{type:"blocked",grade:"perfect"}],true);parryRecoil.prepare();parryRecoil.update(.075,[],true);');
const after=g.read('modelPivot.getObjectByName("forearmR").getWorldPosition(new THREE.Vector3())');
assert(after.z>before.z+.03,'Parry elbow does not move forward');assert(after.distanceTo(before)>.05);
assert.equal(g.read('JSON.stringify([battle.enemy,player.position,battle.player,battle.events])'),combat,'Visual pulse changes combat state');
g.read('parryRecoil.prepare();');
const restored=g.read('modelPivot.getObjectByName("forearmR").getWorldPosition(new THREE.Vector3())');assert(restored.distanceTo(before)<1e-7);
g.reset();g.read('battle.reset("samurai");battle.enemy.z=1.05;battle.enemy.heading=0;');g.tap('KeyJ');g.tick(1.25);
assert(g.read('floorProbe()-player.position.y')>1,'Runtime back throw never jumps above the target');
g.tick(.35);assert.equal(g.read('battle.enemy.health'),g.read('battle.enemy.maxHealth-75'));
console.log('PARRY_THROW_FEEDBACK_VERIFIED: cosmetic elbow only, restore, aerial slam, one-second regrab protection, instant wake-up facing and per-move aim');
