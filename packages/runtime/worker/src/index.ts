import type {
  DialogStateAPI,
  ImportExportAPI,
  TagAPI,
  TreeMutationAPI,
  TreeQueryAPI,
  TreeSubscriptionAPI,
  DraftAPI,
} from '@hierarchidb/common-api';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/common-types';
import {
  enableAllExporters,
  enableAllImporters,
  ImportExportService,
} from '@hierarchidb/import-export';
import type { PluginDefinition } from '@hierarchidb/plugin-service-api';
import { TagService } from '@hierarchidb/tag';
import { SingletonMixin } from '@hierarchidb/util';
import { ImportExportDBPortCoreDBAdapter } from './services/adapters/ImportExportDBPortCoreDBAdapter.js';
import { TagDBPortCoreDBAdapter } from './services/adapters/TagDBPortCoreDBAdapter.js';
import { CommandProcessor } from './services/CommandProcessor.js';
import { CoreDB } from './services/CoreDB.js';
import { DialogStateService } from './services/DialogStateService.js';
import { EphemeralDB } from './services/EphemeralDB.js';
import { bootstrapFeatures } from './services/FeatureBootstrap.js';
import { NodeLifecycleManager } from './services/NodeLifecycleManager.js';
import { TreeMutationService } from './services/TreeMutationService.js';
import { TreeQueryService } from './services/TreeQueryService.js';
import { TreeSubscriptionService } from './services/TreeSubscriptionService.js';
// No direct Comlink types should leak at this boundary
import { DraftService } from './services/DraftService.js';

export {
  configureWorkerContainer,
  getWorkerContainer,
  resetWorkerContainerForTesting,
} from './di/container.js';
export type { PluginWorkerModuleLoader } from './di/interfaces.js';
export { WorkerDiTokens } from './di/tokens.js';
export { resolveDefaultNodeName } from './utils/default-node-name.js';
export { registerPeerDataComposer } from './services/peerDataRegistry.js';
export { createNodePayloadPeerStore } from './entity/createNodePayloadPeerStore.js';

interface PerformanceMemoryStats {
  usedJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

const readHeapStats = (): { used: number; limit: number } => {
  const perf =
    typeof globalThis !== 'undefined'
      ? (globalThis as { performance?: Performance & { memory?: PerformanceMemoryStats } })
          .performance
      : undefined;
  const memory = perf?.memory;
  return {
    used: memory?.usedJSHeapSize ?? 0,
    limit: memory?.jsHeapSizeLimit ?? 0,
  };
};

export class WorkerService {
  private readonly startTime = Date.now();

