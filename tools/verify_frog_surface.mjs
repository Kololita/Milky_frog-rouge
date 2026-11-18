import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { SRGBColorSpace } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.createImageBitmap = async blob => {
  const bytes = Buffer.from(await blob.arrayBuffer());
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), close() {} };
};
const bytes = await fs.readFile(new URL('../output/frog.glb', import.meta.url));
const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
let hand;
asset.scene.traverse(o => { if (o.isMesh && o.material.name === 'Frog smooth hand colors') hand = o; });
assert(hand, 'Hand color material was not exported');
assert(hand.material.map, 'Hand color ramp is missing from the GLB');
assert.equal(hand.material.map.channel, 1, 'Hand ramp must use its own UV coordinates');
assert.equal(hand.material.map.colorSpace, SRGBColorSpace);
assert.equal(hand.material.map.image.width, 256);
assert.equal(hand.material.map.image.height, 4);
assert(!hand.material.vertexColors, 'Do not depend on multiple vertex-color channels for hand color');
const uv = hand.geometry.attributes.uv1;
assert(uv, 'The exported hand ramp UV map is missing');
let min = 1, max = 0;
for (let i = 0; i < uv.count; i++) {
  assert(Number.isFinite(uv.getX(i)) && Number.isFinite(uv.getY(i)));
  min = Math.min(min, uv.getX(i)); max = Math.max(max, uv.getX(i));
}
assert(min < .05 && max > .95, 'The hand color ramp does not span yellow through brown');
assert.equal(hand.material.roughness, Math.fround(.8));
console.log('Hand ramp, separate UVs, color space and web material compatibility verified', { uvRange: [min, max], vertices: uv.count });
