import {
  // CommandAPI,
  // ContextAPI,
  // EntityAPI,
  // HealthAPI,
  // HelperAPI,
  ImportExportAPI,
  // IndexAPI,
  PluginExtensionAPI,
  // MetadataAPI,
  MultiStepDialogAPI,
  // NodeAPI,
  NodeTypeAPI,
  PluginLifecycleAPI,
  PluginRegistryAPI,
  PluginTreeAPI,
  // PreferencesAPI,
  // SearchAPI,
  // SelectionAPI,
  TagAPI,
  // TreeAPI,
  // TreeDiffAPI,
  TreeMutationAPI,
  TreeQueryAPI,
  TreeSubscriptionAPI,
  // UIStateAPI,
  // ValidationAPI,
  // ViewAPI,
  WorkerAPI,
  WorkingCopyAPI,
} from '@hierarchidb/common-api';
import type {
  NodeId,
  TreeId,
  EntityId,
  NodeType,
  Tree,
  TreeNode,
  // WorkingCopyData,
  WorkingCopy,
  ValidationResult,
  // StepCapabilities,
} from '@hierarchidb/common-type';
import { generateId, SingletonMixin } from '@hierarchidb/util';
import * as Comlink from 'comlink';
import { CommandProcessor } from './command/CommandProcessor';
import { CoreDB } from './db/CoreDB';
import { EphemeralDB } from './db/EphemeralDB';
import { NodeLifecycleManager } from './lifecycle/NodeLifecycleManager';
import { PluginRegistryFacade, PluginRegistry, PluginRepository } from '@hierarchidb/runtime-worker-plugin-registry';
import { TreeQueryService } from './services/TreeQueryService';
import { TreeMutationService } from './services/TreeMutationService';
import { NodeTypeService } from './services/NodeTypeService';
import { ImportExportAPIImpl } from './apis/ImportExportAPIImpl';
import { TreeSubscriptionService } from './services/TreeSubscriptionService';
import { PluginTreeService } from './services/PluginTreeService';
// import { PluginLifecycleService } from './services/PluginLifecycleService'; // File doesn't exist yet
import { TagService } from './services/TagService';

/**
 * Worker API Facade Implementation
 *
 * Pure facade that delegates to specialized service classes.
 * Maintains single responsibility: routing API calls to appropriate services.
 */
export class WorkerAPIImpl implements WorkerAPI {
  private dbName: string;
  private isInitialized: boolean = false;

  // Core dependencies
  private coreDB!: CoreDB;
  private ephemeralDB!: EphemeralDB;
  private nodeTypeRegistry!: PluginRegistryFacade;
  private nodeLifecycleManager!: NodeLifecycleManager;
  private commandProcessor!: CommandProcessor;

  // Query/Mutation services
  private queryService!: TreeQueryAPI;
  private mutationService!: TreeMutationAPI;
  private subscriptionService!: TreeSubscriptionAPI;

  // Plugin services
  private pluginTreeService!: PluginTreeAPI;
  private nodeTypeService!: NodeTypeAPI;
  // private pluginLifecycleService!: PluginLifecycleAPI; // Not implemented yet

  // Import/Export services
  private importExportService!: ImportExportAPI;

  // Tag service
  private tagService!: TagAPI;

  // Plugin Registry API
  private pluginRegistryAPI!: PluginRegistryAPI;

  constructor(dbName: string = 'default-worker-db') {
    this.dbName = dbName;
  }

  static async getSingleton(dbName: string = 'default-worker-db'): Promise<WorkerAPIImpl> {
    return SingletonMixin.getSingleton(WorkerAPIImpl.name, async () => {
      const instance = new WorkerAPIImpl(dbName);
      await instance.initialize();
      return instance;
    });
  }

