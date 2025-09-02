/**
 * WorkerService - 窓口API実装
 * 各専門サービスへの純粋なファサード
 */

import * as Comlink from 'comlink';
import { WorkerAPI } from '@hierarchidb/common-api';
import type {
  TreeQueryAPI,
  TreeMutationAPI,
  TreeSubscriptionAPI,
  WorkingCopyAPI,
  PluginTreeAPI,
  NodeTypeAPI,
  PluginLifecycleAPI,
  PluginExtensionAPI,
  ImportExportAPI,
  TagAPI,
  MultiStepDialogAPI,
} from '@hierarchidb/common-api';

/**
 * 専門サービスのコンテナ
 */
export interface ServiceContainer {
  query: TreeQueryAPI;
  mutation: TreeMutationAPI;
  subscription: TreeSubscriptionAPI;
  workingCopy: WorkingCopyAPI;
  pluginTree: PluginTreeAPI;
  nodeType: NodeTypeAPI;
  pluginLifecycle: PluginLifecycleAPI;
  pluginExtension: PluginExtensionAPI;
  importExport: ImportExportAPI;
  tag: TagAPI;
  multiStepDialog: MultiStepDialogAPI;
}

/**
 * WorkerService
 * WorkerAPIインターフェースの実装
 * 各専門サービスへの窓口として機能
 */
export class WorkerService implements WorkerAPI {
  private services: ServiceContainer;
  private initialized = false;
  private startTime = Date.now();
  
  constructor(services: ServiceContainer) {
    this.services = services;
  }
  
  /**
   * クエリAPI取得
   */
  getQueryAPI(): TreeQueryAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.services.query);
  }
  
  /**
   * 変更API取得
   */
  getMutationAPI(): TreeMutationAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.services.mutation);
  }
  
  /**
   * サブスクリプションAPI取得
   */
  getSubscriptionAPI(): TreeSubscriptionAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.services.subscription);
  }
  
  /**
   * ワーキングコピーAPI取得
   */
  getWorkingCopyAPI(): WorkingCopyAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.services.workingCopy);
  }
  
  /**
   * プラグインツリーAPI取得
   */
  getPluginTreeAPI(): PluginTreeAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.services.pluginTree);
  }
  
  /**
   * ノードタイプAPI取得
   */
  getNodeTypeAPI(): NodeTypeAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.services.nodeType);
  }
  
  /**
   * プラグインライフサイクルAPI取得
   */
  getPluginLifecycleAPI(): PluginLifecycleAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.services.pluginLifecycle);
  }
  
  /**
   * プラグイン拡張API取得
   */
  getPluginExtensionAPI(): PluginExtensionAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.services.pluginExtension);
  }
  
  /**
   * インポート/エクスポートAPI取得
   */
  getImportExportAPI(): ImportExportAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.services.importExport);
  }
  
  /**
   * タグAPI取得
   */
  getTagAPI(): TagAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.services.tag);
  }
  
  /**
   * マルチステップダイアログAPI取得
   */
  getMultiStepDialogAPI(): MultiStepDialogAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.services.multiStepDialog);
  }
  
  /**
   * ヘルスチェック
   */
  ping(): { response: 'pong'; timestamp: number } {
    return {
      response: 'pong',
      timestamp: Date.now(),
    };
  }
  
  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    // サービスの初期化は既にBootstrapで完了している想定
    this.initialized = true;
  }
  
  /**
   * シャットダウン
   */
  async shutdown(): Promise<void> {
    // 各サービスのクリーンアップ（必要に応じて）
    this.initialized = false;
  }
  
  /**
   * システムヘルス取得
   */
  async getSystemHealth(): Promise<{
    databases: {
      coreDB: boolean;
      ephemeralDB: boolean;
    };
    services: {
      query: boolean;
      mutation: boolean;
      subscription: boolean;
      plugin: boolean;
      workingCopy: boolean;
    };
    memory: {
      used: number;
      limit: number;
    };
    uptime: number;
  }> {
    return {
      databases: {
        coreDB: true,
        ephemeralDB: true,
      },
      services: {
        query: !!this.services.query,
        mutation: !!this.services.mutation,
        subscription: !!this.services.subscription,
        plugin: !!this.services.pluginLifecycle,
        workingCopy: !!this.services.workingCopy,
      },
      memory: {
        used: 0,
        limit: 0,
      },
      uptime: Date.now() - this.startTime,
    };
  }
}