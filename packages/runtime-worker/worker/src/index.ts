import {
  type ImportExportAPI,
  type TagAPI,
  type TreeMutationAPI,
  type TreeQueryAPI,
  type TreeSubscriptionAPI,
  WorkerAPI,
  type WorkingCopyAPI,
} from '@hierarchidb/common-api';
import type {
  BatchProgressEvent,
  BatchSessionId,
  BatchSessionStatus,
  IBatchSessionManager,
} from '@hierarchidb/runtime-shared-batch-processor';
import { CoreDB } from './services/CoreDB.js';
import { EphemeralDB } from './services/EphemeralDB.js';
import { NodeLifecycleManager } from './services/NodeLifecycleManager.js';
import { CommandProcessor } from './services/CommandProcessor.js';
import { type NodeId, type NodeType, type PluginDefinition, Tree, type TreeId, TreeNode } from '@hierarchidb/common-type';
import { TreeQueryService } from './services/TreeQueryService.js';
import { SingletonMixin } from '@hierarchidb/util';
import { TreeMutationService } from './services/TreeMutationService.js';
import { TreeSubscriptionService } from './services/TreeSubscriptionService.js';
import { TagService } from '@hierarchidb/tag';
import { TagDBPortCoreDBAdapter } from './services/adapters/TagDBPortCoreDBAdapter.js';
import { enableAllExporters, enableAllImporters, ImportExportService } from '@hierarchidb/import-export';
import { bootstrapFeatures } from './services/FeatureBootstrap.js';
import { ImportExportDBPortCoreDBAdapter } from './services/adapters/ImportExportDBPortCoreDBAdapter.js';
// No direct Comlink types should leak at this boundary
import { WorkingCopyService } from './services/WorkingCopyService.js';

interface PerformanceMemoryStats {
  usedJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

const readHeapStats = (): { used: number; limit: number } => {
  const perf = typeof globalThis !== 'undefined'
    ? (globalThis as { performance?: Performance & { memory?: PerformanceMemoryStats } }).performance
    : undefined;
  const memory = perf?.memory;
  return {
    used: memory?.usedJSHeapSize ?? 0,
    limit: memory?.jsHeapSizeLimit ?? 0,
  };
};

type BatchManagerFactory = () => Promise<IBatchSessionManager>;

export class WorkerService {
  private readonly startTime = Date.now();
  private readonly batchFactories: Map<NodeType, BatchManagerFactory>;
  private readonly batchManagers = new Map<NodeType, IBatchSessionManager>();

  static async getSingleton(
    plugins: PluginDefinition[],
    runtimeExports: Record<string, { createBatchManager?: () => Promise<unknown> | unknown }> = {},
  ): Promise<WorkerService> {
    return SingletonMixin.getSingleton(WorkerService.name, async () => {
      const coreDB: CoreDB = await CoreDB.getSingleton();
      const ephemeralDB: EphemeralDB = await EphemeralDB.getSingleton();

      // Feature bootstrap (registry-driven). Keeps init order and opt-in capabilities.
      await bootstrapFeatures();

      // Plugin-side Dexie peer stores are expected to self-register where applicable.
      // We avoid forcing worker-bundle imports here to keep bundles lean and prevent divergence.

      // Enable import/export capability for all node types by default
      enableAllImporters();
      enableAllExporters();

      // Optionally install XLSX parser for tabular if available
      try {
        // Optional dependency; suppress Vite analysis for dynamic import
        const mod = await import(/* @vite-ignore */ '@hierarchidb/tabular-xlsx');
        if (mod && typeof mod.installTabularXlsx === 'function') {
          mod.installTabularXlsx();
          if (typeof mod.markTabularXlsxInstalled === 'function') mod.markTabularXlsxInstalled();
        }
      } catch {
        // XLSX support not installed; proceed without it
      }
      // Tag service
      const tagDBPort = new TagDBPortCoreDBAdapter(coreDB);
      const tagService: TagAPI = await TagService.getSingleton(tagDBPort);

      // Query/Mutation services
      const commandProcessor: CommandProcessor = await CommandProcessor.getSingleton(coreDB);
      const treeQueryService: TreeQueryAPI = await TreeQueryService.getSingleton(coreDB);
      const treeMutationService: TreeMutationAPI = await TreeMutationService.getSingleton(
        coreDB,
        commandProcessor,
      );
      const treeSubscriptionService: TreeSubscriptionAPI =
        await TreeSubscriptionService.getSingleton(coreDB);

      const pluginMap: { [key: string]: PluginDefinition } = Object.fromEntries(
        plugins.map((plugin) => [plugin.name, plugin]),
      );

      const nodeLifecycleManager: NodeLifecycleManager = await NodeLifecycleManager.getSingleton(
        coreDB,
        pluginMap,
      );

      // Import/Export services
      const iePort = new ImportExportDBPortCoreDBAdapter(coreDB);
      const importExportService: ImportExportAPI = await ImportExportService.getSingleton(iePort);

      // WorkingCopy service (ephemeral-backed)
      const workingCopyService: WorkingCopyAPI = new WorkingCopyService(
        coreDB,
        ephemeralDB,
        commandProcessor,
      );

      const batchFactories = new Map<NodeType, BatchManagerFactory>();
      for (const [nodeType, entry] of Object.entries(runtimeExports)) {
        const factoryCandidate = entry?.createBatchManager;
        if (typeof factoryCandidate !== 'function') {
          continue;
        }
        batchFactories.set(nodeType as NodeType, async () => {
          const maybePromise = factoryCandidate();
          const instance = await Promise.resolve(maybePromise) as IBatchSessionManager;
          if (!instance || typeof instance.startBatchSession !== 'function') {
            throw new Error(`[WorkerService] Batch manager for ${nodeType} did not return IBatchSessionManager`);
          }
          return instance;
        });
      }

      return new WorkerService(
        coreDB,
        ephemeralDB,
        treeQueryService,
        treeMutationService,
        treeSubscriptionService,
        importExportService,
        workingCopyService,
        tagService,
        nodeLifecycleManager,
        commandProcessor,
        batchFactories,
      );
    });
  }

