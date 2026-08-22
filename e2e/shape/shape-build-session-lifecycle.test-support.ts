import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { DEFAULT_BUILD_CONFIG } from '@hierarchidb/shape-api';
import type { ConsoleMessage, Page } from '@playwright/test';
import { buildAppUrl, dismissGuidedTour, waitForTreeTableLoad } from '../utils/test-helpers';

export type ShapeNode = {
  treeId: string;
  pageNodeId: string;
  nodeId: string;
  name: string;
};

export type TaskEvidence = {
  taskId: string;
  version: number;
  stage: string;
  status: string;
  progress: number;
  display?: { kind?: string };
  metadata?: Record<string, unknown>;
  errorMessage?: string;
};

export type BuildEvidence = {
  workerStatus: string | null;
  runtimeStatus: string | null;
  runtimeActive: boolean | null;
  persistedStatus: string | null;
  persistedStopReason: string | null;
  tasks: TaskEvidence[];
  sourceApiCacheCount: number;
  sourceFilteredCacheCount: number;
  geometryCacheCount: number;
  geometryTaskCount: number;
  tileEmitTaskCount: number;
  tileMetadataCount: number;
  featureMetadataCount: number;
  geometryErrorCount: number;
  vectorTileCount: number;
  vectorTileBytes: number;
};

export type ShapeChunkStoreCatalogEvidence = {
  databaseName: string;
  relationCount: number;
  cacheKeys: string[];
};

export type BuildStatusEvidence = Pick<
  BuildEvidence,
  | 'workerStatus'
  | 'runtimeStatus'
  | 'runtimeActive'
  | 'persistedStatus'
  | 'persistedStopReason'
  | 'tasks'
>;

export type ConsoleFailureCollector = {
  assertNoUnexpectedErrors(allowedPatterns?: RegExp[]): Promise<void>;
  assertObservedError(expectedPattern: RegExp): Promise<void>;
  readDiagnostics(): Promise<readonly string[]>;
  readonly consoleErrors: readonly string[];
  readonly pageErrors: readonly string[];
};

export type TilePreviewSizeEvidence = {
  parentTileBytes: number;
  totalTileBytes: number;
  inputBytes: number;
};

type TreeSummary = {
  id: string;
  rootId: string;
};

type CreateNodeResult = {
  success: boolean;
  nodeId?: string;
  error?: unknown;
};

type TreeQueryAPI = {
  listTrees(): Promise<TreeSummary[]>;
};

type TreeMutationAPI = {
  createNode(input: {
    nodeType: string;
    treeId: string;
    parentId: string;
    name: string;
  }): Promise<CreateNodeResult>;
  removeNodes(nodeIds: string[]): Promise<{ success: boolean; error?: string }>;
};

type TreeNodeUpdaterAPI = {
  updateTreeNode(
    nodeId: string,
    payload: {
      mode: string;
      data: unknown;
      draftData: unknown;
    }
  ): Promise<void>;
};

type BuildSessionStatus = {
  status: string;
  stopReason?: string;
};

type BuildSessionRuntime = {
  status: string;
  isActive: boolean;
};

type ShapeQueryAPI = {
  getBuildSessionRecord(nodeId: string): Promise<BuildSessionStatus | null>;
  listSourceCaches(nodeId: string): Promise<unknown[]>;
  listGeometryCaches(nodeId: string): Promise<unknown[]>;
  listTileEmitMetadata(nodeId: string): Promise<TileEmitMetadataEvidence[]>;
  listFeatureMetadata(nodeId: string): Promise<unknown[]>;
  listGeometryErrorRecords(nodeId: string): Promise<unknown[]>;
  getVectorTileSummary(nodeId: string): Promise<{ tiles: number; totalBytes: number }>;
};

type TileEmitMetadataEvidence = {
  z: number;
  x: number;
  y: number;
  size: number;
  timestamp: number;
};

type ShapeMutationAPI = {
  clearShapeArtifacts(nodeId: string): Promise<void>;
  deleteBuildSession(nodeId: string): Promise<void>;
  deleteBuildTasks(nodeId: string): Promise<void>;
  upsertBuildSession(session: Record<string, unknown>): Promise<void>;
  upsertBuildTasks(tasks: ReadonlyArray<Record<string, unknown>>): Promise<void>;
};

type WorkerAPI = {
  setCorsProxyBaseURL?(value: string): Promise<void> | void;
  getQueryAPI?(): Promise<TreeQueryAPI>;
  getMutationAPI?(): Promise<TreeMutationAPI>;
  getTreeNodeUpdaterAPI?(): Promise<TreeNodeUpdaterAPI>;
  getShapeQueryAPI?(): Promise<ShapeQueryAPI>;
  getShapeMutationAPI?(): Promise<ShapeMutationAPI>;
  getBuildSessionStatus?(nodeType: string, nodeId: string): Promise<BuildSessionStatus>;
  getBuildSessionRuntime?(nodeType: string, nodeId: string): Promise<BuildSessionRuntime | null>;
  getBuildTasks?(nodeType: string, nodeId: string): Promise<TaskEvidence[]>;
  pauseBuildSession?(nodeType: string, nodeId: string, reason?: string): Promise<void>;
  cancelQueuedBuildSession?(nodeType: string, nodeId: string, reason?: string): Promise<void>;
};

type WorkerClientRef = {
  isInitialized?: boolean;
  initialize?: () => Promise<void> | void;
  client?: WorkerAPI;
  getAPI?: () => WorkerAPI | undefined;
};

type WindowWithWorkerRef = Window & {
  __HDB_WORKER_CLIENT_REF__?: WorkerClientRef;
};

