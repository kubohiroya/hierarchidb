/**
 * @file registerRuntimeWorker.ts
 * @description Scaffolding for runtime worker registration (feature-flagged, no-op safe) for Route plugin
 */

import { readRuntimeEnvValue } from '@hierarchidb/util';

function isFlagEnabled(name: string, fallback = false): boolean {
  const value = readFlagValue(name);
  if (value === undefined) return fallback;
  const normalized = value.toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'enabled';
}

/**
 * Register Route plugin stage adapters backed by a Web Worker.
 * - Guarded by `ROUTE_RUNTIME_WORKER` (default: off)
 * - Safe to call even if runtime-worker package is unavailable
 */
export async function registerRouteRuntimeWorkerAdapters(): Promise<void> {
  if (!isFlagEnabled('ROUTE_RUNTIME_WORKER', false)) return;
  try {
    const name = '@' + 'hierarchidb/runtime-worker';
    const mod: unknown = await import(/* @vite-ignore */ name);
    if (isRuntimeWorkerModule(mod) && typeof mod.createStageWorkerClient === 'function') {
      await mod.createStageWorkerClient();
    }
  } catch {
    // Silently ignore when runtime-worker is not available (dev/offline)
  }
}

function readFlagValue(name: string): string | undefined {
  const fromLocalStorage = (() => {
    if (typeof localStorage === 'undefined') return undefined;
    try {
      return localStorage.getItem(name) ?? undefined;
    } catch {
      return undefined;
    }
  })();
  if (fromLocalStorage !== undefined) return fromLocalStorage;

  const globalRecord = globalThis as Record<string, unknown>;
  const fromGlobal = globalRecord[name];
  if (fromGlobal != null) return String(fromGlobal);

  const envValue = readRuntimeEnvValue(name, { prefixes: [''] });
  if (envValue !== undefined) return envValue;
  return undefined;
}

interface RuntimeWorkerModule {
  createStageWorkerClient?: () => Promise<unknown>;
}

function isRuntimeWorkerModule(value: unknown): value is RuntimeWorkerModule {
  return typeof value === 'object' && value !== null;
}
