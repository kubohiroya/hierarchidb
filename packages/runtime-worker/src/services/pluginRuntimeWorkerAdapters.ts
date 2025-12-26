import { readRuntimeEnvValue } from '@hierarchidb/util';
import type { RuntimeWorkerStageClient, RuntimeWorkerClientProvider } from './RuntimeWorkerService.js';
import { registerRuntimeWorkerClient } from './RuntimeWorkerService.js';
import { createStageWorkerClient } from './StageProcessingService.js';

export type RuntimeWorkerAdapterOptions = {
  pluginId: string;
  flagName?: string;
  defaultEnabled?: boolean;
  allowLocalWorker?: boolean;
  createClient?: RuntimeWorkerClientProvider;
};

type RuntimeScope = Record<string, unknown> & {
  AuthNotificationRegistry?: unknown;
};

const normalizeFlagValue = (value: string): boolean =>
  value === '1' || value === 'true' || value === 'on' || value === 'enabled';

const readFlagValue = (name: string): string | undefined => {
  const fromLocalStorage = (() => {
    if (typeof localStorage === 'undefined') return undefined;
    try {
      return localStorage.getItem(name) ?? undefined;
    } catch {
      return undefined;
    }
  })();
  if (fromLocalStorage !== undefined) return fromLocalStorage;

  const globalRecord = globalThis as RuntimeScope;
  const fromGlobal = globalRecord[name];
  if (fromGlobal != null) return String(fromGlobal);

  const envValue = readRuntimeEnvValue(name, { prefixes: [''] });
  if (envValue !== undefined) return envValue;
  return undefined;
};

const isFlagEnabled = (name: string, fallback: boolean): boolean => {
  const value = readFlagValue(name);
  if (value === undefined) return fallback;
  return normalizeFlagValue(value.toLowerCase());
};

async function createRuntimeWorkerClient(
  allowLocalWorker: boolean,
): Promise<RuntimeWorkerStageClient | null> {
  try {
    const name = '@' + 'hierarchidb/runtime-worker-worker';
    const mod: unknown = await import(/* @vite-ignore */ name);
    if (typeof mod === 'object' && mod !== null && 'createStageWorkerClient' in mod) {
      const factory = (mod as { createStageWorkerClient?: () => Promise<RuntimeWorkerStageClient> })
        .createStageWorkerClient;
      if (typeof factory === 'function') {
        return await factory();
      }
    }
  } catch {
    // Ignore when runtime-worker-worker is unavailable.
  }

  if (!allowLocalWorker) return null;
  try {
    return await createStageWorkerClient();
  } catch {
    return null;
  }
}

export async function registerPluginRuntimeWorkerAdapters({
  pluginId,
  flagName,
  defaultEnabled = false,
  allowLocalWorker = false,
  createClient,
}: RuntimeWorkerAdapterOptions): Promise<void> {
  const resolvedFlag = flagName ?? `${pluginId.toUpperCase()}_RUNTIME_WORKER`;
  registerRuntimeWorkerClient(pluginId, async () => {
    if (!isFlagEnabled(resolvedFlag, defaultEnabled)) {
      return null;
    }
    if (createClient) {
      if (typeof createClient === 'function') {
        return await createClient();
      }
      return createClient;
    }
    return await createRuntimeWorkerClient(allowLocalWorker);
  });
}