const MOCK_GEOJSON_URL = 'https://shape-e2e.invalid/JPN-ADM0.geojson';
const EXPECTED_APP_ORIGIN = new URL(buildAppUrl()).origin;
const GEOBOUNDARIES_ALL_METADATA_URL = 'https://geoboundaries.org/api/current/gbOpen/ALL/ALL/';
const GEOBOUNDARIES_JPN_ADM0_METADATA_URL =
  'https://geoboundaries.org/api/current/gbOpen/JPN/ADM0/';
const ALLOWED_UPSTREAM_URLS = new Set([
  GEOBOUNDARIES_ALL_METADATA_URL,
  GEOBOUNDARIES_JPN_ADM0_METADATA_URL,
  MOCK_GEOJSON_URL,
]);
const CANONICAL_ZOOM_BAND_BOUNDARIES = [1, 2, 3] as const;

const MOCK_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'JPN-ADM0-E2E',
      properties: {
        shapeID: 'JPN-ADM0-E2E',
        shapeName: 'Japan E2E',
        shapeGroup: 'JPN',
        shapeISO: 'JPN',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [139.0, 35.0],
            [140.0, 35.0],
            [140.0, 36.0],
            [139.0, 36.0],
            [139.0, 35.0],
          ],
        ],
      },
    },
  ],
} as const;

const canonicalBuildConfig = {
  ...DEFAULT_BUILD_CONFIG,
  sourceConfig: {
    ...DEFAULT_BUILD_CONFIG.sourceConfig,
    deleteOnComplete: false,
    timeoutMs: 30_000,
  },
  geometryConfig: {
    ...DEFAULT_BUILD_CONFIG.geometryConfig,
    zoomBandBoundaries: [...CANONICAL_ZOOM_BAND_BOUNDARIES],
    enableFeatureFiltering: false,
    deleteOnComplete: false,
  },
  tileEmitConfig: {
    ...DEFAULT_BUILD_CONFIG.tileEmitConfig,
    invalidGeometryFilter: {
      ...DEFAULT_BUILD_CONFIG.tileEmitConfig.invalidGeometryFilter,
    },
    enableTopojsonSimplify: false,
  },
  cleanupConfig: {
    ...DEFAULT_BUILD_CONFIG.cleanupConfig,
  },
} as const;

const canonicalProcessingConfig = {
  source: {
    maxConcurrent: 1,
    retryAttempts: 0,
    retryDelay: 10,
    retryLimit: 0,
    retryBackoff: 'linear',
  },
  geometry: {
    maxConcurrent: 1,
  },
  tileEmit: {
    maxConcurrent: 1,
    dynamicConcurrency: {
      enabled: false,
      minConcurrent: 1,
      maxConcurrent: 1,
      highWatermark: 0.85,
      lowWatermark: 0.6,
      adjustStep: 1,
      sampleMs: 2_000,
    },
  },
} as const;

const CONSOLE_ARGUMENT_SERIALIZATION_TIMEOUT_MS = 2_000;

const serializeConsoleMessage = async (message: ConsoleMessage): Promise<string> => {
  const args = await Promise.all(
    message.args().map(async (argument) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const value = await Promise.race([
          argument.jsonValue(),
          new Promise<never>((_resolve, reject) => {
            timeoutId = setTimeout(() => {
              reject(new Error('console argument serialization timed out'));
            }, CONSOLE_ARGUMENT_SERIALIZATION_TIMEOUT_MS);
          }),
        ]);
        return JSON.stringify(value);
      } catch (error) {
        return `<unserializable:${error instanceof Error ? error.message : String(error)}>`;
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      }
    })
  );
  return `${message.text()} ${args.join(' ')}`.trim();
};

export const collectConsoleFailures = (page: Page): ConsoleFailureCollector => {
  const consoleErrors: string[] = [];
  const diagnostics: string[] = [];
  const pageErrors: string[] = [];
  const pending = new Set<Promise<void>>();

  page.on('console', (message) => {
    const isError = message.type() === 'error';
    const isDiagnostic =
      /\[(?:auth|worker bootstrap|WorkerProvider|ShapeBuildProgressStep|shapeBuildCache|Worker)\]/.test(
        message.text()
      );
    if (!isError && !isDiagnostic) return;
    const task = serializeConsoleMessage(message).then((serialized) => {
      if (isError) consoleErrors.push(serialized);
      if (isDiagnostic) diagnostics.push(serialized);
    });
    pending.add(task);
    void task.finally(() => pending.delete(task));
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message);
  });

  return {
    get consoleErrors() {
      return consoleErrors;
    },
    get pageErrors() {
      return pageErrors;
    },
    async readDiagnostics() {
      await Promise.all(Array.from(pending));
      return diagnostics;
    },
    async assertNoUnexpectedErrors(allowedPatterns: RegExp[] = []) {
      await Promise.all(Array.from(pending));
      const unexpected = [...consoleErrors, ...pageErrors].filter(
        (entry) => !allowedPatterns.some((pattern) => pattern.test(entry))
      );
      if (unexpected.length > 0) {
        throw new Error(`Unexpected browser errors:\n${unexpected.join('\n')}`);
      }
    },
    async assertObservedError(expectedPattern: RegExp) {
      await Promise.all(Array.from(pending));
      const observed = [...consoleErrors, ...pageErrors].some((entry) =>
        expectedPattern.test(entry)
      );
      if (!observed) {
        throw new Error(
          `Expected browser error was not observed: ${String(expectedPattern)}\n` +
            [...consoleErrors, ...pageErrors].join('\n')
        );
      }
    },
  };
};

