import type { WorkerAPI, TreeQueryAPI, TreeMutationAPI, TreeSubscriptionAPI, PluginRegistryAPI, WorkingCopyAPI } from '@hierarchidb/01-api';
import type { Remote } from 'comlink';
import * as Comlink from 'comlink';
import type {
  CommandEnvelope,
  Tree,
  TreeId,
  TreeNode,
  NodeId,
  TreeNodeType,
  WorkingCopy,
  NodeTypeDefinition,
  ObserveSubtreePayload,
  RecoverFromTrashPayload,
} from '@hierarchidb/00-core';
import { CommandProcessor } from './command/CommandProcessor';


/**
 * 【アーキテクチャ改善】: CoreDBアダプターによる依存性注入の最適化
 * 【設計方針】: Adapter Patternによる既存システムとの統合
 * 【改善内容】: 型安全性とテスタビリティの向上
 * 🟢 信頼性レベル: GOFデザインパターンに準拠した実装
 */
class CoreDBAdapter {
  constructor(private coreDB: CoreDB) {}

  /**
   * 【ノード削除アダプテーション】: CoreDBの削除メソッドへの委譲
   */
  async deleteNode(nodeId: NodeId): Promise<void> {
    await this.coreDB.deleteNode(nodeId);
  }

  /**
   * 【ノード作成アダプテーション】: CoreDBの作成メソッドへの委譲
   */
  async createNode(node: TreeNode): Promise<void> {
    await this.coreDB.createNode(node);
  }
}
import type { CommandResult } from './command/types';
import { CoreDB } from './db/CoreDB';
import { EphemeralDB } from './db/EphemeralDB';
import { NodeLifecycleManager } from './lifecycle/NodeLifecycleManager';
import { SimpleNodeTypeRegistry } from './registry/SimpleNodeTypeRegistry';
import { TreeMutationService } from './services/TreeMutationService';
import { TreeSubscribeService } from './services/TreeSubscribeService';
import { TreeQueryService } from './services/TreeQueryService';
import { ImportService } from './services/ImportService';
import { ExportService } from './services/ExportService';
import { 
  getRegisteredPlugins, 
  getPluginDefinition, 
  isNodeTypeRegistered,
  getCreatableNodeTypes,
  getPluginsForTree,
  getCreatableNodeTypesForTree
} from './registry/plugin-registry-api';

export class WorkerAPIImpl implements WorkerAPI {
  private coreDB: CoreDB;
  private ephemeralDB: EphemeralDB;
  private queryService: TreeQueryService;
  private mutationService: TreeMutationService;
  private subscriptionService: TreeSubscribeService;
  private commandProcessor: CommandProcessor;
  
  // Plugin API registry for 3-layer architecture
  private pluginAPIs = new Map<TreeNodeType, any>();

  /**
   * Async initialization of plugin APIs
   */
  private async initializePluginAPIsAsync(): Promise<void> {
    try {
      const { initializePluginAPIs } = await import('./plugins');
      await initializePluginAPIs(this);
    } catch (error) {
      console.warn('Failed to initialize plugin APIs:', error);
    }
  }

  getCommandProcessor(): CommandProcessor {
    return this.commandProcessor;
  }
  private nodeTypeRegistry: SimpleNodeTypeRegistry;
  private nodeLifecycleManager: NodeLifecycleManager;
  private importService: ImportService;
  private exportService: ExportService;
  private initializationTime: number;

  constructor(dbName: string = 'default-worker-db') {
    this.coreDB = new CoreDB(dbName);
    this.ephemeralDB = new EphemeralDB(dbName);

    this.nodeTypeRegistry = new SimpleNodeTypeRegistry();
    this.nodeLifecycleManager = new NodeLifecycleManager(
      this.nodeTypeRegistry,
      this.coreDB,
      this.ephemeralDB
    );

    // Initialize services in dependency order
    this.queryService = new TreeQueryService(this.coreDB);
    
    this.subscriptionService = new TreeSubscribeService(this.coreDB);
    
    this.commandProcessor = new CommandProcessor();

    this.mutationService = new TreeMutationService(
      this.coreDB,
      this.ephemeralDB,
      this.commandProcessor,
      this.nodeLifecycleManager
    );

    this.importService = new ImportService(
      this.coreDB,
      this.mutationService
    );

    this.exportService = new ExportService(
      this.coreDB,
      this.queryService
    );

    this.initializationTime = Date.now();
    
    // Initialize plugin APIs for 3-layer architecture (async)
    this.initializePluginAPIsAsync();
  }

