import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FileLoader, LoaderUtils} from 'three';
import {startupParallelism} from './loading-budget.js';

const loader = new GLTFLoader();
// A GLB job includes decoding its embedded images and building its scene.
// Bound this work across character, enemy and environment callers.
const maxActiveModels = startupParallelism(2);
const queue = [];
let active = 0, head = 0;

async function loadWithFingerprint(url) {
  if (!globalThis.crypto?.subtle) return loader.loadAsync(url);
  const file = new FileLoader(loader.manager).setResponseType('arraybuffer');
  const bytes = await file.loadAsync(url);
  const [gltf,digest] = await Promise.all([
    loader.parseAsync(bytes, LoaderUtils.extractUrlBase(url)),
    crypto.subtle.digest('SHA-256',bytes).catch(() => null),
  ]);
  if (digest) gltf.sourceHash = Array.from(new Uint8Array(digest), value=>value.toString(16).padStart(2,'0')).join('');
  return gltf;
}

function schedule() {
  while (active < maxActiveModels && head < queue.length) {
    const {url, fingerprint, resolve, reject} = queue[head];
    queue[head++] = null;
    active++;
    const loading = fingerprint ? loadWithFingerprint(url) : loader.loadAsync(url);
    loading.then(resolve, reject).finally(() => {
      setTimeout(() => {
        active--;
        schedule();
      }, 16);
    });
  }
  if (head === queue.length) {
    queue.length = 0;
    head = 0;
  }
}

export function loadModel(url, {fingerprint = false} = {}) {
  return new Promise((resolve, reject) => {
    queue.push({url, fingerprint, resolve, reject});
    schedule();
  });
}
