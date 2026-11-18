import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {Battle} from '../src/battle.js';
import {DODGE_DEFENSE,WAVE_STATS} from '../src/battle-values.js';
import {dodgeInvulnerable} from '../src/defense.js';
import {createCameraOcclusion} from '../src/camera-occlusion.js';
import {gameFixture} from './game_fixture.mjs';
const neutral={x:0,z:0,heading:0,height:0};
assert.equal(WAVE_STATS.range,5.425);
for(const [name,frames] of Object.entries({DodgeSideL:14,DodgeSideR:14,DodgeRoll:18,DodgeBackflip:24})){
 assert.equal(DODGE_DEFENSE[name].frames,frames);assert(dodgeInvulnerable(name,(frames-.01)/60));assert(!dodgeInvulnerable(name,frames/60));
}
for(const fps of [30,60,144]){
 const b=new Battle();b.enemy.z=1;b.enemy.superArmor=true;b.beginAttack('CounterWave');b.resolveAttack(.54,neutral);
 assert.equal(b.enemy.health,b.enemy.maxHealth-40);assert.equal(b.waves.length,1);assert.equal(b.waves[0].damage,30);
 for(let i=0;i<fps;i++)b.update(1/fps,neutral);
 assert.equal(b.enemy.health,b.enemy.maxHealth-70,'Palm and wave do not deal independent damage');assert.equal(b.waves.length,0);
 const pass=new Battle();const targets=[2,4].map((z,index)=>Object.assign(pass.createEnemy(pass.encounter,index),{z,superArmor:true}));pass.launchWave(neutral);
 for(let i=0;i<fps;i++){pass.time+=1/fps;pass.updateWaves(1/fps,targets);}
 assert(targets.every(enemy=>enemy.health===enemy.maxHealth-30),'Wave cannot pierce multiple enemies');
 const cooldown=new Battle();cooldown.enemy.z=1;cooldown.enemy.superArmor=true;
 cooldown.launchWave(neutral);cooldown.updateWaves(.1);assert.equal(cooldown.enemy.health,cooldown.enemy.maxHealth-30);
 cooldown.launchWave(neutral);cooldown.time=.999;cooldown.updateWaves(.1);assert.equal(cooldown.enemy.health,cooldown.enemy.maxHealth-30);
 cooldown.launchWave(neutral);cooldown.time=1;cooldown.updateWaves(.1);assert.equal(cooldown.enemy.health,cooldown.enemy.maxHealth-60);
 const g=await gameFixture(fps);g.freezeEnemy=true;g.read('battle.enemy.z=30;battle.player.counterReady=true;battle.player.counterUntil=battle.time+3');
 g.mouse(0);assert.equal(g.read('activeGesture.name'),'CounterWave');assert.notEqual(g.read('actions.CounterWave'),g.read('actions.Attack4'));
 assert(g.until('battle.waves.length>0',2));assert.equal(g.read('battle.waves[0].damage'),30);
}
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,1,.1,100);camera.position.set(0,1,5);camera.lookAt(0,.9,0);camera.updateMatrixWorld();
const material=new THREE.MeshStandardMaterial({color:'white'}),wall=new THREE.Mesh(new THREE.BoxGeometry(2,3,.3),material);wall.position.set(0,1,2);scene.add(wall);
const occlusion=createCameraOcclusion(scene);for(let i=0;i<30;i++)occlusion.update(camera,{x:0,y:0,z:0},1/60);
assert.notEqual(wall.material,material);assert(wall.material.opacity<.01,'Wall does not disappear');assert.equal(material.opacity,1);
wall.position.x=5;for(let i=0;i<60;i++)occlusion.update(camera,{x:0,y:0,z:0},1/60);assert.equal(wall.material,material,'Material was not restored');
const pillars=new THREE.InstancedMesh(new THREE.BoxGeometry(.6,3,.5),material,2);pillars.setMatrixAt(0,new THREE.Matrix4().makeTranslation(0,1,2));pillars.setMatrixAt(1,new THREE.Matrix4().makeTranslation(4,1,2));scene.add(pillars);
for(let i=0;i<40;i++)occlusion.update(camera,{x:0,y:0,z:0},1/60);
assert(pillars.geometry.attributes.cameraFade.getX(0)<.01);assert.equal(pillars.geometry.attributes.cameraFade.getX(1),1,'Entire instanced scenery disappeared');
const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};pillars.material.onBeforeCompile(shader);
const expand=source=>source.replace(/#include <(\w+)>/g,(_,name)=>expand(THREE.ShaderChunk[name]));
await fs.writeFile(new URL('../output/animations/camera-occlusion-shaders.json',import.meta.url),JSON.stringify([{name:'camera-occlusion-instanced',
 vertex:'#version 330 core\n#define attribute in\n#define varying out\n#define USE_INSTANCING\nuniform mat4 modelMatrix,modelViewMatrix,projectionMatrix,viewMatrix;uniform mat3 normalMatrix;uniform bool isOrthographic;attribute vec3 position,normal;attribute vec2 uv;attribute mat4 instanceMatrix;\n'+expand(shader.vertexShader),
 fragment:'#version 330 core\n#define varying in\nuniform mat4 viewMatrix;uniform bool isOrthographic;out vec4 fragmentColor;\n#define gl_FragColor fragmentColor\nvec4 linearToOutputTexel(vec4 value){return value;}\n'+expand(shader.fragmentShader),
}],null,2));
occlusion.clear();assert.equal(pillars.material,material);
console.log('WAVE_OCCLUSION_VERIFIED: dodge windows, separate palm/wave damage, piercing/cooldown, live counter action, scenery and per-instance fading/restoration');
