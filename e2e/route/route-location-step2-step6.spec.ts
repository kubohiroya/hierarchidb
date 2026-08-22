import '../utils/skip-if-disabled';
import type { Page } from '@playwright/test';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '../../plugins/route-plugin/src/common/config/buildConfig';
import { expect, test } from '../fixtures/canonicalAuthFixture';
import {
  buildAppUrl,
  clearTestData,
  dismissGuidedTour,
  setupConsoleErrorTracking,
  waitForTreeTableLoad,
} from '../utils/test-helpers';

type WorkerTree = {
  id: string;
  rootId: string;
};

type WorkerNode = {
  id: string;
  parentId?: string | null;
  treeId: string;
  pageNodeId?: string;
};

type WorkerQueryAPI = {
  listTrees: () => Promise<WorkerTree[]>;
  getNode: (nodeId: string) => Promise<{ id?: string; draftData?: Record<string, unknown> } | null>;
};

type WorkerMutationAPI = {
  createNode: (input: {
    nodeType: string;
    treeId: string;
    parentId: string;
    name: string;
  }) => Promise<{ success: boolean; nodeId: string }>;
};

type WorkerUpdaterAPI = {
  updateTreeNode: (
    nodeId: string,
    payload: {
      mode: string;
      draftMetadata: { name: string; description?: string; tags: string[] };
      draftData: unknown;
      dialogUIState: Record<string, unknown>;
    }
  ) => Promise<void>;
};

type LocationMutationAPI = {
  upsertLocationGroups: (
    nodeId: string,
    items: Array<{ id: string; data: Record<string, unknown> }>
  ) => Promise<void>;
  deleteLocationGroups: (nodeId: string, itemIds: string[]) => Promise<void>;
};

type RouteMutationAPI = {
  resolveIdeGsmRouteCoverage: (request: { nodeId: string; tabularSourceId: string }) => Promise<{
    coverageByCountryOr: Record<string, string[]>;
    coverageByCountryAnd: Record<string, string[]>;
    rowCount: number;
    errorCount: number;
  }>;
  resolveIdeGsmRouteBuildRoutes: (request: {
    nodeId: string;
    tabularSourceId: string;
    selectedArrayByCountries: Record<string, boolean[]>;
  }) => Promise<Array<{ startLocationId: string; endLocationId: string; routeMode: string }>>;
};

type RouteQueryAPI = {
  listRouteLineStrings: (nodeId: string) => Promise<Array<Record<string, unknown>>>;
  checkRouteMetadataSync: (nodeId: string) => Promise<{
    totalCount: number;
    syncedCount: number;
    staleCount: number;
  }>;
  countRouteReferencesToLocations: (locationNodeIds: string[]) => Promise<number>;
};

type WorkerApi = {
  getQueryAPI?: () => Promise<WorkerQueryAPI>;
  getMutationAPI?: () => Promise<WorkerMutationAPI>;
  getTreeNodeUpdaterAPI?: () => Promise<WorkerUpdaterAPI>;
  getLocationMutationAPI?: () => Promise<LocationMutationAPI>;
  getRouteMutationAPI?: () => Promise<RouteMutationAPI>;
  getRouteQueryAPI?: () => Promise<RouteQueryAPI>;
  getBuildSessionStatus?: (
    nodeType: string,
    nodeId: string
  ) => Promise<{ status?: string; [key: string]: unknown }>;
  getBuildTasks?: (nodeType: string, nodeId: string) => Promise<Array<Record<string, unknown>>>;
};

type WorkerClientRef = {
  isInitialized?: boolean;
  initialize?: () => Promise<void> | void;
  client?: WorkerApi;
  getAPI?: () => WorkerApi | undefined;
};

type WindowWithWorkerRef = Window & {
  __HDB_WORKER_CLIENT_REF__?: WorkerClientRef;
  __routeLocationE2E?: RouteLocationE2EHelpers;
};

type RouteLocationE2EHelpers = {
  seedRouteTabularFixture: (tableId: string) => Promise<void>;
  seedRouteFeatureAndArtifacts: (routeNodeId: string, locationNodeId: string) => Promise<void>;
  getRecord: (
    dbName: string,
    storeName: string,
    key: IDBValidKey
  ) => Promise<Record<string, unknown> | undefined>;
  countByIndex: (
    dbName: string,
    storeName: string,
    indexName: string,
    value: IDBValidKey
  ) => Promise<number>;
};

const routeTableId = 'route-location-e2e-table';
const routeFeatureId = 'route-location-e2e-route';
const tokyoFeatureId = 'tokyo';
const osakaFeatureId = 'osaka';
const selectedRoadInJapan = {
  JP: [false, false, false, false, true, false, false, false, false, true],
};

const locationPoint = (
  id: string,
  name: string,
  latitude: number,
  longitude: number,
  admin1: string,
  admin1Code: string
): { id: string; data: Record<string, unknown> } => ({
  id,
  data: {
    schemaVersion: 2,
    pointId: id,
    name,
    latitude,
    longitude,
    type: 'station',
    admin0: 'Japan',
    admin0Code: 'JP',
    admin1,
    admin1Code,
  },
});

