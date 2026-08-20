import type { OriginCoordinatorServiceWorkerScope } from './OriginCoordinatorServiceWorker.js';
import { OriginCoordinatorServiceWorker } from './OriginCoordinatorServiceWorker.js';

const coordinator = new OriginCoordinatorServiceWorker(
  globalThis as unknown as OriginCoordinatorServiceWorkerScope
);

coordinator.install();
coordinator.activate();
coordinator.listen();
