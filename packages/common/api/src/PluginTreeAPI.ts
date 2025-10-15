/**
 * @deprecated Use TreePluginAnalyzer instead. This file will be removed in the next major version.
 * @see TreePluginAnalyzer
 *
 * @file PluginTreeAPI.ts
 * @description TreeTypes-specific plugin management facade API
 *
 * Provides a focused interface for retrieving plugin-loader available for specific trees,
 * with type safety and proper filtering capabilities.
 */

import type { NodeType, TreeId } from '@hierarchidb/common-types';
import { NodeCapability } from './plugin-definition.js';

//  : PluginTreeAPI
//  :

export interface TreePluginInfo {
  readonly nodeType: NodeType;
  readonly displayName: string;
  readonly description?: string;
  readonly menuGroup: 'basic' | 'container' | 'document' | 'advanced';
  readonly createOrder: number;
  readonly creatable: boolean;
  readonly isActive: boolean;
  readonly usageCount: number;
  readonly capabilities: NodeCapability[];
  readonly meta: {
    name: string;
    version: string;
    category?: string;
  };
}

export interface GetPluginsForTreeRequest {
  treeId: TreeId;
  includeInactive?: boolean;
  filters?: {
    nodeTypes?: NodeType[];
    categories?: string[];
    capabilities?: NodeCapability[];
  };
  sortBy?: 'usageCount' | 'displayName' | 'createOrder';
  sortOrder?: 'asc' | 'desc';
}

export interface GetPluginsForTreeResponse {
  success: boolean;
  treeId: TreeId;
  plugins: TreePluginInfo[];
  error?: {
    code: string;
    message: string;
  };
}

export interface PluginUsageStats {
  treeId: TreeId;
  nodeType: NodeType;
  totalNodes: number;
  activeNodes: number;
  lastUsed: number;
  period?: {
    from: number;
    to: number;
  };
  operationStats: Array<{
    operation: string;
    count: number;
    timestamp: number;
  }>;
}

export interface CompatibilityResult {
  compatible: boolean;
  conflicts: Array<{
    nodeType1: NodeType;
    nodeType2: NodeType;
    severity: 'error' | 'warning' | 'info';
    description: string;
  }>;
  warnings: string[];
  suggestions?: string[];
}

export interface OptimizationResult {
  treeId: TreeId;
  recommendations: Array<{
    type: 'enable' | 'disable' | 'configure' | 'replace';
    nodeType: NodeType;
    reason: string;
    priority: number;
  }>;
  currentPerformance: {
    score: number;
  };
  expectedImprovement: {
    performanceGain: number;
  };
}

export interface DependencyGraph {
  treeId: TreeId;
  nodes: Array<{
    nodeType: NodeType;
    label: string;
    metrics?: any;
  }>;
  edges: Array<{
    from: NodeType;
    to: NodeType;
    type: string;
  }>;
  metadata: {
    totalPlugins: number;
    hasCycles: boolean;
  };
  layout?: string;
  groups?: any;
  warnings?: string[];
  cyclicPaths?: NodeType[][];
}

export interface PluginMetrics {
  treeId: TreeId;
  nodeType: NodeType;
  performance: {
    averageResponseTime: number;
    throughput: number;
    errorRate: number;
  };
  resourceUsage: {
    memoryMB: number;
  };
  history?: Array<{
    timestamp: number;
    averageResponseTime: number;
    throughput: number;
    errorRate: number;
  }>;
}

export interface TimePeriod {
  from: number;
  to: number;
}

export interface GraphOptions {
  layout?: 'hierarchical' | 'force' | 'circular';
  groupByCategory?: boolean;
  includeMetrics?: boolean;
}

export interface MetricOptions {
  timeRange?: {
    start: number;
    end: number;
  };
}

/**
 * TreeTypes-specific plugin management API
 *
 * Provides comprehensive plugin analysis and optimization for specific trees.
 *
 * @example
 * ```typescript
 * const pluginTreeAPI = workerAPI.getPluginTreeAPI();
 *
 * // Get plugin-loader for a tree
 * const response = await pluginTreeAPI.getPluginsForTree({
 *   treeId: 'my-tree-123' as TreeId
 * });
 * ```
 */
/**
 * @deprecated Use TreePluginAnalyzer instead
 */
export interface PluginTreeAPI {
  /**
      * :
   * :
   * :
      */
  getPluginsForTree(request: GetPluginsForTreeRequest): Promise<GetPluginsForTreeResponse>;

  /**
      * :
   * :
   * :
      */
  getPluginUsageStats(
    treeId: TreeId,
    nodeType: NodeType,
    period?: TimePeriod,
  ): Promise<PluginUsageStats>;

  /**
      * :
   * :
   * :
      */
  getPluginCompatibility(treeId: TreeId, nodeTypes: NodeType[]): Promise<CompatibilityResult>;

  /**
      * :
   * :
   * :
      */
  optimizePluginConfiguration(treeId: TreeId): Promise<OptimizationResult>;

  /**
      * :
   * :
   * :
      */
  getPluginDependencyGraph(treeId: TreeId, options?: GraphOptions): Promise<DependencyGraph>;

  /**
      * :
   * :
   * :
      */
  getPluginMetrics(
    treeId: TreeId,
    nodeType: NodeType,
    options?: MetricOptions,
  ): Promise<PluginMetrics>;
}
