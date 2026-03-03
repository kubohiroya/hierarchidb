import type { ImportExportAPI } from '@hierarchidb/import-export-api';
import type { TreeTableExpandedAPI, TreeNodeData } from '@hierarchidb/tree-api';
import type {
  TreeMutationAPI,
  TreeNodeUpdaterAPI,
  TreeQueryAPI,
  TreeSubscriptionAPI,
} from '@hierarchidb/tree-api';
import type { TagAPI } from '@hierarchidb/tag-api';
import type { NodeType } from '@hierarchidb/core-types';
import { enableAllExporters, enableAllImporters } from '@hierarchidb/import-export';
import type { LocationMutationAPI, LocationQueryAPI } from '@hierarchidb/location-api';
import type { PluginLifecycleAPI } from '@hierarchidb/plugin-base';
import type { RouteMutationAPI, RouteQueryAPI } from '@hierarchidb/route-api';
import type { RouteDatabaseHandle } from '@hierarchidb/route-store';
import { RouteDB } from '@hierarchidb/route-store';
import { ShapeDB } from '@hierarchidb/shape-store';
import { StylerDB } from '@hierarchidb/styler-store';
import { TagService } from '@hierarchidb/tag';
import { SingletonMixin } from '@hierarchidb/util';
import type { ShapeMutationAPI, ShapeQueryAPI } from '@hierarchidb/shape-api';
import type { StyleMutationAPI, StyleQueryAPI } from '@hierarchidb/style-api';
import { EntityLifecycleManager } from './entity/EntityLifecycleManager.js';
import { ImportExportDBPortCoreDBAdapter } from './services/adapters/ImportExportDBPortCoreDBAdapter.js';
import { TagDBPortCoreDBAdapter } from './services/adapters/TagDBPortCoreDBAdapter.js';
import { CommandProcessor } from './services/CommandProcessor.js';
import { CoreDB } from './services/CoreDB.js';
import { ImportExportLifecycleService } from './services/ImportExportLifecycleService.js';
import { LocationMutationService } from './services/LocationMutationService.js';
import { LocationQueryService } from './services/LocationQueryService.js';
import { NodeLifecycleManager } from './services/NodeLifecycleManager.js';
import { RouteMutationService } from './services/RouteMutationService.js';
import { RouteQueryService } from './services/RouteQueryService.js';
import { ShapeMutationService } from './services/ShapeMutationService.js';
import { ShapeQueryService } from './services/ShapeQueryService.js';
import { StyleService } from './services/StyleService.js';
import { TreeMutationService } from './services/TreeMutationService.js';
import { TreeNodeUpdaterService } from './services/TreeNodeUpdaterService.js';
import { TreeQueryService } from './services/TreeQueryService.js';
import { TreeSubscriptionService } from './services/TreeSubscriptionService.js';
import { TreeTableExpandedService } from './services/TreeTableExpandedService.js';
import { UIStateDB } from './services/UIStateDB.js';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import type { RuntimePluginDefinition } from './types/RuntimePluginDefinition.js';

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

  static async getSingleton(plugins: RuntimePluginDefinition[]): Promise<WorkerService> {
    return SingletonMixin.getSingleton('WorkerService', async () => {
      const coreDB: CoreDB = await CoreDB.getSingleton();
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

      const pluginMap: { [key: string]: RuntimePluginDefinition } = Object.fromEntries(
        plugins.map((plugin) => [plugin.name, plugin])
      );

      const nodeLifecycleManager: NodeLifecycleManager = await NodeLifecycleManager.getSingleton(
        coreDB,
        pluginMap
      );

      const shapeDB = new ShapeDB();

      // Import/Export services
      const iePort = new ImportExportDBPortCoreDBAdapter(coreDB, shapeDB);
      const importExportService: ImportExportAPI<TreeNodeData> =
        await ImportExportLifecycleService.getSingleton<TreeNodeData>(iePort);

      const treeNodeUpdaterService: TreeNodeUpdaterAPI<TreeNodeData> = new TreeNodeUpdaterService(
        coreDB,
        commandProcessor,
        tagService
      );

      const uiStateDB = await UIStateDB.getSingleton();
      const treeTableExpandedService: TreeTableExpandedAPI = new TreeTableExpandedService(
        uiStateDB,
        treeQueryService
      );

      const styleDB = await StylerDB.getSingleton();
      const styleService: StyleQueryAPI & StyleMutationAPI =
        await StyleService.getSingleton(styleDB);
      const shapeQueryService: ShapeQueryAPI = await ShapeQueryService.getSingleton(shapeDB);
      const shapeMutationService: ShapeMutationAPI =
        await ShapeMutationService.getSingleton(shapeDB);
      const locationQueryService: LocationQueryAPI = await LocationQueryService.getSingleton();
      const locationMutationService: LocationMutationAPI =
        await LocationMutationService.getSingleton();
      const routeDB = new RouteDB() as RouteDatabaseHandle;
      const routeQueryService: RouteQueryAPI = await RouteQueryService.getSingleton(routeDB);
      const routeMutationService: RouteMutationAPI = await RouteMutationService.getSingleton(
        routeDB,
        treeQueryService,
        locationQueryService
      );
      EntityLifecycleManager.getSingleton(coreDB, {
        shapeMutation: shapeMutationService,
        locationMutation: locationMutationService,
        routeMutation: routeMutationService,
      });
      await WorkerService.recoverBuildSessionRuntimeRecordsOnWarmStart();

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
        treeTableExpandedService,
        styleDB,
        styleService,
        shapeDB,
        shapeQueryService,
        shapeMutationService,
        locationQueryService,
        locationMutationService,
        routeDB,
        routeQueryService,
        routeMutationService
      );
    });
  }

  private static async recoverBuildSessionRuntimeRecordsOnWarmStart(): Promise<void> {
    try {
      await ephemeralDB.open?.();
      const sessions = await ephemeralDB.buildSessions.toArray();
      if (sessions.length === 0) return;
      // Keep session records for resume/recovery flow; runtime state can be reconstructed.
      return;
    } catch (error) {
      console.error('[WorkerService] Failed to recover persisted build sessions', error);
    }
  }

  constructor(
    private coreDB: CoreDB,
    private queryService: TreeQueryAPI,
    private mutationService: TreeMutationAPI,
    private subscriptionService: TreeSubscriptionAPI,
    private importExportService: ImportExportAPI<TreeNodeData>,
    private treeNodeUpdaterService: TreeNodeUpdaterAPI<TreeNodeData>,
    private tagService: TagAPI,
    private nodeLifecycleManager: NodeLifecycleManager,
    private commandProcessor: CommandProcessor,
    private treeTableExpandedService: TreeTableExpandedAPI,
    private stylerDB: StylerDB,
    private stylerService: StyleQueryAPI & StyleMutationAPI,
    private shapeDB: ShapeDB,
    private shapeQueryService: ShapeQueryAPI,
    private shapeMutationService: ShapeMutationAPI,
    private locationQueryService: LocationQueryAPI,
    private locationMutationService: LocationMutationAPI,
    private routeDB: RouteDatabaseHandle,
    private routeQueryService: RouteQueryAPI,
    private routeMutationService: RouteMutationAPI
  ) {}

  ping(): { response: 'pong'; timestamp: number } {
    const shouldLogInfo =
      typeof console !== 'undefined' &&
      typeof console.log === 'function' &&
      !(globalThis as { __HDB_SILENCE_WORKER_LOGS__?: boolean })
        .__HDB_SILENCE_WORKER_LOGS__;
    if (shouldLogInfo) {
      console.log('[WorkerAPIImpl] ping() called');
    }
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
    this.stylerDB.close();
    this.shapeDB.close?.();
    this.routeDB.close?.();
  }

  async initialize(): Promise<void> {}

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

  getTreeTableExpandedAPI() {
    return this.treeTableExpandedService;
  }

  getImportExportAPI() {
    return this.importExportService;
  }

  getTagAPI() {
    return this.tagService;
  }

  getStyleQueryAPI(): StyleQueryAPI {
    return this.stylerService;
  }

  getStyleMutationAPI(): StyleMutationAPI {
    return this.stylerService;
  }

  getShapeQueryAPI(): ShapeQueryAPI {
    return this.shapeQueryService;
  }

  getShapeMutationAPI(): ShapeMutationAPI {
    return this.shapeMutationService;
  }

  getLocationQueryAPI(): LocationQueryAPI {
    return this.locationQueryService;
  }

  getLocationMutationAPI(): LocationMutationAPI {
    return this.locationMutationService;
  }

  getRouteQueryAPI(): RouteQueryAPI {
    return this.routeQueryService;
  }

  getRouteMutationAPI(): RouteMutationAPI {
    return this.routeMutationService;
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