const sendProxyResponse = (
  response: ServerResponse,
  status: number,
  contentType: string,
  body: string
): void => {
  response.writeHead(status, {
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-origin': EXPECTED_APP_ORIGIN,
    'content-type': contentType,
    vary: 'Origin',
  });
  response.end(body);
};

export const startDeterministicGeoBoundariesProxy = async (
  expectedAuthorizationHeader: string
): Promise<{
  readonly corsProxyBaseURL: string;
  close(): Promise<void>;
  setDownloadDelay(delayMs: number): void;
  readonly requestCount: number;
  readonly authorizedRequestCount: number;
  readonly unauthorizedRequestCount: number;
  readonly rejectedOriginRequestCount: number;
  readonly rejectedTargetRequestCount: number;
  readonly downloadRequestCount: number;
  readonly observedUrls: readonly string[];
}> => {
  let downloadDelayMs = 0;
  let requestCount = 0;
  let authorizedRequestCount = 0;
  let unauthorizedRequestCount = 0;
  let rejectedOriginRequestCount = 0;
  let rejectedTargetRequestCount = 0;
  let downloadRequestCount = 0;
  const observedUrls: string[] = [];
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    if (request.headers.origin !== EXPECTED_APP_ORIGIN) {
      rejectedOriginRequestCount += 1;
      sendProxyResponse(response, 403, 'application/json', JSON.stringify({ error: 'origin' }));
      return;
    }
    if (request.method === 'OPTIONS') {
      sendProxyResponse(response, 204, 'text/plain', '');
      return;
    }
    if (request.method !== 'GET') {
      sendProxyResponse(response, 405, 'application/json', JSON.stringify({ error: 'method' }));
      return;
    }

    requestCount += 1;
    if (request.headers.authorization !== expectedAuthorizationHeader) {
      unauthorizedRequestCount += 1;
      sendProxyResponse(response, 401, 'application/json', JSON.stringify({ error: 'auth' }));
      return;
    }
    authorizedRequestCount += 1;

    const proxyRequest = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? '127.0.0.1'}`
    );
    const rawTargetUrl = proxyRequest.searchParams.get('url');
    if (rawTargetUrl === null) {
      sendProxyResponse(response, 400, 'application/json', JSON.stringify({ error: 'target' }));
      return;
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(rawTargetUrl);
    } catch {
      rejectedTargetRequestCount += 1;
      sendProxyResponse(
        response,
        400,
        'application/json',
        JSON.stringify({ error: 'invalid-target-url' })
      );
      return;
    }
    observedUrls.push(targetUrl.toString());
    if (targetUrl.protocol !== 'https:' || !ALLOWED_UPSTREAM_URLS.has(targetUrl.toString())) {
      rejectedTargetRequestCount += 1;
      sendProxyResponse(
        response,
        403,
        'application/json',
        JSON.stringify({ error: 'upstream-not-allowed' })
      );
      return;
    }
    if (targetUrl.toString() === GEOBOUNDARIES_ALL_METADATA_URL) {
      sendProxyResponse(
        response,
        200,
        'application/json',
        JSON.stringify([
          {
            boundaryISO: 'JPN',
            boundaryType: 'ADM0',
            boundaryName: 'Japan',
            Continent: 'Asia',
          },
        ])
      );
      return;
    }
    if (targetUrl.toString() === GEOBOUNDARIES_JPN_ADM0_METADATA_URL) {
      sendProxyResponse(
        response,
        200,
        'application/json',
        JSON.stringify({
          boundaryISO: 'JPN',
          boundaryType: 'ADM0',
          boundaryName: 'Japan',
          boundaryYear: 2025,
          Continent: 'Asia',
          licenseDetail: 'Open Data',
          simplifiedGeometryGeoJSON: MOCK_GEOJSON_URL,
        })
      );
      return;
    }
    if (targetUrl.toString() === MOCK_GEOJSON_URL) {
      downloadRequestCount += 1;
      const delayAtRequestStart = downloadDelayMs;
      if (delayAtRequestStart > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, delayAtRequestStart);
        });
      }
      sendProxyResponse(response, 200, 'application/geo+json', JSON.stringify(MOCK_GEOJSON));
      return;
    }

    sendProxyResponse(
      response,
      404,
      'application/json',
      JSON.stringify({ error: `Unexpected deterministic target URL: ${targetUrl.toString()}` })
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error('Canonical Shape E2E proxy did not bind a TCP address');
  }
  const corsProxyBaseURL = `http://127.0.0.1:${address.port}/`;

  return {
    corsProxyBaseURL,
    async close() {
      server.closeAllConnections();
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
          server.closeAllConnections();
        }),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => reject(new Error('Shape E2E proxy close timed out')), 1_000);
        }),
      ]);
    },
    setDownloadDelay(delayMs: number) {
      if (!Number.isFinite(delayMs) || delayMs < 0) {
        throw new Error(`Download delay must be a finite non-negative number: ${delayMs}`);
      }
      downloadDelayMs = delayMs;
    },
    get requestCount() {
      return requestCount;
    },
    get authorizedRequestCount() {
      return authorizedRequestCount;
    },
    get unauthorizedRequestCount() {
      return unauthorizedRequestCount;
    },
    get rejectedOriginRequestCount() {
      return rejectedOriginRequestCount;
    },
    get rejectedTargetRequestCount() {
      return rejectedTargetRequestCount;
    },
    get downloadRequestCount() {
      return downloadRequestCount;
    },
    get observedUrls() {
      return observedUrls;
    },
  };
};

