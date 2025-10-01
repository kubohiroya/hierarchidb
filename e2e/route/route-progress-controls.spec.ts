import '../utils/skip-if-disabled';
import { test, expect } from '@playwright/test';
import {
  dismissGuidedTour,
  waitForTreeTableLoad,
  waitForRouteProgress,
  setupConsoleErrorTracking,
  clearTestData,
} from '../utils/test-helpers';

type Scenario = {
  name: string;
  flagValue: '0' | '1';
};

const CSV_URL = 'https://example.com/e2e-route.csv';
const OSRM_BASE_URL = 'https://route-osrm.test';

const SCENARIOS: Scenario[] = [
  { name: 'controls enabled', flagValue: '1' },
  { name: 'controls disabled', flagValue: '0' },
];

test.describe('Route progress controls', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
  });

  for (const scenario of SCENARIOS) {
    test(`pause / resume behavior when controls ${scenario.flagValue === '1' ? 'enabled' : 'disabled'}`, async ({ page }) => {
      await page.route(CSV_URL, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/csv',
          body: 'lon1,lat1,lon2,lat2\n139.751,35.685,139.780,35.690\n',
        });
      });

      await page.route('**://route-osrm.test/route/v1/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'Ok',
            routes: [
              {
                distance: 3245.67,
                duration: 812.4,
                geometry: {
                  coordinates: [
                    [139.751, 35.685],
                    [139.780, 35.690],
                  ],
                },
              },
            ],
          }),
        });
      });

      await page.addInitScript(({ flagValue }) => {
        try {
          localStorage.setItem('ROUTE_PROGRESS_CONTROLS', flagValue);
          localStorage.setItem('ROUTE_BATCH_ENABLED', '1');
        } catch (error) {
          console.warn('[e2e] failed to seed route flags', error);
        }
      }, { flagValue: scenario.flagValue });

      await page.goto('http://localhost:4202/hierarchidb/t/r', { waitUntil: 'networkidle' });
      await dismissGuidedTour(page);
      await waitForTreeTableLoad(page);

      const routeNode = await page.evaluate(async () => {
        const mod = await import('/src/WorkerAPIClient.js');
        const { WorkerAPIClient } = mod;
        const client = await WorkerAPIClient.getOrInit();
        const queryAPI = await client.getQueryAPI();
        const trees = await queryAPI.listTrees();
        const tree = trees.find((t) => t.id === ('r' as any)) ?? trees[0];
        if (!tree) throw new Error('No tree available');
        const rootId = tree.rootId;

        const pickExisting = async () => {
          const existing = await queryAPI.listDescendants(rootId, 4);
          return existing.find((node) => node.nodeType === 'route' && !node.isRemoved && !node.isDraft);
        };

        let routeNode = await pickExisting();

        if (!routeNode) {
          const mutationAPI = await client.getMutationAPI();
          const workingCopyAPI = await client.getWorkingCopyAPI();
          const name = `Route Progress ${Date.now()}`;
          const createResult = await mutationAPI.createNode({
            nodeType: 'route',
            treeId: tree.id,
            parentId: rootId,
            name,
          });
          if (!createResult.success) {
            throw new Error(`Failed to create route node: ${createResult.error ?? 'unknown error'}`);
          }

          const wcNodeId = createResult.nodeId;
          const now = Date.now();
          const start = { coordinates: [139.751, 35.685] as [number, number], name: 'Start', type: 'custom' as const };
          const end = { coordinates: [139.780, 35.690] as [number, number], name: 'End', type: 'custom' as const };

          await workingCopyAPI.updateWorkingCopy(wcNodeId, {
            name,
            description: 'E2E route progress seed',
            category: { primary: 'road' },
            routeType: 'road',
            routeTypes: ['road'],
            transportModes: ['car'],
            startPoint: start,
            endPoint: end,
            generationMethod: 'direct',
            lineGeometry: [start.coordinates, end.coordinates],
            distance: 3245.67,
            duration: 812.4,
            processingStatus: 'completed',
            dataSourceName: 'custom',
            processingConfig: {
              concurrentRequests: 1,
              enableRouteOptimization: false,
              enableElevationData: false,
              enableTrafficData: false,
            },
            createdAt: now,
            updatedAt: now,
            version: 1,
          } as any);

          const commitResult = await workingCopyAPI.commitWorkingCopy(wcNodeId, { onNameConflict: 'auto-rename' });
          if (commitResult.status !== 'ok') {
            throw new Error(`Route commit failed: ${commitResult.status}`);
          }

          routeNode = await queryAPI.getNode(commitResult.nodeId);
        }

        if (!routeNode) throw new Error('Route node unavailable after creation');

        return {
          treeId: tree.id,
          pageNodeId: routeNode.parentId ?? rootId,
          nodeId: routeNode.id,
        };
      });

      await page.goto(
        `http://localhost:4202/hierarchidb/t/${routeNode.treeId}/${routeNode.pageNodeId}/${routeNode.nodeId}/route`,
        { waitUntil: 'networkidle' },
      );

      await expect(page.getByRole('button', { name: /^Launch$/i })).toBeVisible();

      await page.getByLabel(/CSV URL/i).fill(CSV_URL);
      await page.getByLabel(/OSRM base URL/i).fill(OSRM_BASE_URL);
      await page.getByRole('button', { name: /^Launch$/i }).click();

      const progress = await waitForRouteProgress(page);

      await expect(progress.percentage).toBeVisible();
      await expect(progress.stage).toBeVisible();
      await expect(progress.failedCount).toBeVisible();
      await expect(progress.lastError).toBeVisible();

      if (scenario.flagValue === '1') {
        await expect(progress.toggleButton).toBeVisible();
        await expect(progress.toggleButton).toBeEnabled();
        await expect(progress.card).toHaveAttribute('data-progress-state', /running|completed/, { timeout: 5000 });

        await progress.toggleButton.click();
        await expect(progress.card).toHaveAttribute('data-progress-state', 'paused', { timeout: 5000 });
        await expect(progress.toggleButton).toHaveAttribute('aria-pressed', 'true');

        await progress.toggleButton.click();
        await expect(progress.card).toHaveAttribute('data-progress-state', /running|completed/, { timeout: 5000 });
        await expect(progress.toggleButton).toHaveAttribute('aria-pressed', 'false');
      } else {
        await expect(progress.toggleButton).toHaveCount(0);
        await expect(page.getByTestId('route-progress-controls-disabled')).toBeVisible();
      }
    });
  }
});