const buildRouteDraft = (name: string, locationNodeId: string): Record<string, unknown> => ({
  name,
  description: 'Route/location canonical Step2-Step6 E2E build fixture',
  dataSourceName: 'ide-gsm',
  tabularSourceId: routeTableId,
  ideGsmFileName: 'route-location-e2e.csv',
  transportMode: 'road',
  transportSelection: 'road',
  generationMethod: 'selection',
  selectedArrayByCountries: selectedRoadInJapan,
  routeBuildInput: {
    kind: 'selection-driven',
    routes: [
      {
        startLocationId: locationNodeId,
        endLocationId: locationNodeId,
        startCoordinates: [139.6917, 35.6895],
        endCoordinates: [135.5023, 34.6937],
        routeMode: 'road',
        metadata: {
          source: 'route-location-e2e',
          country: 'JP',
          oneway: true,
        },
      },
    ],
  },
  buildConfig: DEFAULT_ROUTE_BUILD_CONFIG,
  processingStatus: 'idle',
});

const selectionRouteDraft = (name: string): Record<string, unknown> => ({
  name,
  description: 'Route/location canonical Step2-Step6 E2E selection fixture',
  dataSourceName: 'ide-gsm',
  tabularSourceId: routeTableId,
  ideGsmFileName: 'route-location-e2e.csv',
  licenseAgreement: true,
  licenseAgreedAt: Date.now(),
  selectedArrayByCountries: selectedRoadInJapan,
  buildConfig: DEFAULT_ROUTE_BUILD_CONFIG,
  processingStatus: 'idle',
});

