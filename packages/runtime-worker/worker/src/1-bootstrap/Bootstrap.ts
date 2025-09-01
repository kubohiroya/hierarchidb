/**
 * Bootstrap - Worker初期化の統括
 * SingletonMixinを使用してすべてのサービスをシングルトンとして管理
 */

import * as Comlink from 'comlink';
import { SingletonMixin } from '@hierarchidb/util';
import { CoreDB } from '../db/CoreDB';
import { EphemeralDB } from '../db/EphemeralDB';
import { ServiceContainer } from '../4-api-implementation/WorkerService';
import { TreeQueryService } from '../services/TreeQueryService';
import { TreeMutationService } from '../services/TreeMutationService';
import { TreeSubscriptionService } from '../services/TreeSubscriptionService';
import { TagService } from '../services/TagService';
import { NodeTypeService } from '../services/NodeTypeService';
import { PluginManagementService } from '../services/PluginManagementService';
import { WorkingCopyManager } from '../services/WorkingCopyManager';
import { NodeLifecycleManager } from '../lifecycle/NodeLifecycleManager';
import { CommandProcessor } from '../command/CommandProcessor';
import { PluginRepository } from '@hierarchidb/runtime-worker-plugin-registry';
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
 * Worker起動時の初期化を統括
 */
export class Bootstrap {
  private appName: string;
  
  constructor(appName: string) {
    this.appName = appName;
  }
  
  /**
   * 全体の初期化
   */
  async initialize(): Promise<ServiceContainer> {
    console.log('[Bootstrap] Starting worker initialization...');
    
    // 1. データベースをシングルトンとして初期化
    console.log('[Bootstrap] Initializing databases...');
    const coreDB = await SingletonMixin.getSingleton(
      `CoreDB-${this.appName}`,
      async () => {
        const db = await CoreDB.getSingleton(this.appName);
        return db;
      }
    );
    
    const ephemeralDB = await SingletonMixin.getSingleton(
      `EphemeralDB-${this.appName}`,
      async () => {
        const db = await EphemeralDB.getSingleton(this.appName);
        return db;
      }
    );
    
    // 2. プラグインレジストリをシングルトンとして初期化
    console.log('[Bootstrap] Initializing plugin registry...');
    const pluginRegistry = await SingletonMixin.getSingleton(
      'PluginRepository',
      () => new PluginRepository()
    );
    
    // 3. プラグイン管理サービスをシングルトンとして初期化
    console.log('[Bootstrap] Initializing plugin management...');
    const pluginManagement = await SingletonMixin.getSingleton(
      PluginManagementService.name,
      () => new PluginManagementService(pluginRegistry)
    );
    
    // 3. ライフサイクルマネージャをシングルトンとして初期化
    const lifecycleManager = await SingletonMixin.getSingleton(
      NodeLifecycleManager.name,
      () => new NodeLifecycleManager(pluginRegistry, coreDB, ephemeralDB)
    );
    
    // 4. コマンドプロセッサをシングルトンとして初期化
    const commandProcessor = await SingletonMixin.getSingleton(
      CommandProcessor.name,
      () => new CommandProcessor()
    );
    
    // 5. 各サービスをシングルトンとして初期化
    console.log('[Bootstrap] Creating operation services...');
    
    const queryService = await SingletonMixin.getSingleton(
      TreeQueryService.name,
      () => new TreeQueryService(coreDB, ephemeralDB)
    );
    
    const mutationService = await SingletonMixin.getSingleton(
      TreeMutationService.name,
      () => new TreeMutationService(
        coreDB,
        ephemeralDB,
        commandProcessor,
        lifecycleManager
      )
    );
    
    const subscriptionService = await SingletonMixin.getSingleton(
      TreeSubscriptionService.name,
      () => new TreeSubscriptionService(coreDB, ephemeralDB)
    );
    
    const tagService = await SingletonMixin.getSingleton(
      TagService.name,
      () => new TagService(coreDB)
    );
    
    const nodeTypeService = await SingletonMixin.getSingleton(
      NodeTypeService.name,
      () => new NodeTypeService(pluginRegistry, queryService)
    );
    
    const workingCopyManager = await SingletonMixin.getSingleton(
      WorkingCopyManager.name,
      () => new WorkingCopyManager(ephemeralDB)
    );
    
    // 6. サービスコンテナを作成（Comlinkでプロキシ化）
    const services: ServiceContainer = {
      query: Comlink.proxy(queryService) as TreeQueryAPI & Comlink.ProxyMarked,
      mutation: Comlink.proxy(mutationService) as TreeMutationAPI & Comlink.ProxyMarked,
      subscription: Comlink.proxy(subscriptionService) as TreeSubscriptionAPI & Comlink.ProxyMarked,
      workingCopy: Comlink.proxy({
        createDraftWorkingCopy: async (nodeType: string, parentId?: string) => {
          // WorkingCopyManagerのメソッドを呼び出す実装
          return 'working-copy-id';
        },
        createWorkingCopyFromNode: async (nodeId: string) => {
          return 'working-copy-id';
        },
        updateWorkingCopy: async (workingCopyId: string, updates: any) => {},
        getWorkingCopy: async (workingCopyId: string) => {
          // TODO: Implement getWorkingCopy in WorkingCopyManager
          return null as any;
        },
        commitWorkingCopy: async (workingCopyId: string) => {
          return 'entity-id';
        },
        discardWorkingCopy: async (workingCopyId: string) => {},
      }) as unknown as WorkingCopyAPI & Comlink.ProxyMarked,
      pluginTree: Comlink.proxy({
        getPluginsForTree: async () => ({ plugins: [], totalCount: 0 }),
      }) as unknown as PluginTreeAPI & Comlink.ProxyMarked,
      nodeType: Comlink.proxy(nodeTypeService) as NodeTypeAPI & Comlink.ProxyMarked,
      pluginLifecycle: Comlink.proxy({
        initializePlugin: async () => {},
        destroyPlugin: async () => {},
      }) as unknown as PluginLifecycleAPI & Comlink.ProxyMarked,
      pluginExtension: Comlink.proxy({
        getExtensionsForPlugin: async () => [],
      }) as unknown as PluginExtensionAPI & Comlink.ProxyMarked,
      importExport: Comlink.proxy({
        importNodes: async () => ({ importedCount: 0, errors: [] }),
        exportNodes: async () => ({ data: { nodes: [] }, format: 'json' }),
      }) as unknown as ImportExportAPI & Comlink.ProxyMarked,
      tag: Comlink.proxy(tagService) as TagAPI & Comlink.ProxyMarked,
      multiStepDialog: Comlink.proxy({
        createWorkingCopy: async () => 'working-copy-id',
        updateWorkingCopyStep: async () => {},
        evaluateCapabilities: async () => ({ canProceed: true, validationErrors: [] }),
        commitWorkingCopy: async () => 'entity-id',
        discardWorkingCopy: async () => {},
      }) as unknown as MultiStepDialogAPI & Comlink.ProxyMarked,
    };
    
    console.log('[Bootstrap] Worker initialization complete');
    return services;
  }
  
  /**
   * すべてのシングルトンをクリーンアップ
   */
  static cleanup(): void {
    SingletonMixin.terminateAll();
  }
}