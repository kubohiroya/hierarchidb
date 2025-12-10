import { SingletonMixin } from '@hierarchidb/util';
import { CoreDB } from './services/CoreDB.js';
import { bootstrapFeatures } from './services/FeatureBootstrap.js';
import { enableAllExporters, enableAllImporters, ImportExportService } from '@hierarchidb/import-export';
import { TagDBPortCoreDBAdapter } from './services/adapters/TagDBPortCoreDBAdapter.js';
import { TagService } from '@hierarchidb/tag';
import { CommandProcessor } from './services/CommandProcessor.js';
import { TreeQueryService } from './services/TreeQueryService.js';
import { TreeMutationService } from './services/TreeMutationService.js';
import { TreeSubscriptionService } from './services/TreeSubscriptionService.js';
import { NodeLifecycleManager } from './services/NodeLifecycleManager.js';
import { ImportExportDBPortCoreDBAdapter } from './services/adapters/ImportExportDBPortCoreDBAdapter.js';
import { TreeNodeUpdaterService } from './services/TreeNodeUpdaterService.js';
import { PluginDefinition, PluginLifecycleAPI } from '@hierarchidb/plugin-service-api';
import { ImportExportAPI, TagAPI, TreeMutationAPI, TreeNodeUpdaterAPI, TreeQueryAPI, TreeSubscriptionAPI } from '@hierarchidb/common-api';
import type { NodeType } from '@hierarchidb/common-types';

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
            },
          ) => {
            if (mod && typeof mod.installTabularXlsx === 'function') {
              mod.installTabularXlsx();
              if (typeof mod.markTabularXlsxInstalled === 'function') {
                mod.markTabularXlsxInstalled();
              }
            }
          },
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
        commandProcessor,
      );
      const treeSubscriptionService: TreeSubscriptionAPI =
        await TreeSubscriptionService.getSingleton(coreDB, treeQueryService);

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

      const treeNodeUpdaterService: TreeNodeUpdaterAPI = new TreeNodeUpdaterService(
        coreDB,
        commandProcessor,
      );

      return new WorkerService(
        coreDB,
        treeQueryService,
        treeMutationService,
        treeSubscriptionService,
        importExportService,
        treeNodeUpdaterService,
        tagService,
        nodeLifecycleManager,
        commandProcessor,
      );
    });
  }

  constructor(
    private coreDB: CoreDB,
    private queryService: TreeQueryAPI,
    private mutationService: TreeMutationAPI,
    private subscriptionService: TreeSubscriptionAPI,
    private importExportService: ImportExportAPI,
    private treeNodeUpdaterService: TreeNodeUpdaterAPI,
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
    // No secondary DB to close
  }

  async initialize(): Promise<void> {
    }

  getQueryAPI(): TreeQueryAPI {
    return this.queryService;
  }

  getMutationAPI() {
    return this.mutationService;
  }

  getSubscriptionAPI() {
    return this.subscriptionService;
  }

  getTreeNodeUpdaterAPI() {
    return this.treeNodeUpdaterService;
  }

  getImportExportAPI() {
    return this.importExportService;
  }

  getTagAPI() {
    return this.tagService;
  }

  // Minimal stub to satisfy interface; not yet wired.
  getPluginLifecycleAPI(): PluginLifecycleAPI {
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
    databases: { coreDB: boolean };
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
      },
      services: {
        query: !!this.queryService,
        mutation: !!this.mutationService,
        subscription: !!this.subscriptionService,
        plugin: !!this.nodeLifecycleManager,
        draft: !!this.treeNodeUpdaterService,
      },
      memory: { used, limit },
      uptime: Date.now() - this.startTime,
    };
  }
}
