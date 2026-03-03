/**
 * WorkerClientProvider - Second layer that wraps Worker with Comlink
 *
 * This provider takes an initialized Worker and wraps it with Comlink,
 * providing the wrapped client to child components.
 */

import type { Remote } from 'comlink';
import React, { type ReactNode, useContext } from 'react';
import { useWorkerClientProviderView } from './useWorkerClientProviderView.js';

export interface WorkerClientProviderProps<T> {
  worker: Worker;
  wrapWorker: (worker: Worker) => Remote<T> | Promise<Remote<T>>;
  children: ReactNode;
  loadingComponent?: ReactNode;
  debug?: boolean;
  healthCheckInterval?: number;
  onClientReady?: (client: Remote<T>) => void;
}

interface ClientState<T> {
  client: Remote<T> | null;
  isReady: boolean;
  isConnected: boolean;
  error: Error | null;
}

export function createWorkerClientProvider<T>() {
  const ClientContext = React.createContext<ClientState<T> | null>(null);

  const WorkerClientProvider: React.FC<WorkerClientProviderProps<T>> = ({
    worker,
    wrapWorker,
    children,
    loadingComponent = <div>Preparing Worker client...</div>,
    debug = false,
    healthCheckInterval = 30000,
    onClientReady,
  }) => {
    const { state } = useWorkerClientProviderView({
      worker,
      wrapWorker,
      debug,
      healthCheckInterval,
      onClientReady,
    });

    if (!state.isReady && !state.error) {
      return <>{loadingComponent}</>;
    }

    if (state.error) {
      return (
        <div style={{ color: 'red' }}>Failed to setup Worker client: {state.error.message}</div>
      );
    }

    return <ClientContext.Provider value={state}>{children}</ClientContext.Provider>;
  };

  const useWorker = (): {
    client: Remote<T>;
    isConnected: boolean;
  } => {
    const state = useContext(ClientContext);
    if (!state) {
      throw new Error('useWorker must be used within WorkerClientProvider');
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
    useWorker,
  };
}
