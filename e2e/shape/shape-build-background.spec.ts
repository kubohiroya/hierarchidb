import '../utils/skip-if-disabled';
import { test, expect } from '@playwright/test';
import {
  dismissGuidedTour,
  waitForTreeTableLoad,
  setupConsoleErrorTracking,
  clearTestData,
  buildAppUrl,
} from '../utils/test-helpers';
import { DEFAULT_BUILD_CONFIG } from '../../plugins/shape-plugin/src/common/types/constants.ts';
import { toNodeType } from '../../packages/common/types/dist';

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

    const buildConfig = JSON.parse(JSON.stringify(DEFAULT_BUILD_CONFIG));
    const selectedArrayByCountries = { JP: [true] };

    const shapeNode = await page.evaluate(async ({ buildConfig, selectedArrayByCountries, nodeType }) => {
      const mod = await import('../../app/src/worker-runtime/WorkerAPIClient.js');
      const { WorkerAPIClient } = mod;
      const client = await WorkerAPIClient.getOrInit();
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

      const wcNodeId = createResult.nodeId;
      const now = Date.now();
      await updaterAPI.updateTreeNodeDraftData(wcNodeId, {
        name,
        description: 'E2E shape build background test',
        buildConfig,
        selectedArrayByCountries,
        processingStatus: 'idle',
        licenseAgreement: true,
        licenseAgreedAt: new Date(now).toISOString(),
      });

      const commitResult = await updaterAPI.commitDraft(wcNodeId, { onNameConflict: 'auto-rename' });
      if (commitResult.status !== 'ok') {
        throw new Error(`Shape commit failed: ${commitResult.status}`);
      }

      return {
        treeId: tree.id,
        pageNodeId: rootId,
        nodeId: commitResult.nodeId,
      };
    }, { buildConfig, selectedArrayByCountries, nodeType: toNodeType('shape') });

    const buildStepUrl = buildAppUrl(`t/${shapeNode.treeId}/${shapeNode.pageNodeId}/${shapeNode.nodeId}/shape/edit/edit/4`);
    await page.goto(buildStepUrl, { waitUntil: 'networkidle' });

    const summaryCard = page.locator('[data-testid="shape-plugin-batch-progress-summary"]');
    await expect(summaryCard).toBeVisible({ timeout: 20000 });

    const startButton = page.getByRole('button', { name: /Start Build|ビルド開始|ビルドを開始/i });
    await expect(startButton).toBeEnabled({ timeout: 10000 });
    await startButton.click();

    const warningDialog = page.getByRole('dialog', { name: /Build warning|ビルド警告|警告/i });
    if (await warningDialog.isVisible({ timeout: 2000 })) {
      const proceedButton = warningDialog.getByRole('button', { name: /Proceed|続行|実行/i });
      await proceedButton.click();
    }

    await page.goto(buildAppUrl(`t/${shapeNode.treeId}/${shapeNode.pageNodeId}`), { waitUntil: 'networkidle' });
    await waitForTreeTableLoad(page);

    const waitForCompletion = async () => {
      const deadline = Date.now() + 90000;
      while (Date.now() < deadline) {
        const status = await page.evaluate(async (nodeId) => {
          const global = window as unknown as { __shapeWorkerClient?: unknown };
          if (!global.__shapeWorkerClient) {
            const mod = await import('../../app/src/worker-runtime/WorkerAPIClient.js');
            const { WorkerAPIClient } = mod;
            global.__shapeWorkerClient = await WorkerAPIClient.getOrInit();
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

    await page.goto(buildStepUrl, { waitUntil: 'networkidle' });
    await expect(summaryCard).toBeVisible({ timeout: 20000 });

    const completion = await page.evaluate(async (nodeId) => {
      const global = window as unknown as { __shapeWorkerClient?: unknown };
      if (!global.__shapeWorkerClient) {
        const mod = await import('../../app/src/worker-runtime/WorkerAPIClient.js');
        const { WorkerAPIClient } = mod;
        global.__shapeWorkerClient = await WorkerAPIClient.getOrInit();
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
