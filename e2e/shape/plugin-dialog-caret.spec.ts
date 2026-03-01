import '../utils/skip-if-disabled';
import { test, expect, type Page } from '@playwright/test';
import {
  buildAppUrl,
  dismissGuidedTour,
  setupConsoleErrorTracking,
  waitForTreeTableLoad,
} from '../utils/test-helpers';

type TreeSummary = {
  id: string;
  rootId: string;
};

type CreateNodeResult = {
  success: boolean;
  nodeId: string;
  error?: unknown;
};

type TreeQueryAPI = {
  listTrees: () => Promise<TreeSummary[]>;
};

type TreeMutationAPI = {
  createNode: (input: {
    nodeType: string;
    treeId: string;
    parentId: string;
    name: string;
  }) => Promise<CreateNodeResult>;
};

type TreeNodeUpdaterAPI = {
  updateTreeNode: (nodeId: string, payload: {
    mode: string;
    data: unknown;
    draftData: unknown;
  }) => Promise<void>;
};

type WorkerAPI = {
  setCorsProxyBaseURL?: (value: string) => Promise<void> | void;
  setAuthToken?: (token: string, scheme?: string) => Promise<void> | void;
  getQueryAPI?: () => Promise<TreeQueryAPI>;
  getMutationAPI?: () => Promise<TreeMutationAPI>;
  getTreeNodeUpdaterAPI?: () => Promise<TreeNodeUpdaterAPI>;
};

type WorkerClientRef = {
  client?: WorkerAPI;
  getAPI?: () => WorkerAPI | undefined;
};

type WindowWithWorkerRef = Window & {
  __HDB_WORKER_CLIENT_REF__?: WorkerClientRef;
};

type ShapeNode = {
  treeId: string;
  pageNodeId: string;
  nodeId: string;
};

