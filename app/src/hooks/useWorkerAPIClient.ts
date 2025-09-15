/**
 * React hook for WorkerAPIClient
 * Provides compatibility with existing code
 */

import { useEffect, useState } from 'react';
import { NotInitializedError, WorkerAPIClient } from '../WorkerAPIClient';

export function useWorkerAPIClient() {
  const [client, setClient] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    const trySet = (api: any) => {
      if (!cancelled) setClient({ getAPI: () => api });
    };
    const init = async () => {
      try {
        // Fast path: already ready
        if (WorkerAPIClient.isReady()) {
          trySet(WorkerAPIClient.getSingleton());
          return;
        }
        // Kick initialization and then getOrInit regardless of event ordering
        await WorkerAPIClient.initialize().catch(() => {});
        const api = await WorkerAPIClient.getOrInit();
        trySet(api);
      } catch (e) {
        // Fallback to event
        const onEvt = async () => {
          try {
            const api = await WorkerAPIClient.getOrInit();
            trySet(api);
          } catch (err) {
            if (!cancelled) setError(err as Error);
          }
        };
        window.addEventListener('hierarchidb-worker-init-complete', onEvt, { once: true });
        // Also poll briefly
        const start = Date.now();
        const t = window.setInterval(async () => {
          if (WorkerAPIClient.isReady()) {
            try {
              const api = await WorkerAPIClient.getOrInit();
              trySet(api);
            } catch (err) {
              if (!cancelled) setError(err as Error);
            } finally {
              window.clearInterval(t);
            }
          } else if (Date.now() - start > 5000) {
            window.clearInterval(t);
          }
        }, 100);
      }
    };
    // Global flag immediate path
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).__HDB_INIT_COMPLETE__) {
      WorkerAPIClient.getOrInit().then(trySet).catch(setError);
    } else {
      init().catch(setError);
    }
    return () => { cancelled = true; };
  }, []);

  if (error) return null;
  return client;
}
