const CAPACITY = 24000;
const METRICS = ['rafMs', 'frameMs', 'cpuMs', 'combatMs', 'waterMs', 'cameraOcclusionMs', 'renderMs',
  'gpuMs', 'gpuWaterMs', 'gpuRenderMs', 'draws', 'triangles', 'textures', 'geometries', 'programs', 'waterSteps'];

export function createFrameProfiler(renderer) {
  const gl = renderer.getContext();
  const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const data = Object.fromEntries(METRICS.map(name => [name, new Float64Array(CAPACITY)]));
  const pending = [];
  const idleQueries = [];
  let cursor = 0, previousRaf, previousFrame, rafMs, start, index, generation = 0, activeQuery;
  renderer.info.autoReset = false;

  function poll() {
    if (!timer || !pending.length) return;
    if (gl.getParameter(timer.GPU_DISJOINT_EXT)) {
      for (const { query } of pending) gl.deleteQuery(query);
      pending.length = 0;
      return;
    }
    while (pending.length && gl.getQueryParameter(pending[0].query, gl.QUERY_RESULT_AVAILABLE)) {
      const { query, slot, metric, frame, run } = pending.shift();
      if (run === generation && cursor - frame <= CAPACITY) {
        data[metric][slot] = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
      }
      idleQueries.push(query);
    }
  }

  function beginGpu(metric) {
    if (!timer || pending.length >= 8) return;
    const query = idleQueries.pop() ?? gl.createQuery();
    if (!query) return;
    gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
    activeQuery = { query, slot: index, metric, frame: cursor, run: generation };
  }

  function endGpu() {
    if (!activeQuery) return;
    gl.endQuery(timer.TIME_ELAPSED_EXT);
    pending.push(activeQuery);
    activeQuery = null;
  }

  const selectedPass = () => cursor % 12 === 0 ? 'gpuMs' : cursor % 12 === 4 ? 'gpuWaterMs'
    : cursor % 12 === 8 ? 'gpuRenderMs' : null;

  function snapshot(includeFrames = false) {
    poll();
    const count = Math.min(cursor, CAPACITY);
    const get = (metric, row) => data[metric][(cursor - count + row) % CAPACITY];
    const summary = Object.fromEntries(METRICS.map(metric => {
      const values = Array.from({ length: count }, (_, i) => get(metric, i)).filter(Number.isFinite).sort((a, b) => a - b);
      const percentile = p => values[Math.ceil(values.length * p) - 1] ?? null;
      return [metric, {
        samples: values.length, p50: percentile(.5), p95: percentile(.95), p99: percentile(.99),
        max: values.at(-1) ?? null,
        ...(metric === 'frameMs' ? { over25: values.filter(v => v > 25).length,
          over33_3: values.filter(v => v > 33.3).length, over50: values.filter(v => v > 50).length } : {}),
      }];
    }));
    return {
      count, summary, gpuTimerAvailable: Boolean(timer),
      renderer: gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
      width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, dpr: renderer.getPixelRatio(),
      ...(includeFrames ? { columns: METRICS,
        frames: Array.from({ length: count }, (_, i) => METRICS.map(metric => get(metric, i))) } : {}),
    };
  }

  return {
    raf(time) {
      rafMs = time - previousRaf;
      previousRaf = time;
    },
    begin(time) {
      poll();
      index = cursor % CAPACITY;
      for (const metric of METRICS) data[metric][index] = NaN;
      data.rafMs[index] = rafMs;
      data.frameMs[index] = time - previousFrame;
      previousFrame = time;
      renderer.info.reset();
      start = performance.now();
      if (selectedPass() === 'gpuMs') beginGpu('gpuMs');
    },
    mark(metric, value) { data[metric][index] = value; },
    beginPass(metric) { if (selectedPass() === metric) beginGpu(metric); },
    endPass(metric) { if (selectedPass() === metric) endGpu(); },
    end() {
      if (selectedPass() === 'gpuMs') endGpu();
      const { render, memory, programs } = renderer.info;
      data.cpuMs[index] = performance.now() - start;
      data.draws[index] = render.calls;
      data.triangles[index] = render.triangles;
      data.textures[index] = memory.textures;
      data.geometries[index] = memory.geometries;
      data.programs[index] = programs.length;
      cursor++;
    },
    reset() { generation++; cursor = 0; previousFrame = undefined; },
    snapshot,
  };
}
