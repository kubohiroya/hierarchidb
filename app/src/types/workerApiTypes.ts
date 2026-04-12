import type { TreeNodeData } from '@hierarchidb/tree-api';
import type { BuildWorkerAPI as BuildWorkerAPIBase } from '@hierarchidb/worker-api';

export type BuildWorkerAPI = BuildWorkerAPIBase<TreeNodeData>;
