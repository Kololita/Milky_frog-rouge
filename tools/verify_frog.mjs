// Sample the exported skin and anatomical joints with the same Three.js loader
// used by the demo. The image shim reads dimensions; GPU rendering is tested
// separately in the browser.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { AnimationMixer, LoopOnce, Quaternion, Vector3, REVISION } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
globalThis.self = globalThis;
globalThis.createImageBitmap = async blob => {
  const data = Buffer.from(await blob.arrayBuffer());
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), close() {} };
};
const root = new URL('../', import.meta.url);
const binary = await fs.readFile(new URL('output/frog.glb', root));
const gltf = await new GLTFLoader().parseAsync(binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength), '');
const bones = [], skins = [];
gltf.scene.traverse(o => { if (o.isBone) bones.push(o); if (o.isSkinnedMesh) skins.push(o); });
const byName = Object.fromEntries(bones.map(b => [b.name, b]));
const mixer = new AnimationMixer(gltf.scene);
const looping = new Set(['Idle', 'Walk', 'WalkBack', 'Run', 'TurnLeft', 'TurnRight']);
const locomotion = new Set(['Walk', 'WalkBack', 'Run']);
const report = { threeRevision: REVISION, bones: bones.length, clips: {} };
function bone(name) {
  // GLTFLoader sanitizes periods in Blender bone names to underscores.
  const bone = byName[name] ?? byName[name.replaceAll('.', '')] ?? byName[name.replaceAll('.', '_')];
  assert(bone, `Missing bone ${name}`);
  return bone;
}
function point(name) { return bone(name).getWorldPosition(new Vector3()); }
function flex(a, b, c) {
  return 180 - a.clone().sub(b).angleTo(c.clone().sub(b)) * 180 / Math.PI;
}
function sampleSkin() {
  gltf.scene.updateMatrixWorld(true);
  for (const skin of skins) skin.skeleton.update();
  return skins.flatMap(skin => {
    const positions = skin.geometry.attributes.position, result = [];
    for (let i = 0; i < positions.count; i++) {
      const v = skin.getVertexPosition(i, new Vector3());
      v.applyMatrix4(skin.matrixWorld);
      assert([v.x, v.y, v.z].every(Number.isFinite), 'Nonfinite skin vertex');
      result.push(v);
    }
    return result;
  });
}
assert.equal(bones.length, 149); assert.equal(gltf.animations.length, 27);
for (const name of ['Wave', 'HoldBelly', 'Cheer', 'Death', 'Attack', 'Dodge']) assert(!gltf.animations.some(c => c.name === name), `Removed clip ${name} is still exported`);
for (const name of ['Blink', 'Laugh', 'Block', 'Attack1', 'Attack2', 'Attack3', 'Attack4','DodgeRoll','DodgeBackflip','DodgeSideL','DodgeSideR','PivotLeft','PivotRight']) assert(gltf.animations.some(c => c.name === name), `Missing clip ${name}`);
const blinkClip = gltf.animations.find(c => c.name === 'Blink');
assert(blinkClip.tracks.every(t => t.name.endsWith('.morphTargetInfluences')), 'Blink must layer without driving the body');
const laughClip = gltf.animations.find(c => c.name === 'Laugh');
assert(laughClip.tracks.some(t => t.name.endsWith('.morphTargetInfluences')), 'Laugh missing facial weights');
const bindVertices = sampleSkin();
const bindFloor = Math.min(...bindVertices.map(v => v.y));
const bindCenterX = (Math.min(...bindVertices.map(v => v.x)) + Math.max(...bindVertices.map(v => v.x))) / 2;
const feet = {};
const palmNormals = {};
const leftWristDirection = new Vector3(0, 1, 0).applyQuaternion(bone('hand.L').getWorldQuaternion(new Quaternion()));
const rightWristDirection = new Vector3(0, 1, 0).applyQuaternion(bone('hand.R').getWorldQuaternion(new Quaternion()));
leftWristDirection.x *= -1;
report.restWristMirrorErrorDegrees = Math.acos(Math.max(-1, Math.min(1, leftWristDirection.dot(rightWristDirection)))) * 180 / Math.PI;
assert(report.restWristMirrorErrorDegrees < .1, 'Right wrist rest direction is skewed relative to left');
for (const side of ['L', 'R']) {
  const sign = side === 'L' ? 1 : -1;
  const ids = bindVertices.map((v, i) => i).filter(i => bindVertices[i].y < bindFloor + .058 && sign * (bindVertices[i].x - bindCenterX) > 0);
  const z = ids.map(i => bindVertices[i].z).sort((a, b) => a - b);
  const sole = indices => indices.sort((a, b) => bindVertices[a].y - bindVertices[b].y).slice(0, Math.max(3, Math.ceil(indices.length / 4)));
  feet[side] = { toe: sole(ids.filter(i => bindVertices[i].z >= z[Math.floor(z.length * .75)])), heel: sole(ids.filter(i => bindVertices[i].z <= z[Math.floor(z.length * .25)])) };
  const wrist = point(`hand.${side}`), index = point(`f_index.01.${side}`), outer = point(`${side === 'L' ? 'f_pinky' : 'f_ring'}.01.${side}`);
  const forward = index.clone().add(outer).multiplyScalar(.5).sub(wrist).normalize();
  const normal = forward.cross(outer.clone().sub(index)).normalize().multiplyScalar(-sign);
  palmNormals[side] = normal.applyQuaternion(bone(`hand.${side}`).getWorldQuaternion(new Quaternion()).invert());
}
const guardRestNormal = point('forearm.R').sub(point('upper_arm.R')).cross(point('hand.R').sub(point('forearm.R'))).normalize();
const guardHingeNormals = Object.fromEntries(['upper_arm.R', 'forearm.R'].map(name => [name, guardRestNormal.clone().applyQuaternion(bone(name).getWorldQuaternion(new Quaternion()).invert())]));
for (const clip of gltf.animations) {
  mixer.stopAllAction();
  const action = mixer.clipAction(clip).reset().setLoop(LoopOnce, 1);
  action.clampWhenFinished = true; action.play();
  const elbows = [], knees = [], front = [], handDepth = [], floorHeights = [], elbowOutward = [], handOutward = [], forearmInward = [];
  const heelAboveToe = [], toeHeights = [], fingerFlex = [], thumbFlex = [], palmsInward = [];
  let first, last, maxMovement = 0, maximumFaceWeight = 0;
  for (let i = 0; i <= 48; i++) {
    mixer.setTime(clip.duration * i / 48);
    const vertices = sampleSkin();
    for (const skin of skins) maximumFaceWeight = Math.max(maximumFaceWeight, ...(skin.morphTargetInfluences ?? [0]));
    if (!first) first = vertices;
    last = vertices;
    floorHeights.push(Math.min(...vertices.map(v => v.y)));
    vertices.forEach((v, j) => { maxMovement = Math.max(maxMovement, v.distanceTo(first[j])); });
    handDepth.push(point('hand.L').z);
    if (locomotion.has(clip.name)) for (const side of ['L', 'R']) {
      const shoulder = point(`upper_arm.${side}`), elbow = point(`forearm.${side}`), hand = point(`hand.${side}`);
      elbows.push(flex(shoulder, elbow, hand));
      knees.push(flex(point(`thigh.${side}`), point(`shin.${side}`), point(`foot.${side}`)));
      front.push(hand.z - shoulder.z); // Blender -Y exports to Three.js +Z.
      const outward = side === 'L' ? 1 : -1;
      elbowOutward.push(outward * (elbow.x - shoulder.x));
      handOutward.push(outward * (hand.x - shoulder.x));
      forearmInward.push(outward * (elbow.x - hand.x));
      const markers = feet[side];
      const height = ids => ids.reduce((sum, j) => sum + vertices[j].y, 0) / ids.length;
      const toeHeight = height(markers.toe), heelHeight = height(markers.heel);
      heelAboveToe.push(heelHeight - toeHeight);
      toeHeights.push(toeHeight - bindFloor);
      fingerFlex.push(flex(point(`f_index.01.${side}`), point(`f_index.02.${side}`), point(`f_index.03.${side}`)));
      thumbFlex.push(flex(point(`thumb.01.${side}`), point(`thumb.02.${side}`), point(`thumb.03.${side}`)));
      const normal = palmNormals[side].clone().applyQuaternion(bone(`hand.${side}`).getWorldQuaternion(new Quaternion()));
      palmsInward.push(normal.dot(new Vector3(-outward, 0, 0)));
    }
  }
  const endpointError = Math.max(...last.map((v, j) => v.distanceTo(first[j])));
  assert(maxMovement > 1e-5, `${clip.name} does not animate the skin`);
  if (looping.has(clip.name)) assert(endpointError < 1e-5, `${clip.name} loop seam`);
  const data = { duration: clip.duration, tracks: clip.tracks.length, maxMovement, endpointError, handForwardRange: Math.max(...handDepth) - Math.min(...handDepth) };
  data.lowestVertexRange = [Math.min(...floorHeights), Math.max(...floorHeights)];
  if (locomotion.has(clip.name)) {
    data.elbowFlexDegrees = [Math.min(...elbows), Math.max(...elbows)];
    data.kneeFlexDegrees = [Math.min(...knees), Math.max(...knees)];
    data.minimumHandInFront = Math.min(...front);
    data.elbowOutwardOffset = [Math.min(...elbowOutward), Math.max(...elbowOutward)];
    data.minimumHandOutwardOffset = Math.min(...handOutward);
    data.forearmInwardOffset = [Math.min(...forearmInward), Math.max(...forearmInward)];
    data.heelAboveToeSoleRange = [Math.min(...heelAboveToe), Math.max(...heelAboveToe)];
    data.toeSoleClearanceRange = [Math.min(...toeHeights), Math.max(...toeHeights)];
    data.indexFingerFlexDegrees = [Math.min(...fingerFlex), Math.max(...fingerFlex)];
    data.thumbFlexDegrees = [Math.min(...thumbFlex), Math.max(...thumbFlex)];
    data.palmInwardAlignment = [Math.min(...palmsInward), Math.max(...palmsInward)];
    assert(data.elbowFlexDegrees[0] > 55, `${clip.name}: insufficient elbow flex`);
    assert(data.minimumHandInFront > .04, `${clip.name}: hand behind shoulder`);
    assert(data.kneeFlexDegrees[1] - data.kneeFlexDegrees[0] > 25, `${clip.name}: stiff knees`);
    assert(data.elbowOutwardOffset[0] > .09, `${clip.name}: elbow tucked against torso`);
    assert(data.minimumHandOutwardOffset > .03, `${clip.name}: hand drawn too far across torso`);
    assert(data.forearmInwardOffset[0] > .025, `${clip.name}: forearm should point inward from elbow`);
    assert(data.indexFingerFlexDegrees[0] > 45, `${clip.name}: fingers not closed into fists`);
    assert(data.thumbFlexDegrees[0] > 45, `${clip.name}: thumb not folded over fist`);
    assert(data.heelAboveToeSoleRange[0] > .004, `${clip.name}: toe lifted above heel`);
    assert(data.toeSoleClearanceRange[0] < .012, `${clip.name}: forefoot never contacts floor`);
    assert(data.toeSoleClearanceRange[1] < (clip.name === 'Run' ? .14 : .08), `${clip.name}: excessive toe clearance`);
    assert(data.palmInwardAlignment[0] > .85, `${clip.name}: palm turns away from body`);
  }
  report.clips[clip.name] = data;
  if (['Blink', 'Laugh'].includes(clip.name)) {
    data.maximumFaceWeight = maximumFaceWeight;
    assert(maximumFaceWeight > .8, `${clip.name}: facial expression never reaches its pose`);
    assert(data.endpointError < 1e-5, `${clip.name}: expression does not return to neutral`);
  }
}
// A facial blink must not replace the arm/leg motion while walking.
mixer.stopAllAction();
const walk = mixer.clipAction(gltf.animations.find(c => c.name === 'Walk')).reset().play();
mixer.setTime(.14); gltf.scene.updateMatrixWorld(true);
const walkingFeet = [point('foot.L'), point('foot.R')];
mixer.clipAction(blinkClip).reset().play(); mixer.setTime(.14); gltf.scene.updateMatrixWorld(true);
assert(walkingFeet.every((v, i) => v.distanceTo(point(`foot.${i ? 'R' : 'L'}`)) < 1e-7), 'Blink interrupts locomotion');
report.blinkLayersOverWalking = true;
// Check the exported held guard at several times after the arm has risen.
mixer.stopAllAction();
const guardClip = gltf.animations.find(c => c.name === 'Block');
const guard = mixer.clipAction(guardClip).reset().setLoop(LoopOnce, 1); guard.clampWhenFinished = true; guard.play();
const elbowAngles = []; let guardTime = 0;
for (const t of [.35, .5, guardClip.duration, guardClip.duration + .3]) {
  mixer.update(t - guardTime); guardTime = t; gltf.scene.updateMatrixWorld(true);
  const shoulder = point('upper_arm.R'), elbow = point('forearm.R'), wrist = point('hand.R');
  const angle = flex(shoulder, elbow, wrist); elbowAngles.push(angle);
  assert(Math.abs(angle - 90) < 3, `Block elbow must be near 90 degrees: ${angle}`);
  const middle = elbow.clone().lerp(wrist, .5), neck = point('spine.005');
  assert(middle.z > neck.z + .1, 'Guard forearm is behind the neck');
  const drop = neck.y - middle.y;
  assert(drop > .045 && drop < .10, `Guard should sit one fist below the neck: ${drop}`);
  const upperNormal = guardHingeNormals['upper_arm.R'].clone().applyQuaternion(bone('upper_arm.R').getWorldQuaternion(new Quaternion()));
  const lowerNormal = guardHingeNormals['forearm.R'].clone().applyQuaternion(bone('forearm.R').getWorldQuaternion(new Quaternion()));
  assert(upperNormal.angleTo(lowerNormal) * 180 / Math.PI < 2, 'Guard elbow has inconsistent arm roll');
}
report.BlockGuard = { elbowAngles, heldAfterFinish: true, protectsUpperChest: true, alignedElbowBendPlane: true };

await fs.writeFile(new URL('output/animations/threejs-verification.json', root), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ clips: gltf.animations.length, bones: bones.length, Walk: report.clips.Walk, Run: report.clips.Run, allClipsValid: true }, null, 2));
