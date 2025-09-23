import type { DownloadWorkerAPI, SimplifyWorkerAPI, VectorTileWorkerAPI } from '@hierarchidb/runtime-worker';
// Re-export worker API types so they are public in this package's .d.ts
export type { DownloadWorkerAPI, SimplifyWorkerAPI, VectorTileWorkerAPI } from '@hierarchidb/runtime-worker';
import { getStageProcessingClient } from '@hierarchidb/runtime-worker';

export interface ShapeRuntimeWorkerClient {
  // Use inline import() types to avoid TS4033 private name issues in DTS
  download: import('@hierarchidb/runtime-worker').DownloadWorkerAPI;
  simplify: import('@hierarchidb/runtime-worker').SimplifyWorkerAPI;
  vectortile: import('@hierarchidb/runtime-worker').VectorTileWorkerAPI;
}

type Provider = () => Promise<ShapeRuntimeWorkerClient | null> | ShapeRuntimeWorkerClient | null;
let provider: Provider | null = null;

export function registerShapeRuntimeWorkerClient(p: Provider) {
  provider = p;
}

export async function getShapeRuntimeWorkerClient(): Promise<ShapeRuntimeWorkerClient | null> {
  if (typeof provider === 'function') {
    const v = await provider();
    if (v) return v;
  }
  try {
    // Fallback: use in-process stage processing client (no threads)
    return await getStageProcessingClient();
  } catch {
    return null;
  }
}
