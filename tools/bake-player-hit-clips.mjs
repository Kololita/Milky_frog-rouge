import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {gzipSync, gunzipSync} from 'node:zlib';
import {AnimationClip} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FROG_HIT_ANIMATION_URL, readBakedHitAnimations} from '../src/assets.js';
import {createPlayerHitClips} from '../src/player-hit-animation.js';

// The solver samples skinning and bones. The images need dimensions for the
// glTF parser, and their decoded pixels never enter the pose calculation.
globalThis.self = globalThis;
globalThis.createImageBitmap = async blob => {
  const bytes = Buffer.from(await blob.arrayBuffer());
  return {width:bytes.readUInt32BE(16), height:bytes.readUInt32BE(20), close(){}};
};

const source = await readFile(new URL('../public/models/characters/frog.glb', import.meta.url));
const target = new URL(`../public${FROG_HIT_ANIMATION_URL}`, import.meta.url);
const hash = createHash('sha256').update(source).digest('hex');
const gltf = await new GLTFLoader().parseAsync(source.buffer.slice(source.byteOffset, source.byteOffset+source.byteLength), '');
const start = performance.now();
const clips = createPlayerHitClips(gltf.animations, gltf.scene);
const bakeMs = performance.now() - start;
assert.equal(clips.length,3);
const serialize = clip => ({...AnimationClip.toJSON(clip), uuid:`frog-baked-${clip.name}`});
const generated = {version:1, modelSha256:hash, clips:clips.map(serialize)};
const bytes = Buffer.from(JSON.stringify(generated));
const compressed = process.argv.includes('--check') ? await readFile(target) : gzipSync(bytes);
const payload = JSON.parse(gunzipSync(compressed));
const parseStart = performance.now();
const decoded = readBakedHitAnimations(payload, hash);
const parseMs = performance.now() - parseStart;
const digest = value => createHash('sha256').update(value).digest('hex');
// JSON normalizes -0 to 0, which does not change the animation values.
assert.equal(digest(JSON.stringify(decoded?.map(serialize))),digest(JSON.stringify(generated.clips)));
assert.equal(readBakedHitAnimations(payload,'different-model'),null);
if (!process.argv.includes('--check')) {
  await mkdir(new URL('.',target), {recursive:true});
  await writeFile(target, compressed);
}
console.log(JSON.stringify({bakeMs,parseMs,tracks:clips.reduce((n,clip)=>n+clip.tracks.length,0),bytes:compressed.length}));
