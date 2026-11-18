import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Battle} from '../src/battle.js';
import {ATTACK_STATS,ENERGY_STATS,energyDamageMultiplier} from '../src/battle-values.js';
import {gameFixture} from './game_fixture.mjs';

const pose={x:0,z:0,heading:0,height:0,landed:true};
const report={damage:[],live:[]};
for(let layer=0;layer<=3;layer++)for(const [name,stats] of Object.entries(ATTACK_STATS)) {
  const b=new Battle();b.player.energy=layer*33;b.enemy.z=1;b.beginAttack(name);b.resolveAttack(stats.times.at(-1),pose);
  const damage=Math.round(b.player.attackPower*stats.motionMultiplier*energyDamageMultiplier(layer*33)*100)/100;
  assert.equal(b.enemy.health,Math.round((b.enemy.maxHealth-damage*stats.times.length)*100)/100);
  assert(b.takeEvents().filter(e=>e.type==='enemyHit').every(e=>e.damage===damage));
  report.damage.push({layer,name,damage,total:damage*stats.times.length});
}
for(const fps of [30,60,144]) {
  const g=await gameFixture(fps),{read,mouse,tap,key,reset,tick,tickFrames,until,hud}=g;
  g.freezeEnemy=true;
  const grant=()=>read('battle.player.counterReady=true;battle.player.counterUntil=battle.time+3;battle.enemy.z=30');
  const point=n=>read(`modelPivot.getObjectByName('${n}').getWorldPosition(new THREE.Vector3())`);
  reset();mouse(1);assert(!read('battle.absorption'),'Middle mouse works without gold');
  const normalEmission=read('(()=>{const a=[];modelPivot.traverse(o=>{if(o.isMesh&&!/^Frog_/.test(o.name)){const m=Array.isArray(o.material)?o.material[0]:o.material;a.push([m.emissiveIntensity,m.emissive.getHexString()])}});return a})()');
  const normalHeadEmission=read('rageEyes.skins.map(mesh=>[mesh.material.emissiveIntensity,mesh.material.emissive.getHexString()])');
  for(let layer=1;layer<=3;layer++) {
    read('battle.player.health=60');
    grant();mouse(1);assert(read('Boolean(battle.absorption)'));assert(read('characterState.isFree'));
    mouse(1);assert.equal(read('battle.player.energy'),(layer-1)*33,'Repeated middle press adds energy early');
    key('KeyW');if(layer===2)key('ShiftLeft');tick(.48);
    assert(read('player.position.length()')>.08,'Absorption prevents movement');
    assert(read('absorptionView.rain.visible'),'Gold shower missing');
    const wrist=point('handR'),shoulder=point('upper_armR');
    assert(wrist.y>shoulder.y+.25,'Right hand not held high');
    assert(wrist.y>1.45,`Right hand too low: ${wrist.y}`);
    tick(.27);assert(read('absorptionView.light.visible&&absorptionView.light.intensity>1'));
    assert(read('rageEyes.skins.every(mesh=>mesh.material.emissiveIntensity>1&&mesh.material.emissive.r>.5)'), 'Head/belly live material is missing absorption glow');
    assert(read('battle.player.energy')>(layer-1)*33&&read('battle.player.energy')<layer*33,'Energy must increase during shower');
    assert.equal(read('battle.player.health'),60,'Healing happens before absorption completes');
    assert(until('!battle.absorption',1));key('KeyW',false);if(layer===2)key('ShiftLeft',false);tickFrames(1);
    assert.equal(read('battle.player.energy'),layer*33);
    assert.equal(read('battle.player.health'),70,'Absorption must heal 10% maximum health');
    assert(hud.get('battle-feed').textContent.includes('生命 +10'));
    assert(!read('battle.player.counterReady||guardEffect.glow.visible'),'Completed absorption leaves counter gold');
    assert(!read('absorptionView.rain.visible||absorptionView.light.visible'));
    assert.deepEqual(read('rageEyes.skins.map(mesh=>[mesh.material.emissiveIntensity,mesh.material.emissive.getHexString()])'),normalHeadEmission, 'Head/belly glow did not restore after absorption');
    assert(hud.get('energy-value').textContent.includes(`+${Math.floor((energyDamageMultiplier(layer*33)-1)*100+1e-8)}%`));
  }
  grant();read('battle.player.health=40');mouse(1);assert(read('Boolean(battle.absorption)'));
  tick(.5);assert.equal(read('battle.player.health'),40);
  assert(until('!battle.absorption',1));assert.equal(read('battle.player.health'),55,'Full energy must heal 15% maximum health');
  assert.equal(read('battle.player.energy'),99);assert(!read('battle.player.counterReady'));
  assert(hud.get('battle-feed').textContent.includes('生命 +15'));
  grant();read('battle.player.health=85');mouse(1);assert(until('!battle.absorption',1.5));
  assert.equal(read('battle.player.health'),100);assert.equal(read('battle.player.energy'),99);
  grant();read('battle.player.health=50');mouse(1);tick(.2);key('ShiftLeft');key('ShiftLeft',false);tickFrames(1);
  assert(!read('battle.absorption||battle.player.counterReady||guardEffect.glow.visible'));
  assert.equal(read('battle.player.health'),50);assert.equal(read('battle.player.energy'),99);
  tick(1.5);assert.equal(read('battle.player.health'),50,'Cancelled full-energy heal arrives later');
  reset();grant();mouse(1);tick(.45);mouse(0);
  assert(!read('battle.absorption'));assert.equal(read('activeGesture.name'),'Attack1','Interrupted absorption retains a gold counter');
  const partial=read('battle.player.energy');assert(partial>0&&partial<33);tickFrames(1);assert(!read('absorptionView.rain.visible||absorptionView.light.visible'));
  tick(.1);assert(point('handR').y<1.4,'Absorption arm remains raised during the attack');
  assert(until('!activeGesture',2));assert.equal(read('battle.player.energy'),partial,'Interrupted absorption awards energy later');
  reset();grant();mouse(1);tick(.6);key('ShiftLeft');key('ShiftLeft',false);
  assert(read('Boolean(activeDodge)&&!battle.absorption'));tickFrames(1);
  assert(read('battle.player.energy')>0&&read('battle.player.energy')<33);assert(!read('absorptionView.rain.visible||absorptionView.light.visible'));
  assert(!read('battle.player.counterReady||guardEffect.glow.visible||guardEffect.points.visible'),'Interrupted absorption retains gold');
  // Healing is capped and is a single completion reward, not a repeating tick.
  reset();grant();read('battle.player.health=95');mouse(1);
  assert(until('!battle.absorption',1.5));assert.equal(read('battle.player.health'),100);
  assert(hud.get('battle-feed').textContent.includes('生命 +5'));tick(.3);assert.equal(read('battle.player.health'),100);
  for(const cancel of ['attack','dodge','hurt']) {
    reset();grant();read('battle.player.health=50');mouse(1);tick(.08);
    if(cancel==='attack')mouse(0);
    if(cancel==='dodge'){key('ShiftLeft');key('ShiftLeft',false);}
    if(cancel==='hurt') {
      read('battle.enemy.z=1.05;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.elapsed=.7');
      g.freezeEnemy=false;tickFrames(1);g.freezeEnemy=true;
    } else tickFrames(1);
    assert(!read('battle.absorption||battle.player.counterReady||guardEffect.glow.visible||guardEffect.points.visible'));
    assert.equal(read('battle.player.energy'),0);assert.equal(read('battle.player.health'),cancel==='hurt'?38:50);
    read('battle.enemy.z=30');tick(1.5);assert.equal(read('battle.player.health'),cancel==='hurt'?38:50,'Interruption granted delayed healing');
  }
  // A valid late start reserves the source: expiration during absorption does not
  // grant a fresh counter, but the already-started absorption may complete.
  reset();grant();tick(2.8);mouse(1);assert(read('Boolean(battle.absorption)'));
  assert(until('!battle.absorption',1.5));assert.equal(read('battle.player.energy'),33);
  reset();grant();mouse(1);tick(.6);read('battle.enemy.z=1.05;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.elapsed=.7');
  g.freezeEnemy=false;tickFrames(1);g.freezeEnemy=true;
  assert(!read('battle.absorption'));assert.equal(read('activeGesture.name'),'Hit');assert(read('battle.player.energy')>0&&read('battle.player.energy')<33);
  reset();grant();mouse(1);tick(.75);tap('Home');tickFrames(1);
  assert.equal(read('battle.player.energy'),0);assert(!read('battle.absorption||absorptionView.rain.visible||absorptionView.light.visible'));
  const restoredEmission=read('(()=>{const a=[];modelPivot.traverse(o=>{if(o.isMesh&&!/^Frog_/.test(o.name)){const m=Array.isArray(o.material)?o.material[0]:o.material;a.push([m.emissiveIntensity,m.emissive.getHexString()])}});return a})()');
  assert.deepEqual(restoredEmission,normalEmission,'Body emission is not restored');
  report.live.push({fps,raisesRightHand:true,movementContinues:true,showerAndBodyGlow:true,threeLayers:[5,10,20],healOnCompletion:20,fullEnergyHeal:40,energyCapThree:true,healCappedAt100:true,attackAndDodgeInterruptImmediately:true,interruptionClearsGoldAndParticles:true,noDelayedReward:true,lateStartCanFinish:true,hurtAndResetCancel:true,materialsRestored:true});
}
await fs.writeFile(new URL('../output/animations/energy-absorption-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('ENERGY_ABSORPTION_VERIFIED',JSON.stringify(report.live));
