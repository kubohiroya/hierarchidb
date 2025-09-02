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
import { proxy, ProxyMarked } from 'comlink';

export class WorkerService implements WorkerAPI {
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
        proxy(treeQueryService),
        proxy(treeMutationService),
        proxy(treeSubscriptionService),
        proxy(importExportService),
        proxy(tagService),
        proxy(nodeLifecycleManager),
        proxy(commandProcessor)
      );
    });
  }

  constructor(
    private plugins: PluginDefinition[],
    private coreDB: CoreDB,
    private ephemeralDB: EphemeralDB,
    private queryService: TreeQueryAPI & ProxyMarked,
    private mutationService: TreeMutationAPI & ProxyMarked,
    private subscriptionService: TreeSubscriptionAPI & ProxyMarked,
    private importExportService: ImportExportAPI & ProxyMarked,
    private tagService: TagAPI & ProxyMarked,
    private nodeLifecycleManager: NodeLifecycleManager & ProxyMarked,
    private commandProcessor: CommandProcessor & ProxyMarked
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

  getQueryAPI(): TreeQueryAPI & ProxyMarked {
    return this.queryService;
  }

  getMutationAPI(): TreeMutationAPI & ProxyMarked {
    return this.mutationService;
  }

  getSubscriptionAPI(): TreeSubscriptionAPI & ProxyMarked {
    return this.subscriptionService;
  }

  getWorkingCopyAPI(): any {
    throw null; //this.
  }

  getImportExportAPI(): ImportExportAPI & ProxyMarked {
    return this.importExportService;
  }

  getTagAPI(): TagAPI & ProxyMarked {
    return this.tagService;
  }

  getNodeLifecycleManager(): NodeLifecycleManager & ProxyMarked {
    return this.nodeLifecycleManager;
  }

  getCommandProcessor(): CommandProcessor & ProxyMarked {
    return this.commandProcessor;
  }
}
