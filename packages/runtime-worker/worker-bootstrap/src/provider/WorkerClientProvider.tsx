/**
 * WorkerClientProvider - Second layer that wraps Worker with Comlink
 *
 * This provider takes an initialized Worker and wraps it with Comlink,
 * providing the wrapped client to child components.
 */

import React, { ReactNode, useContext, useEffect, useState } from 'react';
import type { Remote } from 'comlink';

export interface WorkerClientProviderProps<T> {
  /** The initialized Worker instance */
  worker: Worker;
  /** Function to wrap Worker with Comlink */
  wrapWorker: (worker: Worker) => Remote<T> | Promise<Remote<T>>;
  /** Children to render after Comlink wrapping */
  children: ReactNode;
  /** Component to show while wrapping */
  loadingComponent?: ReactNode;
  /** Enable debug logging */
  debug?: boolean;
  /** Health check interval in milliseconds (0 to disable) */
  healthCheckInterval?: number;
  /** Callback when client is ready */
  onClientReady?: (client: Remote<T>) => void;
}

interface ClientState<T> {
  client: Remote<T> | null;
  isReady: boolean;
  isConnected: boolean;
  error: Error | null;
}

export function createWorkerClientProvider<T>() {
  // Create context for the specific Worker type
  const ClientContext = React.createContext<ClientState<T> | null>(null);

  const WorkerClientProvider: React.FC<WorkerClientProviderProps<T>> = ({
                                                                          worker,
                                                                          wrapWorker,
                                                                          children,
                                                                          loadingComponent = <div>Preparing Worker
                                                                            client...</div>,
                                                                          debug = false,
                                                                          healthCheckInterval = 30000,
                                                                          onClientReady,
                                                                        }) => {
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
          // Wrap Worker with Comlink
          const wrappedClient = await wrapWorker(worker);

          if (!mounted) return;

          // Verify connection (assuming the Worker has a ping method)
          if ('ping' in wrappedClient && typeof wrappedClient.ping === 'function') {
            try {
              await (wrappedClient.ping as any)();

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

          // Set up health check if enabled
          if (healthCheckInterval > 0 && 'ping' in wrappedClient) {
            healthCheckTimer = window.setInterval(async () => {
              if (!mounted) return;

              try {
                await (wrappedClient.ping as any)();

                setState(prev => {
                  if (!prev.isConnected) {
                    if (debug) {
                      console.log('[WorkerClientProvider] Connection restored');
                    }
                    return { ...prev, isConnected: true };
                  }
                  return prev;
                });
              } catch (error) {
                setState(prev => {
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

        // Note: We don't terminate the Worker here as it's managed by WorkerSingletonProvider
      };
    }, [worker, wrapWorker, debug, healthCheckInterval, onClientReady]);

    // Show loading while setting up Comlink
    if (!state.isReady && !state.error) {
      return <>{loadingComponent}</>;
    }

    // Show error if Comlink setup failed
    if (state.error) {
      return (
        <div style={{ color: 'red' }}>
          Failed to setup Worker client: {state.error.message}
        </div>
      );
    }

    // Provide client to children
    return (
      <ClientContext.Provider value={state}>
        {children}
      </ClientContext.Provider>
    );
  };

  /**
   * Hook to access the Worker client from context
   */
  const useWorkerClient = (): {
    client: Remote<T>;
    isConnected: boolean;
  } => {
    const state = useContext(ClientContext);
    if (!state) {
      throw new Error('useWorkerClient must be used within WorkerClientProvider');
    }
    if (!state.client) {
      throw new Error('Worker client is not ready');
    }
    return {
      client: state.client,
      isConnected: state.isConnected,
    };
  };

  return {
    WorkerClientProvider,
    useWorkerClient,
  };
}