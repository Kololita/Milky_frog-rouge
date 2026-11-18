import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {Battle} from '../src/battle.js';
import {RAGE_STATS,ENEMY_STATS} from '../src/battle-values.js';
import {attackCanFinish} from '../src/combat.js';
import {gameFixture} from './game_fixture.mjs';

const pose={x:0,z:0,heading:0,height:0,landed:false,guarding:false,invulnerable:false};
assert(!new Battle().beginRage(),'Rage starts without three energy');
const normal=new Battle(),slow=new Battle();slow.player.energy=99;assert(slow.beginRage());
assert.equal(slow.player.energy,0);assert(slow.isRaging());assert(!slow.beginRage(),'Rage can be restarted while active');
for(const battle of [normal,slow]){battle.enemy.x=0;battle.enemy.z=5;battle.enemy.state='idle';}
for(let i=0;i<10;i++){normal.update(.05,pose,1);slow.update(.05,pose,RAGE_STATS.worldSpeed);}
const normalTravel=5-normal.enemy.z,slowTravel=5-slow.enemy.z;
assert(Math.abs(slowTravel/normalTravel-.8)<1e-8,'Enemy movement is not 80% speed');
assert(Math.abs(slow.time-.5)<1e-9&&Math.abs(slow.enemyTime-.4)<1e-9,'Player and world clocks are not independent');
assert(!attackCanFinish('Attack1',.319,true,RAGE_STATS.attackInterval));
assert(attackCanFinish('Attack1',.40,true,RAGE_STATS.attackInterval));
assert(!attackCanFinish('Attack3',.649,true,RAGE_STATS.attackInterval));
assert(attackCanFinish('Attack3',.78,true,RAGE_STATS.attackInterval),'Interval reduction dropped the third hit');

const report=[];let rageShader;
for(const fps of [30,60,144]) {
  const game=await gameFixture(fps),{read,key,mouse,tick,tickFrames,until,reset,events,hud}=game;game.freezeEnemy=true;
  read('battle.player.energy=99');key('KeyF');key('KeyF',false);
  assert(read('battle.isRaging()'));assert.equal(read('battle.player.energy'),0);
  assert.equal(read('rageEyes.uniforms.rageEyeActive.value'),0);tickFrames(1);
  assert.equal(read('rageEyes.uniforms.rageEyeActive.value'),1);assert(read('rageEyes.skins.length>0'));
  const shader=read(`(()=>{const s={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};rageEyes.skins[0].material.onBeforeCompile(s);return s})()`);rageShader=shader;
  assert(shader.vertexShader.includes('rageEyeSourcePosition'));assert(shader.fragmentShader.includes('vec3(1.0,0.0,0.0)'));
  assert(hud.get('energy-value').textContent.includes('愤怒'));
  assert(!hud.get('energy-value').textContent.includes('秒'));
  assert(Number.parseFloat(hud.get('player-energy').style.values['--fill'])>99);
  tick(.5);assert(Number.parseFloat(hud.get('player-energy').style.values['--fill'])<95);

  // Player locomotion is not slowed by the world time scale.
  key('KeyW');tick(.5);key('KeyW',false);const rageDistance=read('player.position.length()');
  reset();read('battle.enemy.z=30');key('KeyW');tick(.5);key('KeyW',false);const normalDistance=read('player.position.length()');
  assert(Math.abs(rageDistance-normalDistance)<.03,'Rage slowed player locomotion');

  // Attack animation / authored impact clock advances 20% faster.
  reset();read('battle.enemy.z=30');mouse(0);tick(.1);const normalClipTime=read('activeGesture.action.time');
  reset();read('battle.enemy.z=30;battle.player.energy=99');key('KeyF');key('KeyF',false);mouse(0);tick(.1);const rageClipTime=read('activeGesture.action.time');
  assert(Math.abs(rageClipTime/normalClipTime-RAGE_STATS.attackSpeed)<.035,'Attack animation is not 20% faster');

  reset();read('battle.player.energy=99;battle.enemy.z=.8');key('KeyF');key('KeyF',false);mouse(0);
  assert(until(`battle.enemy.health<${ENEMY_STATS.health}`,1));
  assert.equal(read('battle.enemy.health'),147.5,'Rage Attack1 did not deal +25% damage');
  assert(events.some(e=>e.type==='enemyHit'&&e.damage===12.5));
  tick(9.1);assert(!read('battle.isRaging()'));assert.equal(read('rageEyes.uniforms.rageEyeActive.value'),0);
  assert(events.some(e=>e.type==='rageEnded'));
  assert.equal(hud.get('player-energy').style.values['--fill'],'0%');
  report.push({fps,energyConsumed:99,duration:RAGE_STATS.duration,damageMultiplier:RAGE_STATS.damageMultiplier,attackSpeed:RAGE_STATS.attackSpeed,attackInterval:RAGE_STATS.attackInterval,worldSpeed:RAGE_STATS.worldSpeed,redEyesRestore:true,playerMovementUnchanged:true});
}
const expand=source=>source.replace(/#include <(\w+)>/g,(_,name)=>expand(THREE.ShaderChunk[name]));
const shaderOutput=[{name:'rage-eyes',
  vertex:'#version 330 core\n#define attribute in\n#define varying out\nuniform mat4 modelMatrix,modelViewMatrix,projectionMatrix,viewMatrix;uniform mat3 normalMatrix;uniform bool isOrthographic;attribute vec3 position,normal;attribute vec2 uv;\n'+expand(rageShader.vertexShader),
  fragment:'#version 330 core\n#define varying in\nuniform mat4 viewMatrix;uniform bool isOrthographic;\nout vec4 fragmentColor;\n#define gl_FragColor fragmentColor\nvec4 linearToOutputTexel(vec4 value){return value;}\n'+expand(rageShader.fragmentShader),
}];
await fs.writeFile(new URL('../output/animations/rage-eye-shaders.json',import.meta.url),JSON.stringify(shaderOutput,null,2));
await fs.writeFile(new URL('../output/animations/rage-verification.json',import.meta.url),JSON.stringify({normalTravel,slowTravel,report},null,2));
console.log('RAGE_VERIFIED',JSON.stringify({normalTravel,slowTravel,report}));
