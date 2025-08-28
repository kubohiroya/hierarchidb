/**
 * @file PluginManagementAPI.ts
 * @description Plugin lifecycle management API
 *
 * This API handles plugin registration, unregistration, validation, and health monitoring.
 * It's focused on the management aspects of plugins, separated from node type queries.
 */

import type {
  NodeType,
  PluginDefinition,
} from '@hierarchidb/common-core';

// 【型定義】: テストで期待される結果型の定義
// 🟡 信頼性レベル: テスト仕様から推測した型構造
export interface PluginRegistrationResult {
  success: boolean;
  pluginId?: string;
  registeredNodeType?: NodeType;
  error?: {
    code: string;
    message: string;
  };
  validationErrors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface UnregistrationResult {
  success: boolean;
  unregisteredNodeType?: NodeType;
  warnings?: string[];
  error?: {
    code: string;
    message: string;
  };
}

export interface PluginValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  warnings: Array<{
    field: string;
    message: string;
  }>;
}

export interface PluginHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: number;
  issues?: string[];
  performance: {
    avgResponseTime: number;
    errorRate: number;
  };
}

export interface PluginRegistrationInfo {
  nodeType: NodeType;
  meta: {
    name: string;
    version: string;
    category?: string;
  };
  registrationTime: number;
  healthStatus: PluginHealthStatus;
}

export interface PluginListOptions {
  status?: 'healthy' | 'degraded' | 'unhealthy';
  category?: string;
}

export interface PluginDependencyInfo {
  nodeType: NodeType;
  dependencies: NodeType[];
  dependents: NodeType[];
  circularDependencies: boolean;
  warnings?: string[];
}

export interface BulkOperationOptions {
  operation: 'register' | 'unregister';
  plugins?: PluginDefinition[];
  nodeTypes?: NodeType[];
}

