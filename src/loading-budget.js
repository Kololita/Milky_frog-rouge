const ACTIVE_BUDGET_MS = 8;
const IDLE_SLICE_MS = 12;

export const yieldStartup = () => new Promise(resolve => setTimeout(resolve, 0));

export function startupParallelism(limit) {
  const cores = globalThis.navigator?.hardwareConcurrency ?? 4;
  return Math.max(1, Math.min(limit, Math.floor(cores / 4)));
}

// CPU work on the main thread may run in bursts, with real idle time between
// bursts. A single browser decoding or driver call still owns its duration.
export function createLoadingBudget() {
  let start = performance.now();
  return {
    async checkpoint(force = false) {
      const active = performance.now() - start;
      if (!force && active < ACTIVE_BUDGET_MS) return;
      await new Promise(resolve => setTimeout(resolve, Math.max(IDLE_SLICE_MS, Math.min(60, active))));
      start = performance.now();
    },
  };
}
