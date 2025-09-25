// Test-only worker entry that exposes WorkerService over a MessagePort/Comlink endpoint.
// Runs in the same process for simplicity; fake-indexeddb provides IndexedDB in Node.
import 'fake-indexeddb/auto';
import {proxy, expose, Remote} from 'comlink';
import { WorkerService } from '../index.js';
import { DialogStateAPI, ImportExportAPI, TreeMutationAPI, TreeQueryAPI, TreeSubscriptionAPI, WorkingCopyAPI } from '@hierarchidb/common-api';
import { CommandProcessor } from '../services/CommandProcessor.js';

type Endpoint = MessagePort | Worker;

async function main(endpoint?: Endpoint): Promise<void> {
  const svc = await WorkerService.getSingleton([]);
  // No per-API facades; return Comlink proxies of service instances directly

  const api = {
    ping: (): {response: string, timestamp: number} => svc.ping(),
    getQueryAPI: (): TreeQueryAPI  => proxy(svc.getQueryAPI()),
    getMutationAPI: (): TreeMutationAPI => proxy(svc.getMutationAPI()),
    getSubscriptionAPI: (): TreeSubscriptionAPI => proxy(svc.getSubscriptionAPI()),
    getImportExportAPI: (): ImportExportAPI => proxy(svc.getImportExportAPI()),
    getWorkingCopyAPI: (): WorkingCopyAPI => proxy(svc.getWorkingCopyAPI()),
    getDialogStateAPI: (): DialogStateAPI => proxy(svc.getDialogStateAPI()),
    getCommandProcessor: (): CommandProcessor => proxy(svc.getCommandProcessor()),
  };
  // When used in-process via MessageChannel, a test passes an explicit endpoint.
  // If no endpoint is provided (real worker case), expose on self.
  if (endpoint) {
    expose(api, endpoint);
  } else {
    expose(api);
  }
}

// Allow direct import/execute in tests
export { main as exposeTestAPI };
