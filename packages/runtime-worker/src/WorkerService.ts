import type { NodeType } from '@hierarchidb/core-types';
import { initializeEphemeralDB } from '@hierarchidb/gis-sdk';
import { enableAllExporters, enableAllImporters } from '@hierarchidb/import-export';
import type { ImportExportAPI } from '@hierarchidb/import-export-api';
import type { LocationMutationAPI, LocationQueryAPI } from '@hierarchidb/location-api';
import { initializeLocationDB } from '@hierarchidb/location-store';
import type { PluginLifecycleAPI } from '@hierarchidb/plugin-base';
import type { RouteMutationAPI, RouteQueryAPI } from '@hierarchidb/route-api';
import type { RouteDatabaseHandle } from '@hierarchidb/route-store';
import { initializeRouteDB } from '@hierarchidb/route-store';
import type { ShapeMutationAPI, ShapeQueryAPI } from '@hierarchidb/shape-api';
import { initializeShapeDB, type ShapeDB } from '@hierarchidb/shape-store';
import type { StyleMutationAPI, StyleQueryAPI } from '@hierarchidb/style-api';
import { StylerDB } from '@hierarchidb/styler-store';
import { TagService } from '@hierarchidb/tag';
import type { TagAPI } from '@hierarchidb/tag-api';
import type {
  TreeMutationAPI,
  TreeNodeData,
  TreeNodeUpdaterAPI,
  TreeQueryAPI,
  TreeSubscriptionAPI,
  TreeTableExpandedAPI,
} from '@hierarchidb/tree-api';
import { getBuildDatabasePrefix, getDBName, SingletonMixin } from '@hierarchidb/util';
import type {
  YamlCanonicalZipAPI,
  YamlCanonicalZipServiceFactory,
  YamlCoreDbReadOnlyInventoryResult,
} from '@hierarchidb/worker-api';
import { EntityLifecycleManager } from './entity/EntityLifecycleManager.js';
import { ImportExportDBPortCoreDBAdapter } from './services/adapters/ImportExportDBPortCoreDBAdapter.js';
import { TagDBPortCoreDBAdapter } from './services/adapters/TagDBPortCoreDBAdapter.js';
import { CommandProcessor } from './services/CommandProcessor.js';
import { CoreDB } from './services/CoreDB.js';
import { generateNodeId } from './services/generateNodeId.js';
import { getYamlCoreDbReadOnlyInventory } from './services/getYamlCoreDbReadOnlyInventory.js';
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
import {
  TreeNodeUpdaterService,
  type YamlCanonicalDialogWriter,
} from './services/TreeNodeUpdaterService.js';
import { TreeQueryService } from './services/TreeQueryService.js';
import { TreeSubscriptionService } from './services/TreeSubscriptionService.js';
import { TreeTableExpandedService } from './services/TreeTableExpandedService.js';
import { UIStateDB } from './services/UIStateDB.js';
import { reconcileRunningBuildSessions } from './services/utils/reconcileStaleBuildSessions.js';
import { YamlCanonicalZipCoreDbPort } from './services/YamlCanonicalZipCoreDbPort.js';
import type { RuntimePluginDefinition } from './types/RuntimePluginDefinition.js';

