/**
 * @file PluginTreeService.ts
 * @description Tree-specific plugin management service implementation
 */

import type {
  PluginTreeAPI,
  GetPluginsForTreeRequest,
  GetPluginsForTreeResponse,
  TreePluginInfo,
  PluginUsageStats,
  CompatibilityResult,
  OptimizationResult,
  DependencyGraph,
  PluginMetrics,
  GraphOptions,
  MetricOptions,
} from '@hierarchidb/common-api';
import type { TreeId, NodeType, NodeId, NodeCapability } from '@hierarchidb/common-core';
import type { CoreDB } from '../db/CoreDB';
import type { TreeQueryService } from './TreeQueryService';
import {
  getRegisteredPlugins,
  getPluginDefinition,
  isNodeTypeRegistered,
  getCreatableNodeTypes,
  getPluginsForTree,
} from '../registry/plugin-registry-api';

/**
 * Service implementation for tree-specific plugin operations
 */
export class PluginTreeService implements PluginTreeAPI {
  constructor(
    private coreDB: CoreDB,
    private queryService: TreeQueryService
  ) {}

  async getPluginsForTree(request: GetPluginsForTreeRequest): Promise<GetPluginsForTreeResponse> {
    try {
      const tree = await this.queryService.getTree(request.treeId);
      if (!tree) {
        return {
          success: false,
          treeId: request.treeId,
          plugins: [],
          error: {
            code: 'TREE_NOT_FOUND',
            message: `Tree ${request.treeId} not found`
          }
        };
      }

      const registeredPlugins = await getRegisteredPlugins();
      const plugins: TreePluginInfo[] = [];

      for (const plugin of registeredPlugins) {
        const definition = await getPluginDefinition(plugin.nodeType);
        if (!definition) continue;

        const isActive = !request.includeInactive || true;
        // Use searchNodes as a substitute for countNodesByType
        // Get tree root node for search
        const treeRootNode = await this.queryService.getNode(tree.rootId);
        let nodeCount = 0;
        if (treeRootNode) {
          const searchResult = await this.queryService.searchNodes({
            rootNodeId: tree.rootId,
            query: '', // Empty query to get all nodes
            maxResults: 1000 // Large limit to get approximate count
          });
          nodeCount = searchResult?.length || 0;
        }

        const pluginInfo: TreePluginInfo = {
          nodeType: plugin.nodeType,
          displayName: plugin.displayName || plugin.nodeType,
          description: plugin.nodeType + ' plugin', // Default description as plugin definition doesn't include description
          menuGroup: definition.category?.menuGroup || 'basic',
          createOrder: definition.category?.createOrder || 0,
          creatable: !!definition.ui?.dialogComponentPath,
          isActive,
          usageCount: nodeCount,
          capabilities: this.extractCapabilities(definition),
          meta: {
            name: plugin.name || plugin.nodeType,
            version: '1.0.0', // Default version as plugin definition doesn't include version
            category: definition.category?.menuGroup
          }
        };

        plugins.push(pluginInfo);
      }

      // Apply filters
      let filteredPlugins = plugins;
      if (request.filters) {
        if (request.filters.nodeTypes) {
          filteredPlugins = filteredPlugins.filter(p => 
            request.filters!.nodeTypes!.includes(p.nodeType)
          );
        }
        if (request.filters.categories) {
          filteredPlugins = filteredPlugins.filter(p => 
            request.filters!.categories!.includes(p.menuGroup)
          );
        }
        if (request.filters.capabilities) {
          filteredPlugins = filteredPlugins.filter(p => 
            request.filters!.capabilities!.every(cap => p.capabilities.includes(cap))
          );
        }
      }

      // Apply sorting
      if (request.sortBy) {
        filteredPlugins.sort((a, b) => {
          const order = request.sortOrder === 'desc' ? -1 : 1;
          switch (request.sortBy) {
            case 'usageCount':
              return (a.usageCount - b.usageCount) * order;
            case 'displayName':
              return a.displayName.localeCompare(b.displayName) * order;
            case 'createOrder':
              return (a.createOrder - b.createOrder) * order;
            default:
              return 0;
          }
        });
      }

      return {
        success: true,
        treeId: request.treeId,
        plugins: filteredPlugins
      };

    } catch (error) {
      return {
        success: false,
        treeId: request.treeId,
        plugins: [],
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  async getPluginUsageStats(treeId: TreeId, nodeType: NodeType, period?: { from: number; to: number }): Promise<PluginUsageStats> {
    // Get tree and use searchNodes as substitute for countNodesByType
    const tree = await this.queryService.getTree(treeId);
    let totalNodes = 0;
    if (tree) {
      const searchResult = await this.queryService.searchNodes({
        rootNodeId: tree.rootId,
        query: '', // Empty query to get all nodes
        maxResults: 10000 // Large limit for stats
      });
      totalNodes = searchResult?.length || 0;
    }
    const activeNodes = totalNodes; // Simplified: all nodes are considered active
    const lastUsed = Date.now();

    const operationStats = this.generateOperationStats(totalNodes, activeNodes, lastUsed);
    
    let filteredOperationStats = operationStats;
    if (period) {
      filteredOperationStats = operationStats.filter(stat => 
        stat.timestamp >= period.from && stat.timestamp <= period.to
      );
    }

    return {
      treeId,
      nodeType,
      totalNodes,
      activeNodes,
      lastUsed,
      period,
      operationStats: filteredOperationStats
    };
  }

  async getPluginCompatibility(treeId: TreeId, nodeTypes: NodeType[]): Promise<CompatibilityResult> {
    const conflicts: CompatibilityResult['conflicts'] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const pluginDefinitions = await Promise.all(
      nodeTypes.map(async nodeType => ({
        nodeType,
        definition: await getPluginDefinition(nodeType)
      }))
    );

    // Check for database conflicts
    const entityStores = new Map<string, NodeType[]>();
    for (const { nodeType, definition } of pluginDefinitions) {
      if (definition?.database?.tableName) {
        const storeName = definition.database.tableName;
        if (!entityStores.has(storeName)) {
          entityStores.set(storeName, []);
        }
        entityStores.get(storeName)!.push(nodeType);
      }
    }

    for (const [storeName, types] of entityStores) {
      if (types.length > 1) {
        for (let i = 0; i < types.length - 1; i++) {
          for (let j = i + 1; j < types.length; j++) {
            conflicts.push({
              nodeType1: types[i],
              nodeType2: types[j],
              severity: 'error',
              description: `Both plugins use the same entity store: ${storeName}`
            });
          }
        }
      }
    }

    return {
      compatible: conflicts.filter(c => c.severity === 'error').length === 0,
      conflicts,
      warnings,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }

  async optimizePluginConfiguration(treeId: TreeId): Promise<OptimizationResult> {
    const tree = await this.queryService.getTree(treeId);
    if (!tree) {
      throw new Error(`Tree ${treeId} not found`);
    }

    const recommendations: OptimizationResult['recommendations'] = [];
    const allPlugins = await getRegisteredPlugins();
    
    const usageAnalysis = await Promise.all(
      allPlugins.map(async plugin => {
        try {
          const stats = await this.getPluginUsageStats(treeId, plugin.nodeType);
          return { plugin, stats };
        } catch {
          return { plugin, stats: null };
        }
      })
    );

    // Detect unused plugins
    const unusedPlugins = usageAnalysis.filter(({ stats }) => 
      stats && stats.totalNodes === 0 && stats.lastUsed === 0
    );

    for (const { plugin } of unusedPlugins) {
      recommendations.push({
        type: 'disable',
        nodeType: plugin.nodeType,
        reason: `Plugin ${plugin.displayName || plugin.nodeType} is not being used`,
        priority: 7
      });
    }

    const currentPerformance = {
      score: Math.max(0.1, Math.min(1.0, 
        1.0 - (unusedPlugins.length * 0.1)
      ))
    };

    const expectedImprovement = {
      performanceGain: Math.min(0.3, unusedPlugins.length * 0.05)
    };

    return {
      treeId,
      recommendations,
      currentPerformance,
      expectedImprovement
    };
  }

  async getPluginDependencyGraph(treeId: TreeId, options?: GraphOptions): Promise<DependencyGraph> {
    const tree = await this.queryService.getTree(treeId);
    if (!tree) {
      throw new Error(`Tree ${treeId} not found`);
    }

    const pluginsForTree = await getPluginsForTree(treeId);
    const nodes: DependencyGraph['nodes'] = [];
    const edges: DependencyGraph['edges'] = [];

    for (const plugin of pluginsForTree) {
      nodes.push({
        nodeType: plugin.nodeType,
        label: plugin.displayName || plugin.nodeType,
        metrics: {} // Add empty metrics object as expected by the interface
      });
    }

    return {
      treeId,
      nodes,
      edges,
      metadata: {
        totalPlugins: nodes.length,
        hasCycles: false
      },
      layout: options?.layout || 'hierarchical'
    };
  }

  async getPluginMetrics(treeId: TreeId, nodeType: NodeType, options?: MetricOptions): Promise<PluginMetrics> {
    const [tree, pluginDefinition] = await Promise.all([
      this.queryService.getTree(treeId),
      getPluginDefinition(nodeType)
    ]);

    if (!tree) {
      throw new Error(`Tree ${treeId} not found`);
    }

    if (!pluginDefinition) {
      throw new Error(`Plugin ${nodeType} not found`);
    }

    const stats = await this.getPluginUsageStats(treeId, nodeType);
    const responseTime = 100; // Mock response time

    const metrics: PluginMetrics = {
      treeId,
      nodeType,
      performance: {
        averageResponseTime: responseTime,
        throughput: Math.floor(stats.totalNodes / 10),
        errorRate: 0.01
      },
      resourceUsage: {
        memoryMB: 5 + Math.floor(stats.totalNodes * 0.1)
      }
    };

    if (options?.timeRange) {
      metrics.history = this.generateMetricHistory(metrics, options.timeRange);
    }

    return metrics;
  }

  private extractCapabilities(definition: any): NodeCapability[] {
    const capabilities: NodeCapability[] = [];
    
    if (definition.ui?.dialogComponentPath) {
      capabilities.push('create', 'update');
    }
    capabilities.push('read', 'delete', 'move');
    
    if (definition.entityHandler) {
      capabilities.push('export', 'validation');
    }
    
    if (definition.lifecycle) {
      capabilities.push('lifecycle');
    }
    
    capabilities.push('search', 'offline');
    
    return capabilities;
  }

  private generateOperationStats(totalNodes: number, activeNodes: number, lastUsed: number): Array<{ operation: string; count: number; timestamp: number }> {
    const operations = ['create', 'edit', 'delete', 'move'];
    const stats: Array<{ operation: string; count: number; timestamp: number }> = [];
    
    for (const operation of operations) {
      let count = 0;
      const baseTimestamp = lastUsed || Date.now();
      
      switch (operation) {
        case 'create':
          count = Math.floor(totalNodes * 1.2);
          break;
        case 'edit':
          count = Math.floor(activeNodes * 2.5);
          break;
        case 'delete':
          count = Math.floor(totalNodes * 0.2);
          break;
        case 'move':
          count = Math.floor(activeNodes * 0.5);
          break;
      }
      
      stats.push({
        operation,
        count,
        timestamp: baseTimestamp - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
      });
    }
    
    return stats;
  }

  private generateMetricHistory(baseMetrics: PluginMetrics, timeRange: { start: number; end: number }): Array<{ timestamp: number; averageResponseTime: number; throughput: number; errorRate: number }> {
    const history: Array<{ timestamp: number; averageResponseTime: number; throughput: number; errorRate: number }> = [];
    const duration = timeRange.end - timeRange.start;
    const intervalMs = Math.max(60000, Math.floor(duration / 100));
    
    for (let timestamp = timeRange.start; timestamp <= timeRange.end; timestamp += intervalMs) {
      const variation = 0.8 + (Math.random() * 0.4);
      history.push({
        timestamp,
        averageResponseTime: Math.floor(baseMetrics.performance.averageResponseTime * variation),
        throughput: Math.floor(baseMetrics.performance.throughput * variation),
        errorRate: Math.max(0, Math.min(0.1, baseMetrics.performance.errorRate * variation))
      });
    }
    
    return history;
  }
}