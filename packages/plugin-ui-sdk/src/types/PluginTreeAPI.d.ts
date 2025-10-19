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
     * Retrieve plugins that can operate on the specified tree.
     * @param request - Request payload describing target tree and optional filters.
     * @returns Plugin metadata and capability information for the requested tree.
     */
    getPluginsForTree(request: GetPluginsForTreeRequest): Promise<GetPluginsForTreeResponse>;
    /**
     * Fetch usage statistics for a plugin in a tree.
     * @param treeId - Identifier of the tree to analyse.
     * @param nodeType - Node type whose usage should be reported.
     * @param period - Optional time period to constrain the statistics.
     * @returns Aggregated usage information for the specified plugin.
     */
    getPluginUsageStats(treeId: TreeId, nodeType: NodeType, period?: TimePeriod): Promise<PluginUsageStats>;
    /**
     * Evaluate compatibility for a collection of plugins.
     * @param treeId - Identifier of the tree whose configuration is being checked.
     * @param nodeTypes - Node types to include in the compatibility analysis.
     * @returns Detected conflicts, warnings, and remediation suggestions.
     */
    getPluginCompatibility(treeId: TreeId, nodeTypes: NodeType[]): Promise<CompatibilityResult>;
    /**
     * Produce optimization recommendations for a tree's plugin configuration.
     * @param treeId - Identifier of the tree to analyse.
     * @returns Recommended actions and the expected improvement metrics.
     */
    optimizePluginConfiguration(treeId: TreeId): Promise<OptimizationResult>;
    /**
     * Construct a dependency graph between plugins associated with a tree.
     * @param treeId - Identifier of the tree whose dependencies should be graphed.
     * @param options - Graph rendering options including layout and metric flags.
     * @returns Structured dependency data suitable for visualisation.
     */
    getPluginDependencyGraph(treeId: TreeId, options?: GraphOptions): Promise<DependencyGraph>;
    /**
     * Retrieve performance metrics for a plugin instance within a tree.
     * @param treeId - Identifier of the tree hosting the plugin.
     * @param nodeType - Plugin node type being measured.
     * @param options - Optional time range used to scope metrics.
     * @returns Performance snapshots and trend information.
     */
    getPluginMetrics(treeId: TreeId, nodeType: NodeType, options?: MetricOptions): Promise<PluginMetrics>;
}
//# sourceMappingURL=PluginTreeAPI.d.ts.map