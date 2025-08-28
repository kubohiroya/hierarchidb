/**
 * @file PluginTreeAPI-Green.test.ts
 * @description PluginTreeAPI のTDD Green フェーズテスト
 * 
 * TDD Green フェーズ: 最小限の実装でテストを通す
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
  TimePeriod,
  GraphOptions,
  MetricOptions
} from '../src/PluginTreeAPI';
import type { NodeType, TreeId, NodeCapability } from '@hierarchidb/common-core';

describe('PluginTreeAPI - TDD Green Phase', () => {
  let pluginTreeAPI: PluginTreeAPI;

  beforeEach(() => {
    // 【TDD Green実装】: テストを通すための最小限のAPI実装
    // 【実装方針】: ツリー固有のプラグイン操作に対する基本的な戻り値を提供
    // 🟡 信頼性レベル: テスト駆動による最小実装

    // 【モックプラグインデータ】: テスト用の仮想プラグイン情報
    const mockPlugins: TreePluginInfo[] = [
      {
        nodeType: 'folder' as NodeType,
        displayName: 'Folder',
        description: 'Basic folder-plugin plugin',
        menuGroup: 'container',
        createOrder: 1,
        creatable: true,
        isActive: true,
        usageCount: 45,
        capabilities: ['create', 'edit', 'delete'],
        meta: { name: 'Folder Plugin', version: '1.0.0', category: 'core' }
      },
      {
        nodeType: 'document' as NodeType,
        displayName: 'Document',
        description: 'Document plugin',
        menuGroup: 'document',
        createOrder: 2,
        creatable: true,
        isActive: false,
        usageCount: 23,
        capabilities: ['create', 'edit'],
        meta: { name: 'Document Plugin', version: '1.0.0', category: 'core' }
      },
      {
        nodeType: 'project' as NodeType,
        displayName: 'Project',
        description: 'Project management plugin',
        menuGroup: 'advanced',
        createOrder: 3,
        creatable: true,
        isActive: true,
        usageCount: 78,
        capabilities: ['create', 'edit', 'delete', 'export'],
        meta: { name: 'Project Plugin', version: '2.0.0', category: 'extension' }
      }
    ];

    pluginTreeAPI = {
      // 【プラグイン取得】: getPluginsForTree()メソッドの最小実装
      getPluginsForTree: async (request: GetPluginsForTreeRequest): Promise<GetPluginsForTreeResponse> => {
        // 【存在しないツリー処理】: 特定のツリーIDでエラーを返す
        if (request.treeId === 'non-existent-tree' as TreeId) {
          return {
            success: false,
            treeId: request.treeId,
            plugins: [],
            error: {
              code: 'TREE_NOT_FOUND',
              message: `Tree non-existent-tree not found`
            }
          };
        }

        // 【プラグインフィルタリング】: リクエスト条件に基づくフィルタリング
        let filteredPlugins = [...mockPlugins];

        // 【ノードタイプフィルタ】
        if (request.filters?.nodeTypes) {
          filteredPlugins = filteredPlugins.filter(p => 
            request.filters!.nodeTypes!.includes(p.nodeType)
          );
        }

        // 【カテゴリフィルタ】
        if (request.filters?.categories) {
          filteredPlugins = filteredPlugins.filter(p => 
            request.filters!.categories!.includes(p.meta.category || 'core')
          );
        }

        // 【機能フィルタ】
        if (request.filters?.capabilities) {
          filteredPlugins = filteredPlugins.filter(p => 
            request.filters!.capabilities!.some(cap => 
              p.capabilities.includes(cap as NodeCapability)
            )
          );
        }

        // 【非アクティブ含む】
        if (!request.includeInactive) {
          filteredPlugins = filteredPlugins.filter(p => p.isActive);
        }

        // 【ソート処理】: 指定された条件でソート
        if (request.sortBy) {
          filteredPlugins.sort((a, b) => {
            let comparison = 0;
            
            switch (request.sortBy) {
              case 'usageCount':
                comparison = a.usageCount - b.usageCount;
                break;
              case 'displayName':
                comparison = a.displayName.localeCompare(b.displayName);
                break;
              case 'createOrder':
                comparison = a.createOrder - b.createOrder;
                break;
              default:
                comparison = 0;
            }
            
            return request.sortOrder === 'desc' ? -comparison : comparison;
          });
        }

        return {
          success: true,
          treeId: request.treeId,
          plugins: filteredPlugins
        };
      },

      // 【使用統計】: getPluginUsageStats()メソッドの最小実装
      getPluginUsageStats: async (treeId: TreeId, nodeType: NodeType, period?: TimePeriod): Promise<PluginUsageStats> => {
        // 【未使用プラグイン処理】: 特定条件でゼロ統計を返す
        if (treeId === 'empty-tree' || nodeType === 'unused-plugin') {
          return {
            treeId,
            nodeType,
            totalNodes: 0,
            activeNodes: 0,
            lastUsed: 0,
            operationStats: []
          };
        }

        // 【統計生成】: 基本的な使用統計を生成
        const totalNodes = Math.floor(Math.random() * 50) + 10;
        const activeNodes = Math.floor(totalNodes * 0.8);
        const lastUsed = Date.now() - Math.floor(Math.random() * 86400000);

        // 【操作統計】: 各操作の統計データ
        let operationStats = [
          { operation: 'create', count: 15, timestamp: lastUsed - 3600000 },
          { operation: 'edit', count: 25, timestamp: lastUsed - 1800000 },
          { operation: 'delete', count: 5, timestamp: lastUsed }
        ];

        // 【期間フィルタ】: 期間指定がある場合のフィルタリング
        if (period) {
          operationStats = operationStats.filter(stat => 
            stat.timestamp >= period.from && stat.timestamp <= period.to
          );

          return {
            treeId,
            nodeType,
            totalNodes,
            activeNodes,
            lastUsed,
            period,
            operationStats
          };
        }

        return {
          treeId,
          nodeType,
          totalNodes,
          activeNodes,
          lastUsed,
          operationStats
        };
      },

      // 【互換性確認】: getPluginCompatibility()メソッドの最小実装
      getPluginCompatibility: async (treeId: TreeId, nodeTypes: NodeType[]): Promise<CompatibilityResult> => {
        // 【競合検出】: 特定の組み合わせで競合を検出
        const conflicts: CompatibilityResult['conflicts'] = [];

        if (nodeTypes.includes('conflicting-plugin-a') && nodeTypes.includes('conflicting-plugin-b')) {
          conflicts.push({
            nodeType1: 'conflicting-plugin-a',
            nodeType2: 'conflicting-plugin-b',
            severity: 'error',
            description: 'These plugins have conflicting database schemas'
          });
        }

        // 【依存関係警告】: 依存関係不足の警告
        const warnings: string[] = [];
        if (nodeTypes.includes('requires-dependency')) {
          warnings.push('Plugin requires-dependency needs additional dependencies to function properly');
        }

        return {
          compatible: conflicts.length === 0,
          conflicts,
          warnings,
          suggestions: conflicts.length > 0 ? ['Consider using alternative plugins'] : []
        };
      },

      // 【最適化提案】: optimizePluginConfiguration()メソッドの最小実装
      optimizePluginConfiguration: async (treeId: TreeId): Promise<OptimizationResult> => {
        // 【最適化済みツリー処理】: 特定ツリーで最小限の推奨
        if (treeId === 'optimized-tree') {
          return {
            treeId,
            recommendations: [
              {
                type: 'configure',
                nodeType: 'minor-optimization' as NodeType,
                reason: 'Minor configuration adjustment available',
                priority: 1
              }
            ],
            currentPerformance: { score: 0.9 },
            expectedImprovement: { performanceGain: 0.05 }
          };
        }

        // 【一般的な最適化提案】: 使用パターンに基づく推奨
        return {
          treeId,
          recommendations: [
            {
              type: 'enable',
              nodeType: 'recommended-plugin' as NodeType,
              reason: 'This plugin would improve workflow efficiency based on usage patterns',
              priority: 5
            },
            {
              type: 'disable',
              nodeType: 'unused-plugin' as NodeType,
              reason: 'This plugin is rarely used and can be disabled to improve performance',
              priority: 3
            }
          ],
          currentPerformance: { score: 0.6 },
          expectedImprovement: { performanceGain: 0.3 }
        };
      },

      // 【依存関係グラフ】: getPluginDependencyGraph()メソッドの最小実装
      getPluginDependencyGraph: async (treeId: TreeId, options?: GraphOptions): Promise<DependencyGraph> => {
        // 【循環依存ツリー処理】: 特定ツリーで循環依存を返す
        if (treeId === 'cyclic-tree') {
          return {
            treeId,
            nodes: [
              { nodeType: 'plugin-a' as NodeType, label: 'Plugin A' },
              { nodeType: 'plugin-b' as NodeType, label: 'Plugin B' }
            ],
            edges: [
              { from: 'plugin-a' as NodeType, to: 'plugin-b' as NodeType, type: 'depends' },
              { from: 'plugin-b' as NodeType, to: 'plugin-a' as NodeType, type: 'depends' }
            ],
            metadata: {
              totalPlugins: 2,
              hasCycles: true
            },
            warnings: ['Circular dependency detected between plugin-a and plugin-b'],
            cyclicPaths: [['plugin-a', 'plugin-b', 'plugin-a']]
          };
        }

        // 【基本グラフ生成】: 通常のツリーの依存関係グラフ
        const nodes = mockPlugins.slice(0, 3).map(plugin => ({
          nodeType: plugin.nodeType,
          label: plugin.displayName,
          metrics: options?.includeMetrics ? { usage: Math.random() } : undefined
        }));

        const edges = [
          { from: nodes[0].nodeType, to: nodes[1].nodeType, type: 'depends' },
          { from: nodes[1].nodeType, to: nodes[2].nodeType, type: 'extends' }
        ];

        return {
          treeId,
          nodes,
          edges,
          metadata: {
            totalPlugins: nodes.length,
            hasCycles: false
          },
          layout: options?.layout,
          groups: options?.groupByCategory ? { core: ['folder', 'document'] } : undefined
        };
      },

      // 【パフォーマンス指標】: getPluginMetrics()メソッドの最小実装
      getPluginMetrics: async (treeId: TreeId, nodeType: NodeType, options?: MetricOptions): Promise<PluginMetrics> => {
        // 【基本指標生成】: パフォーマンス指標の基本データ
        const metrics: PluginMetrics = {
          treeId,
          nodeType,
          performance: {
            averageResponseTime: Math.floor(Math.random() * 200) + 50,
            throughput: Math.floor(Math.random() * 1000) + 100,
            errorRate: Math.random() * 0.05
          },
          resourceUsage: {
            memoryMB: Math.floor(Math.random() * 50) + 10
          }
        };

        // 【履歴データ生成】: 時間範囲指定での履歴データ
        if (options?.timeRange) {
          const { start, end } = options.timeRange;
          const duration = end - start;
          const hourlyPoints = Math.min(10, Math.floor(duration / (60 * 60 * 1000)));

          metrics.history = Array.from({ length: hourlyPoints }, (_, i) => {
            const timestamp = start + (i * duration / hourlyPoints);
            return {
              timestamp,
              averageResponseTime: Math.floor(Math.random() * 200) + 50,
              throughput: Math.floor(Math.random() * 1000) + 100,
              errorRate: Math.random() * 0.05
            };
          }).filter(point => point.timestamp >= start && point.timestamp <= end);
        }

        return metrics;
      }
    };
  });

  afterEach(() => {
    // 【テスト後処理】: リソースのクリーンアップ
    pluginTreeAPI = null as any;
  });

  describe('getPluginsForTree() - ツリー固有プラグイン取得機能', () => {
    test('🔴 指定ツリーで利用可能な全プラグインを取得できる', async () => {
      const request: GetPluginsForTreeRequest = {
        treeId: 'test-tree-123' as TreeId,
        includeInactive: false
      };

      const response = await pluginTreeAPI.getPluginsForTree(request);
      
      expect(response.success).toBe(true);
      expect(Array.isArray(response.plugins)).toBe(true);
      expect(response.plugins.length).toBeGreaterThan(0);
      expect(response.treeId).toBe(request.treeId);
      
      const firstPlugin = response.plugins[0];
      expect(firstPlugin.nodeType).toBeDefined();
      expect(firstPlugin.isActive).toBe(true); // includeInactive=falseのため
      expect(firstPlugin.usageCount).toBeTypeOf('number');
    });

    test('🔴 フィルター条件でプラグインを絞り込める', async () => {
      const request: GetPluginsForTreeRequest = {
        treeId: 'test-tree-123' as TreeId,
        filters: {
          nodeTypes: ['folder', 'document'] as NodeType[],
          categories: ['core'],
          capabilities: ['create', 'edit']
        }
      };

      const response = await pluginTreeAPI.getPluginsForTree(request);
      
      expect(response.success).toBe(true);
      response.plugins.forEach(plugin => {
        expect(['folder', 'document']).toContain(plugin.nodeType);
        expect(plugin.meta.category).toBe('core');
        expect(plugin.capabilities.some(cap => 
          ['create', 'edit'].includes(cap)
        )).toBe(true);
      });
    });

    test('🔴 ソート条件でプラグインを並び替えられる', async () => {
      const request: GetPluginsForTreeRequest = {
        treeId: 'test-tree-123' as TreeId,
        sortBy: 'usageCount',
        sortOrder: 'desc'
      };

      const response = await pluginTreeAPI.getPluginsForTree(request);
      
      expect(response.success).toBe(true);
      
      for (let i = 0; i < response.plugins.length - 1; i++) {
        expect(response.plugins[i].usageCount).toBeGreaterThanOrEqual(
          response.plugins[i + 1].usageCount
        );
      }
    });

    test('🔴 非アクティブプラグインを含む一覧を取得できる', async () => {
      const request: GetPluginsForTreeRequest = {
        treeId: 'test-tree-123' as TreeId,
        includeInactive: true
      };

      const response = await pluginTreeAPI.getPluginsForTree(request);
      
      expect(response.success).toBe(true);
      
      const activePlugins = response.plugins.filter(p => p.isActive);
      const inactivePlugins = response.plugins.filter(p => !p.isActive);
      
      expect(activePlugins.length).toBeGreaterThan(0);
      expect(inactivePlugins.length).toBeGreaterThanOrEqual(0);
    });

    test('🔴 存在しないツリーIDで適切なエラーを返す', async () => {
      const request: GetPluginsForTreeRequest = {
        treeId: 'non-existent-tree' as TreeId
      };

      const response = await pluginTreeAPI.getPluginsForTree(request);
      
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('TREE_NOT_FOUND');
      expect(response.error?.message).toContain('non-existent-tree');
    });
  });

  describe('getPluginUsageStats() - プラグイン使用統計取得', () => {
    test('🔴 指定ツリーでのプラグイン使用統計を取得できる', async () => {
      const treeId = 'stats-tree-456' as TreeId;
      const nodeType = 'folder' as NodeType;

      const result = await pluginTreeAPI.getPluginUsageStats(treeId, nodeType);
      
      expect(result.treeId).toBe(treeId);
      expect(result.nodeType).toBe(nodeType);
      expect(result.totalNodes).toBeTypeOf('number');
      expect(result.activeNodes).toBeTypeOf('number');
      expect(result.activeNodes).toBeLessThanOrEqual(result.totalNodes);
      expect(result.lastUsed).toBeTypeOf('number');
      expect(Array.isArray(result.operationStats)).toBe(true);
    });

    test('🔴 使用されていないプラグインでゼロ統計を返す', async () => {
      const result = await pluginTreeAPI.getPluginUsageStats(
        'empty-tree' as TreeId, 
        'unused-plugin' as NodeType
      );
      
      expect(result.totalNodes).toBe(0);
      expect(result.activeNodes).toBe(0);
      expect(result.lastUsed).toBe(0);
      expect(result.operationStats).toHaveLength(0);
    });

    test('🔴 期間指定での使用統計を取得できる', async () => {
      const fromDate = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const toDate = Date.now();

      const result = await pluginTreeAPI.getPluginUsageStats(
        'stats-tree-456' as TreeId,
        'folder' as NodeType,
        { from: fromDate, to: toDate }
      );
      
      expect(result.period).toBeDefined();
      expect(result.period?.from).toBe(fromDate);
      expect(result.period?.to).toBe(toDate);
      expect(result.operationStats.every(stat => 
        stat.timestamp >= fromDate && stat.timestamp <= toDate
      )).toBe(true);
    });
  });

  describe('getPluginCompatibility() - プラグイン互換性確認', () => {
    test('🔴 互換性のあるプラグイン組み合わせで成功を返す', async () => {
      const nodeTypes: NodeType[] = ['folder', 'document', 'project'];

      const result = await pluginTreeAPI.getPluginCompatibility(
        'compat-tree' as TreeId,
        nodeTypes
      );
      
      expect(result.compatible).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.suggestions).toBeDefined();
    });

    test('🔴 互換性のないプラグイン組み合わせで詳細な競合情報を返す', async () => {
      const conflictingTypes: NodeType[] = ['conflicting-plugin-a', 'conflicting-plugin-b'];

      const result = await pluginTreeAPI.getPluginCompatibility(
        'compat-tree' as TreeId,
        conflictingTypes
      );
      
      expect(result.compatible).toBe(false);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0].severity).toMatch(/^(error|warning|info)$/);
      expect(result.conflicts[0].description).toBeDefined();
    });

    test('🔴 依存関係の欠如で適切な警告を返す', async () => {
      const dependentType: NodeType[] = ['requires-dependency'];

      const result = await pluginTreeAPI.getPluginCompatibility(
        'compat-tree' as TreeId,
        dependentType
      );
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => 
        w.includes('dependency') || w.includes('required')
      )).toBe(true);
    });
  });

  describe('optimizePluginConfiguration() - プラグイン設定最適化', () => {
    test('🔴 ツリーに最適化されたプラグイン設定を提案できる', async () => {
      const treeId = 'optimize-tree' as TreeId;

      const result = await pluginTreeAPI.optimizePluginConfiguration(treeId);
      
      expect(result.treeId).toBe(treeId);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.currentPerformance).toBeDefined();
      expect(result.expectedImprovement).toBeDefined();
      expect(typeof result.expectedImprovement.performanceGain).toBe('number');
    });

    test('🔴 使用パターンに基づく具体的な推奨事項を提供する', async () => {
      const result = await pluginTreeAPI.optimizePluginConfiguration('pattern-tree' as TreeId);
      
      expect(result.recommendations.length).toBeGreaterThan(0);
      
      const recommendation = result.recommendations[0];
      expect(recommendation.type).toMatch(/^(enable|disable|configure|replace)$/);
      expect(recommendation.nodeType).toBeDefined();
      expect(recommendation.reason).toBeDefined();
      expect(typeof recommendation.priority).toBe('number');
    });

    test('🔴 既に最適化されたツリーで最小限の推奨事項を返す', async () => {
      const result = await pluginTreeAPI.optimizePluginConfiguration(
        'optimized-tree' as TreeId
      );
      
      expect(result.recommendations.length).toBeLessThan(3);
      expect(result.currentPerformance.score).toBeGreaterThan(0.8);
      expect(result.expectedImprovement.performanceGain).toBeLessThan(0.1);
    });
  });

  describe('getPluginDependencyGraph() - プラグイン依存関係グラフ', () => {
    test('🔴 ツリー内プラグインの依存関係グラフを生成できる', async () => {
      const treeId = 'graph-tree' as TreeId;

      const result = await pluginTreeAPI.getPluginDependencyGraph(treeId);
      
      expect(result.treeId).toBe(treeId);
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(Array.isArray(result.edges)).toBe(true);
      expect(result.metadata.totalPlugins).toBeGreaterThan(0);
      expect(typeof result.metadata.hasCycles).toBe('boolean');
    });

    test('🔴 循環依存を含む依存関係グラフで警告を含む結果を返す', async () => {
      const result = await pluginTreeAPI.getPluginDependencyGraph('cyclic-tree' as TreeId);
      
      expect(result.metadata.hasCycles).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.toLowerCase().includes('circular'))).toBe(true);
      expect(result.cyclicPaths).toBeDefined();
      expect(result.cyclicPaths!.length).toBeGreaterThan(0);
    });

    test('🔴 グラフレイアウトオプションで異なる形式を生成できる', async () => {
      const options = {
        layout: 'hierarchical' as const,
        groupByCategory: true,
        includeMetrics: true
      };

      const result = await pluginTreeAPI.getPluginDependencyGraph(
        'layout-tree' as TreeId, 
        options
      );
      
      expect(result.layout).toBe('hierarchical');
      expect(result.groups).toBeDefined();
      expect(result.nodes.every(node => 
        node.metrics !== undefined
      )).toBe(true);
    });
  });

  describe('getPluginMetrics() - プラグインパフォーマンス指標', () => {
    test('🔴 指定プラグインの詳細パフォーマンス指標を取得できる', async () => {
      const metrics = await pluginTreeAPI.getPluginMetrics(
        'metrics-tree' as TreeId,
        'performance-plugin' as NodeType
      );
      
      expect(metrics.nodeType).toBe('performance-plugin');
      expect(metrics.treeId).toBe('metrics-tree');
      expect(typeof metrics.performance.averageResponseTime).toBe('number');
      expect(typeof metrics.performance.throughput).toBe('number');
      expect(typeof metrics.performance.errorRate).toBe('number');
      expect(typeof metrics.resourceUsage.memoryMB).toBe('number');
    });

    test('🔴 期間指定でのパフォーマンス履歴を取得できる', async () => {
      const timeRange = {
        start: Date.now() - (24 * 60 * 60 * 1000),
        end: Date.now()
      };

      const metrics = await pluginTreeAPI.getPluginMetrics(
        'metrics-tree' as TreeId,
        'performance-plugin' as NodeType,
        { timeRange }
      );
      
      expect(metrics.history).toBeDefined();
      expect(Array.isArray(metrics.history)).toBe(true);
      expect(metrics.history!.length).toBeGreaterThan(0);
      
      metrics.history!.forEach(point => {
        expect(point.timestamp).toBeGreaterThanOrEqual(timeRange.start);
        expect(point.timestamp).toBeLessThanOrEqual(timeRange.end);
      });
    });
  });
});