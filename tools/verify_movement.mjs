import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { AnimationMixer, LoopOnce } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { nextBlinkDelay, movementInput, jumpForMovement, advanceMovement } from '../src/movement.js';
import { planDodge } from '../src/dodge.js';

assert.equal(nextBlinkDelay(() => 0), 10);
assert.equal(nextBlinkDelay(() => 1), 13);
for (let i = 0; i < 1000; i++) assert(nextBlinkDelay() >= 10 && nextBlinkDelay() <= 13);
const keys = new Set();
assert.equal(jumpForMovement(movementInput(keys), 0), 'Jump');
keys.add('KeyW');
assert.equal(jumpForMovement(movementInput(keys), 0), 'JumpWalk');
keys.add('ShiftLeft');
assert.equal(jumpForMovement(movementInput(keys), 2.8), 'JumpRun');
keys.clear(); keys.add('KeyS');
assert.equal(jumpForMovement(movementInput(keys), 1.2), 'JumpWalk');

const close = (a,b) => assert(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
for (const yaw of [0,.4,Math.PI/2,Math.PI,4.9]) {
 const forward={x:Math.sin(yaw),z:Math.cos(yaw)};
 for (const [codes,f,r] of [[['KeyW'],1,0],[['KeyS'],-1,0],[['KeyA'],0,-1],[['KeyD'],0,1],[['KeyW','KeyA'],1,-1],[['KeyW','KeyD'],1,1],[['KeyS','KeyA'],-1,-1],[['KeyS','KeyD'],-1,1]]) {
  const input=movementInput(new Set(codes),forward),n=Math.hypot(f,r);
  const expected={x:(forward.x*f-forward.z*r)/n,z:(forward.z*f+forward.x*r)/n};
  close(input.direction.x,expected.x);close(input.direction.z,expected.z);
  for (const heading of [Math.atan2(expected.x,expected.z)]) {
   const step=advanceMovement({heading,velocity:1.2},input,.1);
   close(step.dx,expected.x*.12);close(step.dz,expected.z*.12);
   close(Math.hypot(step.dx,step.dz),.12); // diagonals never run faster
   close(Math.sin(step.heading),expected.x);close(Math.cos(step.heading),expected.z);
  }
  assert.equal(jumpForMovement(input,0),'JumpWalk');
  const sprint=movementInput(new Set([...codes,'ShiftLeft']),forward);
  assert(sprint.sprint);assert.equal(jumpForMovement(sprint,0),'JumpRun');
 }
}
assert.equal(movementInput(new Set(['KeyW','KeyS'])).direction,null);
assert.equal(movementInput(new Set(['KeyA','KeyD'])).direction,null);
assert.equal(movementInput(new Set(['KeyW','KeyS','KeyA','KeyD'])).move,0);
const paused=advanceMovement({heading:1,velocity:0},movementInput(new Set(['KeyD'])),.1,true);
close(paused.heading,1);close(paused.dx,0);close(paused.dz,0);
// Free-state movement turns quickly; a free dodge still directly faces its aim.
for(const code of ['KeyW','KeyS','KeyA','KeyD']) {
 const held=new Set([code,'ShiftLeft']),input=movementInput(held);
 let step={heading:0,velocity:0};
 for(let i=0;i<18;i++) step=advanceMovement(step,input,1/60);
 assert(Math.hypot(step.dx,step.dz)>0);
 close(Math.sin(step.heading),input.direction.x);close(Math.cos(step.heading),input.direction.z);
 assert.equal(planDodge(held,{x:0,z:1},step.heading,true).name,'DodgeRoll');
}

globalThis.self = globalThis;
globalThis.createImageBitmap = async blob => {
  const bytes = Buffer.from(await blob.arrayBuffer());
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), close() {} };
};
const bytes = await fs.readFile(new URL('../output/frog.glb', import.meta.url));
const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const mixer = new AnimationMixer(asset.scene);
let hips; asset.scene.traverse(o => { if (o.isBone && o.name === 'spine') hips = o; });
const report = {};
for (const [name, speed] of [['Jump', 0], ['JumpWalk', 1.2], ['JumpRun', 2.8]]) {
  const clip = asset.animations.find(c => c.name === name);
  assert(clip, `${name} is absent from the exported model`);
  mixer.stopAllAction();
  const action = mixer.clipAction(clip).reset().setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play();
  const y = [];
  for (let i = 0; i <= 60; i++) { mixer.setTime(clip.duration * i / 60); y.push(hips.position.y); }
  assert(Math.max(...y) - y[0] > .12, `${name} never leaves the ground`);
  assert(Math.abs(y.at(-1) - y[0]) < 1e-5, `${name} does not land at its starting height`);
  let state = { heading: 0, velocity: speed }, distance = 0;
  const input = { move: speed ? 1 : 0, direction: speed ? {x:0,z:1} : null, sprint: name === 'JumpRun' };
  for (let t = 0; t < clip.duration; t += 1/120) {
    state = advanceMovement(state, input, 1/120, false); distance += state.dz;
    if (speed) assert(Math.abs(state.velocity - speed) < 1e-9, `${name} interrupts movement`);
  }
  const landed = advanceMovement(state, input, 1/120, false);
  assert(Math.abs(landed.velocity - speed) < 1e-9, `${name} drops speed on landing`);
  if (speed) assert(distance > speed * clip.duration * .99);
  else assert.equal(distance, 0);
  const turning = advanceMovement(state, { ...input, move:1, direction:{x:1,z:0} }, .1, false);
  close(turning.heading,Math.PI/2);assert(turning.dx>0 && Math.abs(turning.dz)<1e-9,'Airborne direction change is blocked');
  const stopping = advanceMovement(state, { move: 0, direction:null, sprint: false }, .2, false);
  if (speed) assert(stopping.velocity < state.velocity, 'Released movement is ignored in air');
  report[name] = { duration: clip.duration, forwardDistance: distance, rootLift: Math.max(...y) - y[0] };
}
await fs.writeFile(new URL('../output/animations/jump-verification.json', import.meta.url), JSON.stringify(report, null, 2));
console.log('Eight camera-relative directions, normalized diagonals, all-direction sprint/jumps, quick smooth facing, landing and blink interval verified:', report);