export const configureWorkerCorsProxy = async (
  page: Page,
  corsProxyBaseURL: string
): Promise<void> => {
  await page.waitForFunction(
    () => {
      const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
      return ref?.isInitialized === true && Boolean(ref.client);
    },
    null,
    { timeout: 30_000 }
  );
  await page.evaluate(async (proxyBaseURL) => {
    const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
    if (!ref) throw new Error('Canonical Shape E2E worker ref is missing');
    const api = ref.client;
    if (!api) throw new Error('Canonical Shape E2E worker API is not ready');
    if (!api.setCorsProxyBaseURL) {
      throw new Error('Canonical Shape E2E CORS proxy API is missing');
    }
    await api.setCorsProxyBaseURL(proxyBaseURL);
  }, corsProxyBaseURL);
};

export const prepareAuthenticatedTree = async (
  page: Page,
  corsProxyBaseURL: string
): Promise<void> => {
  await page.goto(buildAppUrl('d/r'), { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await dismissGuidedTour(page);
  await waitForTreeTableLoad(page);
  await configureWorkerCorsProxy(page, corsProxyBaseURL);
};

export const createShapeNode = async (
  page: Page,
  options: {
    label: string;
    selectedArrayByCountries: Record<string, boolean[]>;
  }
): Promise<ShapeNode> =>
  page.evaluate(
    async ({ label, selectedArrayByCountries, buildConfig, processingConfig }) => {
      const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
      const api = ref?.client ?? ref?.getAPI?.();
      if (!api) throw new Error('Canonical Shape E2E worker API is not ready');
      if (!api.getQueryAPI || !api.getMutationAPI || !api.getTreeNodeUpdaterAPI) {
        throw new Error('Canonical Shape E2E tree APIs are missing');
      }
      const [queryAPI, mutationAPI, updaterAPI] = await Promise.all([
        api.getQueryAPI(),
        api.getMutationAPI(),
        api.getTreeNodeUpdaterAPI(),
      ]);
      const trees = await queryAPI.listTrees();
      const tree = trees.find((candidate) => candidate.id === 'r');
      if (!tree) {
        throw new Error('Canonical Shape E2E requires a resources tree');
      }

      const name = `${label} ${Date.now()}`;
      const created = await mutationAPI.createNode({
        nodeType: 'shape',
        treeId: tree.id,
        parentId: tree.rootId,
        name,
      });
      if (!created.success || !created.nodeId) {
        throw new Error(
          `Canonical Shape E2E node creation failed: ${String(created.error ?? 'unknown')}`
        );
      }

      const draft = {
        name,
        description: 'Canonical Shape build-session lifecycle E2E fixture',
        buildConfig,
        processingConfig,
        selectedArrayByCountries,
        processingStatus: 'idle',
        licenseAgreement: true,
        licenseAgreedAt: new Date().toISOString(),
      };
      await updaterAPI.updateTreeNode(created.nodeId, {
        mode: 'save-draft',
        data: draft,
        draftData: draft,
      });

      return {
        treeId: tree.id,
        pageNodeId: tree.rootId,
        nodeId: created.nodeId,
        name,
      };
    },
    {
      ...options,
      buildConfig: canonicalBuildConfig,
      processingConfig: canonicalProcessingConfig,
    }
  );

export const openShapeBuildStep = async (page: Page, node: ShapeNode): Promise<void> => {
  await page.goto(buildAppUrl(`d/${node.treeId}/${node.pageNodeId}`), {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await waitForTreeTableLoad(page);
  await closeResumeDialogIfVisible(page);
  const nodeLink = page.getByRole('link', { name: node.name, exact: true }).first();
  await nodeLink.waitFor({ state: 'visible', timeout: 7_500 });
  await nodeLink.click();

  const editButton = page.getByRole('button', { name: /ノードを編集|Edit/i }).first();
  const editDeadline = Date.now() + 5_000;
  let didOpenEditor = false;
  while (Date.now() < editDeadline && !didOpenEditor) {
    await closeResumeDialogIfVisible(page, 250);
    if (await editButton.isVisible()) {
      didOpenEditor = await editButton
        .click({ timeout: 500 })
        .then(() => true)
        .catch(() => false);
    }
    if (!didOpenEditor) {
      await page.waitForTimeout(100);
    }
  }
  if (!didOpenEditor) {
    throw new Error('Shape build editor did not open after closing the resume queue dialog');
  }
  await closeResumeDialogIfVisible(page);

  const buildStep = page.getByRole('button', { name: /^5\.?\s*(ビルド|Build)/ }).first();
  await buildStep.waitFor({ state: 'visible', timeout: 7_500 });
  await buildStep.click();
  await page.getByTestId('build-control-start-resume-button').waitFor({
    state: 'visible',
    timeout: 7_500,
  });
};

export const closeResumeDialogIfVisible = async (page: Page, timeout = 2_000): Promise<void> => {
  const resumeDialog = page
    .getByRole('dialog', { name: /Build session list|ビルドセッション一覧/i })
    .first();
  const closeButton = resumeDialog.getByRole('button', { name: /×\s*(Close|閉じる)/i });
  const isVisible = await closeButton
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);
  if (!isVisible) return;
  await closeButton.click({ force: true, timeout });
  const hidden = await resumeDialog
    .waitFor({ state: 'hidden', timeout: Math.max(timeout, 1_000) })
    .then(() => true)
    .catch(() => false);
  if (hidden) return;
  await page.keyboard.press('Escape');
  await resumeDialog.waitFor({ state: 'hidden', timeout: Math.max(timeout, 1_000) });
};

export const readBuildStatusEvidence = async (
  page: Page,
  nodeId: string
): Promise<BuildStatusEvidence> =>
  page.evaluate(async (targetNodeId) => {
    const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
    const api = ref?.client;
    if (!api) throw new Error('Canonical Shape E2E worker API is not ready');
    if (
      !api.getBuildSessionStatus ||
      !api.getBuildSessionRuntime ||
      !api.getBuildTasks ||
      !api.getShapeQueryAPI
    ) {
      throw new Error('Canonical Shape E2E build status APIs are missing');
    }
    const query = await api.getShapeQueryAPI();
    const persisted = await query.getBuildSessionRecord(targetNodeId);
    if (persisted && typeof persisted.status !== 'string') {
      throw new Error('Canonical Shape E2E persisted session is missing status');
    }
    const [status, runtime, tasks] = await Promise.all([
      persisted ? api.getBuildSessionStatus('shape', targetNodeId) : Promise.resolve(null),
      api.getBuildSessionRuntime('shape', targetNodeId),
      api.getBuildTasks('shape', targetNodeId),
    ]);
    if (status !== null && typeof status.status !== 'string') {
      throw new Error('Canonical Shape E2E Worker status is missing');
    }
    if (
      runtime !== null &&
      (typeof runtime.status !== 'string' || typeof runtime.isActive !== 'boolean')
    ) {
      throw new Error('Canonical Shape E2E runtime record violates the status contract');
    }
    return {
      workerStatus: status === null ? null : status.status,
      runtimeStatus: runtime === null ? null : runtime.status,
      runtimeActive: runtime === null ? null : runtime.isActive,
      persistedStatus: persisted === null ? null : persisted.status,
      persistedStopReason: persisted?.stopReason ?? null,
      tasks,
    };
  }, nodeId);

export const readShapeChunkStoreCatalogEvidence = async (
  page: Page,
  nodeId: string
): Promise<ShapeChunkStoreCatalogEvidence[]> =>
  page.evaluate(async (targetNodeId) => {
    const requestResult = async <T>(request: IDBRequest<T>): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
        request.onsuccess = () => resolve(request.result);
      });
    const openExistingDatabase = async (databaseName: string): Promise<IDBDatabase> =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName);
        request.onerror = () =>
          reject(request.error ?? new Error(`Failed to open ${databaseName}`));
        request.onupgradeneeded = () => {
          request.transaction?.abort();
          reject(new Error(`IndexedDB catalog entry disappeared before open: ${databaseName}`));
        };
        request.onsuccess = () => resolve(request.result);
      });

    const databases = await indexedDB.databases();
    const evidence: ShapeChunkStoreCatalogEvidence[] = [];
    for (const databaseInfo of databases) {
      const databaseName = databaseInfo.name;
      if (!databaseName?.endsWith('-shape-chunks')) continue;
      const database = await openExistingDatabase(databaseName);
      try {
        if (
          !database.objectStoreNames.contains('relations') ||
          !database.objectStoreNames.contains('files')
        ) {
          evidence.push({ databaseName, relationCount: -1, cacheKeys: [] });
          continue;
        }
        const relationTransaction = database.transaction('relations', 'readonly');
        const relations = (await requestResult(
          relationTransaction.objectStore('relations').index('nodeId').getAll(targetNodeId)
        )) as Array<{ metadataId?: unknown }>;
        const metadataIds = relations.map((relation) => {
          if (typeof relation.metadataId !== 'string' || relation.metadataId.length === 0) {
            throw new Error(`Invalid chunk-store relation in ${databaseName}`);
          }
          return relation.metadataId;
        });
        const fileTransaction = database.transaction('files', 'readonly');
        const fileStore = fileTransaction.objectStore('files');
        const files = await Promise.all(
          metadataIds.map((metadataId) => requestResult(fileStore.get(metadataId)))
        );
        evidence.push({
          databaseName,
          relationCount: relations.length,
          cacheKeys: files.map((file) => {
            const cacheKey = (file as { cacheKey?: unknown } | undefined)?.cacheKey;
            return typeof cacheKey === 'string' ? cacheKey : '<missing-cache-key>';
          }),
        });
      } finally {
        database.close();
      }
    }
    return evidence;
  }, nodeId);

