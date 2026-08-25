import '../utils/skip-if-disabled';
import type { Page } from '@playwright/test';
import { CANONICAL_E2E_ACCESS_TOKEN, expect, test } from '../fixtures/canonicalAuthFixture';
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
  updateTreeNode: (
    nodeId: string,
    payload: {
      mode: string;
      data: unknown;
      draftData: unknown;
    }
  ) => Promise<void>;
};

type WorkerAPI = {
  setCorsProxyBaseURL?: (value: string) => Promise<void> | void;
  getQueryAPI?: () => Promise<TreeQueryAPI>;
  getMutationAPI?: () => Promise<TreeMutationAPI>;
  getTreeNodeUpdaterAPI?: () => Promise<TreeNodeUpdaterAPI>;
  generateShapeDownloadTaskPayloadsFromSelection?: (
    nodeId: string,
    dataSourceName: string,
    selectedArrayByCountries: Record<string, boolean[]>
  ) => Promise<unknown[]>;
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

type IsoCountryFixture = {
  iso2Codes: string[];
  geoBoundariesMetadata: Array<{
    boundaryISO: string;
    boundaryType: 'ADM0';
    boundaryName: string;
  }>;
};

const GEOBOUNDARIES_ALL_METADATA_URL = 'https://geoboundaries.org/api/current/gbOpen/ALL/ALL/';
const E2E_CORS_PROXY_URL_PATTERN =
  /^https:\/\/hierarchidb-cors-proxy\.kubohiroya\.workers\.dev(?:\/|\?)/u;

const loadIsoCountryFixture = async (page: Page): Promise<IsoCountryFixture> =>
  page.evaluate(async () => {
    const response = await fetch(new URL('iso3166-country-names.i18n.json', document.baseURI));
    if (!response.ok) {
      throw new Error(`Failed to load ISO country names: ${response.status}`);
    }
    const names = (await response.json()) as { en?: Record<string, string> };
    if (!names.en) throw new Error('English ISO country names are missing');
    const entries = Object.entries(names.en);
    const iso2Codes = entries
      .map(([code]) => code)
      .filter((code) => code.length === 2)
      .slice(0, 200);
    const geoBoundariesMetadata = entries
      .filter(([code]) => code.length === 3)
      .map(([boundaryISO, boundaryName]) => ({
        boundaryISO,
        boundaryType: 'ADM0' as const,
        boundaryName,
      }));
    if (iso2Codes.length !== 200 || geoBoundariesMetadata.length < 200) {
      throw new Error(
        `Expected at least 200 ISO2 and ISO3 countries, received ${iso2Codes.length} and ${geoBoundariesMetadata.length}`
      );
    }
    return { iso2Codes, geoBoundariesMetadata };
  });

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
          deleteGeometryCache: false,
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
  test('Shape Step 3 loads countries and a 200-entry selection produces source tasks', async ({
    page,
    canonicalAuth,
  }) => {
    test.setTimeout(180000);

    setupConsoleErrorTracking(page);
    await canonicalAuth.signIn();
    await page.goto(buildAppUrl('f/r'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    const isoCountryFixture = await loadIsoCountryFixture(page);
    let metadataRequestCount = 0;
    await page.route(E2E_CORS_PROXY_URL_PATTERN, async (route) => {
      const proxyUrl = new URL(route.request().url());
      if (proxyUrl.searchParams.get('url') !== GEOBOUNDARIES_ALL_METADATA_URL) {
        await route.continue();
        return;
      }
      if (route.request().headers().authorization !== `Bearer ${CANONICAL_E2E_ACCESS_TOKEN}`) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'invalid_e2e_worker_authorization' }),
        });
        return;
      }
      metadataRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isoCountryFixture.geoBoundariesMetadata),
      });
    });

    await page.waitForFunction(
      () => {
        const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
        return Boolean(ref?.client ?? ref?.getAPI?.());
      },
      null,
      { timeout: 30000 }
    );

    const shapeNode = await createShapeNodeWithDraft(page);
    await page.goto(buildAppUrl(`f/${shapeNode.treeId}/${shapeNode.pageNodeId}`), {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await waitForTreeTableLoad(page);

    const nodeLink = page.locator(`a[href$="/${shapeNode.nodeId}/-/folder/list"]`).first();
    await expect(nodeLink).toBeVisible({ timeout: 20000 });
    await nodeLink.click();

    const openEditButton = page.getByRole('button', { name: /ノードを編集|Edit/i }).first();
    await expect(openEditButton).toBeVisible({ timeout: 10000 });
    await openEditButton.click();

    const countryStepButton = page.getByRole('button', { name: /^3\s*/ }).first();
    await expect(countryStepButton).toBeVisible({ timeout: 10000 });
    await expect(countryStepButton).toBeEnabled({ timeout: 10000 });
    await countryStepButton.click();

    await expect(
      page.getByRole('heading', {
        name: /Select Countries & Administrative Levels|国・行政レベルの選択/i,
      })
    ).toBeVisible({ timeout: 60000 });
    await expect(page.getByPlaceholder('Search by country or code...')).toBeVisible({
      timeout: 10000,
    });
    expect(metadataRequestCount).toBeGreaterThanOrEqual(1);

    const sourceTaskResult = await page.evaluate(
      async ({ nodeId, countryCodes }) => {
        const selectedArrayByCountries = Object.fromEntries(
          countryCodes.map((code) => [code, [true]])
        );
        const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
        const api = ref?.client ?? ref?.getAPI?.();
        if (!api?.generateShapeDownloadTaskPayloadsFromSelection) {
          throw new Error('Shape source task payload API is not ready');
        }
        const payloads = await api.generateShapeDownloadTaskPayloadsFromSelection(
          nodeId,
          'geoboundaries',
          selectedArrayByCountries
        );
        return { selectedCount: countryCodes.length, payloadCount: payloads.length };
      },
      { nodeId: shapeNode.nodeId, countryCodes: isoCountryFixture.iso2Codes }
    );

    expect(sourceTaskResult.selectedCount).toBe(200);
    expect(sourceTaskResult.payloadCount).toBeGreaterThanOrEqual(1);
  });

  test('PluginDialog caret: Step1/Step5 inputs stay editable after menu interactions', async ({
    page,
    canonicalAuth,
  }) => {
    test.skip(
      true,
      'Tracked in #1673: this caret scenario relies on legacy node-link selection semantics; the seeded Shape node remains unselected and the edit action stays disabled.'
    );
    test.setTimeout(180000);

    setupConsoleErrorTracking(page);
    await canonicalAuth.signIn();
    await page.goto(buildAppUrl('f/r'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    await page.waitForFunction(
      () => {
        const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
        return Boolean(ref?.client ?? ref?.getAPI?.());
      },
      null,
      { timeout: 30000 }
    );

    await page.evaluate(async () => {
      const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
      const api = ref?.client ?? ref?.getAPI?.();
      if (api?.setCorsProxyBaseURL) {
        await api.setCorsProxyBaseURL('');
      }
    });

    const shapeNode = await createShapeNodeWithDraft(page);
    await page.goto(buildAppUrl(`f/${shapeNode.treeId}/${shapeNode.pageNodeId}`), {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await waitForTreeTableLoad(page);

    const nodeLink = page.locator(`a[href$="/${shapeNode.nodeId}/-/folder/list"]`).first();
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
        description:
          'Build step is not exposed in this runtime configuration; Step5 assertions were skipped.',
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