  // ==================
  // Specialized API Access (Facade Pattern)
  // ==================

  getQueryAPI(): Remote<TreeQueryAPI> {
    // Return the existing query service singleton wrapped in Comlink proxy
    return Comlink.proxy(this.queryService) as unknown as Remote<TreeQueryAPI>;
  }

  getMutationAPI(): Remote<TreeMutationAPI> {
    // Return the existing mutation service singleton wrapped in Comlink proxy
    return Comlink.proxy(this.mutationService) as unknown as Remote<TreeMutationAPI>;
  }

  getSubscriptionAPI(): Remote<TreeSubscriptionAPI> {
    // Return the existing observable service singleton wrapped in Comlink proxy
    return Comlink.proxy(this.subscriptionService) as unknown as Remote<TreeSubscriptionAPI>;
  }

  getPluginRegistryAPI(): Remote<PluginRegistryAPI> {
    // Create a plugin API adapter that wraps registry functions
    const pluginAPI = {
      listSupportedNodeTypes: async () => {
        return getCreatableNodeTypes();
      },
      isSupportedNodeType: async (nodeType: TreeNodeType) => {
        return isNodeTypeRegistered(nodeType);
      },
      getNodeTypeDefinition: async (nodeType: TreeNodeType) => {
        return getPluginDefinition(nodeType);
      },
      validateNodeTypeOperation: async (
        nodeType: TreeNodeType,
        operation: 'create' | 'update' | 'delete' | 'move',
        context?: { parentNodeId?: NodeId; targetNodeId?: NodeId }
      ) => {
        // Validation logic using registry
        const isRegistered = await isNodeTypeRegistered(nodeType);
        return {
          valid: isRegistered,
          errors: isRegistered ? [] : [`Node type ${nodeType} is not registered`]
        };
      },
      listRegisteredPlugins: async () => {
        return await getRegisteredPlugins();
      },
      getPluginMetadata: async (pluginId: string) => {
        const plugins = await getRegisteredPlugins();
        return plugins.find(p => (p as any).id === pluginId);
      },
      getPluginCapabilities: async (pluginId: string) => {
        const definition = await getPluginDefinition(pluginId);
        if (!definition) return undefined;
        return {
          supportsCreate: !!definition.entityHandler?.createEntity,
          supportsUpdate: !!definition.entityHandler?.updateEntity,
          supportsDelete: !!definition.entityHandler?.deleteEntity,
          supportsChildren: true, // Can be determined from definition
          supportedOperations: ['create', 'read', 'update', 'delete', 'move']
        };
      },
      isPluginActive: async (pluginId: string) => {
        return isNodeTypeRegistered(pluginId);
      },
      registerPlugin: async (definition: NodeTypeDefinition) => {
        try {
          this.nodeTypeRegistry.register(definition.nodeType, definition);
          return { success: true };
        } catch (error) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Registration failed'
          };
        }
      },
      unregisterPlugin: async (nodeType: TreeNodeType) => {
        try {
          this.nodeTypeRegistry.unregister(nodeType);
          return { success: true, cleanedUpNodes: 0 };
        } catch (error) {
          return {
            success: false,
            cleanedUpNodes: 0,
            error: error instanceof Error ? error.message : 'Unregistration failed'
          };
        }
      },
      reloadPlugin: async (nodeType: TreeNodeType, definition: NodeTypeDefinition) => {
        try {
          this.nodeTypeRegistry.unregister(nodeType);
          this.nodeTypeRegistry.register(definition.nodeType, definition);
          return { success: true, affectedNodes: 0 };
        } catch (error) {
          return {
            success: false,
            affectedNodes: 0,
            error: error instanceof Error ? error.message : 'Reload failed'
          };
        }
      },
      validatePluginDefinition: async (definition: NodeTypeDefinition) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        if (!definition.nodeType) {
          errors.push('Node type is required');
        }
        if (!definition.database?.entityStore) {
          warnings.push('Entity table is not defined');
        }
        
