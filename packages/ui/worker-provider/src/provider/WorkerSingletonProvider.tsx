/**
 * WorkerSingletonProvider - Manages Worker initialization and startup
 *
 * This provider ensures the Worker process is started and initialized
 * before rendering child components. It handles the initial Worker creation
 * and verification that the Worker-side initialization is complete.
 */

import type { WorkerAPI } from '@hierarchidb/worker-api';
import type React from 'react';
import { createContext, useContext } from 'react';
import {
  useWorkerSingletonProviderView,
  type WorkerSingletonProviderState as WorkerState,
} from './useWorkerSingletonProviderView.js';

type WorkerClient = WorkerAPI<Record<string, unknown>>;

interface WorkerProviderProps {
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ComponentType<{ error: Error }>;
  getWorkerClient: () => Promise<WorkerClient>;
  getRawWorker: () => Worker | MessagePort | null;
}

const WorkerContext = createContext<WorkerState | null>(null);

export const WorkerSingletonProvider: React.FC<WorkerProviderProps> = ({
  children,
  loadingComponent,
  errorComponent: ErrorComponent,
  getWorkerClient,
  getRawWorker,
}) => {
  const { state } = useWorkerSingletonProviderView({
    getWorkerClient,
    getRawWorker,
  });

  // Show loading screen while initializing
  if (!state.isReady && !state.error) {
    return <>{loadingComponent || <div>Loading... {state.progress}%</div>}</>;
  }

  // Show error screen if initialization failed
  if (state.error) {
    if (ErrorComponent) {
      return <ErrorComponent error={state.error} />;
    }
    return <div>Error: {state.error.message}</div>;
  }

  // Worker is ready
  return <WorkerContext.Provider value={state}>{children}</WorkerContext.Provider>;
};

export const useWorker = () => {
  const context = useContext(WorkerContext);
  if (!context) {
    throw new Error('useWorker must be used within WorkerSingletonProvider');
  }
  return context;
};
