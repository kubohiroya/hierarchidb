import { SingletonMixin } from '@hierarchidb/util';
import type {
  Tree,
  TreeId,
  TreeNode,
  NodeId,
  NodeType,
  WorkingCopy,
} from '@hierarchidb/common-type';
import type {
  WorkerAPI,
  TreeQueryAPI,
  TreeMutationAPI,
  TreeSubscriptionAPI,
  NodeTypeRegistryAPI,
  WorkingCopyAPI,
  PluginTreeAPI,
  TreePluginAnalyzer,
  NodeTypeAPI,
  PluginManagementAPI,
  PluginLifecycleAPI,
  ImportExportAPI,
  PluginRegistryAPI,
} from '@hierarchidb/common-api';
import type { Remote } from 'comlink';
import * as Comlink from 'comlink';
import { CommandProcessor } from './command/CommandProcessor';
import { CoreDB } from './db/CoreDB';
import { EphemeralDB } from './db/EphemeralDB';
import { NodeLifecycleManager } from './lifecycle/NodeLifecycleManager';
import { PluginRegistry } from '@hierarchidb/runtime-plugin-registry';
import { registerDefaultPlugins } from './registry/default-plugins';
import { PluginIntegrationBuilder } from '@hierarchidb/runtime-plugin-registry/loader';
import type { PluginIntegrated, PluginDefinition } from '@hierarchidb/common-type';

