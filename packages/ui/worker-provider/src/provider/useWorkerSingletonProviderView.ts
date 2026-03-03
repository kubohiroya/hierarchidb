import { useEffect, useState } from 'react';
import { WorkerInitializationChannel } from '@hierarchidb/ui-worker-client';
import type { WorkerAPI } from '@hierarchidb/worker-api';

type WorkerClient = WorkerAPI<Record<string, unknown>>;

export interface WorkerSingletonProviderState {
  client: WorkerClient | null;
  isReady: boolean;
  error: Error | null;
  progress: number;
  message: string;
}

export interface UseWorkerSingletonProviderViewParams {
  getWorkerClient: () => Promise<WorkerClient>;
  getRawWorker: () => Worker | MessagePort | null;
}

export interface UseWorkerSingletonProviderViewResult {
  state: WorkerSingletonProviderState;
}

const INITIAL_STATE: WorkerSingletonProviderState = {
  client: null,
  isReady: false,
  error: null,
  progress: 0,
  message: 'Initializing...',
};

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function useWorkerSingletonProviderView({
  getWorkerClient,
  getRawWorker,
}: UseWorkerSingletonProviderViewParams): UseWorkerSingletonProviderViewResult {
  const [state, setState] = useState<WorkerSingletonProviderState>(INITIAL_STATE);

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelayMs = 1000;

    const initializeWorker = async () => {
      while (retryCount < maxRetries && mounted) {
        try {
          const client = await getWorkerClient();
          const workerInstance = getRawWorker();
          if (!workerInstance) {
            throw new Error('Raw Worker instance not accessible');
          }

          const initChannel = new WorkerInitializationChannel();
          const initResult = await initChannel.waitForInitialization({
            worker: workerInstance,
            timeout: 10000,
            debug: false,
          });

          if (!initResult.success) {
            const errorMessage =
              typeof initResult.error === 'string'
                ? initResult.error
                : initResult.error instanceof Error
                  ? initResult.error.message
                  : 'Worker initialization failed';
            throw new Error(errorMessage);
          }

          const pingable = client as WorkerClient & { ping?: () => Promise<unknown> };
          if (typeof pingable.ping === 'function') {
            await pingable.ping();
          }

          if (!mounted) return;

          setState({
            client,
            isReady: true,
            error: null,
            progress: 100,
            message: 'Ready',
          });
          return;
        } catch (error) {
          retryCount += 1;

          if (retryCount >= maxRetries) {
            if (!mounted) return;
            setState({
              client: null,
              isReady: false,
              error: error instanceof Error ? error : new Error('Failed to initialize Worker'),
              progress: 0,
              message: 'Failed to initialize',
            });
            return;
          }

          await sleep(retryDelayMs);
        }
      }
    };

    void initializeWorker();

    return () => {
      mounted = false;
    };
  }, [getRawWorker, getWorkerClient]);

  return {
    state,
  };
}