  constructor(
    private coreDB: CoreDB,
    private ephemeralDB: EphemeralDB,
    private queryService: TreeQueryAPI,
    private mutationService: TreeMutationAPI,
    private subscriptionService: TreeSubscriptionAPI,
    private importExportService: ImportExportAPI,
    private workingCopyService: WorkingCopyAPI,
    private tagService: TagAPI,
    private nodeLifecycleManager: NodeLifecycleManager,
    private commandProcessor: CommandProcessor,
    batchFactories?: Map<NodeType, BatchManagerFactory>,
  ) {
    this.batchFactories = batchFactories ?? new Map();
    this.queryApiFacade = {
      getTree: (treeId: TreeId) => this.queryService.getTree(treeId),
      listTrees: () => this.queryService.listTrees(),
      getNode: (nodeId: NodeId) => this.queryService.getNode(nodeId),
      listChildren: (parentId: NodeId) => this.queryService.listChildren(parentId),
      listDescendants: (nodeId: NodeId, maxDepth?: number) =>
        this.queryService.listDescendants(nodeId, maxDepth),
      listAncestors: (nodeId: NodeId) => this.queryService.listAncestors(nodeId),
      searchNodes: (options) => this.queryService.searchNodes(options),
    } satisfies TreeQueryAPI;
  }

  private readonly queryApiFacade: TreeQueryAPI;

  ping(): { response: 'pong'; timestamp: number } {
    console.log('[WorkerAPIImpl] ping() called');
    return {
      response: 'pong',
      timestamp: Date.now(),
    };
  }

  async shutdown(): Promise<void> {
    // Cleanup all subscriptions
    await this.subscriptionService.unsubscribeAll();

    // Close databases
    this.coreDB.close();
    this.ephemeralDB.close();
  }

  async initialize(): Promise<void> {
    // Initialization is handled in getSingleton; nothing to do.
  }

  getQueryAPI(): TreeQueryAPI {
    return this.queryApiFacade;
  }

  getMutationAPI() {
    return this.mutationService;
  }

  getSubscriptionAPI() {
    return this.subscriptionService;
  }

  getWorkingCopyAPI() {
    return this.workingCopyService;
  }

  getImportExportAPI() {
    return this.importExportService;
  }

  getTagAPI() {
    return this.tagService;
  }