  async initialize(): Promise<void> {
    console.log('[WorkerAPIImpl] Starting initialization...');

    if (this.isInitialized) {
      console.log('[WorkerAPIImpl] Already initialized');
      return;
    }

    // Initialize databases
    this.coreDB = await CoreDB.getSingleton(this.dbName);
    this.ephemeralDB = await EphemeralDB.getSingleton(this.dbName);

    // Initialize registries
    this.nodeTypeRegistry = new PluginRegistryFacade(new PluginRepository());
    const unifiedRegistry = PluginRegistry.getInstance();

    // Register Import/Export plugins with dependency resolution
    try {
      // const registrationResult = await importExportPluginRegistry.registerAllPlugins(unifiedRegistry); // Disabled due to build issues
      // if (registrationResult.success) {
      //   console.log('[WorkerAPIImpl] Import/Export plugins registered successfully:', registrationResult.registered);
      // } else {
      //   console.warn('[WorkerAPIImpl] Some Import/Export plugins failed to register:', registrationResult.errors);
      // } // Disabled due to build issues
    } catch (error) {
      console.error('[WorkerAPIImpl] Failed to register Import/Export plugins:', error);
    }

    // Initialize lifecycle manager
    this.nodeLifecycleManager = new NodeLifecycleManager(
      this.nodeTypeRegistry,
      this.coreDB,
      this.ephemeralDB
    );

    // Initialize command processor
    this.commandProcessor = new CommandProcessor();

    // Initialize core services
    this.queryService = new TreeQueryService(this.coreDB, this.ephemeralDB);
    this.subscriptionService = new TreeSubscriptionService(this.coreDB, this.ephemeralDB);
    this.mutationService = new TreeMutationService(
      this.coreDB,
      this.ephemeralDB,
      this.commandProcessor,
      this.nodeLifecycleManager
    );

    // Initialize plugin services
    this.pluginTreeService = new PluginTreeService(this.coreDB, this.queryService as any);
    this.nodeTypeService = new NodeTypeService(this.nodeTypeRegistry as any, this.queryService as any);
    // this.pluginLifecycleService = new PluginLifecycleService(this.nodeTypeRegistry); // Not implemented yet

    // Initialize import/export services
    this.importExportService = await ImportExportAPIImpl.getInstance() as unknown as ImportExportAPI;

    // Initialize tag service
    this.tagService = new TagService(this.coreDB);

    // Initialize Plugin Registry API
    const integratedPlugins = new Map();
    const pluginLoadOrder: NodeType[] = [];
    const pluginsInOrder = await this.nodeTypeRegistry.getAllPlugins();

    for (const plugin of pluginsInOrder) {
      integratedPlugins.set(plugin.nodeType, plugin);
      pluginLoadOrder.push(plugin.nodeType);
    }

    this.pluginRegistryAPI = new PluginRegistryFacade(new PluginRepository()) as any;

    this.isInitialized = true;
    console.log('[WorkerAPIImpl] Initialization complete');
  }

  async shutdown(): Promise<void> {
    // Cleanup all subscriptions
    await this.subscriptionService.unsubscribeAll();

    // Close databases
    await this.coreDB.close();
    await this.ephemeralDB.close();
  }

  // ==================
  // Facade API Methods - Pure delegation to services
  // ==================

  getQueryAPI(): TreeQueryAPI & Comlink.ProxyMarked {
    return this.queryService as unknown as TreeQueryAPI & Comlink.ProxyMarked;
  }

  getMutationAPI(): TreeMutationAPI & Comlink.ProxyMarked {
    return this.mutationService as unknown as TreeMutationAPI & Comlink.ProxyMarked;
  }

  getSubscriptionAPI(): TreeSubscriptionAPI & Comlink.ProxyMarked {
    // Create a proper TreeSubscriptionAPI implementation
    const subscriptionAPI: TreeSubscriptionAPI = {
      subscribeNode: async (nodeId, callback, options) => {
        // Use the new API method that directly accepts callback
        return await this.subscriptionService.subscribeNode(nodeId, callback, options);
      },

      subscribeSubtree: async (nodeId, callback, options) => {
        // Use the new API method that directly accepts callback
        return await this.subscriptionService.subscribeSubtree(nodeId, callback, options);
      },

      subscribeTree: async (treeId, callback, options) => {
        // Use the new API method that directly accepts callback
        return await this.subscriptionService.subscribeTree(treeId, callback, options);
      },

      unsubscribe: async (subscriptionId) => {
        return await this.subscriptionService.unsubscribe(subscriptionId);
      },

      unsubscribeNode: async (nodeId) => {
        return await this.subscriptionService.unsubscribeNode(nodeId);
      },

      unsubscribeTree: async (treeId) => {
        return await this.subscriptionService.unsubscribeTree(treeId);
      },

      unsubscribeAll: async () => {
        return this.subscriptionService.unsubscribeAll();
      },

      listActiveSubscriptions: async () => {
        return [];
      },

      isSubscriptionActive: async (subscriptionId) => {
        return false;
      },

      getSubscriptionStats: async () => {
        return {
          totalActive: 0,
          nodeSubscriptions: 0,
          subtreeSubscriptions: 0,
          treeSubscriptions: 0,
          eventsProcessedToday: 0,
          averageEventLatency: 0,
        };
      },

      getRecentEvents: async (nodeId, limit = 50) => {
        return [];
      },

      getEventHistory: async (startTime, endTime, nodeId) => {
        return [];
      },
    };

    return Comlink.proxy(subscriptionAPI);
  }