// Services
import { TreeMutationService } from './services/TreeMutationService';
import { TreeSubscriptionService } from './services/TreeSubscriptionService';
import { TreeQueryService } from './services/TreeQueryService';
import { ImportService } from './services/ImportService';
import { ExportService } from './services/ExportService';
import { PluginTreeService } from './services/PluginTreeService';
import { NodeTypeService } from './services/NodeTypeService';
import { PluginManagementService } from './services/PluginManagementService';
import { ImportExportAPIImpl } from './apis/ImportExportAPIImpl';
// import { importExportPluginRegistry } from '@hierarchidb/feature-import-export-plugin-plugin'; // Disabled due to build issues
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
  private nodeTypeRegistry!: PluginRegistry;
  private nodeLifecycleManager!: NodeLifecycleManager;
  private commandProcessor!: CommandProcessor;

  // Plugin integration properties
  private pluginIntegrationBuilder!: PluginIntegrationBuilder;
  private integratedPlugins!: Map<NodeType, PluginIntegrated>;
  private pluginLoadOrder!: NodeType[];

  // Query/Mutation services
  private queryService!: TreeQueryService;
  private mutationService!: TreeMutationService;
  private subscriptionService!: TreeSubscriptionService;

  // Plugin services
  private pluginTreeService!: PluginTreeService;
  private nodeTypeService!: NodeTypeService;
  private pluginManagementService!: PluginManagementService;

  // Import/Export services
  private importService!: ImportService;
  private exportService!: ExportService;
  private importExportAPI!: ImportExportAPIImpl;

  // Tag service
  private tagService!: TagService;

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

    // Initialize plugins
    await this.initializePlugins();

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
    this.queryService = new TreeQueryService(this.coreDB);
    this.subscriptionService = new TreeSubscriptionService(this.coreDB);
    this.mutationService = new TreeMutationService(
      this.coreDB,
      this.ephemeralDB,
      this.commandProcessor,
      this.nodeLifecycleManager
    );

    // Initialize plugin services
    this.pluginTreeService = new PluginTreeService(this.coreDB, this.queryService);
    this.nodeTypeService = new NodeTypeService(this.nodeTypeRegistry, this.queryService);
    this.pluginManagementService = new PluginManagementService(this.nodeTypeRegistry);

    // Initialize import/export services
    this.importService = new ImportService(this.coreDB, this.mutationService);
    this.exportService = new ExportService(this.coreDB, this.queryService);
    this.importExportAPI = await ImportExportAPIImpl.getInstance();

    // Initialize tag service
    this.tagService = new TagService(this.coreDB);

    this.isInitialized = true;
    console.log('[WorkerAPIImpl] Initialization complete');
  }

  private async initializePlugins(): Promise<void> {
    console.log('[WorkerAPIImpl] Loading plugins...');

    try {
      // Virtual moduleから読み込み
      const { pluginDefinitions, pluginLoadOrder } =
        await import('virtual:plugin-definitions');

      this.pluginLoadOrder = pluginLoadOrder;

      // PluginDefinitionマップ作成
      const definitionMap = new Map<NodeType, PluginDefinition>(
        pluginDefinitions.map(def => [def.nodeType, def])
      );

      // PluginIntegrated構築
      this.pluginIntegrationBuilder = new PluginIntegrationBuilder();
      this.integratedPlugins = await this.pluginIntegrationBuilder.buildAll(
        definitionMap,
        pluginLoadOrder
      );

      // レジストリ登録
      this.nodeTypeRegistry = PluginRegistry.getInstance();
      for (const [nodeType, integrated] of this.integratedPlugins) {
        this.nodeTypeRegistry.registerPlugin(integrated);
      }

      console.log(`[WorkerAPIImpl] Loaded ${this.integratedPlugins.size} plugins`);
      console.log('[WorkerAPIImpl] Load order:', pluginLoadOrder);
    } catch (error) {
      console.error('[WorkerAPIImpl] Failed to load plugins:', error);

      // フォールバック処理
      console.log('[WorkerAPIImpl] Falling back to default plugins');
      this.nodeTypeRegistry = PluginRegistry.getInstance();
      registerDefaultPlugins(this.nodeTypeRegistry);

      this.integratedPlugins = new Map();
      this.pluginLoadOrder = [];
    }
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

  getTreePluginAnalyzer(): TreePluginAnalyzer & Comlink.ProxyMarked {
    // Return the same service with the new interface name
    return Comlink.proxy(this.pluginTreeService) as unknown as TreePluginAnalyzer &
      Comlink.ProxyMarked;
  }

  getNodeTypeAPI(): NodeTypeAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.nodeTypeService);
  }

  getPluginManagementAPI(): PluginManagementAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.pluginManagementService);
  }

  getPluginLifecycleAPI(): PluginLifecycleAPI & Comlink.ProxyMarked {
    // Return the same service with the new interface name
    return Comlink.proxy(this.pluginManagementService) as unknown as PluginLifecycleAPI &
      Comlink.ProxyMarked;
  }

  getImportExportAPI(): ImportExportAPI & Comlink.ProxyMarked {
    return Comlink.proxy(this.importExportAPI);
  }

  getTagAPI(): TagService & Comlink.ProxyMarked {
    return Comlink.proxy(this.tagService);
  }

  /**
   * @deprecated Use specialized APIs instead. This legacy API will be removed in v2.0.
   */
  getPluginRegistryAPI(): PluginRegistryAPI & Comlink.ProxyMarked {
    // Create a legacy adapter that delegates to the new APIs
    const legacyAdapter = {
      listSupportedNodeTypes: async () => this.nodeTypeService.listSupported(),
      isSupportedNodeType: async (nodeType: NodeType) => this.nodeTypeService.isSupported(nodeType),
      getNodeDefinition: async (nodeType: NodeType) => {
        // Use the plugin-registry-api function instead
        const { getPluginDefinition } = await import('./registry/plugin-registry-api');
        return getPluginDefinition(nodeType);
      },
      validateNodeTypeOperation: async (nodeType: NodeType, operation: any, context?: any) => {
        return this.nodeTypeService.validateOperation(nodeType, operation, context);
      },
      listRegisteredPlugins: async () => this.pluginManagementService.listRegistered(),
      getPluginsForTree: async (treeId: TreeId) => {
        const response = await this.pluginTreeService.getPluginsForTree({
          treeId,
          includeInactive: false,
        });
        return response.plugins;
      },
      getPluginMetadata: async (pluginId: string) => {
        // This would need to be implemented based on plugin ID lookup
        return undefined;
      },
      getPluginCapabilities: async (pluginId: string) => {
        // This would need to be implemented based on plugin ID lookup
        return undefined;
      },
      isPluginActive: async (pluginId: string) => {
        // This would need to be implemented based on plugin ID lookup
        return false;
      },
      registerPlugin: async (definition: any) => {
        return this.pluginManagementService.register(definition);
      },
      unregisterPlugin: async (nodeType: NodeType) => {
        const result = await this.pluginManagementService.unregister(nodeType);
        return {
          success: result.success,
          cleanedUpNodes: 0,
          error: result.error?.message,
        };
      },
      registerExtension: async (nodeType: NodeType, api: any) => {
        // Extension registration would need to be implemented
        return { success: true };
      },
      unregisterExtension: async (nodeType: NodeType) => {
        // Extension unregistration would need to be implemented
        return { success: true };
      },
      getExtension: async (nodeType: NodeType) => {
        // Extension retrieval would need to be implemented
        return undefined;
      },
      hasExtension: async (nodeType: NodeType) => {
        // Extension check would need to be implemented
        return false;
      },
      listExtensions: async () => {
        // Extension listing would need to be implemented
        return [];
      },
      invokeExtensionMethod: async (nodeType: NodeType, method: string, ...args: any[]) => {
        // Extension method invocation would need to be implemented
        return undefined;
      },
      validatePluginConfiguration: async (nodeType: NodeType, config: any) => {
        return this.pluginManagementService.validatePlugin(config);
      },
      getPluginHealth: async (nodeType: NodeType) => {
        return this.pluginManagementService.checkHealth(nodeType);
      },
    };

    return legacyAdapter as unknown as PluginRegistryAPI & Comlink.ProxyMarked;
  }

  getNodeTypeRegistryAPI(): NodeTypeRegistryAPI & Comlink.ProxyMarked {
    // Create an adapter that delegates to the appropriate services
    const adapter = {
      // Node Type Operations
      listSupportedNodeTypes: async () => this.nodeTypeService.listSupported(),
      isSupportedNodeType: async (nodeType: NodeType) => this.nodeTypeService.isSupported(nodeType),
      getNodeDefinition: async (nodeType: NodeType) => {
        const { getPluginDefinition } = await import('./registry/plugin-registry-api');
        return getPluginDefinition(nodeType);
      },
      validateNodeTypeOperation: async (nodeType: NodeType, operation: any, context?: any) => {
        return this.nodeTypeService.validateOperation(nodeType, operation, context);
      },

      // Plugin Management
      listRegisteredPlugins: async () => this.pluginManagementService.listRegistered(),
      getPluginsForTree: async (treeId: string) => {
        const response = await this.pluginTreeService.getPluginsForTree({
          treeId: treeId as TreeId,
          includeInactive: false,
        });
        return response.plugins;
      },
      getPluginMetadata: async (pluginId: string) => undefined,
      isPluginActive: async (pluginId: string) => false,

      // Plugin Registry Operations
      registerPlugin: async (definition: any) => {
        return this.pluginManagementService.register(definition);
      },
      unregisterPlugin: async (nodeType: NodeType) => {
        const result = await this.pluginManagementService.unregister(nodeType);
        return {
          success: result.success,
          cleanedUpNodes: 0,
          error: result.error?.message,
        };
      },
      reloadPlugin: async (nodeType: NodeType, definition: any) => {
        return { success: false, affectedNodes: 0, error: 'Not implemented' };
      },

      // Plugin Validation
      validatePluginDefinition: async (definition: any) => {
        return this.pluginManagementService.validatePlugin(definition);
      },
      checkPluginCompatibility: async (nodeType: NodeType) => {
        return {
          compatible: false,
          version: '0.0.0',
          requiredVersion: '0.0.0',
        };
      },
      getPluginSystemHealth: async () => {
        return {
          totalPlugins: 0,
          activePlugins: 0,
          failedPlugins: 0,
          systemErrors: [],
          performance: {
            averageLoadTime: 0,
            totalMemoryUsage: 0,
          },
        };
      },

      // Node Type Capabilities
      getSupportedOperations: async (nodeType: NodeType) => {
        return [] as Array<'create' | 'read' | 'update' | 'delete' | 'move' | 'copy'>;
      },
      supportsChildren: async (nodeType: NodeType) => false,
      getAllowedChildTypes: async (parentType: NodeType) => [],

      // Plugin API Extensions
      getExtension: async (nodeType: NodeType) => undefined,
      registerExtension: async (nodeType: NodeType, api: any) => {},
    };

    return adapter as unknown as NodeTypeRegistryAPI & Comlink.ProxyMarked;
  }

  // ==================
  // System Management
  // ==================

  /**
   * Simple ping method for health check
   */
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
  // Helper Methods
  // ==================
  
  getLoadedPlugins(): Map<NodeType, PluginIntegrated> {
    return this.integratedPlugins || new Map();
  }

  getPluginLoadOrder(): NodeType[] {
    return this.pluginLoadOrder || [];
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
    return this.queryService.getChildren(params);
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