export const readBuildEvidence = async (page: Page, nodeId: string): Promise<BuildEvidence> =>
  page.evaluate(async (targetNodeId) => {
    const openExistingDatabase = async (databaseName: string): Promise<IDBDatabase> =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName);
        request.onerror = () =>
          reject(request.error ?? new Error(`Failed to open ${databaseName}`));
        request.onupgradeneeded = () => {
          request.transaction?.abort();
          reject(new Error(`IndexedDB catalog entry disappeared before open: ${databaseName}`));
        };
        request.onsuccess = () => resolve(request.result);
      });

    const readEphemeralCounts = async (): Promise<{
      sourceFilteredCacheCount: number;
      geometryCacheCount: number;
      geometryTaskCount: number;
      tileEmitTaskCount: number;
    }> => {
      const requiredStores = [
        'buildSessionConfigs',
        'buildTasks',
        'sourceCacheMeta',
        'geometryCacheMeta',
      ];
      const databaseNames = (await indexedDB.databases())
        .map((database) => database.name)
        .filter((name): name is string => typeof name === 'string' && name.length > 0);
      const matches: IDBDatabase[] = [];
      for (const databaseName of databaseNames) {
        const database = await openExistingDatabase(databaseName);
        if (requiredStores.every((storeName) => database.objectStoreNames.contains(storeName))) {
          matches.push(database);
        } else {
          database.close();
        }
      }
      if (matches.length !== 1) {
        matches.forEach((database) => {
          database.close();
        });
        throw new Error(
          `Canonical Shape E2E requires exactly one ephemeral database; found ${matches.length}`
        );
      }

      const database = matches[0];
      if (!database) {
        throw new Error('Canonical Shape E2E ephemeral database disappeared after discovery');
      }
      const transaction = database.transaction(
        ['buildTasks', 'sourceCacheMeta', 'geometryCacheMeta'],
        'readonly'
      );
      const countByIndex = (
        storeName: string,
        indexName: string,
        key: IDBValidKey
      ): Promise<number> =>
        new Promise<number>((resolve, reject) => {
          const request = transaction.objectStore(storeName).index(indexName).count(key);
          request.onerror = () =>
            reject(request.error ?? new Error(`Failed to count ${storeName}`));
          request.onsuccess = () => resolve(request.result);
        });
      try {
        const [sourceFilteredCacheCount, geometryCacheCount, geometryTaskCount, tileEmitTaskCount] =
          await Promise.all([
            countByIndex('sourceCacheMeta', 'nodeId', targetNodeId),
            countByIndex('geometryCacheMeta', 'nodeId', targetNodeId),
            countByIndex('buildTasks', '[nodeId+stage]', [targetNodeId, 'geometry']),
            countByIndex('buildTasks', '[nodeId+stage]', [targetNodeId, 'tileEmit']),
          ]);
        return {
          sourceFilteredCacheCount,
          geometryCacheCount,
          geometryTaskCount,
          tileEmitTaskCount,
        };
      } finally {
        database.close();
      }
    };

    const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
    const api = ref?.client ?? ref?.getAPI?.();
    if (!api) throw new Error('Canonical Shape E2E worker API is not ready');
    if (
      !api.getBuildSessionStatus ||
      !api.getBuildSessionRuntime ||
      !api.getBuildTasks ||
      !api.getShapeQueryAPI
    ) {
      throw new Error('Canonical Shape E2E build query APIs are missing');
    }
    const query = await api.getShapeQueryAPI();
    const persisted = await query.getBuildSessionRecord(targetNodeId);
    if (persisted && typeof persisted.status !== 'string') {
      throw new Error('Canonical Shape E2E persisted session is missing status');
    }
    const [
      status,
      runtime,
      tasks,
      sourceCaches,
      geometryCaches,
      tileMetadata,
      featureMetadata,
      geometryErrors,
      vectorTiles,
      ephemeralCounts,
    ] = await Promise.all([
      persisted ? api.getBuildSessionStatus('shape', targetNodeId) : Promise.resolve(null),
      api.getBuildSessionRuntime('shape', targetNodeId),
      api.getBuildTasks('shape', targetNodeId),
      query.listSourceCaches(targetNodeId),
      query.listGeometryCaches(targetNodeId),
      query.listTileEmitMetadata(targetNodeId),
      query.listFeatureMetadata(targetNodeId),
      query.listGeometryErrorRecords(targetNodeId),
      query.getVectorTileSummary(targetNodeId),
      readEphemeralCounts(),
    ]);
    if (status !== null && typeof status.status !== 'string') {
      throw new Error('Canonical Shape E2E Worker status is missing');
    }
    if (
      runtime !== null &&
      (typeof runtime.status !== 'string' || typeof runtime.isActive !== 'boolean')
    ) {
      throw new Error('Canonical Shape E2E runtime record violates the status contract');
    }
    if (
      !Number.isFinite(vectorTiles.tiles) ||
      !Number.isFinite(vectorTiles.totalBytes) ||
      vectorTiles.tiles < 0 ||
      vectorTiles.totalBytes < 0
    ) {
      throw new Error('Canonical Shape E2E vector tile summary violates the numeric contract');
    }
    if (geometryCaches.length !== ephemeralCounts.geometryCacheCount) {
      throw new Error(
        `Canonical Shape E2E geometry cache count mismatch: API=${geometryCaches.length}; IndexedDB=${ephemeralCounts.geometryCacheCount}`
      );
    }
    return {
      workerStatus: status === null ? null : status.status,
      runtimeStatus: runtime === null ? null : runtime.status,
      runtimeActive: runtime === null ? null : runtime.isActive,
      persistedStatus: persisted === null ? null : persisted.status,
      persistedStopReason: persisted?.stopReason ?? null,
      tasks,
      sourceApiCacheCount: sourceCaches.length,
      sourceFilteredCacheCount: ephemeralCounts.sourceFilteredCacheCount,
      geometryCacheCount: geometryCaches.length,
      geometryTaskCount: ephemeralCounts.geometryTaskCount,
      tileEmitTaskCount: ephemeralCounts.tileEmitTaskCount,
      tileMetadataCount: tileMetadata.length,
      featureMetadataCount: featureMetadata.length,
      geometryErrorCount: geometryErrors.length,
      vectorTileCount: vectorTiles.tiles,
      vectorTileBytes: vectorTiles.totalBytes,
    };
  }, nodeId);

