import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {gameFixture} from './game_fixture.mjs';
const g=await gameFixture(60),{read,reset,mouse,tick,tickFrames}=g;g.freezeEnemy=true;
const error=read(`(()=>{
 let max=0,samples=0;player.position.set(20,.3,-10);player.rotation.set(.1,1.7,.05);
 for(const name of Object.keys(actions))for(let i=0;i<=6;i++) {
  mixer.stopAllAction();const action=actions[name].reset().play();mixer.setTime(action.getClip().duration*i/6);
  player.updateMatrixWorld(true);let exact=Infinity;const p=new THREE.Vector3();
  modelPivot.traverse(mesh=>{if(!mesh.isSkinnedMesh||/^Frog_(?:eyelid|mouth|laugh)_/.test(mesh.name))return;
   for(let j=0;j<mesh.geometry.attributes.position.count;j++)exact=Math.min(exact,mesh.getVertexPosition(j,p).applyMatrix4(mesh.matrixWorld).y);
  });
  max=Math.max(max,Math.abs(floorProbe()-exact));samples++;
 }return {max,samples};
})()`);
assert(error.max<1e-8,`Clearance differs from actual skin: ${error.max}`);
reset();read('battle.enemy.z=30;battle.player.counterReady=true;battle.player.counterUntil=battle.time+3');mouse(1);tick(.48);
assert(read('absorptionView.rain.visible&&absorptionView.rain.userData.gpuAnimated'));
let version=read('absorptionView.rain.geometry.attributes.position.version');tick(.1);
assert.equal(read('absorptionView.rain.geometry.attributes.position.version'),version,'Rain still uploads all particles every frame');
reset();mouse(2);read('battle.enemy.z=1.05;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.elapsed=.7');g.freezeEnemy=false;tickFrames(1);g.freezeEnemy=true;
tick(.06);version=read('guardEffect.points.geometry.attributes.position.version');tickFrames(1);
assert.equal(read('guardEffect.points.geometry.attributes.position.version'),version,'Shield particles still upload every frame');
const burst=read('enemyView.impactParticles.points');assert(burst.userData.gpuAnimated);
version=burst.geometry.attributes.position.version;tickFrames(1);assert.equal(burst.geometry.attributes.position.version,version);
// Expand the actual Three.js shader source for an independent native compiler.
const expand=source=>source.replace(/#include <(\w+)>/g,(_,name)=>expand(THREE.ShaderChunk[name]));
const shaders=[];
for(const [name,points] of [['rain',read('absorptionView.rain')],['shield',read('guardEffect.points')],['impact',burst]]) {
 const shader={uniforms:{},vertexShader:THREE.ShaderLib.points.vertexShader,fragmentShader:THREE.ShaderLib.points.fragmentShader};
 points.material.onBeforeCompile(shader);
 assert(shader.vertexShader.includes('transformed='));assert(shader.fragmentShader.includes('gl_PointCoord'));
 const color=points.material.vertexColors?'#define USE_COLOR\n':'';
 shaders.push({name,vertex:'#version 330 core\n#define attribute in\n#define varying out\n'+color+
  'uniform mat4 modelMatrix,modelViewMatrix,projectionMatrix,viewMatrix;uniform mat3 normalMatrix;uniform bool isOrthographic;attribute vec3 position,normal;attribute vec2 uv;attribute vec3 color;\n'+expand(shader.vertexShader),
 fragment:'#version 330 core\n#define varying in\n'+color+
  'out vec4 fragmentColor;\n#define gl_FragColor fragmentColor\nvec4 linearToOutputTexel(vec4 value){return value;}\n'+expand(shader.fragmentShader)});
}
await fs.writeFile(new URL('../output/animations/gpu-particle-shaders.json',import.meta.url),JSON.stringify(shaders,null,2));
await fs.writeFile(new URL('../output/animations/gpu-runtime-verification.json',import.meta.url),JSON.stringify({clearance:error,rainAndShieldUploadOnlyAtSpawn:true,impactBurstsOnePersistentDraw:true,shadersPrepared:shaders.map(s=>s.name)},null,2));
console.log('GPU_RUNTIME_VERIFIED',JSON.stringify(error));
