import type { TreeId, NodeType } from '@hierarchidb/common-type';

export interface TreePluginInfo {
  nodeType: NodeType;
  nodeCount: number;
  isActive: boolean;
  lastUsed?: Date;
}

export interface GetPluginsForTreeRequest {
  treeId: TreeId;
  includeInactive?: boolean;
}

export interface GetPluginsForTreeResponse {
  treeId: TreeId;
  plugins: TreePluginInfo[];
  totalNodes: number;
}

export interface PluginUsageStats {
  nodeType: NodeType;
  usageCount: number;
  lastUsed: Date;
  averagePerformance?: number;
}

export interface CompatibilityResult {
  compatible: boolean;
  conflicts?: Array<{ nodeType: NodeType; reason: string }>;
}

export interface OptimizationResult {
  optimized: boolean;
  suggestedOrder?: NodeType[];
  performanceGain?: number;
}

export interface DependencyGraph {
  nodes: Array<{ nodeType: NodeType; level: number }>;
  edges: Array<{ from: NodeType; to: NodeType }>;
}

export interface PluginMetrics {
  nodeType: NodeType;
  performance: number;
  memoryUsage: number;
  errorRate: number;
}

export type TimePeriod = 'hour' | 'day' | 'week' | 'month';

export interface GraphOptions {
  includeInactive?: boolean;
  maxDepth?: number;
}

export interface MetricOptions {
  period: TimePeriod;
  aggregation?: 'average' | 'sum' | 'max' | 'min';
}

export interface TreePluginAnalyzer {
  getPluginsForTree(request: GetPluginsForTreeRequest): Promise<GetPluginsForTreeResponse>;
  analyzeUsage(treeId: TreeId): Promise<PluginUsageStats[]>;
  checkCompatibility(treeId: TreeId, nodeType: NodeType): Promise<CompatibilityResult>;
  optimizePluginOrder(treeId: TreeId): Promise<OptimizationResult>;
  getDependencyGraph(treeId: TreeId, options?: GraphOptions): Promise<DependencyGraph>;
  getMetrics(treeId: TreeId, options?: MetricOptions): Promise<PluginMetrics[]>;
}