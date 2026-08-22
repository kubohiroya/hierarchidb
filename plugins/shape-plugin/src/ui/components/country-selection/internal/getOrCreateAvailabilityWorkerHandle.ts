import {
  assertOriginCoordinatorOwnedClientCreationAllowed,
  registerOriginCoordinatorOwnedClientHandle,
} from '@hierarchidb/origin-coordinator';
import { createAuthSessionStorageBridge } from '@hierarchidb/ui-auth';
import { proxy, wrap } from 'comlink';
import type { CountryAvailabilityWorkerAPI } from '~/ui/workers/countryAvailabilityTypes';

export const AVAILABILITY_WORKER_INITIALIZATION_TIMEOUT_MS = 15_000;

// availability is loaded in a dedicated worker thread
const createAvailabilityWorker = (): Worker => {
  try {
    return new Worker(new URL('../../../workers/countryAvailability.worker', import.meta.url), {
      type: 'module',
    });
  } catch {
    throw new Error('Country availability worker construction failed.');
  }
};

export type AvailabilityWorkerHandle = {
  worker: Worker;
  api: ReturnType<typeof wrap<CountryAvailabilityWorkerAPI>>;
  bridgeReady: Promise<void>;
};

let sharedAvailabilityWorkerHandle: AvailabilityWorkerHandle | null = null;

function initializeAvailabilityWorkerBridge(
  worker: Worker,
  api: AvailabilityWorkerHandle['api']
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = (error: Error | null): void => {
      if (settled) return;
      settled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
      worker.removeEventListener('error', onWorkerError);
      worker.removeEventListener('messageerror', onWorkerMessageError);
      if (error === null) {
        resolve();
      } else {
        reject(error);
      }
    };
    const onWorkerError = (): void => {
      finish(new Error('Country availability worker failed to initialize.'));
    };
    const onWorkerMessageError = (): void => {
      finish(
        new Error('Country availability worker message channel failed during initialization.')
      );
    };

    worker.addEventListener('error', onWorkerError);
    worker.addEventListener('messageerror', onWorkerMessageError);
    timeoutId = setTimeout(() => {
      finish(
        new Error(
          `Country availability worker bridge initialization timed out after ${AVAILABILITY_WORKER_INITIALIZATION_TIMEOUT_MS}ms.`
        )
      );
    }, AVAILABILITY_WORKER_INITIALIZATION_TIMEOUT_MS);

    void Promise.resolve()
      .then(() => api.setUiStorageBridge(proxy(createAuthSessionStorageBridge())))
      .then(
        () => finish(null),
        () =>
          finish(new Error('Country availability worker UI storage bridge initialization failed.'))
      );
  });
}

export const getOrCreateAvailabilityWorkerHandle = (): AvailabilityWorkerHandle => {
  assertOriginCoordinatorOwnedClientCreationAllowed();
  if (sharedAvailabilityWorkerHandle) return sharedAvailabilityWorkerHandle;
  const worker = createAvailabilityWorker();
  let unregisterOwnedClientHandle: () => void;
  try {
    unregisterOwnedClientHandle = registerOriginCoordinatorOwnedClientHandle({
      close: () => worker.terminate(),
    });
  } catch (error) {
    worker.terminate();
    throw error;
  }
  let api: AvailabilityWorkerHandle['api'];
  try {
    api = wrap<CountryAvailabilityWorkerAPI>(worker);
  } catch {
    unregisterOwnedClientHandle();
    worker.terminate();
    throw new Error('Country availability worker client setup failed.');
  }
  const bridgeReady = initializeAvailabilityWorkerBridge(worker, api).catch((error: unknown) => {
    if (sharedAvailabilityWorkerHandle?.worker === worker) {
      sharedAvailabilityWorkerHandle = null;
    }
    unregisterOwnedClientHandle();
    worker.terminate();
    throw error;
  });
  sharedAvailabilityWorkerHandle = {
    worker,
    api,
    bridgeReady,
  };
  return sharedAvailabilityWorkerHandle;
};
