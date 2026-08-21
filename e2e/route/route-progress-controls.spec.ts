import '../utils/skip-if-disabled';
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
  getNode: (nodeId: string) => Promise<{ draftData?: { processingStatus?: string } } | null>;
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
  updateTreeNode: (nodeId: string, payload: { mode: string; data: unknown; draftData: unknown }) => Promise<void>;
};

type WorkerApi = {
  getQueryAPI?: () => Promise<WorkerQueryAPI>;
  getMutationAPI?: () => Promise<WorkerMutationAPI>;
  getTreeNodeUpdaterAPI?: () => Promise<WorkerUpdaterAPI>;
};

type WorkerClientRef = {
  isInitialized?: boolean;
  initialize?: () => Promise<void> | void;
  client?: WorkerApi;
  getAPI?: () => WorkerApi | undefined;
};

type WindowWithWorkerRef = Window & {
  __HDB_WORKER_CLIENT_REF__?: WorkerClientRef;
};

test.describe('Route build controls', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
  });

  test('build start button triggers route build lifecycle in UI', async ({
    page,
    canonicalAuth,
  }) => {
    test.setTimeout(120000);
    await canonicalAuth.signIn();

    await page.goto(buildAppUrl('t/r'), { waitUntil: 'networkidle' });
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
    await page.waitForFunction(() => Boolean((window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__?.client), null, {
      timeout: 20000,
    });
    const routeNode = await page.evaluate(async (): Promise<WorkerNode> => {
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
      const name = `Route Build E2E ${Date.now()}`;
      const createResult = await mutationAPI.createNode({
        nodeType: 'route',
        treeId: tree.id,
        parentId: tree.rootId,
        name,
      });
      if (!createResult.success) {
        throw new Error('Failed to create route node');
      }
      const draftPayload = {
        name,
        description: 'Route build control E2E seed',
        dataSourceName: 'ide-gsm',
        tabularSourceId: `missing-tabular-${Date.now()}`,
        selectedArrayByCountries: {
          JP: [true, true, false, false, false],
        },
        transportMode: 'air',
        transportSelection: 'air',
        generationMethod: 'direct',
        startLocationId: 'loc:start',
        endLocationId: 'loc:end',
        processingStatus: 'idle',
      };
      await updaterAPI.updateTreeNode(createResult.nodeId, {
        mode: 'save-draft',
        data: draftPayload,
        draftData: draftPayload,
      });
      return {
        id: createResult.nodeId,
        treeId: tree.id,
        parentId: tree.rootId,
        pageNodeId: tree.rootId,
      };
    });

    await expect
      .poll(async () => {
        return await page.evaluate(async (nodeId: string) => {
          const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
          const client = ref?.client ?? ref?.getAPI?.();
          if (!client?.getQueryAPI) return false;
          const queryAPI = await client.getQueryAPI();
          const node = await queryAPI.getNode(nodeId);
          return Boolean(node?.id);
        }, routeNode.id);
      }, {
        timeout: 15000,
        intervals: [200, 500, 1000],
      })
      .toBe(true);

    const pageNodeId = routeNode.pageNodeId ?? routeNode.parentId ?? `${routeNode.treeId}:root`;
    await page.goto(buildAppUrl(`t/${routeNode.treeId}/${pageNodeId}`), { waitUntil: 'networkidle' });
    await waitForTreeTableLoad(page);

    const routeNodeLink = page.locator(`a[href$="/${routeNode.id}"]`).first();
    await expect(routeNodeLink).toBeVisible({ timeout: 20000 });
    await routeNodeLink.click();
    await expect(page).toHaveURL(new RegExp(`/d/${routeNode.treeId}/${routeNode.id}$`), { timeout: 20000 });

    const openEditButton = page.getByRole('button', { name: /編集/ }).first();
    await expect(openEditButton).toBeVisible({ timeout: 10000 });
    await expect(openEditButton).toBeEnabled();
    await openEditButton.click();
    await expect(page).toHaveURL(new RegExp(`/${routeNode.id}/route/edit/normal/\\d+`), { timeout: 20000 });

    const currentUrl = new URL(page.url());
    const normalizedPath = currentUrl.pathname.replace(/\/+$/, '');
    const buildStepPath = normalizedPath.replace(/\/edit\/normal\/\d+$/, '/edit/normal/4');
    const buildStepUrl = `${buildStepPath}${currentUrl.search}`;
    if (buildStepUrl !== `${normalizedPath}${currentUrl.search}`) {
      await page.goto(buildStepUrl, { waitUntil: 'networkidle' });
    }
    await expect(page).toHaveURL(new RegExp(`/${routeNode.id}/route/edit/normal/4`), { timeout: 20000 });

    const startButton = page.getByTestId('build-control-start-resume-button');
    let startVisible = await startButton.isVisible().catch(() => false);
    for (let i = 0; i < 2 && !startVisible; i += 1) {
      const nextButton = page.getByRole('button', { name: /次へ/ }).last();
      await expect(nextButton).toBeVisible({ timeout: 5000 });
      await expect(nextButton).toBeEnabled();
      await nextButton.click();
      startVisible = await startButton.isVisible().catch(() => false);
    }
    await expect(startButton).toBeVisible({ timeout: 15000 });
    await expect(startButton).toBeEnabled();

    await startButton.click();

    await expect(
      page.getByText('No related location nodes found.').first(),
    ).toBeVisible({ timeout: 20000 });
  });
});