  static async getSingleton(plugins: PluginDefinition[]): Promise<WorkerService> {
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

      // Optionally install XLSX parser for tabular-source if available
      await import('@hierarchidb/tabular-source-xlsx')
        .then(
          (
            mod:
              | undefined
              | null
              | {
                  installTabularXlsx?: () => void;
                  markTabularXlsxInstalled?: () => void;
                }
          ) => {
            if (mod && typeof mod.installTabularXlsx === 'function') {
              mod.installTabularXlsx();
              if (typeof mod.markTabularXlsxInstalled === 'function') {
                mod.markTabularXlsxInstalled();
              }
            }
          }
        )
        .catch(() => {
          // XLSX support not installed; proceed without it
        });

      // Tag service
      const tagDBPort = new TagDBPortCoreDBAdapter(coreDB);
      const tagService: TagAPI = await TagService.getSingleton(tagDBPort);

      // Query/Mutation services
      const commandProcessor: CommandProcessor = await CommandProcessor.getSingleton(coreDB);
      const treeQueryService: TreeQueryAPI = await TreeQueryService.getSingleton(coreDB);
      const treeMutationService: TreeMutationAPI = await TreeMutationService.getSingleton(
        coreDB,
        commandProcessor
      );
      const treeSubscriptionService: TreeSubscriptionAPI =
        await TreeSubscriptionService.getSingleton(coreDB, treeQueryService);

      const pluginMap: { [key: string]: PluginDefinition } = Object.fromEntries(
        plugins.map((plugin) => [plugin.name, plugin])
      );

      const nodeLifecycleManager: NodeLifecycleManager = await NodeLifecycleManager.getSingleton(
        coreDB,
        pluginMap
      );

      // Import/Export services
      const iePort = new ImportExportDBPortCoreDBAdapter(coreDB);
      const importExportService: ImportExportAPI = await ImportExportService.getSingleton(iePort);

      // Draft service (ephemeral-backed)
      const draftService: DraftAPI = new DraftService(
        coreDB,
        ephemeralDB,
        commandProcessor
      );

      const dialogStateService: DialogStateAPI = new DialogStateService();

      return new WorkerService(
        coreDB,
        ephemeralDB,
        treeQueryService,
        treeMutationService,
        treeSubscriptionService,
        importExportService,
        draftService,
        tagService,
        nodeLifecycleManager,
        commandProcessor,
        dialogStateService
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
    private draftService: DraftAPI,
    private tagService: TagAPI,
    private nodeLifecycleManager: NodeLifecycleManager,
    private commandProcessor: CommandProcessor,
    private dialogStateService: DialogStateAPI
  ) {
    this.queryApiFacade = {
      getTree: (treeId: TreeId) => this.queryService.getTree(treeId),
      listTrees: () => this.queryService.listTrees(),
      getNode: (nodeId: NodeId) => this.queryService.getNode(nodeId),
      listChildren: (parentId: NodeId) => this.queryService.listChildren(parentId),
      listDescendants: (nodeId: NodeId, maxDepth?: number) =>
        this.queryService.listDescendants(nodeId, maxDepth),
      listAncestors: (nodeId: NodeId) => this.queryService.listAncestors(nodeId),
      searchNodes: (options) => this.queryService.searchNodes(options),
      searchNodesFulltext: (options) => this.queryService.searchNodesFulltext(options),
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
    // no-op: working copy cleaner removed (draftData is retained without TTL)
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

  getDraftAPI() {
    return this.draftService;
  }

  getImportExportAPI() {
    return this.importExportService;
  }

  getTagAPI() {
    return this.tagService;
  }

  getDialogStateAPI(): DialogStateAPI {
    return this.dialogStateService;
  }

  // Minimal stub to satisfy interface; not yet wired.
  getPluginLifecycleAPI(): import('@hierarchidb/plugin-service-api').PluginLifecycleAPI {
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

  async getSystemHealth(): Promise<{
    databases: { coreDB: boolean; ephemeralDB: boolean };
    services: {
      query: boolean;
      mutation: boolean;
      subscription: boolean;
      plugin: boolean;
      draft: boolean;
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
        draft: !!this.draftService,
      },
      memory: { used, limit },
      uptime: Date.now() - this.startTime,
    };
  }
}

export { entityRegistry } from './entity/EntityRegistry.js';
// Public re-exports for plugin-side stores and registry
export type {
  GroupItemBase,
  GroupStore,
  PeerEntity,
  PeerStore,
  RelationBase,
  RelationStore,
} from './entity/store.js';
export { storeRegistry } from './entity/store-registry.js';
export * from './module-paths.js';
export * from './services/downloadAdapter.js';
export {
  getRuntimeWorkerClient,
  hasRuntimeWorkerClient,
  type RuntimeWorkerClientProvider,
  type RuntimeWorkerStageClient,
  registerRuntimeWorkerClient,
  unregisterRuntimeWorkerClient,
} from './services/RuntimeWorkerService.js';
export {
  createStageWorkerClient,
  getStageProcessingClient,
} from './services/StageProcessingService.js';
// Re-export stage worker API contracts for clients (adapters)
export type { DownloadWorkerAPI, SimplifyWorkerAPI, VectorTileWorkerAPI } from './types.js';
export type { WorkerAPI } from './WorkerAPI.js';