async function installIndexedDbFixtureHelpers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type StoreDefinition = {
      name: string;
      options?: IDBObjectStoreParameters;
      indexes?: Array<{ name: string; keyPath: string | string[]; options?: IDBIndexParameters }>;
    };

    const routeFeatureIdValue = 'route-location-e2e-route';
    const tokyoFeatureIdValue = 'tokyo';
    const osakaFeatureIdValue = 'osaka';
    const routeStoreDefinitions: StoreDefinition[] = [
      {
        name: 'features',
        options: { keyPath: 'id' },
        indexes: [
          { name: 'nodeId', keyPath: 'nodeId' },
          { name: 'startLocationId', keyPath: 'startLocationId' },
          { name: 'endLocationId', keyPath: 'endLocationId' },
        ],
      },
      {
        name: 'vectorTiles',
        options: { keyPath: 'tileId' },
        indexes: [
          { name: 'nodeId', keyPath: 'nodeId' },
          { name: '[nodeId+z+x+y]', keyPath: ['nodeId', 'z', 'x', 'y'] },
        ],
      },
      {
        name: 'tileIndex',
        options: { keyPath: 'id' },
        indexes: [
          { name: 'nodeId', keyPath: 'nodeId' },
          { name: '[nodeId+z+x+y]', keyPath: ['nodeId', 'z', 'x', 'y'] },
        ],
      },
    ];
    const ephemeralStoreDefinitions: StoreDefinition[] = [
      {
        name: 'buildTasks',
        options: { keyPath: 'taskId' },
        indexes: [
          { name: 'nodeId', keyPath: 'nodeId' },
          { name: 'status', keyPath: 'status' },
          { name: 'index', keyPath: 'index' },
          { name: 'stagePriority', keyPath: 'stagePriority' },
          { name: 'sequence', keyPath: 'sequence' },
          { name: '[nodeId+status]', keyPath: ['nodeId', 'status'] },
          { name: '[nodeId+stage]', keyPath: ['nodeId', 'stage'] },
          { name: '[nodeId+index]', keyPath: ['nodeId', 'index'] },
          { name: '[nodeId+status+index]', keyPath: ['nodeId', 'status', 'index'] },
          { name: '[nodeId+stage+index]', keyPath: ['nodeId', 'stage', 'index'] },
          {
            name: '[nodeId+stage+status+index]',
            keyPath: ['nodeId', 'stage', 'status', 'index'],
          },
        ],
      },
      {
        name: 'buildSessionConfigs',
        options: { keyPath: 'nodeId' },
      },
      {
        name: 'buildSessionHeartbeats',
        options: { keyPath: 'nodeId' },
      },
      {
        name: 'buildSessionStatuses',
        options: { keyPath: 'nodeId' },
        indexes: [{ name: 'status', keyPath: 'status' }],
      },
      {
        name: 'buildStageStatuses',
        options: { keyPath: 'id' },
        indexes: [
          { name: 'nodeId', keyPath: 'nodeId' },
          { name: '[nodeId+stage]', keyPath: ['nodeId', 'stage'] },
          { name: '[nodeId+startedAt]', keyPath: ['nodeId', 'startedAt'] },
        ],
      },
      {
        name: 'sourceCache',
        options: { keyPath: 'id' },
        indexes: [
          { name: 'nodeId', keyPath: 'nodeId' },
          { name: '[nodeId+sourceKey]', keyPath: ['nodeId', 'sourceKey'] },
          {
            name: '[nodeId+countryCode+adminLevel]',
            keyPath: ['nodeId', 'countryCode', 'adminLevel'],
          },
        ],
      },
      {
        name: 'sourceCacheMeta',
        options: { keyPath: 'id' },
        indexes: [
          { name: 'nodeId', keyPath: 'nodeId' },
          { name: '[nodeId+sourceKey]', keyPath: ['nodeId', 'sourceKey'] },
          {
            name: '[nodeId+countryCode+adminLevel]',
            keyPath: ['nodeId', 'countryCode', 'adminLevel'],
          },
        ],
      },
      {
        name: 'geometryCache',
        options: { keyPath: 'id' },
        indexes: [
          { name: 'nodeId', keyPath: 'nodeId' },
          { name: '[nodeId+bandIndex]', keyPath: ['nodeId', 'bandIndex'] },
          {
            name: '[nodeId+countryCode+adminLevel]',
            keyPath: ['nodeId', 'countryCode', 'adminLevel'],
          },
          { name: '[nodeId+timestamp]', keyPath: ['nodeId', 'timestamp'] },
        ],
      },
      {
        name: 'geometryCacheMeta',
        options: { keyPath: 'id' },
        indexes: [
          { name: 'nodeId', keyPath: 'nodeId' },
          { name: '[nodeId+bandIndex]', keyPath: ['nodeId', 'bandIndex'] },
          {
            name: '[nodeId+countryCode+adminLevel]',
            keyPath: ['nodeId', 'countryCode', 'adminLevel'],
          },
          { name: '[nodeId+timestamp]', keyPath: ['nodeId', 'timestamp'] },
        ],
      },
      {
        name: 'geometryErrors',
        options: { keyPath: 'id' },
        indexes: [{ name: 'nodeId', keyPath: 'nodeId' }],
      },
      {
        name: 'tileEmitBufferRelations',
        options: { keyPath: 'id' },
        indexes: [
          { name: 'nodeId', keyPath: 'nodeId' },
          { name: 'bufferId', keyPath: 'bufferId' },
          { name: '[nodeId+bandIndex]', keyPath: ['nodeId', 'bandIndex'] },
          { name: '[nodeId+bandIndex+tileId]', keyPath: ['nodeId', 'bandIndex', 'tileId'] },
        ],
      },
    ];

    const applyStoreDefinitions = (
      db: IDBDatabase,
      stores: StoreDefinition[],
      upgradeTransaction: IDBTransaction | null
    ): void => {
      for (const store of stores) {
        let objectStore: IDBObjectStore;
        if (db.objectStoreNames.contains(store.name)) {
          if (!upgradeTransaction) {
            throw new Error(`upgrade transaction unavailable for ${store.name}`);
          }
          objectStore = upgradeTransaction.objectStore(store.name);
        } else {
          objectStore = db.createObjectStore(store.name, store.options);
        }
        for (const index of store.indexes ?? []) {
          if (!objectStore.indexNames.contains(index.name)) {
            objectStore.createIndex(index.name, index.keyPath, index.options);
          }
        }
      }
    };

    const hasStoreDefinitions = (db: IDBDatabase, stores: StoreDefinition[]): boolean => {
      for (const store of stores) {
        if (!db.objectStoreNames.contains(store.name)) return false;
        const tx = db.transaction(store.name, 'readonly');
        const objectStore = tx.objectStore(store.name);
        for (const index of store.indexes ?? []) {
          if (!objectStore.indexNames.contains(index.name)) {
            tx.abort();
            return false;
          }
        }
        tx.abort();
      }
      return true;
    };

    const openDbVersion = (
      name: string,
      stores: StoreDefinition[],
      version?: number
    ): Promise<IDBDatabase> =>
      new Promise((resolve, reject) => {
        const request =
          version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
        request.onupgradeneeded = () => {
          const db = request.result;
          applyStoreDefinitions(db, stores, request.transaction);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error(`failed to open ${name}`));
      });

    const openDb = async (name: string, stores: StoreDefinition[] = []): Promise<IDBDatabase> => {
      const db = await openDbVersion(name, stores);
      if (stores.length === 0 || hasStoreDefinitions(db, stores)) {
        return db;
      }
      const nextVersion = db.version + 1;
      db.close();
      return openDbVersion(name, stores, nextVersion);
    };

    const completeTransaction = (tx: IDBTransaction): Promise<void> =>
      new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error ?? new Error('indexeddb transaction aborted'));
        tx.onerror = () => reject(tx.error ?? new Error('indexeddb transaction failed'));
      });

    const putRecord = async (
      dbName: string,
      storeName: string,
      value: Record<string, unknown>,
      stores: StoreDefinition[] = []
    ): Promise<void> => {
      const db = await openDb(dbName, stores);
      try {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(value);
        await completeTransaction(tx);
      } finally {
        db.close();
      }
    };

    const getRecord = async (
      dbName: string,
      storeName: string,
      key: IDBValidKey
    ): Promise<Record<string, unknown> | undefined> => {
      const db = await openDb(dbName);
      try {
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, 'readonly');
          const request = tx.objectStore(storeName).get(key);
          request.onsuccess = () => resolve(request.result as Record<string, unknown> | undefined);
          request.onerror = () => reject(request.error ?? new Error('indexeddb get failed'));
        });
      } finally {
        db.close();
      }
    };

    const countByIndex = async (
      dbName: string,
      storeName: string,
      indexName: string,
      value: IDBValidKey
    ): Promise<number> => {
      const db = await openDb(dbName);
      try {
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, 'readonly');
          const request = tx.objectStore(storeName).index(indexName).count(value);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error ?? new Error('indexeddb count failed'));
        });
      } finally {
        db.close();
      }
    };

    const seedRouteTabularFixture = async (tableId: string): Promise<void> => {
      const now = Date.now();
      const headers = [
        'Start',
        'End',
        'Name',
        'Distance',
        'Speed',
        'Border',
        'Overhead',
        'Loading',
        'Mode',
        'Quality',
        'Oneway',
        'Freight',
        'Country1',
        'Region1',
        'Country2',
        'Region2',
      ];
      await putRecord(
        'hierarchidb-route-metadata',
        'tabularMetadata',
        {
          id: tableId,
          filename: 'route-location-e2e.csv',
          columns: headers.map((name, index) => ({ name, index })),
          totalRows: 1,
          isChunked: true,
          chunkCount: 1,
          fileSizeBytes: 256,
          createdAt: now,
          referencingPlugins: ['route'],
          referenceCount: 1,
        },
        [
          {
            name: 'tabularMetadata',
            options: { keyPath: 'id' },
            indexes: [
              { name: 'contentHash', keyPath: 'contentHash' },
              { name: 'filename', keyPath: 'filename' },
              { name: 'createdAt', keyPath: 'createdAt' },
              {
                name: 'referencingPlugins',
                keyPath: 'referencingPlugins',
                options: { multiEntry: true },
              },
            ],
          },
        ]
      );
      const rows = [
        {
          Start: 'Tokyo',
          End: 'Osaka',
          Name: 'Tokyo to Osaka',
          Distance: '500000',
          Speed: '80',
          Border: '',
          Overhead: '',
          Loading: '',
          Mode: '0',
          Quality: 'fixture',
          Oneway: '',
          Freight: '',
          Country1: 'JP',
          Region1: 'Tokyo',
          Country2: 'JP',
          Region2: 'Osaka',
        },
      ];
      const binaryData = new TextEncoder().encode(JSON.stringify(rows)).buffer;
      await putRecord(
        'hierarchidb-tabular-source-rowstore-db',
        'rowChunks',
        {
          id: `route:${tableId}:0`,
          pluginId: 'route',
          tableId,
          chunkIndex: 0,
          startRowIndex: 0,
          endRowIndex: 0,
          binaryData,
          createdAt: now,
          updatedAt: now,
        },
        [
          {
            name: 'rowChunks',
            options: { keyPath: 'id' },
            indexes: [
              { name: '[pluginId+tableId]', keyPath: ['pluginId', 'tableId'] },
              {
                name: '[pluginId+tableId+startRowIndex]',
                keyPath: ['pluginId', 'tableId', 'startRowIndex'],
              },
              {
                name: '[pluginId+tableId+endRowIndex]',
                keyPath: ['pluginId', 'tableId', 'endRowIndex'],
              },
              { name: 'tableId', keyPath: 'tableId' },
              { name: 'pluginId', keyPath: 'pluginId' },
              { name: 'chunkIndex', keyPath: 'chunkIndex' },
              { name: 'createdAt', keyPath: 'createdAt' },
            ],
          },
          {
            name: 'rowIndexes',
            options: { keyPath: 'id' },
            indexes: [
              { name: '[pluginId+tableId+column]', keyPath: ['pluginId', 'tableId', 'column'] },
              {
                name: '[pluginId+tableId+column+value]',
                keyPath: ['pluginId', 'tableId', 'column', 'value'],
              },
            ],
          },
        ]
      );
    };

    const seedRouteFeatureAndArtifacts = async (
      routeNodeId: string,
      locationNodeId: string
    ): Promise<void> => {
      const now = Date.now();
      await putRecord(
        'hierarchidb-route',
        'features',
        {
          id: routeFeatureIdValue,
          nodeId: routeNodeId,
          type: 'route',
          version: 1,
          createdAt: now,
          updatedAt: now,
          featureId: 'tokyo+osaka',
          name: 'Tokyo to Osaka',
          routeMode: 'road',
          startLocationId: locationNodeId,
          endLocationId: locationNodeId,
          startPoint: {
            locationId: locationNodeId,
            locationFeatureId: tokyoFeatureIdValue,
            pointId: tokyoFeatureIdValue,
            longitude: 139.6917,
            latitude: 35.6895,
            name: 'Tokyo',
            locationName: 'Tokyo',
            admin0Name: 'Japan',
            admin0Code: 'JP',
            admin1Name: 'Tokyo',
            admin1Code: '13',
          },
          endPoint: {
            locationId: locationNodeId,
            locationFeatureId: osakaFeatureIdValue,
            pointId: osakaFeatureIdValue,
            longitude: 135.5023,
            latitude: 34.6937,
            name: 'Osaka',
            locationName: 'Osaka',
            admin0Name: 'Japan',
            admin0Code: 'JP',
            admin1Name: 'Osaka',
            admin1Code: '27',
          },
        },
        routeStoreDefinitions
      );
      await putRecord(
        'hierarchidb-route',
        'vectorTiles',
        {
          tileId: `${routeNodeId}:e2e-tile`,
          nodeId: routeNodeId,
          z: 1,
          x: 1,
          y: 1,
          data: new Uint8Array([1, 2, 3]).buffer,
          size: 3,
          contentType: 'application/vnd.mapbox-vector-tile',
          timestamp: now,
        },
        routeStoreDefinitions
      );
      await putRecord(
        'hierarchidb-route',
        'tileIndex',
        {
          id: `${routeNodeId}:e2e-index`,
          nodeId: routeNodeId,
          z: 1,
          x: 1,
          y: 1,
          lineIds: [routeFeatureIdValue],
          updatedAt: now,
        },
        routeStoreDefinitions
      );
      await putRecord(
        'hierarchidb-ephemeral',
        'sourceCache',
        {
          id: `${routeNodeId}:e2e-source`,
          nodeId: routeNodeId,
          domainType: 'route',
          sourceKey: 'road:tokyo:osaka',
          data: new Uint8Array([1, 2, 3]).buffer,
          format: 'geojson',
          featureCount: 1,
          bbox: [135.5023, 34.6937, 139.6917, 35.6895],
          downloadTime: 1,
          size: 3,
          timestamp: now,
        },
        ephemeralStoreDefinitions
      );
      await putRecord(
        'hierarchidb-ephemeral',
        'geometryCache',
        {
          id: `${routeNodeId}:e2e-geometry`,
          nodeId: routeNodeId,
          domainType: 'route',
          bandIndex: 0,
          sourceKey: 'road:tokyo:osaka',
          data: new Uint8Array([1, 2, 3]).buffer,
          featureCount: 1,
          vertexCount: 2,
          polygonCount: 0,
          extractionRatio: 1,
          tolerance: 0,
          timestamp: now,
        },
        ephemeralStoreDefinitions
      );
      await putRecord(
        'hierarchidb-ephemeral',
        'tileEmitBufferRelations',
        {
          id: `${routeNodeId}:e2e-relation`,
          nodeId: routeNodeId,
          domainType: 'route',
          bandIndex: 0,
          tileId: `${routeNodeId}:e2e-tile`,
          bufferId: `${routeNodeId}:e2e-geometry`,
          createdAt: now,
        },
        ephemeralStoreDefinitions
      );
      await putRecord(
        'hierarchidb-ephemeral',
        'buildTasks',
        {
          taskId: `${routeNodeId}:e2e-task`,
          nodeId: routeNodeId,
          version: 1,
          domainType: 'route',
          status: 'completed',
          index: 0,
          stage: 'source',
          progress: 100,
          sequence: 0,
          stagePriority: 0,
        },
        ephemeralStoreDefinitions
      );
    };

    (window as WindowWithWorkerRef).__routeLocationE2E = {
      seedRouteTabularFixture,
      seedRouteFeatureAndArtifacts,
      getRecord,
      countByIndex,
    };
  });
}

