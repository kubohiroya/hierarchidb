/**
 * @file registerRuntimeWorker.ts
 * @description Scaffolding for runtime-worker worker registration (features-flagged, no-op safe) for Route plugin
 */

import { readRuntimeEnvValue } from '@hierarchidb/util';
import type { RouteRuntimeWorkerClient } from './RuntimeWorkerClient.js';
import { registerRouteRuntimeWorkerClient } from './RuntimeWorkerClient.js';

function isFlagEnabled(name: string, fallback = false): boolean {
  const value = readFlagValue(name);
  if (value === undefined) return fallback;
  const normalized = value.toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'enabled';
}

/**
 * Register Route plugin stage adapters backed by a Web Worker.
 * - Guarded by `ROUTE_RUNTIME_WORKER` (default: off)
 * - Safe to call even if runtime-worker-worker package is unavailable
 */
export async function registerRouteRuntimeWorkerAdapters(): Promise<void> {
  registerRouteRuntimeWorkerClient(async (): Promise<RouteRuntimeWorkerClient | null> => {
    if (!isFlagEnabled('ROUTE_RUNTIME_WORKER', false)) {
      return null;
    }
    try {
      const name = '@' + 'hierarchidb/runtime-worker-worker';
      const mod: unknown = await import(/* @vite-ignore */ name);
      if (isRuntimeWorkerModule(mod) && typeof mod.createStageWorkerClient === 'function') {
        const client = await mod.createStageWorkerClient();
        return client as RouteRuntimeWorkerClient;
      }
    } catch {
      // Silently ignore when runtime-worker-worker is not available (dev/offline)
    }
    return null;
  });
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
