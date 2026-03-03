import type { Remote } from 'comlink';
import { useEffect, useState } from 'react';

interface ClientState<T> {
  client: Remote<T> | null;
  isReady: boolean;
  isConnected: boolean;
  error: Error | null;
}

type PingFunction = () => Promise<unknown>;

const resolvePingFunction = <T,>(client: Remote<T>): PingFunction | null => {
  if (typeof client !== 'object' && typeof client !== 'function') {
    return null;
  }
  const record = client as Record<string, unknown>;
  const candidate = record.ping;
  if (typeof candidate !== 'function') {
    return null;
  }
  return async () => {
    const result = candidate.call(client);
    return await Promise.resolve(result);
  };
};

export interface UseWorkerClientProviderViewParams<T> {
  worker: Worker;
  wrapWorker: (worker: Worker) => Remote<T> | Promise<Remote<T>>;
  debug: boolean;
  healthCheckInterval: number;
  onClientReady?: (client: Remote<T>) => void;
}

export interface UseWorkerClientProviderViewResult<T> {
  state: ClientState<T>;
}

export function useWorkerClientProviderView<T>({
  worker,
  wrapWorker,
  debug,
  healthCheckInterval,
  onClientReady,
}: UseWorkerClientProviderViewParams<T>): UseWorkerClientProviderViewResult<T> {
  const [state, setState] = useState<ClientState<T>>({
    client: null,
    isReady: false,
    isConnected: false,
    error: null,
  });

  useEffect(() => {
    let mounted = true;
    let healthCheckTimer: number | null = null;

    const setupClient = async () => {
      try {
        const wrappedClient = await wrapWorker(worker);

        if (!mounted) return;

        const ping = resolvePingFunction(wrappedClient);
        if (ping) {
          try {
            await ping();

            if (debug) {
              console.log('[WorkerClientProvider] Comlink connection verified');
            }
          } catch (error) {
            if (debug) {
              console.warn('[WorkerClientProvider] Ping not available or failed:', error);
            }
          }
        }

        setState({
          client: wrappedClient,
          isReady: true,
          isConnected: true,
          error: null,
        });

        onClientReady?.(wrappedClient);

        if (healthCheckInterval > 0 && ping) {
          healthCheckTimer = window.setInterval(async () => {
            if (!mounted) return;

            try {
              await ping();

              setState((prev) => {
                if (!prev.isConnected) {
                  if (debug) {
                    console.log('[WorkerClientProvider] Connection restored');
                  }
                  return { ...prev, isConnected: true };
                }
                return prev;
              });
            } catch (error) {
              setState((prev) => {
                if (prev.isConnected) {
                  if (debug) {
                    console.error('[WorkerClientProvider] Health check failed:', error);
                  }
                  return { ...prev, isConnected: false };
                }
                return prev;
              });
            }
          }, healthCheckInterval);
        }
      } catch (error) {
        if (!mounted) return;

        const err = error instanceof Error ? error : new Error(String(error));

        setState({
          client: null,
          isReady: false,
          isConnected: false,
          error: err,
        });

        if (debug) {
          console.error('[WorkerClientProvider] Failed to wrap Worker:', err);
        }
      }
    };

    setupClient();

    return () => {
      mounted = false;

      if (healthCheckTimer) {
        clearInterval(healthCheckTimer);
      }
    };
  }, [worker, wrapWorker, debug, healthCheckInterval, onClientReady]);

  return { state };
}
