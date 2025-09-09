/**
 * WorkerSingletonProvider - Manages Worker initialization and startup
 *
 * This provider ensures the Worker process is started and initialized
 * before rendering child components. It handles the initial Worker creation
 * and verification that the Worker-side initialization is complete.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { WorkerInitializationChannel } from '../WorkerInitializationChannel';

interface WorkerState {
  client: any; // Generic worker client type
  isReady: boolean;
  error: Error | null;
  progress: number;
  message: string;
}

interface WorkerProviderProps {
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ComponentType<{ error: Error }>;
  getWorkerClient: () => Promise<any>;
  getRawWorker: () => Worker | null;
}

const WorkerContext = createContext<WorkerState | null>(null);

export const WorkerSingletonProvider: React.FC<WorkerProviderProps> = ({
                                                                         children,
                                                                         loadingComponent,
                                                                         errorComponent: ErrorComponent,
                                                                         getWorkerClient,
                                                                         getRawWorker,
                                                                       }) => {
  const [state, setState] = useState<WorkerState>({
    client: null,
    isReady: false,
    error: null,
    progress: 0,
    message: 'Initializing...',
  });

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000;

    const initializeWorker = async () => {
      while (retryCount < maxRetries && mounted) {
        try {
          // Get the Worker client
          const client = await getWorkerClient();

          // Get the raw Worker instance for initialization detection
          const workerInstance = getRawWorker();
          if (!workerInstance) {
            throw new Error('Raw Worker instance not accessible');
          }

          const initChannel = new WorkerInitializationChannel();

          // Wait for Worker-side initialization to complete
          const initResult = await initChannel.waitForInitialization({
            worker: workerInstance,
            timeout: 10000,
            debug: false,
          });

          if (!initResult.success) {
            const errorMessage = typeof initResult.error === 'string'
              ? initResult.error
              : initResult.error instanceof Error
                ? initResult.error.message
                : 'Worker initialization failed';
            throw new Error(errorMessage);
          }

          // Now verify Comlink communication is working
          try {
            await client.ping();
          } catch (verifyError) {
            console.error('[WorkerProvider] Comlink verification failed:', verifyError);
            throw new Error(`Comlink verification failed: ${verifyError}`);
          }

          if (mounted) {
            setState({
              client,
              isReady: true,
              error: null,
              progress: 100,
              message: 'Ready',
            });
          }
          return;
        } catch (error) {
          retryCount++;
          console.error(`[WorkerProvider] Failed to initialize Worker (attempt ${retryCount}/${maxRetries}):`, error);

          if (retryCount >= maxRetries) {
            if (mounted) {
              setState({
                client: null,
                isReady: false,
                error: error instanceof Error ? error : new Error('Failed to initialize Worker'),
                progress: 0,
                message: 'Failed to initialize',
              });
            }
            return;
          }

          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    };

    initializeWorker();

    return () => {
      mounted = false;
    };
  }, [getWorkerClient, getRawWorker]);

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
  return (
    <WorkerContext.Provider value={state}>
      {children}
    </WorkerContext.Provider>
  );
};

export const useWorker = () => {
  const context = useContext(WorkerContext);
  if (!context) {
    throw new Error('useWorker must be used within WorkerSingletonProvider');
  }
  return context;
};