import type { NodeType } from '@hierarchidb/core-types';

export type PluginLifecycleError = {
  code: string;
  message: string;
};

export type PluginLifecycleResult = {
  success: boolean;
  error?: PluginLifecycleError;
};

export type PluginLifecycleValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

export type PluginLifecycleHealthReport = {
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: number;
  issues: string[];
  performance: {
    avgResponseTime: number;
    errorRate: number;
  };
};

export type PluginDependencyReport = {
  nodeType: NodeType;
  dependencies: NodeType[];
  dependents: NodeType[];
  circularDependencies: boolean;
};

export type PluginBulkOperationSummary = {
  total: number;
  success: number;
  failed: number;
};

export type PluginBulkOperationResult = {
  successful: NodeType[];
  failed: Array<{ nodeType: NodeType; error: PluginLifecycleError }>;
  summary: PluginBulkOperationSummary;
};

export type PluginResetOptions = {
  nodeType: NodeType;
  deleteData?: boolean;
  deleteDrafts?: boolean;
};

export type PluginResetResult = {
  success: boolean;
  nodeType: NodeType;
  deletedEntities: Record<string, unknown>;
  error?: PluginLifecycleError;
};

export type PluginDeleteResult = {
  success: boolean;
  nodeType: NodeType;
  error?: PluginLifecycleError;
};

export interface PluginLifecycleAPI {
  register(): Promise<PluginLifecycleResult>;
  unregister(): Promise<PluginLifecycleResult>;
  validatePlugin(): Promise<PluginLifecycleValidationResult>;
  checkHealth(): Promise<PluginLifecycleHealthReport>;
  listRegistered(): Promise<NodeType[]>;
  getDependencies(nodeType: NodeType): Promise<PluginDependencyReport>;
  bulkOperation(): Promise<PluginBulkOperationResult>;
  resetPlugin(options: PluginResetOptions): Promise<PluginResetResult>;
  deletePlugin(nodeType: NodeType): Promise<PluginDeleteResult>;
  resetSystem(): Promise<PluginResetResult>;
}