export interface BulkOperationResult {
  successful: Array<{
    nodeType: NodeType;
    result: any;
  }>;
  failed: Array<{
    nodeType: NodeType;
    error: string;
  }>;
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

export interface PluginResetOptions {
  nodeType: NodeType;
  resetMode: 'individual' | 'folder' | 'system';
  createBackup?: boolean;
}

export interface PluginResetResult {
  success: boolean;
  nodeType: NodeType;
  deletedEntities: {
    groupEntities?: number;
    relationalEntities?: number;
    treeNodes?: number;  // Only for folder-plugin/system reset
    peerEntities?: number;  // Only for folder-plugin/system reset
  };
  backupLocation?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface PluginDeleteResult {
  success: boolean;
  nodeType: NodeType;
  warnings?: string[];
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Plugin lifecycle management API
 *
 * Provides comprehensive plugin management functionality including registration,
 * validation, health monitoring, and dependency management.
 *
 * @example
 * ```typescript
 * const pluginMgmtAPI = workerAPI.getPluginManagementAPI();
 * 
 * // Register a new plugin
 * const result = await pluginMgmtAPI.register(myPluginDefinition);
 * 
 * // Check plugin health
 * const health = await pluginMgmtAPI.checkHealth('folder-plugin');
 * ```
 */
export interface PluginManagementAPI {
  // ==================
  // Core Plugin Lifecycle Operations
  // ==================

  /**
   * 【機能概要】: 新しいプラグインをシステムに登録する
   * 【テスト対応】: register()の成功/失敗/重複ケースをテスト
   * 🟢 信頼性レベル: テスト仕様に基づく確実な実装
   * @param definition - 登録するプラグインの定義
   * @returns 登録結果とプラグインID
   */
  register(definition: PluginDefinition): Promise<PluginRegistrationResult>;

  /**
   * 【機能概要】: 登録済みプラグインをシステムから削除する  
   * 【テスト対応】: unregister()の成功/失敗/警告ケースをテスト
   * 🟢 信頼性レベル: テスト仕様に基づく確実な実装
   * @param nodeType - 削除するプラグインのノードタイプ
   * @returns 削除結果と警告情報
   */
  unregister(nodeType: NodeType): Promise<UnregistrationResult>;

  /**
   * 【機能概要】: プラグイン定義の妥当性を検証する
   * 【テスト対応】: validatePlugin()の有効/無効定義ケースをテスト
   * 🟢 信頼性レベル: テスト仕様に基づく確実な実装
   * @param definition - 検証するプラグイン定義
   * @returns 検証結果と詳細エラー情報
   */
  validatePlugin(definition: PluginDefinition): Promise<PluginValidationResult>;

  /**
   * 【機能概要】: プラグインの動作状況とパフォーマンスを監視する
   * 【テスト対応】: checkHealth()の健全/問題/未登録ケースをテスト
   * 🟢 信頼性レベル: テスト仕様に基づく確実な実装
   * @param nodeType - 監視するプラグインのノードタイプ
   * @returns ヘルス状況とパフォーマンス指標
   */
  checkHealth(nodeType: NodeType): Promise<PluginHealthStatus>;

  /**
   * 【機能概要】: 登録済みプラグインの一覧を取得する
   * 【テスト対応】: listRegistered()の全取得/フィルター取得ケースをテスト
   * 🟢 信頼性レベル: テスト仕様に基づく確実な実装
   * @param options - フィルター条件（オプション）
   * @returns 登録プラグイン情報の配列
   */
  listRegistered(options?: PluginListOptions): Promise<PluginRegistrationInfo[]>;

  /**
   * 【機能概要】: プラグインの依存関係を分析する
   * 【テスト対応】: getDependencies()の依存関係/循環依存ケースをテスト
   * 🟢 信頼性レベル: テスト仕様に基づく確実な実装
   * @param nodeType - 分析するプラグインのノードタイプ
   * @returns 依存関係情報と循環依存警告
   */
  getDependencies(nodeType: NodeType): Promise<PluginDependencyInfo>;

  /**
   * 【機能概要】: 複数プラグインの一括操作を実行する
   * 【テスト対応】: bulkOperation()の一括登録/削除/部分失敗ケースをテスト
   * 🟢 信頼性レベル: テスト仕様に基づく確実な実装
   * @param options - 一括操作の設定
   * @returns 操作結果とサマリー情報
   */
  bulkOperation(options: BulkOperationOptions): Promise<BulkOperationResult>;

  // ==================
  // Plugin Reset and Delete Operations
  // ==================

  /**
   * 【機能概要】: プラグインに関連するエンティティをリセットする
   * 【動作仕様】:
   *   - individual mode: GroupEntity, RelationalEntityのみ削除（TreeNode, PeerEntity保持）
   *   - folder-plugin mode: すべてのエンティティを削除（完全リセット）
   *   - system mode: すべてのプラグインの全データを削除
   * 【テスト対応】: resetPlugin()の各モード/バックアップケースをテスト
   * 🟢 信頼性レベル: テスト仕様に基づく確実な実装
   * @param options - リセット設定（モード、バックアップ）
   * @returns リセット結果と削除数
   */
  resetPlugin(options: PluginResetOptions): Promise<PluginResetResult>;

  /**
   * 【機能概要】: プラグインを完全に削除する
   * 【制約条件】:
   *   - folderプラグインは削除不可（コアプラグイン）
   *   - 依存されているプラグインの削除時は警告
   * 【テスト対応】: deletePlugin()の成功/制約/警告ケースをテスト
   * 🟢 信頼性レベル: テスト仕様に基づく確実な実装
   * @param nodeType - 削除するプラグインのノードタイプ
   * @returns 削除結果と警告情報
   */
  deletePlugin(nodeType: NodeType): Promise<PluginDeleteResult>;

  /**
   * 【機能概要】: システム全体をリセットする
   * 【動作仕様】: すべてのプラグインの全データを削除
   * 【テスト対応】: resetSystem()の完全リセットケースをテスト
   * 🟢 信頼性レベル: テスト仕様に基づく確実な実装
   * @param createBackup - バックアップ作成フラグ
   * @returns システムリセット結果
   */
  resetSystem(createBackup?: boolean): Promise<PluginResetResult>;
}

/**
 * Default export for the PluginManagementAPI interface
 */
export default PluginManagementAPI;