async function waitForWorkerClient(page: Page): Promise<void> {
  await page.waitForFunction(
    () => Boolean((window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__?.client),
    null,
    { timeout: 20000 }
  );
}

async function createNodeWithDraft(
  page: Page,
  nodeType: 'location' | 'route',
  name: string,
  draftData: Record<string, unknown>
): Promise<WorkerNode> {
  return page.evaluate(
    async ({ nodeType: targetNodeType, name: nodeName, draft }) => {
      const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
      if (!ref) throw new Error('Worker client reference is unavailable');
      if (!ref.isInitialized && typeof ref.initialize === 'function') {
        await ref.initialize();
      }
      const client = ref.client ?? ref.getAPI?.();
      if (!client?.getQueryAPI || !client.getMutationAPI || !client.getTreeNodeUpdaterAPI) {
        throw new Error('Worker API is unavailable');
      }
      const queryAPI = await client.getQueryAPI();
      const mutationAPI = await client.getMutationAPI();
      const updaterAPI = await client.getTreeNodeUpdaterAPI();
      const trees = await queryAPI.listTrees();
      const tree = trees.find((item) => item.id === 'r') ?? trees[0];
      if (!tree) throw new Error('No console available');
      const createResult = await mutationAPI.createNode({
        nodeType: targetNodeType,
        treeId: tree.id,
        parentId: tree.rootId,
        name: nodeName,
      });
      if (!createResult.success) {
        throw new Error(`Failed to create ${targetNodeType} node`);
      }
      await updaterAPI.updateTreeNode(createResult.nodeId, {
        mode: 'save',
        draftMetadata: {
          name: nodeName,
          description: typeof draft.description === 'string' ? draft.description : undefined,
          tags: [],
        },
        draftData: draft,
        dialogUIState: {},
      });
      return {
        id: createResult.nodeId,
        treeId: tree.id,
        parentId: tree.rootId,
        pageNodeId: tree.rootId,
      };
    },
    { nodeType, name, draft: draftData }
  );
}

async function saveNodeData(
  page: Page,
  nodeId: string,
  name: string,
  data: Record<string, unknown>
): Promise<void> {
  await page.evaluate(
    async ({ targetNodeId, nodeName, draft }) => {
      const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
      if (!ref) throw new Error('Worker client reference is unavailable');
      const client = ref.client ?? ref.getAPI?.();
      if (!client?.getTreeNodeUpdaterAPI) {
        throw new Error('TreeNode updater API is unavailable');
      }
      const updaterAPI = await client.getTreeNodeUpdaterAPI();
      await updaterAPI.updateTreeNode(targetNodeId, {
        mode: 'save',
        draftMetadata: {
          name: nodeName,
          description: typeof draft.description === 'string' ? draft.description : undefined,
          tags: [],
        },
        draftData: draft,
        dialogUIState: {},
      });
    },
    { targetNodeId: nodeId, nodeName: name, draft: data }
  );
}

async function openRouteEditStep(
  page: Page,
  routeNode: WorkerNode,
  step: number,
  label: RegExp
): Promise<void> {
  const pageNodeId = routeNode.pageNodeId ?? routeNode.parentId ?? `${routeNode.treeId}:root`;
  const closeDialogButton = page.getByRole('button', { name: /ダイアログを閉じる|Close/i }).first();
  if (await closeDialogButton.isVisible().catch(() => false)) {
    await closeDialogButton.click();
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10000 });
  }
  await expect
    .poll(
      async () =>
        page.evaluate(async (targetNodeId) => {
          const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
          const client = ref?.client ?? ref?.getAPI?.();
          const queryAPI = client?.getQueryAPI ? await client.getQueryAPI() : undefined;
          const node = await queryAPI?.getNode(targetNodeId);
          return Boolean(node?.id);
        }, routeNode.id),
      { timeout: 15000, intervals: [200, 500, 1000] }
    )
    .toBe(true);
  await page.goto(buildAppUrl(`d/${routeNode.treeId}/${pageNodeId}`), {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10000 });
  await waitForTreeTableLoad(page);
  const routeNodeLink = page.locator(`a[href*="/${routeNode.id}/"]`).first();
  await expect(routeNodeLink).toBeVisible({ timeout: 20000 });
  await routeNodeLink.click();
  await expect(page).toHaveURL(new RegExp(`/${routeNode.id}/`), {
    timeout: 20000,
  });

  const openEditButton = page.getByRole('button', { name: /ノードを編集|Edit/i }).first();
  await expect(openEditButton).toBeVisible({ timeout: 10000 });
  await expect(openEditButton).toBeEnabled();
  await openEditButton.click();
  await expect(page).toHaveURL(new RegExp(`/${routeNode.id}/route/edit/normal/\\d+`), {
    timeout: 20000,
  });
  const dialog = page.getByRole('dialog').last();
  const dialogVisible = await dialog.isVisible({ timeout: 20000 }).catch(() => false);
  if (!dialogVisible) {
    const nodeSnapshot = await page.evaluate(async (targetNodeId) => {
      const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
      const client = ref?.client ?? ref?.getAPI?.();
      const queryAPI = client?.getQueryAPI ? await client.getQueryAPI() : undefined;
      return queryAPI?.getNode(targetNodeId);
    }, routeNode.id);
    throw new Error(
      `Route edit dialog did not open: url=${page.url()} node=${JSON.stringify(nodeSnapshot)}`
    );
  }
  for (let attempt = 0; attempt < step; attempt += 1) {
    const stepButton = page.getByRole('button', { name: new RegExp(`^${step}\\.\\s*`) }).first();
    await expect(stepButton).toBeVisible({ timeout: 10000 });
    await expect(stepButton).toContainText(label);
    if (await stepButton.isEnabled()) {
      await stepButton.click();
      await expect(page).toHaveURL(new RegExp(`/${routeNode.id}/route/edit/normal/${step}`), {
        timeout: 20000,
      });
      break;
    }
    const currentStepMatch = page.url().match(/\/route\/edit\/normal\/(\d+)/);
    const currentStep = currentStepMatch ? Number(currentStepMatch[1]) : NaN;
    if (currentStep === step) {
      break;
    }
    if (!Number.isInteger(currentStep) || currentStep >= step) {
      throw new Error(`Cannot navigate to route edit step ${step} from ${page.url()}`);
    }
    const nextButton = page.locator('#dialog-footer-next-button').last();
    await expect(nextButton).toBeEnabled({ timeout: 15000 });
    await nextButton.click();
    await expect(page).toHaveURL(
      new RegExp(`/${routeNode.id}/route/edit/normal/${currentStep + 1}`),
      {
        timeout: 20000,
      }
    );
  }
  await expect(page).toHaveURL(new RegExp(`/${routeNode.id}/route/edit/normal/${step}`), {
    timeout: 20000,
  });
}

