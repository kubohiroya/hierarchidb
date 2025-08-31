import type { NodeType, PluginDefinition } from '@hierarchidb/common-type';

export interface PluginRegistrationResult {
  success: boolean;
  nodeType?: NodeType;
  error?: string;
}

export interface UnregistrationResult {
  success: boolean;
  cleanedUpNodes: number;
  error?: string;
}

export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface PluginHealthStatus {
  healthy: boolean;
  nodeType: NodeType;
  issues?: string[];
}

export interface PluginRegistrationInfo {
  nodeType: NodeType;
  definition: PluginDefinition;
  registeredAt: Date;
}

export interface PluginListOptions {
  includeInactive?: boolean;
  includeMetadata?: boolean;
}

export interface PluginDependencyInfo {
  nodeType: NodeType;
  dependencies: NodeType[];
  dependents: NodeType[];
}

export interface BulkOperationOptions {
  parallel?: boolean;
  stopOnError?: boolean;
}

export interface BulkOperationResult {
  successful: NodeType[];
  failed: Array<{ nodeType: NodeType; error: string }>;
  totalTime: number;
}

export interface PluginManagementAPI {
  register(definition: PluginDefinition): Promise<PluginRegistrationResult>;
  unregister(nodeType: NodeType): Promise<UnregistrationResult>;
  listRegistered(options?: PluginListOptions): Promise<PluginRegistrationInfo[]>;
  validatePlugin(definition: PluginDefinition): Promise<PluginValidationResult>;
  checkHealth(nodeType: NodeType): Promise<PluginHealthStatus>;
  getDependencies(nodeType: NodeType): Promise<PluginDependencyInfo>;
  bulkRegister(definitions: PluginDefinition[], options?: BulkOperationOptions): Promise<BulkOperationResult>;
  bulkUnregister(nodeTypes: NodeType[], options?: BulkOperationOptions): Promise<BulkOperationResult>;
}