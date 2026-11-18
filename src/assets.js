import {skipActorShadows} from './actor-shadows.js';
import {createPlayerHitClips,preparePlayerHitClips} from './player-hit-animation.js';
import {loadModel} from './model-loading.js';
import { AnimationMixer, AnimationClip } from 'three';
import { extractAttackRootMotion } from './attack-root-motion.js';
import {createBackThrowClip} from './back-throw.js';
import {fetchGzipAsset} from './gzip-asset.js';

const HIT_CLIP_NAMES = ['HitRecoil', 'HitSit', 'HitLaunch'];
export const FROG_HIT_ANIMATION_URL = '/animations/frog-hit-poses.json.gz';

async function loadBakedHitAnimations(url) {
  try {
    const response = await fetchGzipAsset(url);
    return await response.json();
  } catch {
    return null;
  }
}

export function readBakedHitAnimations(manifest, sourceHash) {
  if (!sourceHash || manifest?.modelSha256 !== sourceHash || manifest.version !== 1) return null;
  try {
    const clips = manifest.clips.map(clip => AnimationClip.parse(clip));
    return clips.length === HIT_CLIP_NAMES.length &&
      clips.every((clip, index) => clip.name === HIT_CLIP_NAMES[index] && clip.tracks.length && clip.validate())
      ? clips : null;
  } catch {
    return null;
  }
}

/** GLB uses meters and has feet at the origin. */
export async function loadAnimatedModel(url, hitAnimationUrl) {
  const useManifest = Boolean(hitAnimationUrl && globalThis.crypto?.subtle);
  const [gltf, manifest] = await Promise.all([
    loadModel(url, {fingerprint:useManifest}),
    useManifest ? loadBakedHitAnimations(hitAnimationUrl) : null,
  ]);
  verifyModelTextures(gltf.scene);
  gltf.scene.traverse(object => {
    if (object.isMesh) {
      // Thin facial surfaces should not cast a detached shadow on the face.
      const facialSurface = /^Frog_(?:eyelid|mouth|laugh)_/.test(object.name);
      object.castShadow = !facialSurface;
      object.receiveShadow = false;
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        skipActorShadows(material);
        if (material.map) material.map.anisotropy = 4;
      }
    }
  });
  const mixer = new AnimationMixer(gltf.scene);
  const attackMotion = extractAttackRootMotion(gltf.animations, gltf.scene, /^(?:Attack[1-4]|RunAttack)$/);
  const dodgeMotion = extractAttackRootMotion(gltf.animations, gltf.scene, /^DodgeSide[LR]$/);
  const bakedHitClips = readBakedHitAnimations(manifest, gltf.sourceHash);
  const hitClips = bakedHitClips ?? await preparePlayerHitClips(gltf.animations, gltf.scene);
  const {actions, faceActions} = createModelActions(gltf.animations, mixer, hitClips);
  return {model:gltf.scene, mixer, actions, faceActions, attackMotion, dodgeMotion, bakedHitClips:Boolean(bakedHitClips)};
}

export function verifyModelTextures(model){
  const missing=new Set();
  model.traverse(object=>{if(!object.isMesh)return;for(const material of (Array.isArray(object.material)?object.material:[object.material])){
    if(['Original frog baked colors','Frog smooth hand colors'].includes(material.name)&&!material.map)missing.add(material.name);
  }});
  if(missing.size)throw new Error(`角色贴图未加载：${[...missing].join('、')}`);
}

export function createModelActions(clips, mixer, hitClips = createPlayerHitClips(clips, mixer.getRoot())) {
  const actions = {}, faceActions = {};
  const counter=clips.find(clip=>clip.name==='Attack4')?.clone();if(counter)counter.name='CounterWave';
  const backThrow=createBackThrowClip(clips);
  for (const clip of [...clips,...hitClips,...(counter?[counter]:[]),...(backThrow?[backThrow]:[])]) {
    const isFace = track => track.name.endsWith('.morphTargetInfluences') || track.name === 'jaw.position';
    // Keep corrective facial shapes and jaw motion at their authored weight.
    // Fading their weight directly cuts a straight chord through the eye.
    if (clip.name === 'Laugh') {
      faceActions.Laugh = mixer.clipAction(new AnimationClip('LaughFace', clip.duration, clip.tracks.filter(isFace)));
      actions.Laugh = mixer.clipAction(new AnimationClip('Laugh', clip.duration, clip.tracks.filter(track => !isFace(track))));
    } else {
      actions[clip.name] = mixer.clipAction(clip.name === 'Blink' ? clip : new AnimationClip(clip.name, clip.duration, clip.tracks.filter(track => track.name !== 'jaw.position')));
    }
  }
  return { actions, faceActions };
}
