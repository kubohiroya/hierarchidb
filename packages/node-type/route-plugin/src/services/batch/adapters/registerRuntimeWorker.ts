/**
 * @file registerRuntimeWorker.ts
 * @description Scaffolding for runtime worker registration (feature-flagged, no-op safe) for Route plugin
 */

function isFlagEnabled(name: string, fallback = false): boolean {
  const g: any = (globalThis as any);
  const env = (typeof process !== 'undefined' ? (process as any).env : undefined) || {};
  const ls = typeof localStorage !== 'undefined' ? localStorage : undefined;
  const v = ls?.getItem(name) ?? g?.[name] ?? env?.[name];
  if (v == null) return fallback;
  const s = String(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'on' || s === 'enabled';
}

/**
 * Register Route plugin stage adapters backed by a Web Worker.
 * - Guarded by `ROUTE_RUNTIME_WORKER` (default: off)
 * - Safe to call even if runtime-worker package is unavailable
 */
export async function registerRouteRuntimeWorkerAdapters(): Promise<void> {
  if (!isFlagEnabled('ROUTE_RUNTIME_WORKER', false)) return;
  try {
    const mod: any = await import('@hierarchidb/runtime-worker');
    if (typeof mod?.createStageWorkerClient === 'function') {
      await mod.createStageWorkerClient();
    }
  } catch {
    // Silently ignore when runtime-worker is not available (dev/offline)
  }
}

