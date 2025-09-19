/**
 * @file registerRuntimeWorker.ts
 * @description Scaffolding for runtime worker registration (feature-flagged, no-op safe)
 */

type RuntimeScope = Record<string, unknown> & {
  AuthNotificationRegistry?: unknown;
};

function isFlagEnabled(name: string, fallback = false): boolean {
  const scope = globalThis as RuntimeScope;
  const env = typeof process !== 'undefined' && process?.env ? process.env : {};
  const storage = typeof localStorage !== 'undefined' ? localStorage : undefined;
  const value = storage?.getItem(name) ?? (scope[name] as string | undefined) ?? env?.[name];
  if (value == null) return fallback;
  const normalized = String(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'enabled';
}

/**
 * Register Location plugin stage adapters backed by a Web Worker.
 * - Guarded by `LOCATION_RUNTIME_WORKER` (default: off)
 * - Safe to call even if runtime-worker package is unavailable
 */
export async function registerLocationRuntimeWorkerAdapters(): Promise<void> {
  if (!isFlagEnabled('LOCATION_RUNTIME_WORKER', false)) return;
  try {
    // Lazy import to avoid bundling when flag is off
    const name = '@' + 'hierarchidb/runtime-worker';
    const mod = await import(/* @vite-ignore */ (name as string)) as {
      createStageWorkerClient?: () => Promise<unknown>;
    };
    if (typeof mod.createStageWorkerClient === 'function') {
      // Create client instance once (caller can store if needed)
      await mod.createStageWorkerClient();
    }
  } catch {
    // Silently ignore when runtime-worker is not available (dev/offline)
  }
}