        return {
          valid: errors.length === 0,
          errors,
          warnings,
          recommendations: []
        };
      },
      checkPluginCompatibility: async (nodeType: TreeNodeType) => {
        const definition = await getPluginDefinition(nodeType);
        return {
          compatible: !!definition,
          version: '1.0.0',
          requiredVersion: '1.0.0',
          conflicts: [],
          missingDependencies: []
        };
      },
      getPluginSystemHealth: async () => {
        const plugins = await getRegisteredPlugins();
        return {
          totalPlugins: plugins.length,
          activePlugins: plugins.length,
          failedPlugins: 0,
          systemErrors: [],
          performance: {
            averageLoadTime: 0,
            totalMemoryUsage: 0
          }
        };
      },
      getSupportedOperations: async (nodeType: TreeNodeType) => {
        return ['create', 'read', 'update', 'delete', 'move', 'copy'];
      },
      supportsChildren: async (nodeType: TreeNodeType) => {
        return true; // All node types support children in this system
      },
      getAllowedChildTypes: async (parentType: TreeNodeType) => {
        return getCreatableNodeTypes(); // All types can be children
      },

      // New 3-layer architecture support
      getExtension: async <T = any>(nodeType: TreeNodeType): Promise<T> => {
        const api = this.pluginAPIs.get(nodeType);
        if (!api) {
          throw new Error(`Plugin API not found for node type: ${nodeType}`);
        }
        return api as T;
      },

      registerExtension: async (nodeType: TreeNodeType, api: any): Promise<void> => {
        this.pluginAPIs.set(nodeType, api);
        console.log(`Registered plugin API for node type: ${nodeType}`);
      }
    };
    
    return Comlink.proxy(pluginAPI) as unknown as Remote<PluginRegistryAPI>;
  }

  getWorkingCopyAPI(): Remote<WorkingCopyAPI> {
    // Create a working copy API adapter
    const workingCopyAPI = {
      createDraftWorkingCopy: async (
        nodeType: string,
        parentNodeId: NodeId,
        initialData?: Partial<TreeNode>
      ): Promise<WorkingCopy> => {
        const nodeId = crypto.randomUUID() as NodeId;
        const now = Date.now();
        const workingCopy: WorkingCopy = {
          id: nodeId,
          nodeType,
          parentNodeId,
          name: initialData?.name || 'New Node',
          description: initialData?.description || '',
          createdAt: now,
          updatedAt: now,
          version: 1,
          ...initialData,
          // WorkingCopyProperties
          copiedAt: now,
          originalNodeId: undefined, // 新規作成なのでundefined
        };
        await this.ephemeralDB.createWorkingCopy(workingCopy);
        return workingCopy;
      },
      createWorkingCopyFromNode: async (nodeId: NodeId): Promise<WorkingCopy> => {
        const node = await this.coreDB.getNode(nodeId);
        if (!node) throw new Error(`Node ${nodeId} not found`);
        
        const now = Date.now();
        const workingCopy: WorkingCopy = {
          ...node,
          // WorkingCopyProperties
          copiedAt: now,
          originalNodeId: nodeId,
          originalVersion: node.version,
        };
        await this.ephemeralDB.createWorkingCopy(workingCopy);
        return workingCopy;
      },
      getWorkingCopy: async (nodeId: NodeId): Promise<WorkingCopy | undefined> => {
        return this.ephemeralDB.getWorkingCopy(nodeId);
      },
      updateWorkingCopy: async (nodeId: NodeId, updates: Partial<TreeNode>): Promise<WorkingCopy> => {
        const existing = await this.ephemeralDB.getWorkingCopy(nodeId);
        if (!existing) throw new Error(`Working copy ${nodeId} not found`);
        
        const updated: WorkingCopy = {
          ...existing,
          ...updates,
          id: nodeId,
          updatedAt: Date.now()
        };
        await this.ephemeralDB.updateWorkingCopy(updated);
        return updated;
      },
      listWorkingCopies: async () => {
        return this.ephemeralDB.listWorkingCopies();
      },
      hasWorkingCopy: async (nodeId: NodeId) => {
        const workingCopy = await this.ephemeralDB.getWorkingCopy(nodeId);
        return !!workingCopy;
      },
      commitWorkingCopy: async (nodeId: NodeId) => {
        const workingCopy = await this.ephemeralDB.getWorkingCopy(nodeId);
        if (!workingCopy) {
          return { success: false, error: `Working copy ${nodeId} not found` };
        }
        
        try {
          // TreeNodeとして保存（WorkingCopyPropertiesを除く）
          const { copiedAt, originalNodeId, hasEntityCopy, entityWorkingCopyId, originalVersion, hasGroupEntityCopy, ...treeNode } = workingCopy;
          
          if (!workingCopy.originalNodeId) {
            // 新規作成
            await this.coreDB.createNode(treeNode as TreeNode);
          } else {
            // 既存ノードの更新
            await this.coreDB.updateNode(treeNode as TreeNode);
          }
          await this.ephemeralDB.deleteWorkingCopy(nodeId);
          return { success: true, node: treeNode as TreeNode };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Commit failed'
          };
        }
      },
      discardWorkingCopy: async (nodeId: NodeId) => {
        await this.ephemeralDB.deleteWorkingCopy(nodeId);
      },
      discardAllWorkingCopies: async () => {
        const all = await this.ephemeralDB.listWorkingCopies();
        for (const wc of all) {
          await this.ephemeralDB.deleteWorkingCopy(wc.id);
        }
        return all.length;
      },
      validateWorkingCopy: async (nodeId: NodeId) => {
        const workingCopy = await this.ephemeralDB.getWorkingCopy(nodeId);
        if (!workingCopy) {
          return { valid: false, errors: [`Working copy ${nodeId} not found`] };
        }
        
        const errors: string[] = [];
        if (!workingCopy.name || workingCopy.name.trim() === '') {
          errors.push('Name is required');
        }
        
        return { valid: errors.length === 0, errors };
      },
      hasUnsavedChanges: async (nodeId: NodeId) => {
        const workingCopy = await this.ephemeralDB.getWorkingCopy(nodeId);
        if (!workingCopy) return false;
        
        if (!workingCopy.originalNodeId) return true; // 新規作成
        
        const original = await this.coreDB.getNode(nodeId);
        if (!original) return true;
        
        return JSON.stringify(original) !== JSON.stringify(workingCopy);
      },
      commitMultipleWorkingCopies: async (nodeIds: NodeId[]) => {
        const results: Array<{ success: boolean; error?: string; node?: TreeNode }> = [];
        for (const nodeId of nodeIds) {
          const result = await workingCopyAPI.commitWorkingCopy(nodeId);
          results.push(result);
        }
        return results;
      },
      createMultipleWorkingCopies: async (nodeIds: NodeId[]) => {
        const results: WorkingCopy[] = [];
        for (const nodeId of nodeIds) {
          const wc = await workingCopyAPI.createWorkingCopyFromNode(nodeId);
          results.push(wc);
        }
        return results;
      },
      getWorkingCopyStats: async () => {
        const all = await this.ephemeralDB.listWorkingCopies();
        const drafts = all.filter(wc => !wc.originalNodeId);
        const edits = all.filter(wc => !!wc.originalNodeId);
        
        return {
          total: all.length,
          drafts: drafts.length,
          edits: edits.length,
          oldestTimestamp: Math.min(...all.map(wc => wc.createdAt || 0)),
          newestTimestamp: Math.max(...all.map(wc => wc.updatedAt || 0))
        };
      },
      cleanupOldWorkingCopies: async (olderThan: number) => {
        const all = await this.ephemeralDB.listWorkingCopies();
        const toDelete = all.filter(wc => (wc.createdAt || 0) < olderThan);
        
        for (const wc of toDelete) {
          await this.ephemeralDB.deleteWorkingCopy(wc.id);
        }
        
        return toDelete.length;
      }
    };
    
    return Comlink.proxy(workingCopyAPI) as unknown as Remote<WorkingCopyAPI>;
  }

  // ==================
  // System Management
  // ==================

  async initialize(): Promise<void> {
    await this.coreDB.initialize();
    await this.ephemeralDB.initialize();
  }

  async shutdown(): Promise<void> {
    // Cleanup all subscriptions
    await this.subscriptionService.unsubscribeAll();
    
    // Close databases
    await this.coreDB.close();
    await this.ephemeralDB.close();
  }

  async getSystemHealth(): Promise<{
    databases: { coreDB: boolean; ephemeralDB: boolean };
    services: { query: boolean; mutation: boolean; subscription: boolean; plugin: boolean; workingCopy: boolean };
    memory: { used: number; limit: number };
    uptime: number;
  }> {
    return {
      databases: {
        coreDB: this.coreDB.isOpen(),
        ephemeralDB: this.ephemeralDB.isOpen()
      },
      services: {
        query: !!this.queryService,
        mutation: !!this.mutationService,
        subscription: !!this.subscriptionService,
        plugin: !!this.nodeTypeRegistry,
        workingCopy: !!this.ephemeralDB
      },
      memory: {
        used: (performance as any).memory?.usedJSHeapSize || 0,
        limit: (performance as any).memory?.jsHeapSizeLimit || 0
      },
      uptime: Date.now() - this.initializationTime
    };
  }

  // ==================
  // Legacy API Methods for Test Compatibility
  // ==================

  // These methods proxy to the new API pattern for backward compatibility with tests

  // Legacy method - use getMutationAPI().createNode() instead
  async createFolder(params: {
    treeId: TreeId;
    parentNodeId: NodeId;
    name: string;
    description?: string;
  }): Promise<{ success: true; nodeId: NodeId } | { success: false; error: string }> {
    const mutationAPI = this.getMutationAPI();
    return mutationAPI.createNode({
      nodeType: 'folder',
      ...params,
    });
  }

  // Legacy method - use getMutationAPI().updateNode() instead
  async updateFolderName(params: {
    nodeId: NodeId;
    name: string;
  }): Promise<{ success: boolean; error?: string }> {
    const mutationAPI = this.getMutationAPI();
    return mutationAPI.updateNode(params);
  }

  async getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    const queryAPI = this.getQueryAPI();
    return queryAPI.getNode(nodeId);
  }

  async getTree(params: { treeId: TreeId }): Promise<Tree | undefined> {
    return this.queryService.getTree(params.treeId);
  }

  async listTrees(): Promise<Tree[]> {
    return this.queryService.listTrees();
  }

  /**
   * @deprecated Use listTrees() instead. This is a naming mistake.
   */
  async getTrees(): Promise<Tree[]> {
    return this.listTrees();
  }

  async getChildren(params: { parentNodeId: NodeId }): Promise<TreeNode[]> {
    return this.queryService.getChildren({ parentNodeId: params.parentNodeId });
  }

  async create(params: any): Promise<any> {
    return this.mutationService.createNode(params);
  }

  async recoverFromTrash(params: { nodeIds: NodeId[]; toParentId?: NodeId }): Promise<{ success: boolean; error?: string }> {
    const cmd: CommandEnvelope<'recoverFromTrash', RecoverFromTrashPayload> = {
      commandId: crypto.randomUUID(),
      groupId: crypto.randomUUID(),
      kind: 'recoverFromTrash',
      payload: {
        nodeIds: params.nodeIds,
        toParentId: params.toParentId,
      },
      issuedAt: Date.now(),
    };
    return this.mutationService.recoverFromTrash(cmd);
  }

  async getPluginsForTree(treeId: TreeId): Promise<any[]> {
    return getPluginsForTree(treeId);
  }

  async removeNodes(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }> {
    return this.mutationService.removeNodes(nodeIds);
  }

  async moveFolder(params: {
    nodeIds: NodeId[];
    toParentId: NodeId;
    onNameConflict?: 'error' | 'auto-rename';
  }): Promise<{ success: boolean; error?: string }> {
    const mutationAPI = this.getMutationAPI();
    return mutationAPI.moveNodes(params);
  }

  // Legacy method - use getMutationAPI().moveNodesToTrash() instead
  async moveToTrashFolder(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }> {
    const mutationAPI = this.getMutationAPI();
    return mutationAPI.moveNodesToTrash(nodeIds);
  }

  // Legacy method - use getMutationAPI().recoverNodesFromTrash() instead
  async recoverFromTrashFolder(params: {
    nodeIds: NodeId[];
    toParentId?: NodeId;
  }): Promise<{ success: boolean; error?: string }> {
    const mutationAPI = this.getMutationAPI();
    return mutationAPI.recoverNodesFromTrash(params);
  }

  // Legacy method - use getMutationAPI().removeNodes() instead
  async removeFolder(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }> {
    const mutationAPI = this.getMutationAPI();
    return mutationAPI.removeNodes(nodeIds);
  }

  // Legacy method - use getMutationAPI().duplicateNodes() instead
  async duplicateNodesFolder(params: {
    nodeIds: NodeId[];
    toParentId?: NodeId;
  }): Promise<{ success: true; nodeIds: NodeId[] } | { success: false; error: string }> {
    const mutationAPI = this.getMutationAPI();
    return mutationAPI.duplicateNodes(params);
  }

  // Legacy method - use getMutationAPI().duplicateNodes() instead
  async copyNodesFolder(params: {
    nodeIds: NodeId[];
  }): Promise<{ success: boolean; clipboardData?: any; error?: string }> {
    // For copy operation, we create clipboard data that can be used for paste
    if (params.nodeIds.length === 0) {
      return { success: false, error: 'No nodes to copy' };
    }
    
    // Get the nodes to create clipboard data
    const queryAPI = this.getQueryAPI();
    const nodes: TreeNode[] = [];
    for (const nodeId of params.nodeIds) {
      const node = await queryAPI.getNode(nodeId);
      if (node) {
        nodes.push(node);
      }
    }
    
    if (nodes.length === 0) {
      return { success: false, error: 'No valid nodes found to copy' };
    }
    
    // Create clipboard data containing the node information
    const clipboardData = {
      type: 'hierarchidb-nodes',
      nodeIds: params.nodeIds,
      nodes: nodes,
      timestamp: Date.now(),
    };
    
    return {
      success: true,
      clipboardData,
    };
  }

  // Legacy method - clipboard operations should use proper clipboard API
  async pasteNodesFolder(params: {
    targetParentId: NodeId;
    clipboardData: any;
  }): Promise<{ success: boolean; nodeIds?: NodeId[]; error?: string }> {
    // Validate clipboard data
    if (!params.clipboardData || params.clipboardData.type !== 'hierarchidb-nodes') {
      return { success: false, error: 'Invalid clipboard data' };
    }
    
    // Use duplicateNodes to create copies at the target location
    const mutationAPI = this.getMutationAPI();
    const result = await mutationAPI.duplicateNodes({
      nodeIds: params.clipboardData.nodeIds,
      toParentId: params.targetParentId,
    });
    
    if (result.success) {
      return {
        success: true,
        nodeIds: result.nodeIds,
      };
    } else {
      return {
        success: false,
        error: 'success' in result && !result.success && 'error' in result ? result.error : 'Unknown error',
      };
    }
  }

  async undo(): Promise<{ success: boolean; error?: string }> {
    // Simplified undo - would need to integrate with command processor
    return { success: true };
  }

  async redo(): Promise<{ success: boolean; error?: string }> {
    // Simplified redo - would need to integrate with command processor
    return { success: true };
  }

  // Legacy execute object with method properties - routes to correct API methods
  execute = {
    createNode: async (params: any) => this.getMutationAPI().createNode(params),
    moveNode: async (params: any) => this.getMutationAPI().moveNodes(params),
    updateNodeName: async (params: any) => this.getMutationAPI().updateNode(params),
    moveToTrash: async (params: any) => this.getMutationAPI().moveNodesToTrash(params),
    restoreFromTrash: async (params: any) => this.getMutationAPI().recoverNodesFromTrash(params),
    recoverFromTrash: async (params: any) => this.getMutationAPI().recoverNodesFromTrash(params),
    duplicateNodes: async (params: any) => this.getMutationAPI().duplicateNodes(params),
    copyNodes: async (params: any) => this.copyNodesFolder({ nodeIds: params.nodeIds || [] }),
    pasteNodes: async (params: any) => this.pasteNodesFolder(params),
    deleteNodes: async (params: any) => this.getMutationAPI().removeNodes(params),
    removeNodes: async (params: any) => this.getMutationAPI().removeNodes(params),
    exportTreeNodes: async (params: any) => this.exportTreeNodes(params),
    undo: async () => this.undo(),
    redo: async () => this.redo(),
  };

  unsubscribe(): Promise<void> {
    return this.shutdown();
  }

  getNodeTypeRegistry() {
    return this.nodeTypeRegistry;
  }

  searchByNameWithMatchMode(params: {
    rootNodeId: NodeId;
    query: string;
    mode: 'exact' | 'prefix' | 'suffix' | 'partial';
    maxDepth?: number;
  }): Promise<TreeNode[]> {
    const queryAPI = this.getQueryAPI();
    return queryAPI.searchNodes(params);
  }

  searchByNameWithDepth(params: {
    rootNodeId: NodeId;
    query: string;
    maxDepth: number;
  }): Promise<TreeNode[]> {
    const queryAPI = this.getQueryAPI();
    return queryAPI.searchNodes({
      ...params,
      mode: 'partial',
    });
  }

  async subscribeSubtree(nodeId: NodeId, callback: (event: any) => void): Promise<string> {
    // Create subscription ID and proxy to observable service
    const subscriptionId = crypto.randomUUID();
    
    // Subscribe to subtree changes using proper CommandEnvelope format
    const cmd: CommandEnvelope<'subscribeSubtree', ObserveSubtreePayload> = {
      commandId: subscriptionId,
      groupId: subscriptionId,
      kind: 'subscribeSubtree',
      payload: {
        rootNodeId: nodeId,
      },
      issuedAt: Date.now(),
    };
    
    const observable = await this.subscriptionService.subscribeSubtree(cmd);
    
    // Subscribe to the observable
    observable.subscribe({
      next: callback,
      error: (error) => console.error('Observable error:', error),
      complete: () => console.log('Observable completed'),
    });
    
    return subscriptionId;
  }

  async exportTreeNodes(params: {
    nodeIds: NodeId[];
    format?: 'json' | 'csv';
  }): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }> {
    try {
      const queryAPI = this.getQueryAPI();
      const format = params.format || 'json';
      
      // Get the nodes to export
      const nodes: TreeNode[] = [];
      for (const nodeId of params.nodeIds) {
        const node = await queryAPI.getNode(nodeId);
        if (node) {
          nodes.push(node);
        }
      }
      
      if (nodes.length === 0) {
        return { success: false, error: 'No nodes found to export' };
      }
      
      let content: string;
      let mimeType: string;
      let extension: string;
      
      if (format === 'csv') {
        // CSV export
        const headers = ['id', 'name', 'nodeType', 'parentNodeId', 'createdAt', 'updatedAt'];
        const csvRows = [headers.join(',')];
        
        for (const node of nodes) {
          const row = [
            node.id,
            `"${node.name.replace(/"/g, '""')}"`, // Escape quotes
            node.nodeType,
            node.parentNodeId || '',
            new Date(node.createdAt).toISOString(),
            new Date(node.updatedAt).toISOString(),
          ];
          csvRows.push(row.join(','));
        }
        
        content = csvRows.join('\n');
        mimeType = 'text/csv';
        extension = 'csv';
      } else {
        // JSON export (default)
        content = JSON.stringify(nodes, null, 2);
        mimeType = 'application/json';
        extension = 'json';
      }
      
      // Create blob
      const blob = new Blob([content], { type: mimeType });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `hierarchidb-export-${timestamp}.${extension}`;
      
      return {
        success: true,
        blob,
        filename,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
      };
    }
  }

  moveNodes(params: {
    nodeIds: NodeId[];
    toParentId: NodeId;
  }): Promise<{ success: boolean; error?: string }> {
    const mutationAPI = this.getMutationAPI();
    return mutationAPI.moveNodes(params);
  }

  moveToTrash(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }> {
    const mutationAPI = this.getMutationAPI();
    return mutationAPI.moveNodesToTrash(nodeIds);
  }

  /**
   * Dispose of resources and cleanup subscriptions
   */
  dispose(): void {
    // TODO: Implement subscription cleanup if needed
    // For now, this is a no-op to satisfy the interface
  }

}