const parseTileEmitTaskId = (
  nodeId: string,
  taskId: string
): { bandIndex: number; zBase: number; tileId: number } => {
  const prefix = `${nodeId}:tileEmit:`;
  if (!taskId.startsWith(prefix)) {
    throw new Error(`Canonical Shape E2E TileEmit task id has an invalid prefix: ${taskId}`);
  }
  const parts = taskId.slice(prefix.length).split(':');
  if (parts.length !== 3) {
    throw new Error(`Canonical Shape E2E TileEmit task id has an invalid shape: ${taskId}`);
  }
  const [bandIndexRaw, zBaseRaw, tileIdRaw] = parts;
  const bandIndex = Number(bandIndexRaw);
  const zBase = Number(zBaseRaw);
  const tileId = Number(tileIdRaw);
  if (
    !Number.isSafeInteger(bandIndex) ||
    bandIndex < 0 ||
    !Number.isSafeInteger(zBase) ||
    zBase < 0 ||
    !Number.isSafeInteger(tileId) ||
    tileId < 0
  ) {
    throw new Error(`Canonical Shape E2E TileEmit task id has invalid numbers: ${taskId}`);
  }
  return { bandIndex, zBase, tileId };
};

const resolveCanonicalBand = (
  bandIndex: number
): { bandIndex: number; zBase: number; zMax: number } => {
  const boundaries = [...CANONICAL_ZOOM_BAND_BOUNDARIES];
  const bands = boundaries.slice(0, -1).map((zBase, index) => {
    const nextBoundary = boundaries[index + 1];
    if (nextBoundary === undefined) {
      throw new Error(`Canonical Shape E2E zoom band ${index} is missing its upper boundary`);
    }
    return {
      bandIndex: index,
      zBase,
      zMax: index === boundaries.length - 2 ? nextBoundary : nextBoundary - 1,
    };
  });
  const band = bands.find((candidate) => candidate.bandIndex === bandIndex);
  if (!band) {
    throw new Error(`Canonical Shape E2E TileEmit task uses unknown band ${bandIndex}`);
  }
  return band;
};

