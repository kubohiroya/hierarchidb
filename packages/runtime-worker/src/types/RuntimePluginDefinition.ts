import type { NodeType } from '@hierarchidb/core-types';
import type { NodeLifecycleHooks } from '../services/lifecycle-types.js';

export type RuntimePluginDefinition = {
  nodeType: NodeType | string;
  name: string;
  displayName: string;
  dependencies: string[];
  priority: number;
  version: string;
  lifecycle?: NodeLifecycleHooks;
  packageName?: string;
  description?: string;
};