  async startBatchSession(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus> {
    const manager = await this.ensureBatchManager(nodeType);
    const sessionId = await manager.startBatchSession(nodeId);
    try {
      return await manager.getBatchSessionStatus(sessionId);
    } catch (error) {
      console.warn('[WorkerService] getBatchSessionStatus failed after start:', error);
      return {
        sessionId,
        nodeId,
        status: 'running',
        progress: {
          total: 0,
          completed: 0,
          failed: 0,
          percentage: 0,
          currentStage: 'starting',
        },
        startedAt: Date.now(),
      } satisfies BatchSessionStatus;
    }
  }

  async getBatchSessionStatus(nodeType: NodeType, sessionId: BatchSessionId): Promise<BatchSessionStatus> {
    const manager = await this.ensureBatchManager(nodeType);
    return manager.getBatchSessionStatus(sessionId);
  }

  async pauseBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void> {
    const manager = await this.ensureBatchManager(nodeType);
    await manager.pauseBatchSession(sessionId);
  }

  async resumeBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void> {
    const manager = await this.ensureBatchManager(nodeType);
    await manager.resumeBatchSession(sessionId);
  }

  async cancelBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void> {
    const manager = await this.ensureBatchManager(nodeType);
    await manager.cancelBatchSession(sessionId);
  }

  async subscribeBatchProgress(
    nodeType: NodeType,
    sessionId: BatchSessionId,
    cb: (event: BatchProgressEvent) => void,
  ): Promise<() => void> {
    const manager = await this.ensureBatchManager(nodeType);
    const teardown = manager.onBatchProgress(sessionId, cb);
    if (typeof teardown === 'function') {
      return teardown;
    }
    // Support implementations that accidentally returned a Promise
    if (teardown && typeof (teardown as PromiseLike<() => void>).then === 'function') {
      return (await teardown) ?? (() => {
      });
    }
    return () => {
    };
  }

  // Minimal stub to satisfy interface; not yet wired.
  getPluginLifecycleAPI(): import('@hierarchidb/common-api').PluginLifecycleAPI {
    return {
      async register() {
        return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented' } };
      },
      async unregister() {
        return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented' } };
      },
      async validatePlugin() {
        return { isValid: false, errors: [], warnings: [] };
      },
      async checkHealth() {
        return {
          status: 'degraded',
          lastCheck: Date.now(),
          issues: ['Not implemented'],
          performance: { avgResponseTime: 0, errorRate: 1 },
        };
      },
      async listRegistered() {
        return [];
      },
      async getDependencies(nodeType) {
        return { nodeType, dependencies: [], dependents: [], circularDependencies: false };
      },
      async bulkOperation() {
        return { successful: [], failed: [], summary: { total: 0, success: 0, failed: 0 } };
      },
      async resetPlugin(options) {
        return { success: false, nodeType: options.nodeType, deletedEntities: {} };
      },
      async deletePlugin(nodeType) {
        return { success: false, nodeType };
      },
      async resetSystem() {
        return { success: false, nodeType: 'folder' as NodeType, deletedEntities: {} };
      },
    };
  }

  getNodeLifecycleManager(): NodeLifecycleManager {
    return this.nodeLifecycleManager;
  }

  getCommandProcessor(): CommandProcessor {
    return this.commandProcessor;
  }

  private async ensureBatchManager(nodeType: NodeType): Promise<IBatchSessionManager> {
    const cached = this.batchManagers.get(nodeType);
    if (cached) {
      return cached;
    }
    const factory = this.batchFactories.get(nodeType);
    if (!factory) {
      throw new Error(`[WorkerService] No batch manager factory registered for node type ${nodeType}`);
    }
    const manager = await factory();
    this.batchManagers.set(nodeType, manager);
    return manager;
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
    const { used, limit } = readHeapStats();
    return {
      databases: {
        coreDB: this.coreDB.isOpen?.() ?? true,
        ephemeralDB: this.ephemeralDB.isOpen?.() ?? true,
      },
      services: {
        query: !!this.queryService,
        mutation: !!this.mutationService,
        subscription: !!this.subscriptionService,
        plugin: !!this.nodeLifecycleManager,
        workingCopy: !!this.workingCopyService,
      },
      memory: { used, limit },
      uptime: Date.now() - this.startTime,
    };
  }
}

// Re-export stage worker API contracts for clients (adapters)
export type { DownloadWorkerAPI, SimplifyWorkerAPI, VectorTileWorkerAPI } from './types.js';
export { getStageProcessingClient, createStageWorkerClient } from './services/StageProcessingService.js';

// Public re-exports for plugin-side stores and registry
export type {
  PeerEntity,
  PeerStore,
  GroupItemBase,
  GroupStore,
  RelationBase,
  RelationStore,
} from './entity/store.js';
export { storeRegistry } from './entity/store-registry.js';
export { entityRegistry } from './entity/EntityRegistry.js';
