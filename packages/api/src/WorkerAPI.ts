import type { TreeObservableService } from './TreeObservableService';
import type { TreeMutationService } from './TreeMutationService';
import type { TreeQueryService } from './TreeQueryService';

export interface WorkerAPI extends TreeObservableService, TreeMutationService, TreeQueryService {
  initialize(): Promise<void>;

  dispose(): void;
}
