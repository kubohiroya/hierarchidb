/**
 * DualLayerWorkerProvider - Combined two-layer Worker initialization system
 *
 * This component combines WorkerSingletonProvider and WorkerClientProvider to provide
 * a complete Worker initialization and Comlink wrapping solution with
 * lazy singleton initialization support.
 */

import type { InitializationResult } from '@hierarchidb/ui-worker-client';
import type { Remote } from 'comlink';
import React, { type ReactNode } from 'react';
import { createWorkerClientProvider } from './WorkerClientProvider.js';
import { useWorkerProviderView } from './useWorkerProviderView.js';

export interface WorkerProviderProps<T> {
  createWorker: () => Worker;
  wrapWorker: (worker: Worker) => Remote<T> | Promise<Remote<T>>;
  children: ReactNode;
  loadingWorkerComponent?: ReactNode;
  loadingClientComponent?: ReactNode;
  errorWorkerComponent?: (error: Error) => ReactNode;
  workerTimeout?: number;
  healthCheckInterval?: number;
  debug?: boolean;
  onWorkerInitialized?: (worker: Worker, result: InitializationResult) => void;
  onClientReady?: (client: Remote<T>) => void;
}

export function createWorkerProvider<T>() {
  const { WorkerClientProvider, useWorker } = createWorkerClientProvider<T>();

  const WorkerProvider: React.FC<WorkerProviderProps<T>> = ({
    createWorker,
    wrapWorker,
    children,
    loadingWorkerComponent = <div>Initializing Worker...</div>,
    loadingClientComponent = <div>Setting up Worker client...</div>,
    healthCheckInterval = 30000,
    debug = false,
    onClientReady,
  }) => {
    const { worker } = useWorkerProviderView({ createWorker });

    if (!worker) {
      return <>{loadingWorkerComponent}</>;
    }

    return (
      <WorkerClientProvider
        worker={worker}
        wrapWorker={wrapWorker}
        loadingComponent={loadingClientComponent}
        debug={debug}
        healthCheckInterval={healthCheckInterval}
        onClientReady={onClientReady}
      >
        {children}
      </WorkerClientProvider>
    );
  };

  return {
    DualLayerWorkerProvider: WorkerProvider,
    useWorker,
  };
}
