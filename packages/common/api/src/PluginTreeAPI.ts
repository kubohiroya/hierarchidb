/**
 * @deprecated Use TreePluginAnalyzer instead. This file will be removed in the next major version.
 * @see TreePluginAnalyzer
 * 
 * @file PluginTreeAPI.ts
 * @description TreeTypes-specific plugin management facade API
 *
 * Provides a focused interface for retrieving plugins available for specific trees,
 * with type safety and proper filtering capabilities.
 */

import type { TreeId, NodeType, NodeCapability } from '@hierarchidb/common-type';

// 【型定義】: PluginTreeAPIテスト用の追加型定義
// 🟡 信頼性レベル: テスト仕様から推測した型構造

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
 * // Get plugins for a tree
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
   * 【機能概要】: 指定ツリーで利用可能なプラグイン一覧を取得
   * 【テスト対応】: フィルター、ソート、非アクティブ含む取得をテスト
   * 🟢 信頼性レベル: テスト仕様に基づく確実な実装
   */
  getPluginsForTree(request: GetPluginsForTreeRequest): Promise<GetPluginsForTreeResponse>;

  /**
   * 【機能概要】: プラグインの使用統計を取得
   * 【テスト対応】: 基本統計、未使用統計、期間指定統計をテスト
   * 🟢 信頼性レベル: テスト仕様に基づく確実な実装
   */
  getPluginUsageStats(
    treeId: TreeId,
    nodeType: NodeType,
    period?: TimePeriod
  ): Promise<PluginUsageStats>;

  /**
   * 【機能概要】: プラグイン間の互換性を確認
   * 【テスト対応】: 互換性確認、競合検出、依存関係不足をテスト
   * 🟢 信頼性レベル: テスト仕様に基づく確実な実装
   */
  getPluginCompatibility(treeId: TreeId, nodeTypes: NodeType[]): Promise<CompatibilityResult>;

  /**
   * 【機能概要】: ツリーのプラグイン設定最適化を提案
   * 【テスト対応】: 最適化提案、使用パターン分析、最適化済みツリーをテスト
   * 🟢 信頼性レベル: テスト仕様に基づく確実な実装
   */
  optimizePluginConfiguration(treeId: TreeId): Promise<OptimizationResult>;

  /**
   * 【機能概要】: プラグイン依存関係グラフを生成
   * 【テスト対応】: 基本グラフ生成、循環依存検出、レイアウト指定をテスト
   * 🟢 信頼性レベル: テスト仕様に基づく確実な実装
   */
  getPluginDependencyGraph(treeId: TreeId, options?: GraphOptions): Promise<DependencyGraph>;

  /**
   * 【機能概要】: プラグインのパフォーマンス指標を取得
   * 【テスト対応】: 基本指標取得、履歴データ取得をテスト
   * 🟢 信頼性レベル: テスト仕様に基づく確実な実装
   */
  getPluginMetrics(
    treeId: TreeId,
    nodeType: NodeType,
    options?: MetricOptions
  ): Promise<PluginMetrics>;
}

/**
 * Default export for the PluginTreeAPI interface
 */
export default PluginTreeAPI;