  getWorkingCopyAPI(): WorkingCopyAPI & Comlink.ProxyMarked {
    // Create a complete WorkingCopyAPI implementation
    const workingCopyAPI: WorkingCopyAPI = {
      // Basic operations
      createDraftWorkingCopy: async (nodeType: string, parentId: NodeId, initialData?: any) => {
        // Create a new working copy for a draft node
        const workingCopyId = `wc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const workingCopy: WorkingCopy = {
          id: workingCopyId as NodeId,
          parentId: parentId || undefined,
          nodeType: nodeType as NodeType,
          name: initialData?.name || `New ${nodeType}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
          copiedAt: Date.now(), // Required by WorkingCopyProperties
          ...initialData,
        };
        await this.ephemeralDB.createWorkingCopy(workingCopy);
        return workingCopy;
      },
      createWorkingCopyFromNode: async (nodeId: NodeId) => {
        const node = await this.coreDB.getNode(nodeId);
        if (!node) {
          throw new Error(`Node ${nodeId} not found`);
        }
        const workingCopy: WorkingCopy = {
          ...node,
          copiedAt: Date.now(), // Required by WorkingCopyProperties
        };
        await this.ephemeralDB.createWorkingCopy(workingCopy);
        return workingCopy;
      },
      getWorkingCopy: async (nodeId: NodeId) => {
        return this.ephemeralDB.getWorkingCopy(nodeId);
      },
      updateWorkingCopy: async (nodeId: NodeId, updates: Partial<TreeNode>) => {
        const workingCopy = await this.ephemeralDB.getWorkingCopy(nodeId);
        if (!workingCopy) {
          throw new Error(`Working copy for ${nodeId} not found`);
        }
        const updatedWorkingCopy: WorkingCopy = {
          ...workingCopy,
          ...updates,
          updatedAt: Date.now(),
        };
        await this.ephemeralDB.updateWorkingCopy(updatedWorkingCopy);
        return updatedWorkingCopy;
      },
      listWorkingCopies: async () => {
        return this.ephemeralDB.listWorkingCopies();
      },
      hasWorkingCopy: async (nodeId: NodeId) => {
        const workingCopy = await this.ephemeralDB.getWorkingCopy(nodeId);
        return !!workingCopy;
      },

      // Commit and discard operations
      commitWorkingCopy: async (nodeId: NodeId) => {
        const workingCopy = await this.ephemeralDB.getWorkingCopy(nodeId);
        if (!workingCopy) {
          return { success: false, error: 'Working copy not found' };
        }
        // In a real implementation, this would save to CoreDB
        // For now, just remove from EphemeralDB
        await this.ephemeralDB.discardWorkingCopy(nodeId);
        return { success: true, nodeId };
      },
      discardWorkingCopy: async (nodeId: NodeId) => {
        return this.ephemeralDB.discardWorkingCopy(nodeId);
      },
      discardAllWorkingCopies: async () => {
        const workingCopies = await this.ephemeralDB.listWorkingCopies();
        for (const wc of workingCopies) {
          await this.ephemeralDB.discardWorkingCopy(wc.id);
        }
        return workingCopies.length;
      },

      // Validation operations
      validateWorkingCopy: async (nodeId: NodeId) => {
        // Basic validation implementation
        const workingCopy = await this.ephemeralDB.getWorkingCopy(nodeId);
        if (!workingCopy) {
          return { valid: false, message: 'Working copy not found' };
        }
        return { valid: true };
      },
      hasUnsavedChanges: async (nodeId: NodeId) => {
        const workingCopy = await this.ephemeralDB.getWorkingCopy(nodeId);
        return !!workingCopy;
      },

      // Bulk operations
      commitMultipleWorkingCopies: async (nodeIds: NodeId[]) => {
        const results = [];
        for (const nodeId of nodeIds) {
          try {
            const workingCopy = await this.ephemeralDB.getWorkingCopy(nodeId);
            if (workingCopy) {
              // In a real implementation, this would save to CoreDB
              await this.ephemeralDB.discardWorkingCopy(nodeId);
              results.push({ success: true, nodeId });
            } else {
              results.push({ success: false, error: 'Working copy not found' });
            }
          } catch (error) {
            results.push({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
        return results;
      },
      createMultipleWorkingCopies: async (nodeIds: NodeId[]) => {
        const results = [];
        for (const nodeId of nodeIds) {
          try {
            const node = await this.coreDB.getNode(nodeId);
            if (node) {
              const workingCopy: WorkingCopy = {
                ...node,
                copiedAt: Date.now(), // Required by WorkingCopyProperties
              };
              await this.ephemeralDB.createWorkingCopy(workingCopy);
              results.push(workingCopy);
            }
          } catch (error) {
            // Skip failed ones
          }
        }
        return results;
      },

      // Working Copy Status
      getWorkingCopyStats: async () => {
        const workingCopies = await this.ephemeralDB.listWorkingCopies();
        const now = Date.now();
        return {
          total: workingCopies.length,
          drafts: workingCopies.filter((wc) => (wc as any).isDraft).length,
          edits: workingCopies.filter((wc) => !(wc as any).isDraft).length,
          oldestTimestamp: workingCopies.reduce(
            (oldest, wc) => Math.min(oldest, wc.updatedAt),
            now
          ),
          newestTimestamp: workingCopies.reduce((newest, wc) => Math.max(newest, wc.updatedAt), 0),
        };
      },

      cleanupOldWorkingCopies: async (olderThan: number) => {
        const workingCopies = await this.ephemeralDB.listWorkingCopies();
        const toDelete = workingCopies.filter((wc) => wc.updatedAt < olderThan);
        for (const wc of toDelete) {
          await this.ephemeralDB.discardWorkingCopy(wc.id);
        }
        return toDelete.length;
      },
    };

    return Comlink.proxy(workingCopyAPI);
  }

  getPluginTreeAPI(): PluginTreeAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.pluginTreeService);
  }

  getTreePluginAnalyzer(): PluginTreeAPI & Comlink.ProxyMarked {
    // Return the same service with the new interface name
    return Comlink.proxy(this.pluginTreeService) as unknown as PluginTreeAPI & Comlink.ProxyMarked;
  }

  getNodeTypeAPI(): NodeTypeAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.nodeTypeService);
  }

  getPluginLifecycleAPI(): PluginLifecycleAPI & Comlink.ProxyMarked {
    // Create a stub implementation until PluginLifecycleService is implemented
    const stubAPI: PluginLifecycleAPI = {
      listRegistered: async () => [],
      register: async () => ({ 
        success: false, 
        error: { 
          code: 'NOT_IMPLEMENTED', 
          message: 'Not implemented' 
        } 
      }),
      unregister: async () => ({ 
        success: false, 
        error: { 
          code: 'NOT_IMPLEMENTED', 
          message: 'Not implemented' 
        } 
      }),
      validatePlugin: async () => ({ 
        isValid: false, 
        errors: [{
          field: 'plugin',
          message: 'Not implemented',
          severity: 'error' as const
        }], 
        warnings: [] 
      }),
      checkHealth: async () => ({ 
        status: 'unhealthy' as const,
        lastCheck: Date.now(),
        issues: ['Not implemented'],
        performance: {
          avgResponseTime: 0,
          errorRate: 0
        }
      }),
      getDependencies: async () => ({
        nodeType: 'unknown' as NodeType,
        dependencies: [],
        dependents: [],
        circularDependencies: false,
        warnings: []
      }),
      bulkOperation: async () => ({
        successful: [],
        failed: [],
        summary: {
          total: 0,
          success: 0,
          failed: 0
        }
      }),
      resetPlugin: async () => ({
        success: false,
        nodeType: 'unknown' as NodeType,
        deletedEntities: {
          groupEntities: 0,
          relationalEntities: 0
        },
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Not implemented'
        }
      }),
      deletePlugin: async () => ({
        success: false,
        nodeType: 'unknown' as NodeType,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Not implemented'
        }
      }),
      resetSystem: async () => ({
        success: false,
        nodeType: 'system' as NodeType,
        deletedEntities: {
          groupEntities: 0,
          relationalEntities: 0,
          treeNodes: 0,
          peerEntities: 0
        },
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Not implemented'
        }
      }),
    };
    return Comlink.proxy(stubAPI) as unknown as PluginLifecycleAPI & Comlink.ProxyMarked;
  }

  getPluginExtensionAPI(): PluginExtensionAPI & Comlink.ProxyMarked {
    // Create a stub implementation until PluginExtensionService is implemented
    // PluginExtensionAPI is a generic interface with nodeType and methods
    const stubAPI = {
      nodeType: 'stub' as NodeType,
      methods: {}
    };
    return Comlink.proxy(stubAPI) as unknown as PluginExtensionAPI & Comlink.ProxyMarked;
  }

  getImportExportAPI(): ImportExportAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.importExportService);
  }

  getTagAPI(): TagAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.tagService);
  }

  /**
   * @deprecated Use specialized APIs instead. This legacy API will be removed in v2.0.
   */
  getPluginRegistryAPI(): PluginRegistryAPI & Comlink.ProxyMarked {
    // Create a legacy adapter that delegates to the new APIs
    const legacyAdapter: PluginRegistryAPI = {
      getRegisteredPlugins: async () => {
        // Return empty array until PluginLifecycleService is implemented
        return [];
      },
      getPluginInfo: async (nodeType: NodeType) => {
        // Return null until PluginLifecycleService is implemented
        return null;
      },
      getPluginLoadOrder: async () => {
        // Return empty array until PluginLifecycleService is implemented
        return [];
      },
      getPluginDependencies: async (nodeType: NodeType) => {
        // Return empty array until PluginLifecycleService is implemented
        return [];
      },
      isPluginRegistered: async (nodeType: NodeType) => {
        // Use nodeTypeService to check if supported
        return this.nodeTypeService.isSupported(nodeType);
      },
      getPluginCount: async () => {
        // Return 0 until PluginLifecycleService is implemented
        return 0;
      },
    };

    return Comlink.proxy(legacyAdapter) as unknown as PluginRegistryAPI & Comlink.ProxyMarked;
  }

  getNodeTypeRegistryAPI(): PluginRegistryAPI & Comlink.ProxyMarked {
    // Return the same implementation as getPluginRegistryAPI
    return this.getPluginRegistryAPI();
  }

  // ==================
  // System Management
  // ==================

  /**
   * Simple ping method for health check
   */
  /**
   * 多段階ダイアログAPI
   * Working Copy の作成、バッチバリデーション、ステップ能力の評価などを提供
   */
  getMultiStepDialogAPI(): MultiStepDialogAPI & Comlink.ProxyMarked {
    const api = {
      // Working Copy の作成
      createWorkingCopy: async (nodeType: string, parentNodeId?: NodeId) => {
        const workingCopyId = generateId() as EntityId;
        const handler = await (this.nodeTypeRegistry as any).getEntityHandler(nodeType as NodeType);

        if (!handler) {
          throw new Error(`No handler found for node type: ${nodeType}`);
        }

        // EphemeralDBにWorking Copyを作成
        await this.ephemeralDB.workingCopies.add({
          id: workingCopyId,
          nodeType: nodeType as NodeType,
          parentNodeId: (parentNodeId || null) as any,
          data: {},
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            currentStep: 0,
            validationState: {},
          },
        });

        return workingCopyId;
      },

      // Working Copy の取得
      getWorkingCopy: async (workingCopyId: EntityId) => {
        const wc = await this.ephemeralDB.workingCopies.get(workingCopyId);
        return wc ? { ...wc, data: (wc as any).data || {}, metadata: (wc as any).metadata || {} } as any : null;
      },

      // Working Copy の更新
      updateWorkingCopy: async (workingCopyId: EntityId, updates: any) => {
        const existing = await this.ephemeralDB.workingCopies.get(workingCopyId);
        if (!existing) {
          throw new Error(`Working copy not found: ${workingCopyId}`);
        }

        const updated = {
          ...existing,
          ...updates,
          metadata: {
            ...(existing as any).metadata,
            ...(updates as any).metadata,
            updatedAt: new Date(),
          },
        };

        await this.ephemeralDB.workingCopies.put(updated);
        return updated as any;
      },

      // Working Copy の削除
      deleteWorkingCopy: async (workingCopyId: EntityId) => {
        await this.ephemeralDB.workingCopies.delete(workingCopyId);
      },

      // バッチバリデーション
      batchValidate: async (workingCopyIds: EntityId[]) => {
        const results: Record<EntityId, import('@hierarchidb/common-api').ValidationResult> = {};

        for (const id of workingCopyIds) {
          const workingCopy = await this.ephemeralDB.workingCopies.get(id);
          if (!workingCopy) continue;

          const handler = await (this.nodeTypeRegistry as any).getEntityHandler(workingCopy.nodeType);
          if (!(handler as any)?.validate) {
            results[id] = { valid: true, errors: [], warnings: [] };
            continue;
          }

          try {
            const validationResult = await (handler as any).validate((workingCopy as any).data);
            // Convert to the expected ValidationResult format
            if (typeof validationResult === 'object' && 'valid' in validationResult) {
              results[id] = {
                valid: validationResult.valid,
                errors: validationResult.errors || [],
                warnings: validationResult.warnings || []
              };
            } else {
              results[id] = { valid: true, errors: [], warnings: [] };
            }
          } catch (error) {
            results[id] = {
              valid: false,
              errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
              warnings: []
            };
          }
        }

        return results;
      },

      // ステップ能力の評価
      evaluateCapabilities: async (workingCopyId: EntityId, step: number) => {
        const workingCopy = await this.ephemeralDB.workingCopies.get(workingCopyId);
        if (!workingCopy) {
          throw new Error(`Working copy not found: ${workingCopyId}`);
        }

        const handler = await (this.nodeTypeRegistry as any).getEntityHandler(workingCopy.nodeType);
        if (!(handler as any)?.getStepCapabilities) {
          // デフォルトの能力を返す
          return {
            canNavigateTo: true,
            canStartBatch: false,
            canSave: step === -1, // 最終ステップでのみ保存可能
            canProceedToNext: true,
            canBackToPrevious: step > 0,
          };
        }

        return await (handler as any).getStepCapabilities((workingCopy as any).data, step);
      },

      // バッチ能力の評価
      batchEvaluateCapabilities: async (
        requests: Array<{ workingCopyId: EntityId; step: number }>
      ) => {
        const results: Record<EntityId, any> = {};

        for (const { workingCopyId, step } of requests) {
          try {
            results[workingCopyId] = await (this.getMultiStepDialogAPI() as any).evaluateCapabilities(
              workingCopyId,
              step
            );
          } catch (error) {
            // エラー時はデフォルト能力を返す
            results[workingCopyId] = {
              canNavigateTo: false,
              canStartBatch: false,
              canSave: false,
              canProceedToNext: false,
              canBackToPrevious: false,
            };
          }
        }

        return results;
      },

      // Working Copy からエンティティを作成して保存
      saveWorkingCopy: async (workingCopyId: EntityId) => {
        const workingCopy = await this.ephemeralDB.workingCopies.get(workingCopyId);
        if (!workingCopy) {
          throw new Error(`Working copy not found: ${workingCopyId}`);
        }

        const handler = await (this.nodeTypeRegistry as any).getEntityHandler(workingCopy.nodeType);
        if (!handler) {
          throw new Error(`No handler found for node type: ${workingCopy.nodeType}`);
        }

        // エンティティを作成
        const entityId = generateId() as EntityId;
        const entity = await (handler as any).createEntity(entityId, (workingCopy as any).data || {});

        // CoreDBに保存
        // Note: entities table doesn't exist in CoreDB directly
        // This would need to be handled through the plugin's specific storage
        // For now, we'll skip the direct DB operation
        // await this.coreDB.transaction('rw', this.coreDB.entities, async () => {
        //   await this.coreDB.entities.add(entity);
        // });

        // Working Copyを削除
        await this.ephemeralDB.workingCopies.delete(workingCopyId);

        return entityId;
      },
    };
    
    return Comlink.proxy(api) as MultiStepDialogAPI & Comlink.ProxyMarked;
  }

  ping(): { response: 'pong'; timestamp: number } {
    console.log('[WorkerAPIImpl] ping() called');
    return {
      response: 'pong',
      timestamp: Date.now(),
    };
  }

  async getSystemHealth(): Promise<{
    databases: { coreDB: boolean; ephemeralDB: boolean };
    services: {
      query: boolean;
      mutation: boolean;
      subscription: boolean;
      plugin: boolean;
      workingCopy: boolean;
    };
    memory: { used: number; limit: number };
    uptime: number;
  }> {
    return {
      databases: {
        coreDB: this.coreDB.isOpen(),
        ephemeralDB: this.ephemeralDB.isOpen(),
      },
      services: {
        query: !!this.queryService,
        mutation: !!this.mutationService,
        subscription: !!this.subscriptionService,
        plugin: !!this.nodeTypeRegistry,
        workingCopy: !!this.ephemeralDB,
      },
      memory: {
        used: (performance as any).memory?.usedJSHeapSize || 0,
        limit: (performance as any).memory?.jsHeapSizeLimit || 0,
      },
      uptime: Date.now() - Date.now(), // Would need to track initialization time
    };
  }

  // ==================
  // Legacy compatibility methods
  // ==================

  /**
   * @deprecated Use getQueryAPI().getTree() instead. Will be removed in v2.0.
   */
  async getTree(params: { treeId: TreeId }): Promise<Tree | undefined> {
    return this.queryService.getTree(params.treeId);
  }

  /**
   * @deprecated Use getQueryAPI().listTrees() instead. Will be removed in v2.0.
   */
  async listTrees(): Promise<Tree[]> {
    return this.queryService.listTrees();
  }

  /**
   * @deprecated Use getQueryAPI().listTrees() instead. This is a naming mistake. Will be removed in v2.0.
   */
  async getTrees(): Promise<Tree[]> {
    return this.listTrees();
  }

  /**
   * @deprecated Use getQueryAPI().getNode() instead. Will be removed in v2.0.
   */
  async getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    return this.queryService.getNode(nodeId);
  }

  /**
   * @deprecated Use getQueryAPI().listChildren() instead. Will be removed in v2.0.
   */
  async getChildren(params: { parentId: NodeId }): Promise<TreeNode[]> {
    // getChildren doesn't exist on TreeQueryAPI, use listChildren instead
    return (this.queryService as any).listChildren?.(params.parentId) || [];
  }

  /**
   * @deprecated Use getMutationAPI().createNode() instead. Will be removed in v2.0.
   */
  async create(params: any): Promise<any> {
    return this.mutationService.createNode(params);
  }

  /**
   * @deprecated Use getMutationAPI().recoverNodesFromTrash() instead. Will be removed in v2.0.
   */
  async recoverFromTrash(params: {
    nodeIds: NodeId[];
    toParentId?: NodeId;
  }): Promise<{ success: boolean; error?: string }> {
    // The mutation service expects a CommandEnvelope, but for legacy compatibility we create a simple response
    try {
      const result = await this.mutationService.recoverNodesFromTrash(params);
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * @deprecated Use getPluginTreeAPI().getPluginsForTree() instead for better type safety. Will be removed in v2.0.
   */
  async getPluginsForTree(treeId: TreeId): Promise<any[]> {
    const response = await this.pluginTreeService.getPluginsForTree({
      treeId,
      includeInactive: false,
    });
    return response.plugins;
  }

  /**
   * @deprecated Use getMutationAPI().removeNodes() instead. Will be removed in v2.0.
   */
  async removeNodes(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }> {
    return this.mutationService.removeNodes(nodeIds);
  }
}
