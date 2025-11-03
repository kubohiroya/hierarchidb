/**
 * TODO(runtime-worker-factory): add vitest coverage for
 * register/get/unregister (positive + fallback) and ensure the new
 * registry works across multiple nodeType consumers without leaking
 * per-package state. Tests should live under `src/__tests__` once
 * the shared factory design is finalised.
 */

import { getStageProcessingClient } from './StageProcessingService.js';

type StageProcessingClient = Awaited<ReturnType<typeof getStageProcessingClient>>;

export type RuntimeWorkerStageClient = StageProcessingClient;
export type RuntimeWorkerClientProvider =
  | (() => Promise<RuntimeWorkerStageClient | null>)
  | (() => RuntimeWorkerStageClient | null)
  | RuntimeWorkerStageClient
  | null;

interface RegistryEntry {
  provider: RuntimeWorkerClientProvider;
}

const registry = new Map<string, RegistryEntry>();

export function registerRuntimeWorkerClient(
  nodeType: string,
  provider: RuntimeWorkerClientProvider
): void {
  registry.set(nodeType, { provider });
}

export function unregisterRuntimeWorkerClient(nodeType: string): void {
  registry.delete(nodeType);
}

export function hasRuntimeWorkerClient(nodeType: string): boolean {
  return registry.has(nodeType);
}

async function resolveProvider(
  provider: RuntimeWorkerClientProvider
): Promise<RuntimeWorkerStageClient | null> {
  if (typeof provider === 'function') {
    return provider();
  }
  return provider ?? null;
}

export async function getRuntimeWorkerClient(
  nodeType: string,
  options: { fallbackToLocal?: boolean } = {}
): Promise<RuntimeWorkerStageClient | null> {
  const entry = registry.get(nodeType);
  if (entry) {
    const client = await resolveProvider(entry.provider);
    if (client) {
      return client;
    }
  }

  if (options.fallbackToLocal ?? true) {
    try {
      return await getStageProcessingClient();
    } catch {
      return null;
    }
  }

  return null;
}
