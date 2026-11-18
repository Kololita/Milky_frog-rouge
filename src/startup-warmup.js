import {Group,Mesh,OrthographicCamera,PlaneGeometry} from 'three';
import {createLoadingBudget, startupParallelism} from './loading-budget.js';

// Compilation visits the original meshes without reparenting them. Lighting
// and environment are collected from the actual target scene.
class ShaderBatch extends Group {
  objects = [];

  traverse(visitor) {
    for (const object of this.objects) visitor(object);
  }
}

const BATCH_SIZE = 32;
const MAX_PARALLEL_BATCHES = 2;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForPrograms(gl, extension, programs) {
  const deadline = performance.now() + 60000;
  while (programs.length) {
    if (gl.isContextLost() || performance.now() > deadline) throw Error('GPU 着色器预热未完成');
    let pending = 0;
    for (const program of programs) {
      if (!gl.getProgramParameter(program, extension.COMPLETION_STATUS_KHR)) programs[pending++] = program;
    }
    programs.length = pending;
    if (pending) await pause(16);
  }
}

async function warmProgramBindings(gl, extension, entries, budget) {
  if (extension) await waitForPrograms(gl, extension, entries.map(entry => entry.program));
  for (const entry of entries) {
    if (!extension && !gl.getProgramParameter(entry.program, gl.LINK_STATUS)) throw Error('GPU 着色器链接失败');
    // Three lazily queries uniforms and vertex attributes on the first draw.
    // Do the same work in budgeted slices after the program has linked.
    if (extension) entry.getUniforms?.();
    await budget.checkpoint();
  }
}

export async function compileSceneInBatches(renderer, scene, camera, onProgress = () => {}, options = {}) {
  const {visibleOnly = false, excludedRoots = new Set(), onBatch} = options;
  const objects = [];
  function collect(object) {
    if (excludedRoots.has(object) || (visibleOnly && !object.visible)) return;
    if (object.isMesh || object.isPoints || object.isLine || object.isSprite) objects.push(object);
    for (const child of object.children) collect(child);
  }
  collect(scene);
  const batch = new ShaderBatch();
  const budget = createLoadingBudget();
  const gl = renderer.getContext();
  const compileExtension = gl.getExtension('KHR_parallel_shader_compile');
  const programCache = renderer.info.programs;
  const canTrackPrograms = Array.isArray(programCache);
  const trackLinks = canTrackPrograms && programCache.every(entry => entry.program);
  const waveSize = BATCH_SIZE * (compileExtension && trackLinks ? startupParallelism(MAX_PARALLEL_BATCHES) : 1);
  for (let offset = 0; offset < objects.length; offset += waveSize) {
    const waveEnd = Math.min(objects.length, offset + waveSize);
    const firstProgram = canTrackPrograms ? programCache.length : 0;
    const timings = [];
    for (let start = offset; start < waveEnd; start += BATCH_SIZE) {
      batch.objects = objects.slice(start, start + BATCH_SIZE);
      const startTime = performance.now(), firstInBatch = canTrackPrograms ? programCache.length : 0;
      const compiling = trackLinks ? renderer.compile(batch,camera,scene) : renderer.compileAsync(batch,camera,scene);
      const submitMs = performance.now() - startTime;
      if (!trackLinks) await compiling;
      if (onBatch) timings.push({offset:start,objects:batch.objects.length,startTime,
        submitMs,programs:canTrackPrograms ? programCache.slice(firstInBatch).map(entry=>entry.name) : [],
        materials:[...new Set(batch.objects.flatMap(object=>object.material).map(material=>material?.name||material?.type))]});
      await budget.checkpoint();
    }
    if (trackLinks) {
      // Three's Material can point at multiple GL programs in one wave. Wait on
      // the actual programs that were created, including every variant.
      const entries = programCache.slice(firstProgram);
      if (entries.every(entry => entry.program)) await warmProgramBindings(gl, compileExtension, entries, budget);
      else {
        batch.objects = objects.slice(offset, waveEnd);
        await renderer.compileAsync(batch, camera, scene);
      }
    }
    for (const {startTime,...sample} of timings) onBatch({...sample,elapsedMs:performance.now()-startTime});
    onProgress(waveEnd / objects.length);
    await budget.checkpoint(true);
  }
  if (!objects.length) onProgress(1);
}

export async function compileStartupTarget(renderer, target, scene, camera, onProgress, options) {
  const previous = renderer.getRenderTarget();
  const face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
  try {
    renderer.setRenderTarget(target);
    await compileSceneInBatches(renderer, scene, camera, onProgress, options);
  } finally {
    renderer.setRenderTarget(previous, face, mip);
  }
}

export async function compileStartupQuad(renderer, target, materials) {
  const scene = new Group();
  const geometry = new PlaneGeometry(2,2);
  const camera = new OrthographicCamera(-1,1,1,-1,0,1);
  for (const material of materials) scene.add(new Mesh(geometry, material));
  try {
    await compileStartupTarget(renderer, target, scene, camera);
  } finally {
    geometry.dispose();
  }
}

export async function warmScene(renderer, scene, camera, draw, onProgress, excludedRoots) {
  const targets = new Set(), textures = new Set();
  scene.traverse(object => {
    if (object.isReflector) targets.add(object.getRenderTarget());
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });

  const total = textures.size + targets.size;
  const budget = createLoadingBudget();
  let submitted = 0;
  for (const texture of textures) {
    renderer.initTexture(texture);
    onProgress('upload', ++submitted / total);
    await budget.checkpoint();
  }
  for (const target of targets) {
    renderer.initRenderTarget(target);
    onProgress('upload', ++submitted / total);
    await budget.checkpoint();
  }
  onProgress('upload', 1);
  await compileSceneInBatches(renderer, scene, camera, fraction => onProgress('compile', fraction), {excludedRoots});
  draw();
  onProgress('compile', 1);
  renderer.domElement.dataset.warmup = JSON.stringify({
    pointLightVariants:1,
    reflectionTargets:targets.size,
    programs:renderer.info.programs.length,
  });
}

// Poll with zero timeout so the loading screen can repaint while the GPU works.
export async function waitForStartupGpu(renderer) {
  const gl = renderer.getContext();
  const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!fence) throw Error('无法确认 GPU 预热状态');
  const deadline = performance.now() + 15000;
  gl.flush();
  try {
    for (;;) {
      const status = gl.clientWaitSync(fence, 0, 0);
      if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) return;
      if (status === gl.WAIT_FAILED || performance.now() > deadline) throw Error('GPU 资源预热未完成');
      await pause(4);
    }
  } finally {
    gl.deleteSync(fence);
  }
}
