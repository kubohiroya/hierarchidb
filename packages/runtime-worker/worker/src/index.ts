import {
  ImportExportAPI,
  TagAPI,
  TreeMutationAPI,
  TreeQueryAPI,
  TreeSubscriptionAPI,
  WorkerAPI,
} from '@hierarchidb/common-api';
import { CoreDB } from './services/CoreDB';
import { EphemeralDB } from './services/EphemeralDB';
import { NodeLifecycleManager } from './services/NodeLifecycleManager';
import { CommandProcessor } from './services/CommandProcessor';
import { PluginDefinition } from '@hierarchidb/common-type';
import { TreeQueryService } from 'services/TreeQueryService';
import { SingletonMixin } from '@hierarchidb/util';
import { TreeMutationService } from './services/TreeMutationService';
import { TreeSubscriptionService } from './services/TreeSubscriptionService';
import { TagService } from './services/TagService';
import { ImportExportService } from './services/ImportExportService';
// No direct Comlink types should leak at this boundary

export class WorkerService implements WorkerAPI {
  private readonly startTime = Date.now();
  static async getSingleton(plugins: PluginDefinition[]): Promise<WorkerService> {
    return SingletonMixin.getSingleton(WorkerService.name, async () => {
      const coreDB: CoreDB = await CoreDB.getSingleton();
      const ephemeralDB: EphemeralDB = await EphemeralDB.getSingleton();
      // Tag service
      const tagService: TagAPI = await TagService.getSingleton(coreDB);

      // Query/Mutation services
      const commandProcessor: CommandProcessor = await CommandProcessor.getSingleton(coreDB);
      const treeQueryService: TreeQueryAPI = await TreeQueryService.getSingleton(coreDB);
      const treeMutationService: TreeMutationAPI = await TreeMutationService.getSingleton(
        coreDB,
        commandProcessor
      );
      const treeSubscriptionService: TreeSubscriptionAPI =
        await TreeSubscriptionService.getSingleton(coreDB);

      const pluginMap: { [key: string]: PluginDefinition } = Object.fromEntries(
        plugins.map((plugin) => [plugin.name, plugin])
      );

      const nodeLifecycleManager: NodeLifecycleManager = await NodeLifecycleManager.getSingleton(
        coreDB,
        pluginMap
      );

      // Import/Export services
      const importExportService: ImportExportAPI = await ImportExportService.getSingleton(coreDB);

      return new WorkerService(
        plugins,
        coreDB,
        ephemeralDB,
        treeQueryService,
        treeMutationService,
        treeSubscriptionService,
        importExportService,
        tagService,
        nodeLifecycleManager,
        commandProcessor
      );
    });
  }

  constructor(
    private plugins: PluginDefinition[],
    private coreDB: CoreDB,
    private ephemeralDB: EphemeralDB,
    private queryService: TreeQueryAPI,
    private mutationService: TreeMutationAPI,
    private subscriptionService: TreeSubscriptionAPI,
    private importExportService: ImportExportAPI,
    private tagService: TagAPI,
    private nodeLifecycleManager: NodeLifecycleManager,
    private commandProcessor: CommandProcessor
  ) {}

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
    // Already initialized by bootstrap in this build
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

  getWorkingCopyAPI(): import('@hierarchidb/common-api').WorkingCopyAPI {
    throw new Error('WorkingCopyAPI is not implemented in this build');
  }

  getImportExportAPI(): ImportExportAPI {
    return this.importExportService;
  }

  getTagAPI(): TagAPI {
    return this.tagService;
  }

  getPluginLifecycleAPI(): import('@hierarchidb/common-api').PluginLifecycleAPI {
    throw new Error('PluginLifecycleAPI is not implemented in this build');
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
    return {
      databases: {
        coreDB: true,
        ephemeralDB: true,
      },
      services: {
        query: !!this.queryService,
        mutation: !!this.mutationService,
        subscription: !!this.subscriptionService,
        plugin: false,
        workingCopy: false,
      },
      memory: {
        used: 0,
        limit: 0,
      },
      uptime: Date.now() - this.startTime,
    };
  }
}
