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
import { TreeTableExpandedService } from './services/TreeTableExpandedService.js';
import { ImportExportDBPortCoreDBAdapter } from './services/adapters/ImportExportDBPortCoreDBAdapter.js';
import { TreeNodeUpdaterService } from './services/TreeNodeUpdaterService.js';
import {
  PluginLifecycleAPI,
  ShapeMutationAPI,
  ShapeQueryAPI,
  StyleMutationAPI,
  StyleQueryAPI,
  LocationQueryAPI,
  RouteQueryAPI,
  RouteMutationAPI,
} from '@hierarchidb/plugin-service-api';
import {
  ImportExportAPI,
  TagAPI,
  TreeMutationAPI,
  TreeNodeUpdaterAPI,
  TreeQueryAPI,
  TreeSubscriptionAPI,
  TreeTableExpandedAPI,
} from '@hierarchidb/common-api';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import { UIStateDB } from './services/UIStateDB.js';
import { StyleDB } from '@hierarchidb/style-store';
import { StyleService } from './services/StyleService.js';
import { ShapeQueryService } from './services/ShapeQueryService.js';
import { ShapeMutationService } from './services/ShapeMutationService.js';
import { LocationQueryService } from './services/LocationQueryService.js';
import { RouteQueryService } from './services/RouteQueryService.js';
import { RouteMutationService } from './services/RouteMutationService.js';
import type { RuntimePluginDefinition } from './types/RuntimePluginDefinition.js';

interface PerformanceMemoryStats {
  usedJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

type DexieCollectionHandle = {
  toArray: () => Promise<any[]>;
  count: () => Promise<number>;
  delete?: () => Promise<number>;
};

type DexieWhereHandle = {
  equals: (value: unknown) => DexieCollectionHandle;
};

type DexieTableHandle = {
  where: (key: string) => DexieWhereHandle;
  get?: (id: string) => Promise<any>;
  delete?: (id: string) => Promise<void>;
};

type ShapeDatabaseHandle = {
  open?: () => Promise<unknown>;
  close?: () => void;
  batchSessions: DexieTableHandle;
  batchTasks: DexieTableHandle;
  features: DexieTableHandle;
  featureBuffers: DexieTableHandle;
  tileBuffers: DexieTableHandle;
  vectorTiles: DexieTableHandle;
  cache: DexieTableHandle;
  getVectorTile?: (nodeId: NodeId, z: number, x: number, y: number) => Promise<any>;
  clearCache?: (nodeId?: NodeId, cacheType?: string) => Promise<number>;
};

type RouteDatabaseHandle = {
  open?: () => Promise<unknown>;
  close?: () => void;
  routeResults: {
    where: (key: string) => {
      equals: (value: NodeId) => { toArray: () => Promise<unknown[]>; delete?: () => Promise<number> };
    };
  };
  routeCache: {
    where: (key: string) => {
      equals: (value: NodeId) => { delete?: () => Promise<number> };
    };
  };
  routeCursors: {
    where: (key: string) => {
      equals: (value: NodeId) => { delete?: () => Promise<number> };
    };
  };
  pendingSessions: {
    where: (key: string) => {
      equals: (value: NodeId) => { delete?: () => Promise<number> };
    };
  };
};

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

      const pluginMap: { [key: string]: RuntimePluginDefinition } = Object.fromEntries(
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

      const uiStateDB = await UIStateDB.getSingleton();
      const treeTableExpandedService: TreeTableExpandedAPI = new TreeTableExpandedService(
        uiStateDB,
        treeQueryService,
      );

      const styleDB = await StyleDB.getSingleton();
      const styleService: StyleQueryAPI & StyleMutationAPI = await StyleService.getSingleton(
        styleDB,
      );
      const { ShapeDB } = await import('@hierarchidb/shape-plugin') as {
        ShapeDB: new () => ShapeDatabaseHandle;
      };
      const shapeDB = new ShapeDB();
      const shapeQueryService: ShapeQueryAPI = await ShapeQueryService.getSingleton(shapeDB);
      const shapeMutationService: ShapeMutationAPI = await ShapeMutationService.getSingleton(shapeDB);
      const locationQueryService: LocationQueryAPI = await LocationQueryService.getSingleton();
      const { RouteDatabase } = await import('@hierarchidb/route-plugin/database') as {
        RouteDatabase: new () => RouteDatabaseHandle;
      };
      const routeDB = new RouteDatabase();
      const routeQueryService: RouteQueryAPI = await RouteQueryService.getSingleton(routeDB);
      const routeMutationService: RouteMutationAPI = await RouteMutationService.getSingleton(routeDB);

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
        routeDB,
        routeQueryService,
        routeMutationService,
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
    private treeTableExpandedService: TreeTableExpandedAPI,
    private styleDB: StyleDB,
    private styleService: StyleQueryAPI & StyleMutationAPI,
    private shapeDB: ShapeDatabaseHandle,
    private shapeQueryService: ShapeQueryAPI,
    private shapeMutationService: ShapeMutationAPI,
    private locationQueryService: LocationQueryAPI,
    private routeDB: RouteDatabaseHandle,
    private routeQueryService: RouteQueryAPI,
    private routeMutationService: RouteMutationAPI,
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
    this.styleDB.close();
    this.shapeDB.close?.();
    this.routeDB.close?.();
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
    return this.styleService;
  }

  getStyleMutationAPI(): StyleMutationAPI {
    return this.styleService;
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
