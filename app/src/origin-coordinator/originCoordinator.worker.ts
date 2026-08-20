import { getOriginCoordinatorSourceSha } from '@hierarchidb/origin-coordinator';
import type { OriginCoordinatorServiceWorkerScope } from './OriginCoordinatorServiceWorker.js';
import { OriginCoordinatorServiceWorker } from './OriginCoordinatorServiceWorker.js';

const coordinator = new OriginCoordinatorServiceWorker(
  globalThis as unknown as OriginCoordinatorServiceWorkerScope,
  getOriginCoordinatorSourceSha()
);

coordinator.install();
coordinator.activate();
coordinator.listen();
