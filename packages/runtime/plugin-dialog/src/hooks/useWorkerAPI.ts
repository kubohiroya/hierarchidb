/**
 * Worker API Hook
 * Provides access to Worker API with Comlink
 */

import { useEffect, useState } from 'react';
import * as Comlink from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';

let workerInstance: Worker | null = null;
let workerAPI: WorkerAPI | null = null;

/**
 * Initialize Worker and Comlink proxy
 */
async function initializeWorker(): Promise<WorkerAPI> {
  if (workerAPI) return workerAPI;

  // Create Worker instance
  workerInstance = new Worker(
    new URL('../../../worker/src/index.ts', import.meta.url),
    { type: 'module' }
  );

  // Wrap with Comlink
  const api = Comlink.wrap<WorkerAPI>(workerInstance);
  
  // Initialize the Worker
  await api.initialize();
  
  workerAPI = api;
  return api;
}

/**
 * Hook to access Worker API
 */
export function useWorkerAPI() {
  const [api, setApi] = useState<WorkerAPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    initializeWorker()
      .then(setApi)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { api, loading, error };
}