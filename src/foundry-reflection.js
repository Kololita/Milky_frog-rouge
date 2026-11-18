import {DataTexture, HalfFloatType, LinearFilter, RGBAFormat, ShaderMaterial,
  UnsignedByteType, WebGLCubeRenderTarget} from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {fetchGzipAsset} from './gzip-asset.js';

export const PROBE_SIZE = 256;
const FACE_VALUES = PROBE_SIZE * PROBE_SIZE * 4;
const FACE_COUNT = 6;
const sources = new Map();

async function loadFaces(lighting) {
  const response = await fetchGzipAsset(`/textures/foundry/probe-${lighting}.bin.gz`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength !== FACE_VALUES * FACE_COUNT * Uint16Array.BYTES_PER_ELEMENT) {
    throw Error('Unexpected foundry reflection asset length');
  }
  return new Uint16Array(buffer);
}

export function preloadFoundryReflection(lighting) {
  if (!sources.has(lighting)) sources.set(lighting, loadFaces(lighting).catch(() => null));
  return sources.get(lighting);
}

export function uploadFoundryReflection(renderer, size, data) {
  const type = renderer.extensions.has('EXT_color_buffer_float') ? HalfFloatType : UnsignedByteType;
  const target = new WebGLCubeRenderTarget(size, {type, depthBuffer:false});
  const face = new DataTexture(null, PROBE_SIZE, PROBE_SIZE, RGBAFormat, HalfFloatType);
  face.magFilter = face.minFilter = LinearFilter;
  const material = new ShaderMaterial({
    depthTest:false, depthWrite:false, toneMapped:false,
    uniforms:{source:{value:face}},
    vertexShader:`varying vec2 pixelUV;
      void main(){pixelUV=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`uniform sampler2D source;
      varying vec2 pixelUV;
      void main(){gl_FragColor=texture2D(source,pixelUV);}`,
  });
  const quad = new FullScreenQuad(material);
  const previous = renderer.getRenderTarget();
  const previousFace = renderer.getActiveCubeFace();
  const previousMip = renderer.getActiveMipmapLevel();
  try {
    for (let i = 0; i < FACE_COUNT; i++) {
      const offset = i * FACE_VALUES;
      face.image.data = data.subarray(offset, offset + FACE_VALUES);
      face.needsUpdate = true;
      renderer.setRenderTarget(target, i);
      quad.render(renderer);
    }
    target.texture.needsPMREMUpdate = true;
    return target;
  } catch (error) {
    target.dispose();
    throw error;
  } finally {
    renderer.setRenderTarget(previous, previousFace, previousMip);
    face.dispose();
    material.dispose();
  }
}