export const readTilePreviewSizeEvidence = async (
  page: Page,
  nodeId: string,
  task: TaskEvidence
): Promise<TilePreviewSizeEvidence> => {
  const { bandIndex, zBase, tileId } = parseTileEmitTaskId(nodeId, task.taskId);
  const band = resolveCanonicalBand(bandIndex);
  if (band.zBase !== zBase) {
    throw new Error(
      `Canonical Shape E2E TileEmit task band mismatch: task zBase=${zBase}; expected=${band.zBase}`
    );
  }

  const summary = task.metadata?.tileEmitParentInputSummary;
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    throw new Error('Canonical Shape E2E TileEmit task is missing parent input summary metadata');
  }
  const rawInputBytes = (summary as Record<string, unknown>).intersectingGeojsonByteSize;
  if (typeof rawInputBytes !== 'number' || !Number.isFinite(rawInputBytes) || rawInputBytes < 0) {
    throw new Error('Canonical Shape E2E TileEmit input byte size violates the numeric contract');
  }

  const tileMetadata = await page.evaluate(async (targetNodeId) => {
    const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
    const api = ref?.client ?? ref?.getAPI?.();
    if (!api?.getShapeQueryAPI) {
      throw new Error('Canonical Shape E2E Shape query API is missing');
    }
    const query = await api.getShapeQueryAPI();
    return query.listTileEmitMetadata(targetNodeId);
  }, nodeId);
  for (const row of tileMetadata) {
    if (
      !Number.isSafeInteger(row.z) ||
      row.z < 0 ||
      !Number.isSafeInteger(row.x) ||
      row.x < 0 ||
      !Number.isSafeInteger(row.y) ||
      row.y < 0 ||
      !Number.isFinite(row.size) ||
      row.size < 0 ||
      !Number.isFinite(row.timestamp) ||
      row.timestamp < 0
    ) {
      throw new Error('Canonical Shape E2E TileEmit metadata violates the numeric contract');
    }
  }

  const tileIndexScale = 2 ** 22;
  const tileIndexStride = tileIndexScale * tileIndexScale;
  const offset = tileId - zBase * tileIndexStride;
  const parentX = Math.floor(offset / tileIndexScale);
  const parentY = offset - parentX * tileIndexScale;
  if (parentX < 0 || parentY < 0) {
    throw new Error(
      `Canonical Shape E2E TileEmit task has an invalid packed tile id: ${task.taskId}`
    );
  }

  const parentCandidates = tileMetadata.filter(
    (row) => row.z === zBase && row.x === parentX && row.y === parentY
  );
  const latestParent = parentCandidates.reduce<TileEmitMetadataEvidence | null>(
    (latest, row) => (latest === null || row.timestamp > latest.timestamp ? row : latest),
    null
  );
  if (latestParent === null) {
    throw new Error(`Canonical Shape E2E TileEmit parent metadata is missing: ${task.taskId}`);
  }

  const descendants = tileMetadata.filter((row) => {
    if (row.z < zBase || row.z > band.zMax) return false;
    const scale = 2 ** (row.z - zBase);
    return (
      row.x >= parentX * scale &&
      row.x <= (parentX + 1) * scale - 1 &&
      row.y >= parentY * scale &&
      row.y <= (parentY + 1) * scale - 1
    );
  });
  if (descendants.length === 0) {
    throw new Error(`Canonical Shape E2E TileEmit descendant metadata is missing: ${task.taskId}`);
  }

  return {
    parentTileBytes: latestParent.size,
    totalTileBytes: descendants.reduce((total, row) => total + row.size, 0),
    inputBytes: Math.round(rawInputBytes),
  };
};

export const cancelBuildDirectly = async (page: Page, nodeId: string): Promise<void> => {
  await page.evaluate(async (targetNodeId) => {
    const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
    const api = ref?.client ?? ref?.getAPI?.();
    if (!api) throw new Error('Canonical Shape E2E worker API is not ready');
    if (!api.cancelQueuedBuildSession) {
      throw new Error('Canonical Shape E2E cancel API is missing');
    }
    await api.cancelQueuedBuildSession('shape', targetNodeId, 'user-pause');
  }, nodeId);
};

