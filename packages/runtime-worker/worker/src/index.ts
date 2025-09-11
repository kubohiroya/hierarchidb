import {
  ImportExportAPI,
  TagAPI,
  TreeMutationAPI,
  TreeQueryAPI,
  TreeSubscriptionAPI,
  WorkerAPI,
  WorkingCopyAPI,
} from '@hierarchidb/common-api';
import { CoreDB } from './services/CoreDB';
import { EphemeralDB } from './services/EphemeralDB';
import { NodeLifecycleManager } from './services/NodeLifecycleManager';
import { CommandProcessor } from './services/CommandProcessor';
import { PluginDefinition } from '@hierarchidb/common-type';
import { TreeQueryService } from './services/TreeQueryService';
import { SingletonMixin } from '@hierarchidb/util';
import { TreeMutationService } from './services/TreeMutationService';
import { TreeSubscriptionService } from './services/TreeSubscriptionService';
import { TagService } from '@hierarchidb/tag';
import { TagDBPortCoreDBAdapter } from './services/adapters/TagDBPortCoreDBAdapter';
import { enableAllExporters, enableAllImporters, ImportExportService } from '@hierarchidb/import-export';
import { bootstrapFeatures } from './services/FeatureBootstrap';
import { ImportExportDBPortCoreDBAdapter } from './services/adapters/ImportExportDBPortCoreDBAdapter';
// No direct Comlink types should leak at this boundary
import { WorkingCopyService } from './services/WorkingCopyService';

export class WorkerService implements WorkerAPI {
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

      // Optionally install XLSX parser for tabular if available
      try {
        // Optional dependency; suppress Vite analysis for dynamic import
        // @ts-ignore
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
      const tagService: TagAPI = await TagService.getSingleton(tagDBPort as any);

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
      const importExportService: ImportExportAPI = await ImportExportService.getSingleton(iePort as any);

      // WorkingCopy service (ephemeral-backed)
      const workingCopyService: WorkingCopyAPI = new WorkingCopyService(
        coreDB,
        ephemeralDB,
        commandProcessor,
      );

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
  ) {
  }

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
    return this.queryService;
  }

  getMutationAPI(): TreeMutationAPI {
    return this.mutationService;
  }

  getSubscriptionAPI(): TreeSubscriptionAPI {
    return this.subscriptionService;
  }

  getWorkingCopyAPI(): WorkingCopyAPI {
    return this.workingCopyService;
  }

  getImportExportAPI(): ImportExportAPI {
    return this.importExportService;
  }

  getTagAPI(): TagAPI {
    return this.tagService;
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
        return { success: false, nodeType: options.nodeType, deletedEntities: {} } as any;
      },
      async deletePlugin(nodeType) {
        return { success: false, nodeType };
      },
      async resetSystem() {
        return { success: false, nodeType: 'folder' as any, deletedEntities: {} } as any;
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
      workingCopy: boolean;
    };
    memory: { used: number; limit: number };
    uptime: number;
  }> {
    const used = (globalThis as any).performance?.memory?.usedJSHeapSize ?? 0;
    const limit = (globalThis as any).performance?.memory?.jsHeapSizeLimit ?? 0;
    return {
      databases: {
        coreDB: (this.coreDB as any).isOpen?.() ?? true,
        ephemeralDB: (this.ephemeralDB as any).isOpen?.() ?? true,
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
export type { DownloadWorkerAPI, SimplifyWorkerAPI, VectorTileWorkerAPI } from './types';
export { getStageProcessingClient, createStageWorkerClient } from './services/StageProcessingService';

// Public re-exports for plugin-side stores and registry
export type {
  PeerEntity,
  PeerStore,
  GroupItemBase,
  GroupStore,
  RelationBase,
  RelationStore,
} from './entity/store';
export { storeRegistry } from './entity/store-registry';
