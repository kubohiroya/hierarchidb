// Test-only worker entry that exposes WorkerService over a MessagePort/Comlink endpoint.
// Runs in the same process for simplicity; fake-indexeddb provides IndexedDB in Node.
import 'fake-indexeddb/auto';
import * as Comlink from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { WorkerService } from '../index';

async function main(endpoint?: Comlink.Endpoint) {
  const svc = await WorkerService.getSingleton([]);
  // No per-API facades; return Comlink proxies of service instances directly

  const api: WorkerAPI = {
    ping: () => svc.ping(),
    getQueryAPI: () => Comlink.proxy(svc.getQueryAPI()),
    getMutationAPI: () => Comlink.proxy(svc.getMutationAPI()),
    getSubscriptionAPI: () => Comlink.proxy(svc.getSubscriptionAPI()),
    getWorkingCopyAPI: () => Comlink.proxy(svc.getWorkingCopyAPI()),
  };
  // When used in-process via MessageChannel, a test passes an explicit endpoint.
  // If no endpoint is provided (real worker case), expose on self.
  if (endpoint) {
    Comlink.expose<WorkerAPI>(api, endpoint);
  } else {
    Comlink.expose<WorkerAPI>(api);
  }
}

// Allow direct import/execute in tests
export { main as exposeTestAPI };
