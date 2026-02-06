import type { TreeNodeData } from '@hierarchidb/tree-api';
import type { WorkerAPI as WorkerAPIBase } from '@hierarchidb/worker-api';

export type WorkerAPI = WorkerAPIBase<TreeNodeData>;