export const seedFilterSession = async (page: Page, nodeId: string): Promise<void> => {
  await page.evaluate(async (targetNodeId) => {
    const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
    const api = ref?.client ?? ref?.getAPI?.();
    if (!api) throw new Error('Canonical Shape E2E worker API is not ready');
    if (!api.getShapeMutationAPI) {
      throw new Error('Canonical Shape E2E mutation API is missing');
    }
    const mutation = await api.getShapeMutationAPI();
    const startedAt = Date.now() - 1_000;
    await mutation.upsertBuildSession({
      nodeId: targetNodeId,
      status: 'paused',
      stopReason: 'user-pause',
      canResume: true,
      startedAt,
      updatedAt: startedAt,
      stageId: 'source',
      stageStartedAt: startedAt,
      stageInactiveMs: 0,
      inactiveMs: 0,
      lastHeartbeatAt: startedAt + 500,
      progress: {
        total: 4,
        completed: 1,
        failed: 1,
        skipped: 1,
        percentage: 75,
        stage: 'source',
      },
      stages: {
        source: {
          status: 'running',
          progress: 75,
          tasksTotal: 4,
          tasksCompleted: 2,
          tasksFailed: 1,
        },
      },
    });
    await mutation.upsertBuildTasks([
      {
        taskId: `${targetNodeId}:filter:queued`,
        nodeId: targetNodeId,
        version: 1,
        stage: 'source',
        status: 'queued',
        index: 0,
        progress: 0,
        metadata: { message: 'canonical queued task' },
      },
      {
        taskId: `${targetNodeId}:filter:completed`,
        nodeId: targetNodeId,
        version: 2,
        stage: 'source',
        status: 'completed',
        index: 1,
        progress: 100,
        metadata: { message: 'canonical completed task' },
      },
      {
        taskId: `${targetNodeId}:filter:failed`,
        nodeId: targetNodeId,
        version: 3,
        stage: 'source',
        status: 'failed',
        index: 2,
        progress: 100,
        errorMessage: 'canonical filter failure',
      },
      {
        taskId: `${targetNodeId}:filter:skipped`,
        nodeId: targetNodeId,
        version: 4,
        stage: 'source',
        status: 'completed',
        index: 3,
        progress: 100,
        display: { kind: 'skip', key: 'canonical-filter-skip' },
        metadata: { message: 'canonical skipped task' },
      },
    ]);
  }, nodeId);
};

export const seedQueuedSession = async (page: Page, nodeId: string): Promise<void> => {
  await page.evaluate(async (targetNodeId) => {
    const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
    const api = ref?.client ?? ref?.getAPI?.();
    if (!api) throw new Error('Canonical Shape E2E worker API is not ready');
    if (!api.getShapeMutationAPI) {
      throw new Error('Canonical Shape E2E mutation API is missing');
    }
    const mutation = await api.getShapeMutationAPI();
    await mutation.deleteBuildTasks(targetNodeId);
    await mutation.deleteBuildSession(targetNodeId);
    const startedAt = Date.now();
    await mutation.upsertBuildSession({
      nodeId: targetNodeId,
      status: 'idle',
      startedAt,
      updatedAt: startedAt,
      progress: {
        total: 1,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
        stage: 'source',
      },
      stages: {},
    });
    await mutation.upsertBuildTasks([
      {
        taskId: `${targetNodeId}:queued-cancel`,
        nodeId: targetNodeId,
        version: 1,
        stage: 'source',
        status: 'queued',
        index: 0,
        progress: 0,
      },
    ]);
  }, nodeId);
};

export const removeShapeNode = async (page: Page, nodeId: string): Promise<void> => {
  let callTimeoutId: ReturnType<typeof setTimeout> | undefined;
  const cleanup = page.evaluate(async (targetNodeId) => {
    let timeoutId: number | undefined;
    const cleanup = async (): Promise<void> => {
      const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
      const api = ref?.client ?? ref?.getAPI?.();
      if (!api) throw new Error('Canonical Shape E2E worker API is not ready');
      if (!api.getShapeMutationAPI || !api.getMutationAPI || !api.getShapeQueryAPI) {
        throw new Error('Canonical Shape E2E cleanup APIs are missing');
      }
      const shapeQuery = await api.getShapeQueryAPI();
      const current = await shapeQuery.getBuildSessionRecord(targetNodeId);
      if (current?.status === 'running') {
        if (!api.pauseBuildSession) {
          throw new Error('Canonical Shape E2E cannot stop an active cleanup target');
        }
        await api.pauseBuildSession('shape', targetNodeId, 'user-pause');
      }
      const [shapeMutation, treeMutation] = await Promise.all([
        api.getShapeMutationAPI(),
        api.getMutationAPI(),
      ]);
      await shapeMutation.clearShapeArtifacts(targetNodeId);
      const removed = await treeMutation.removeNodes([targetNodeId]);
      if (!removed.success) {
        throw new Error(`Canonical Shape E2E node cleanup failed: ${removed.error ?? 'unknown'}`);
      }
    };

    try {
      await Promise.race([
        cleanup(),
        new Promise<never>((_resolve, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(new Error(`Canonical Shape E2E node cleanup timed out: ${targetNodeId}`));
          }, 15_000);
        }),
      ]);
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    }
  }, nodeId);
  try {
    await Promise.race([
      cleanup,
      new Promise<never>((_resolve, reject) => {
        callTimeoutId = setTimeout(() => {
          reject(new Error(`Canonical Shape E2E node cleanup call timed out: ${nodeId}`));
        }, 15_000);
      }),
    ]);
  } finally {
    if (callTimeoutId !== undefined) clearTimeout(callTimeoutId);
  }
};

export const waitForOutcomeDialogClose = async (page: Page): Promise<void> => {
  const title = page
    .getByRole('heading', {
      name: /Build completed|Build failed|ビルド.*(完了|失敗)/i,
    })
    .first();
  if (!(await title.isVisible({ timeout: 2_000 }).catch(() => false))) return;
  const dialog = title.locator('xpath=ancestor::*[@role="dialog"][1]');
  await dialog.getByRole('button', { name: /Close|閉じる/i }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
};