async function waitForRouteBuildCompletion(page: Page, nodeId: string): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(async (targetNodeId) => {
          const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
          const client = ref?.client ?? ref?.getAPI?.();
          if (!client?.getBuildSessionStatus) {
            throw new Error('Worker build session status API unavailable');
          }
          let status: { status?: string; [key: string]: unknown };
          try {
            status = await client.getBuildSessionStatus('route', targetNodeId);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (/Session .* not found/.test(message)) {
              return 'missing';
            }
            throw error;
          }
          if (status.status !== 'failed') {
            return status.status ?? 'unknown';
          }
          const tasks = client.getBuildTasks
            ? await client.getBuildTasks('route', targetNodeId)
            : [];
          return `failed:${JSON.stringify({ status, tasks })}`;
        }, nodeId),
      { timeout: 60000, intervals: [500, 1000, 2000] }
    )
    .toBe('completed');
}

test.describe('Route canonical Step2-Step6 with Location cascade', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
  });

  test('covers selection planning, canonical build, preview sync, and location cascade', async ({
    page,
    canonicalAuth,
  }) => {
    test.setTimeout(240000);
    await installIndexedDbFixtureHelpers(page);
    await canonicalAuth.signIn();

    await page.goto(buildAppUrl('d/r'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
    await waitForWorkerClient(page);

    const suffix = String(Date.now());
    const locationNode = await createNodeWithDraft(page, 'location', `Location E2E ${suffix}`, {
      name: `Location E2E ${suffix}`,
      processingStatus: 'completed',
    });
    const selectionRouteNode = await createNodeWithDraft(
      page,
      'route',
      `Route Selection E2E ${suffix}`,
      selectionRouteDraft(`Route Selection E2E ${suffix}`)
    );
    const directRouteName = `Route Build E2E ${suffix}`;
    const directRouteDraft = buildRouteDraft(directRouteName, locationNode.id);
    const directRouteNode = await createNodeWithDraft(
      page,
      'route',
      directRouteName,
      directRouteDraft
    );

    const initialLocationItems = [
      locationPoint(tokyoFeatureId, 'Tokyo', 35.6895, 139.6917, 'Tokyo', '13'),
      locationPoint(osakaFeatureId, 'Osaka', 34.6937, 135.5023, 'Osaka', '27'),
    ];
    await page.evaluate(
      async ({ locationNodeId, routeNodeId, tableId, items }) => {
        const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
        const client = ref?.client ?? ref?.getAPI?.();
        const helpers = (window as WindowWithWorkerRef).__routeLocationE2E;
        if (!helpers) throw new Error('Route/location E2E helpers unavailable');
        if (!client?.getLocationMutationAPI) throw new Error('Location mutation API unavailable');
        const locationMutation = await client.getLocationMutationAPI();
        await locationMutation.upsertLocationGroups(locationNodeId, items);
        await helpers.seedRouteTabularFixture(tableId);
        await helpers.seedRouteFeatureAndArtifacts(routeNodeId, locationNodeId);
      },
      {
        locationNodeId: locationNode.id,
        routeNodeId: directRouteNode.id,
        tableId: routeTableId,
        items: initialLocationItems,
      }
    );

    const selectionResult = await page.evaluate(
      async ({ nodeId, tabularSourceId, selected }) => {
        const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
        const client = ref?.client ?? ref?.getAPI?.();
        if (!client?.getRouteMutationAPI) throw new Error('Route mutation API unavailable');
        const routeMutation = await client.getRouteMutationAPI();
        const coverage = await routeMutation.resolveIdeGsmRouteCoverage({
          nodeId,
          tabularSourceId,
        });
        const plannedRoutes = await routeMutation.resolveIdeGsmRouteBuildRoutes({
          nodeId,
          tabularSourceId,
          selectedArrayByCountries: selected,
        });
        return { coverage, plannedRoutes };
      },
      {
        nodeId: selectionRouteNode.id,
        tabularSourceId: routeTableId,
        selected: selectedRoadInJapan,
      }
    );
    expect(selectionResult.coverage.rowCount).toBe(1);
    expect(selectionResult.coverage.errorCount).toBe(0);
    expect(selectionResult.coverage.coverageByCountryOr.JP).toEqual(['road']);
    expect(selectionResult.coverage.coverageByCountryAnd.JP).toEqual(['road']);
    expect(selectionResult.plannedRoutes).toHaveLength(1);
    expect(selectionResult.plannedRoutes[0]).toMatchObject({
      startLocationId: locationNode.id,
      endLocationId: locationNode.id,
      routeMode: 'road',
    });

    await openRouteEditStep(page, selectionRouteNode, 2, /データソース|Data Source/i);
    await expect(page.getByText(/IDE-GSM|Data Source/i).first()).toBeVisible({ timeout: 15000 });
    await openRouteEditStep(
      page,
      selectionRouteNode,
      3,
      /交通経路の種類|Route Selection|Route Config/i
    );

    await openRouteEditStep(page, directRouteNode, 5, /ビルド|Build/i);
    const startButton = page.getByTestId('build-control-start-resume-button');
    await expect(startButton).toBeVisible({ timeout: 15000 });
    await expect(startButton).toBeEnabled();
    await startButton.click();
    await waitForRouteBuildCompletion(page, directRouteNode.id);
    await expect(page.getByRole('dialog').last()).toContainText(/completed|完了/i, {
      timeout: 15000,
    });

    await expect
      .poll(
        async () =>
          page.evaluate(async (nodeId) => {
            const helpers = (window as WindowWithWorkerRef).__routeLocationE2E;
            if (!helpers) throw new Error('Route/location E2E helpers unavailable');
            return helpers.countByIndex('hierarchidb-route', 'vectorTiles', 'nodeId', nodeId);
          }, directRouteNode.id),
        { timeout: 60000, intervals: [500, 1000, 2000] }
      )
      .toBeGreaterThan(0);

    await saveNodeData(page, directRouteNode.id, directRouteName, {
      ...directRouteDraft,
      processingStatus: 'completed',
      processedAt: Date.now(),
      buildFinishedAt: Date.now(),
    });

    await openRouteEditStep(page, directRouteNode, 6, /プレビュー|Preview/i);
    await expect(page.getByText(/Route geometry is available|経路/i).first()).toBeVisible({
      timeout: 30000,
    });
    const syncSummary = await page.evaluate(async (nodeId) => {
      const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
      const client = ref?.client ?? ref?.getAPI?.();
      if (!client?.getRouteQueryAPI) throw new Error('Route query API unavailable');
      const routeQuery = await client.getRouteQueryAPI();
      return routeQuery.checkRouteMetadataSync(nodeId);
    }, directRouteNode.id);
    expect(syncSummary).toMatchObject({ totalCount: 1, syncedCount: 1, staleCount: 0 });

    await page.evaluate(
      async ({ locationNodeId, item }) => {
        const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
        const client = ref?.client ?? ref?.getAPI?.();
        if (!client?.getLocationMutationAPI) throw new Error('Location mutation API unavailable');
        const locationMutation = await client.getLocationMutationAPI();
        await locationMutation.upsertLocationGroups(locationNodeId, [item]);
      },
      {
        locationNodeId: locationNode.id,
        item: locationPoint(tokyoFeatureId, 'Tokyo Renamed', 35.6895, 139.6917, 'Tokyo-to', '13'),
      }
    );
    const metadataSyncedRoute = await page.evaluate((key) => {
      const helpers = (window as WindowWithWorkerRef).__routeLocationE2E;
      if (!helpers) throw new Error('Route/location E2E helpers unavailable');
      return helpers.getRecord('hierarchidb-route', 'features', key);
    }, routeFeatureId);
    expect(metadataSyncedRoute?.startPoint?.locationName).toBe('Tokyo Renamed');
    expect(metadataSyncedRoute?.rebuildRequired).toBeUndefined();
    await expect
      .poll(
        async () =>
          page.evaluate(async (nodeId) => {
            const helpers = (window as WindowWithWorkerRef).__routeLocationE2E;
            if (!helpers) throw new Error('Route/location E2E helpers unavailable');
            return helpers.countByIndex('hierarchidb-ephemeral', 'sourceCache', 'nodeId', nodeId);
          }, directRouteNode.id),
        { timeout: 5000, intervals: [200, 500] }
      )
      .toBeGreaterThan(0);

    await page.evaluate(
      async ({ locationNodeId, item }) => {
        const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
        const client = ref?.client ?? ref?.getAPI?.();
        if (!client?.getLocationMutationAPI) throw new Error('Location mutation API unavailable');
        const locationMutation = await client.getLocationMutationAPI();
        await locationMutation.upsertLocationGroups(locationNodeId, [item]);
      },
      {
        locationNodeId: locationNode.id,
        item: locationPoint(tokyoFeatureId, 'Tokyo Renamed', 35.7, 139.6917, 'Tokyo-to', '13'),
      }
    );
    const rebuildRoute = await page.evaluate((key) => {
      const helpers = (window as WindowWithWorkerRef).__routeLocationE2E;
      if (!helpers) throw new Error('Route/location E2E helpers unavailable');
      return helpers.getRecord('hierarchidb-route', 'features', key);
    }, routeFeatureId);
    expect(rebuildRoute?.rebuildRequired).toBe(true);
    expect(typeof rebuildRoute?.rebuildRequiredAt).toBe('number');
    await expect(
      page.evaluate(async (nodeId) => {
        const helpers = (window as WindowWithWorkerRef).__routeLocationE2E;
        if (!helpers) throw new Error('Route/location E2E helpers unavailable');
        return helpers.countByIndex('hierarchidb-route', 'vectorTiles', 'nodeId', nodeId);
      }, directRouteNode.id)
    ).resolves.toBe(0);
    await expect(
      page.evaluate(async (nodeId) => {
        const helpers = (window as WindowWithWorkerRef).__routeLocationE2E;
        if (!helpers) throw new Error('Route/location E2E helpers unavailable');
        return helpers.countByIndex('hierarchidb-ephemeral', 'sourceCache', 'nodeId', nodeId);
      }, directRouteNode.id)
    ).resolves.toBe(0);
    const reservedStatus = await page.evaluate((nodeId) => {
      const helpers = (window as WindowWithWorkerRef).__routeLocationE2E;
      if (!helpers) throw new Error('Route/location E2E helpers unavailable');
      return helpers.getRecord('hierarchidb-ephemeral', 'buildSessionStatuses', nodeId);
    }, directRouteNode.id);
    expect(reservedStatus).toMatchObject({ nodeId: directRouteNode.id, status: 'idle' });

    await page.evaluate(
      async ({ routeNodeId, locationNodeId }) => {
        const helpers = (window as WindowWithWorkerRef).__routeLocationE2E;
        if (!helpers) throw new Error('Route/location E2E helpers unavailable');
        await helpers.seedRouteFeatureAndArtifacts(routeNodeId, locationNodeId);
      },
      { routeNodeId: directRouteNode.id, locationNodeId: locationNode.id }
    );
    const referenceCountBeforeDelete = await page.evaluate(async (locationNodeId) => {
      const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
      const client = ref?.client ?? ref?.getAPI?.();
      if (!client?.getRouteQueryAPI) throw new Error('Route query API unavailable');
      const routeQuery = await client.getRouteQueryAPI();
      return routeQuery.countRouteReferencesToLocations([locationNodeId]);
    }, locationNode.id);
    expect(referenceCountBeforeDelete).toBe(1);

    await page.evaluate(
      async ({ locationNodeId, locationFeatureId }) => {
        const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
        const client = ref?.client ?? ref?.getAPI?.();
        if (!client?.getLocationMutationAPI) throw new Error('Location mutation API unavailable');
        const locationMutation = await client.getLocationMutationAPI();
        await locationMutation.deleteLocationGroups(locationNodeId, [locationFeatureId]);
      },
      { locationNodeId: locationNode.id, locationFeatureId: tokyoFeatureId }
    );
    await expect(
      page.evaluate((key) => {
        const helpers = (window as WindowWithWorkerRef).__routeLocationE2E;
        if (!helpers) throw new Error('Route/location E2E helpers unavailable');
        return helpers.getRecord('hierarchidb-route', 'features', key);
      }, routeFeatureId)
    ).resolves.toBeUndefined();
    await expect(
      page.evaluate(async (nodeId) => {
        const helpers = (window as WindowWithWorkerRef).__routeLocationE2E;
        if (!helpers) throw new Error('Route/location E2E helpers unavailable');
        return helpers.countByIndex('hierarchidb-route', 'vectorTiles', 'nodeId', nodeId);
      }, directRouteNode.id)
    ).resolves.toBe(0);
  });
});
