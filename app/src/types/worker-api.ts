import type { TreeNodeData } from '@hierarchidb/tree-api';
import type {
  BuildWorkerAPI as BuildWorkerAPIBase,
  WorkerAPI as WorkerAPIBase,
} from '@hierarchidb/worker-api';

export type BuildWorkerAPI = BuildWorkerAPIBase<TreeNodeData>;
/** @deprecated Use BuildWorkerAPI. */
export type WorkerAPI = WorkerAPIBase<TreeNodeData>;
