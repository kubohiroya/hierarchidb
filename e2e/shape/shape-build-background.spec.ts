import '../utils/skip-if-disabled';
import { test, expect } from '@playwright/test';
import {
  dismissGuidedTour,
  waitForTreeTableLoad,
  setupConsoleErrorTracking,
  clearTestData,
  buildAppUrl,
} from '../utils/test-helpers';

test.describe('Shape build background (real pipeline)', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
  });

  test('continues build after leaving step and persists tiles', async ({ page }) => {
    test.setTimeout(120000);

    const geoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            shapeName: 'Japan',
            shapeISO: 'JPN',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [139.75, 35.68],
                [139.80, 35.68],
                [139.80, 35.72],
                [139.75, 35.72],
                [139.75, 35.68],
              ],
            ],
          },
        },
      ],
    };

    const metadataUrlPattern = '**/geoboundaries.org/api/current/gbOpen/ALL/ALL/**';
    const boundaryMetadataUrlPattern = '**/geoboundaries.org/api/current/gbOpen/JPN/ADM0/**';
    const geoJsonUrl = 'https://geoboundaries.test/JPN_ADM0.json';

    await page.route(metadataUrlPattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            boundaryISO: 'JPN',
            boundaryName: 'Japan',
            boundaryType: 'ADM0',
            Continent: 'Asia',
          },
        ]),
      });
    });

    await page.route(boundaryMetadataUrlPattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          simplifiedGeometryGeoJSON: geoJsonUrl,
          boundaryYear: 2023,
          licenseDetail: 'Test License',
        }),
      });
    });

    await page.route('**/geoboundaries.test/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(geoJson),
      });
    });

    await page.goto(buildAppUrl('t/r'), { waitUntil: 'networkidle' });
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
    await page.waitForFunction(() => Boolean((window as any).__HDB_WORKER_CLIENT_REF__?.client), null, { timeout: 15000 });

    await page.evaluate(async () => {
      const ref = (window as any).__HDB_WORKER_CLIENT_REF__;
      const api = ref?.client ?? ref?.getAPI?.();
      if (api?.setAuthToken) {
        await api.setAuthToken('e2e-test-token', 'Bearer');
      }
    });

    const buildConfig = {
      dataSourceName: 'geoboundaries',
      fetchConfig: {
        maxConcurrent: 1,
        deleteOnComplete: false,
        timeoutMs: 300000,
        retryAttempts: 3,
        retryDelay: 1000,
        retryLimit: 3,
        retryBackoff: 'linear',
      },
      transformConfig: {
        zoomBandBoundaries: [2, 3, 6],
        maxConcurrent: 1,
        enableFeatureFiltering: true,
        featureAreaThreshold: 1.0,
        minVertexCountForAreaFilter: 10,
        aspectRatioThreshold: 5,
        featureFilterMethod: 'hybrid',
        hybridFilterConfig: {
          quickRejectThreshold: 0.002,
          regularShapeMinRatio: 0.5,
          regularShapeMaxRatio: 2.0,
          simpleShapeVertexThreshold: 10,
          elongatedShapeCorrectionFactor: 1.3,
        },
        deleteOnComplete: false,
        tolerance: 0.2,
        areaThreshold: 1.0,
        excludePolygonAreaCoefficient: 1,
        omitDetailsConfig: {
          level: 'strong',
        },
        areaBasedTolerance: {
          thresholdAreaPx2: 4096 * 4096,
          largeAreaTolerance: 0.1,
        },
        minRingVertices: 4,
        boundaryDisableAtZoomOrAbove: 3,
      },
      vtConfig: {
        enableTopojsonSimplify: true,
        maxConcurrent: 1,
        dynamicConcurrency: {
          enabled: true,
          minConcurrent: 1,
          highWatermark: 0.85,
          lowWatermark: 0.6,
          adjustStep: 1,
          sampleMs: 2000,
        },
        tolerance: 0,
        extent: 4096,
        bufferSize: 256,
        boundaryDedupe: true,
        indexMaxPoints: 0,
        layerSetName: 'shape',
        promoteId: 'id',
        tileSize: 256,
        inputFormat: 'geojson',
        inputCompression: 'none',
        tileExpandFactor: 1,
        tileExpandMargin: 0,
        format: 'mvt',
        compression: 'gzip',
      },
      cleanupConfig: {
        deleteFetchApiCache: false,
        deleteFetchFilteredCache: false,
        deleteTransformCache: false,
        deleteVTCache: false,
      },
    };
    const selectedArrayByCountries = { JP: [true] };

    const shapeNode = await page.evaluate(async ({ buildConfig, selectedArrayByCountries, nodeType }) => {
      const client = (window as any).__HDB_WORKER_CLIENT_REF__?.client;
      if (!client) {
        throw new Error('Worker client not ready');
      }
      const queryAPI = await client.getQueryAPI();
      const mutationAPI = await client.getMutationAPI();
      const updaterAPI = await client.getTreeNodeUpdaterAPI();

      const trees = await queryAPI.listTrees();
      const tree = trees.find((t) => t.id === ('r' as any)) ?? trees[0];
      if (!tree) throw new Error('No console available');
      const rootId = tree.rootId;

      const name = `Shape Build ${Date.now()}`;
      const createResult = await mutationAPI.createNode({
        nodeType,
        treeId: tree.id,
        parentId: rootId,
        name,
      });
      if (!createResult.success) {
        throw new Error(`Failed to create shape node: ${createResult ?? 'unknown error'}`);
      }

      const nodeId = createResult.nodeId;
      const now = Date.now();
      const draftPayload = {
        name,
        description: 'E2E shape build background test',
        buildConfig,
        selectedArrayByCountries,
        processingStatus: 'idle',
        licenseAgreement: true,
        licenseAgreedAt: new Date(now).toISOString(),
      };

      await updaterAPI.updateTreeNode(nodeId, {
        mode: 'save-draft',
        data: draftPayload,
        draftData: draftPayload,
      });

      return {
        treeId: tree.id,
        pageNodeId: rootId,
        nodeId,
        name,
      };
    }, { buildConfig, selectedArrayByCountries, nodeType: 'shape' });

    const nodeLink = page.getByRole('link', { name: new RegExp(shapeNode.name) });
    await expect(nodeLink).toBeVisible({ timeout: 10000 });
    await nodeLink.click();

    const launchBuildButton = page.getByRole('button', { name: /ビルドを開始|ビルド開始|Build/i });
    await expect(launchBuildButton).toBeVisible({ timeout: 10000 });
    await launchBuildButton.click();

    const summaryCard = page.locator('[data-testid="shape-plugin-batch-progress-summary"]');

    await page.evaluate(async ({ nodeId, selectedArrayByCountries, dataSourceName }) => {
      const ref = (window as any).__HDB_WORKER_CLIENT_REF__;
      const api = ref?.client ?? ref?.getAPI?.();
      if (!api) {
        throw new Error('Worker client not ready');
      }
      const payloads = await api.generateShapeDownloadTaskPayloadsFromSelection(
        nodeId,
        dataSourceName,
        selectedArrayByCountries,
      );
      await api.startBatchSession('shape', nodeId, payloads, 'finish_all_stages');
    }, {
      nodeId: shapeNode.nodeId,
      selectedArrayByCountries,
      dataSourceName: buildConfig.dataSourceName,
    });

    await page.goto(buildAppUrl(`t/${shapeNode.treeId}/${shapeNode.pageNodeId}`), { waitUntil: 'networkidle' });
    await waitForTreeTableLoad(page);

    const waitForCompletion = async () => {
      const deadline = Date.now() + 90000;
      while (Date.now() < deadline) {
        const status = await page.evaluate(async (nodeId) => {
          const global = window as { __shapeWorkerClient?: unknown };
          if (!global.__shapeWorkerClient) {
            const ref = (window as any).__HDB_WORKER_CLIENT_REF__?.client;
            if (!ref) {
              return { status: null, tiles: 0 };
            }
            global.__shapeWorkerClient = ref;
          }
          const client = global.__shapeWorkerClient as any;
          const queryAPI = await client.getShapeQueryAPI();
          const session = await queryAPI.getBuildSessionRecord(nodeId);
          const summary = await queryAPI.getVectorTileSummary(nodeId);
          return {
            status: session?.status ?? null,
            tiles: summary?.tiles ?? 0,
          };
        }, shapeNode.nodeId);

        if (status.status === 'completed' && status.tiles > 0) return;
        await page.waitForTimeout(1000);
      }
      throw new Error('Timed out waiting for shape build completion');
    };

    await waitForCompletion();

    await page.goto(buildAppUrl(`t/${shapeNode.treeId}/${shapeNode.pageNodeId}`), { waitUntil: 'networkidle' });
    await waitForTreeTableLoad(page);
    const nodeLinkAfter = page.getByRole('link', { name: new RegExp(shapeNode.name) });
    await expect(nodeLinkAfter).toBeVisible({ timeout: 10000 });
    await nodeLinkAfter.click();
    const launchBuildButtonAfter = page.getByRole('button', { name: /ビルドを開始|ビルド開始|Build/i });
    await expect(launchBuildButtonAfter).toBeVisible({ timeout: 10000 });
    await launchBuildButtonAfter.click();
    await expect(summaryCard).toBeVisible({ timeout: 20000 });

    const completion = await page.evaluate(async (nodeId) => {
      const global = window as unknown as { __shapeWorkerClient?: unknown };
      if (!global.__shapeWorkerClient) {
        const ref = (window as any).__HDB_WORKER_CLIENT_REF__?.client;
        if (!ref) {
          return { status: null, tiles: 0 };
        }
        global.__shapeWorkerClient = ref;
      }
      const client = global.__shapeWorkerClient as any;
      const queryAPI = await client.getShapeQueryAPI();
      const session = await queryAPI.getBuildSessionRecord(nodeId);
      const summary = await queryAPI.getVectorTileSummary(nodeId);
      return {
        status: session?.status ?? null,
        tiles: summary?.tiles ?? 0,
      };
    }, shapeNode.nodeId);

    expect(completion.status).toBe('completed');
    expect(completion.tiles).toBeGreaterThan(0);
  });
});
