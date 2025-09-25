import { registerTimelineWorkerStores, loadTimelineEntitiesDbModule } from '../worker-factory/registerTimelineWorkerStores.js';

export { lifecycle } from './lifecycle.js';
export { registerTimelineWorkerStores, loadTimelineEntitiesDbModule };
export type { RegisterTimelineWorkerStoresOptions } from '../worker-factory/registerTimelineWorkerStores.js';

export function register(): void {
  void registerTimelineWorkerStores();
}

export default {
  registerTimelineWorkerStores,
  loadTimelineEntitiesDbModule,
};
