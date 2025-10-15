/**
 * @file registerRuntimeWorker.ts
 * @description Scaffolding for runtime worker registration (feature-flagged, no-op safe)
 */

import { readRuntimeEnvValue } from '@hierarchidb/util';
import type { LocationRuntimeWorkerClient } from './RuntimeWorkerClient.js';
import { registerLocationRuntimeWorkerClient } from './RuntimeWorkerClient.js';

type RuntimeScope = Record<string, unknown> & {
  AuthNotificationRegistry?: unknown;
};

function isFlagEnabled(name: string, fallback = false): boolean {
  const scope = globalThis as RuntimeScope;
  const storage = typeof localStorage !== 'undefined' ? localStorage : undefined;
  const envValue = readRuntimeEnvValue(name, { prefixes: [''] });
  const value = storage?.getItem(name) ?? (scope[name] as string | undefined) ?? envValue;
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
  registerLocationRuntimeWorkerClient(async (): Promise<LocationRuntimeWorkerClient | null> => {
    if (!isFlagEnabled('LOCATION_RUNTIME_WORKER', false)) {
      return null;
    }
    try {
      const name = '@' + 'hierarchidb/runtime-worker';
      const mod = await import(/* @vite-ignore */ (name as string)) as {
        createStageWorkerClient?: () => Promise<LocationRuntimeWorkerClient>;
      };
      if (typeof mod.createStageWorkerClient === 'function') {
        return await mod.createStageWorkerClient();
      }
    } catch {
      // Silently ignore when runtime-worker is not available (dev/offline)
    }
    return null;
  });
}
