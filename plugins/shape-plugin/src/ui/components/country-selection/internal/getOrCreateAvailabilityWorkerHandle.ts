import {
  assertOriginCoordinatorOwnedClientCreationAllowed,
  registerOriginCoordinatorOwnedClientHandle,
} from '@hierarchidb/origin-coordinator';
import { createAuthSessionStorageBridge } from '@hierarchidb/ui-auth';
import { proxy, wrap } from 'comlink';
import type { CountryAvailabilityWorkerAPI } from '~/ui/workers/countryAvailabilityTypes';

// availability is loaded in a dedicated worker thread
const createAvailabilityWorker = () =>
  new Worker(new URL('../../../workers/countryAvailability.worker', import.meta.url), {
    type: 'module',
  });

export type AvailabilityWorkerHandle = {
  worker: Worker;
  api: ReturnType<typeof wrap<CountryAvailabilityWorkerAPI>>;
  bridgeReady: Promise<void>;
};

let sharedAvailabilityWorkerHandle: AvailabilityWorkerHandle | null = null;

export const getOrCreateAvailabilityWorkerHandle = (): AvailabilityWorkerHandle => {
  assertOriginCoordinatorOwnedClientCreationAllowed();
  if (sharedAvailabilityWorkerHandle) return sharedAvailabilityWorkerHandle;
  const worker = createAvailabilityWorker();
  registerOriginCoordinatorOwnedClientHandle({ close: () => worker.terminate() });
  const api = wrap<CountryAvailabilityWorkerAPI>(worker);
  const bridgeReady = api.setUiStorageBridge(proxy(createAuthSessionStorageBridge()));
  sharedAvailabilityWorkerHandle = {
    worker,
    api,
    bridgeReady,
  };
  return sharedAvailabilityWorkerHandle;
};