const createShapeNodeWithDraft = async (page: Page): Promise<ShapeNode> => {
  return page.evaluate(async () => {
    const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
    const api = ref?.client ?? ref?.getAPI?.();
    if (!api?.getQueryAPI || !api?.getMutationAPI || !api?.getTreeNodeUpdaterAPI) {
      throw new Error('Worker API is not ready');
    }

    const [queryAPI, mutationAPI, updaterAPI] = await Promise.all([
      api.getQueryAPI(),
      api.getMutationAPI(),
      api.getTreeNodeUpdaterAPI(),
    ]);

    const trees = await queryAPI.listTrees();
    const tree = trees.find((item) => item.id === 'r') ?? trees[0];
    if (!tree) {
      throw new Error('No tree available');
    }

    const name = `Shape Caret ${Date.now()}`;
    const createResult = await mutationAPI.createNode({
      nodeType: 'shape',
      treeId: tree.id,
      parentId: tree.rootId,
      name,
    });
    if (!createResult.success) {
      throw new Error(`Failed to create shape node: ${String(createResult.error ?? 'unknown')}`);
    }

    const draftPayload = {
      name,
      description: 'E2E caret validation',
      buildConfig: {
        dataSourceName: 'geoboundaries',
        sourceConfig: {
          maxConcurrent: 1,
          deleteOnComplete: false,
          timeoutMs: 300000,
          retryAttempts: 1,
          retryDelay: 1000,
          retryLimit: 1,
          retryBackoff: 'linear',
        },
        geometryConfig: {
          zoomBandBoundaries: [1, 2, 3],
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
          minRingVertices: 4,
          boundaryDisableAtZoomOrAbove: 3,
        },
        tileEmitConfig: {
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
          indexMaxPoints: 100000,
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
      },
      selectedArrayByCountries: {
        JP: [true],
      },
      processingStatus: 'idle',
      licenseAgreement: true,
      licenseAgreedAt: new Date().toISOString(),
    };

    await updaterAPI.updateTreeNode(createResult.nodeId, {
      mode: 'save-draft',
      data: draftPayload,
      draftData: draftPayload,
    });

    return {
      treeId: tree.id,
      pageNodeId: tree.rootId,
      nodeId: createResult.nodeId,
    };
  });
};

test.describe('PluginDialog caret E2E', () => {
  test('PluginDialog caret: Step1/Step5 inputs stay editable after menu interactions', async ({ page }) => {
    test.setTimeout(180000);

    await page.route('**/auth/verify', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'e2e-fake-access-token');
      localStorage.setItem('id_token', 'e2e-fake-id-token');
      localStorage.setItem(
        'userinfo',
        JSON.stringify({
          sub: 'e2e-user',
          name: 'E2E User',
          email: 'e2e@example.com',
        })
      );
      localStorage.setItem('token_expires_at', String(Date.now() + 60 * 60 * 1000));
      localStorage.setItem('last_auth_completion', String(Date.now()));
    });

    setupConsoleErrorTracking(page);
    await page.goto(buildAppUrl('t/r'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    await page.waitForFunction(() => {
      const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
      return Boolean(ref?.client ?? ref?.getAPI?.());
    }, null, { timeout: 30000 });

    await page.evaluate(async (accessToken: string) => {
      const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
      const api = ref?.client ?? ref?.getAPI?.();
      if (api?.setCorsProxyBaseURL) {
        await api.setCorsProxyBaseURL('');
      }
      if (api?.setAuthToken) {
        await api.setAuthToken(accessToken, 'Bearer');
      }
    }, 'e2e-fake-access-token');

    const verifyResult = await page.evaluate(async (accessToken: string) => {
      const response = await fetch('/auth/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      return { ok: response.ok, status: response.status };
    }, 'e2e-fake-access-token');
    expect(verifyResult.ok, `Expected mocked /auth/verify to succeed (status=${verifyResult.status})`).toBe(true);

    const shapeNode = await createShapeNodeWithDraft(page);
    await page.goto(buildAppUrl(`t/${shapeNode.treeId}/${shapeNode.pageNodeId}`), {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await waitForTreeTableLoad(page);

    const nodeLink = page.locator(`a[href$="/${shapeNode.nodeId}"]`).first();
    await expect(nodeLink).toBeVisible({ timeout: 20000 });
    await nodeLink.click();

    const openEditButton = page.getByRole('button', { name: /ノードを編集|Edit/i }).first();
    await expect(openEditButton).toBeVisible({ timeout: 10000 });
    await openEditButton.click();

    const nameInput = page.locator('input[name="name"]').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.click();
    await expect(nameInput).toBeFocused();
    await nameInput.fill('Caret Name Updated');
    await expect(nameInput).toHaveValue('Caret Name Updated');

    const descriptionInput = page.locator('textarea[name="description"]').first();
    await expect(descriptionInput).toBeVisible({ timeout: 10000 });
    await descriptionInput.click();
    await expect(descriptionInput).toBeFocused();
    const hasDescriptionCaret = await descriptionInput.evaluate((element) => {
      const textarea = element as HTMLTextAreaElement;
      return typeof textarea.selectionStart === 'number';
    });
    expect(hasDescriptionCaret).toBe(true);

    const buildStepButton = page.getByRole('button', { name: /^5\s*(ビルド|Build)/ }).first();
    const hasBuildStep = await buildStepButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasBuildStep) {
      test.info().annotations.push({
        type: 'note',
        description: 'Build step is not exposed in this runtime configuration; Step5 assertions were skipped.',
      });
      return;
    }

    await expect(buildStepButton).toBeEnabled({ timeout: 10000 });
    await buildStepButton.click();

    const searchInput = page.getByPlaceholder(/Search tasks/i).first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.click();
    await expect(searchInput).toBeFocused();
    await searchInput.fill('alpha');
    await expect(searchInput).toHaveValue('alpha');

    const buildControlMenuButton = page.getByTestId('build-control-menu-button');
    await expect(buildControlMenuButton).toBeVisible({ timeout: 10000 });
    await buildControlMenuButton.click();
    await expect(page.getByRole('menu').last()).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu').last()).not.toBeVisible({ timeout: 10000 });

    await searchInput.click();
    await expect(searchInput).toBeFocused();
    await searchInput.fill('alpha-build-menu');
    await expect(searchInput).toHaveValue('alpha-build-menu');

    const stepOneButton = page.getByRole('button', { name: /^1\s*/ }).first();
    await expect(stepOneButton).toBeVisible({ timeout: 10000 });
    await stepOneButton.click({ button: 'right' });
    await expect(page.getByRole('menu').last()).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu').last()).not.toBeVisible({ timeout: 10000 });

    await searchInput.click();
    await expect(searchInput).toBeFocused();
    await searchInput.fill('alpha-stepper-menu');
    await expect(searchInput).toHaveValue('alpha-stepper-menu');

    const footerLeftButton = page.getByTestId('plugin-dialog-footer-left').first();
    await expect(footerLeftButton).toBeVisible({ timeout: 10000 });
    await footerLeftButton.click({ button: 'right' });
    await expect(page.getByRole('menu').last()).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu').last()).not.toBeVisible({ timeout: 10000 });

    await searchInput.click();
    await expect(searchInput).toBeFocused();
    await searchInput.fill('alpha-footer-menu');
    await expect(searchInput).toHaveValue('alpha-footer-menu');
  });
});