export interface WorkerServiceOptions {
  readonly databasePrefix: string;
  readonly yamlCanonicalDialogWriter?: YamlCanonicalDialogWriter;
  readonly yamlCanonicalZipServiceFactory?: YamlCanonicalZipServiceFactory;
  readonly assertYamlStorageCanonicalAccess?: () => void;
}

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

  static async getSingleton(
    plugins: RuntimePluginDefinition[],
    options: WorkerServiceOptions
  ): Promise<WorkerService> {
    if (options.databasePrefix !== getBuildDatabasePrefix()) {
      throw new Error('worker-service-database-prefix-mismatch');
    }
    const instance = await SingletonMixin.getSingleton('WorkerService', async () => {
      const coreDatabaseName = getDBName(options.databasePrefix, 'core');
      const coreDB: CoreDB = await CoreDB.getSingleton(coreDatabaseName);
      initializeEphemeralDB(getDBName(options.databasePrefix, 'ephemeral'));
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

      const shapeDB = initializeShapeDB(getDBName(options.databasePrefix, 'shape'));
      const shapeChunkStoreDatabaseName = getDBName(options.databasePrefix, 'shape-chunks');

      // Import/Export services
      const iePort = new ImportExportDBPortCoreDBAdapter(coreDB, shapeDB);
      const importExportService: ImportExportAPI<TreeNodeData> =
        await ImportExportLifecycleService.getSingleton<TreeNodeData>(iePort);

      const treeNodeUpdaterService: TreeNodeUpdaterAPI<TreeNodeData> = new TreeNodeUpdaterService(
        coreDB,
        commandProcessor,
        tagService,
        options.yamlCanonicalDialogWriter
      );
      const assertCanonicalAccess =
        options.assertYamlStorageCanonicalAccess ??
        (() => {
          throw new Error('yaml-storage-canonical-access-guard-required');
        });
      const yamlCanonicalZipService: YamlCanonicalZipAPI = options.yamlCanonicalZipServiceFactory?.(
        {
          coreDB: new YamlCanonicalZipCoreDbPort(coreDB),
          assertCanonicalAccess,
          generateNodeId,
          now: Date.now,
        }
      ) ?? {
        async exportYamlCanonicalZip() {
          return Object.freeze({ ok: false, code: 'ACCESS_DENIED' as const });
        },
        async importYamlCanonicalZip() {
          return Object.freeze({ ok: false, code: 'ACCESS_DENIED' as const });
        },
      };

      const uiStateDB = await UIStateDB.getSingleton(getDBName(options.databasePrefix, 'ui-atoms'));
      const treeTableExpandedService: TreeTableExpandedAPI = new TreeTableExpandedService(
        uiStateDB,
        treeQueryService
      );

      const styleDB = await StylerDB.getSingleton(getDBName(options.databasePrefix, 'style'));
      const styleService: StyleQueryAPI & StyleMutationAPI =
        await StyleService.getSingleton(styleDB);
      const shapeQueryService: ShapeQueryAPI = await ShapeQueryService.getSingleton(
        shapeDB,
        shapeChunkStoreDatabaseName
      );
      const shapeMutationService: ShapeMutationAPI = await ShapeMutationService.getSingleton(
        shapeDB,
        shapeChunkStoreDatabaseName
      );
      initializeLocationDB(getDBName(options.databasePrefix, 'location'));
      const locationQueryService: LocationQueryAPI = await LocationQueryService.getSingleton();
      const locationMutationService: LocationMutationAPI =
        await LocationMutationService.getSingleton();
      const routeDB = initializeRouteDB(
        getDBName(options.databasePrefix, 'route')
      ) as RouteDatabaseHandle;
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
        options.databasePrefix,
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
        routeMutationService,
        yamlCanonicalZipService,
        assertCanonicalAccess
      );
    });
    if (instance.databasePrefix !== options.databasePrefix) {
      throw new Error('worker-service-database-prefix-mismatch');
    }
    return instance;
  }

  private static async recoverBuildSessionRuntimeRecordsOnWarmStart(): Promise<void> {
    try {
      const result = await reconcileRunningBuildSessions();
      if (result.repairedNodeIds.length > 0) {
        console.warn('[WorkerService] Repaired stale running build sessions on startup', {
          repairedNodeIds: result.repairedNodeIds,
          checkedCount: result.checkedNodeIds.length,
        });
      }
    } catch (error) {
      console.error('[WorkerService] Failed to recover persisted build sessions', error);
    }
  }

  constructor(
    private readonly databasePrefix: string,
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
    private routeMutationService: RouteMutationAPI,
    private yamlCanonicalZipService: YamlCanonicalZipAPI,
    private assertCanonicalAccess: () => void
  ) {}

  private readonly guardedServiceApis = new WeakMap<object, object>();

  private guardServiceApi<T extends object>(service: T): T {
    const existing = this.guardedServiceApis.get(service);
    if (existing !== undefined) return existing as T;
    const guarded = new Proxy(service, {
      get: (target, property, receiver) => {
        this.assertCanonicalAccess();
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function'
          ? (...args: unknown[]) => {
              this.assertCanonicalAccess();
              return Reflect.apply(value, target, args);
            }
          : value;
      },
    });
    this.guardedServiceApis.set(service, guarded);
    return guarded;
  }

  ping(): { response: 'pong'; timestamp: number } {
    const shouldLogInfo =
      typeof console !== 'undefined' &&
      typeof console.log === 'function' &&
      !(globalThis as { __HDB_SILENCE_WORKER_LOGS__?: boolean }).__HDB_SILENCE_WORKER_LOGS__;
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

  async getYamlCoreDbReadOnlyInventory(): Promise<YamlCoreDbReadOnlyInventoryResult> {
    this.assertCanonicalAccess();
    return getYamlCoreDbReadOnlyInventory(this.coreDB);
  }

  getYamlCanonicalZipAPI(): YamlCanonicalZipAPI {
    return this.guardServiceApi(this.yamlCanonicalZipService);
  }

  getCoreDB(): CoreDB {
    return this.coreDB;
  }

  getQueryAPI(): TreeQueryAPI {
    return this.guardServiceApi(this.queryService);
  }

  getMutationAPI() {
    return this.guardServiceApi(this.mutationService);
  }

  getSubscriptionAPI() {
    return this.guardServiceApi(this.subscriptionService);
  }

  getTreeNodeUpdaterAPI() {
    return this.guardServiceApi(this.treeNodeUpdaterService);
  }

  getTreeTableExpandedAPI() {
    return this.treeTableExpandedService;
  }

  getImportExportAPI() {
    return this.guardServiceApi(this.importExportService);
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
