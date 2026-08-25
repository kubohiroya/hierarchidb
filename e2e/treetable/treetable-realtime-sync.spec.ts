import { expect, type Page, test } from '@playwright/test';
import {
  buildAppUrl,
  clearTestData,
  dismissGuidedTour,
  setupConsoleErrorTracking,
  waitForSubTreeUpdate,
  waitForTreeTableLoad,
} from '../utils/test-helpers';

type TreeRecord = {
  id: string;
  rootId: string;
};

type MutationResult = {
  success: boolean;
  nodeId?: string;
  error?: string;
};

type TreeQueryAPI = {
  listTrees: () => Promise<TreeRecord[]>;
};

type TreeMutationAPI = {
  createNode: (params: {
    nodeType: string;
    treeId: string;
    parentId: string;
    name: string;
    description?: string;
  }) => Promise<MutationResult>;
  updateNode: (params: {
    nodeId: string;
    name?: string;
    description?: string;
    visible?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  removeNodes: (nodeIds: string[]) => Promise<{ success: boolean; error?: string }>;
};

type WorkerAPI = {
  getQueryAPI?: () => Promise<TreeQueryAPI>;
  getMutationAPI?: () => Promise<TreeMutationAPI>;
};

type WorkerClientRef = {
  client?: WorkerAPI;
  getAPI?: () => WorkerAPI | undefined;
  initialize?: () => Promise<void> | void;
};

type RealtimeSyncWindow = Window & {
  __HDB_WORKER_CLIENT_REF__?: WorkerClientRef;
};

type CreatedFolder = {
  treeId: string;
  rootId: string;
  nodeId: string;
  name: string;
};

const getNodeRow = (page: Page, name: string) =>
  page.locator('[data-testid="console-node"]').filter({ hasText: name }).first();

const createFolderThroughWorker = async (
  page: Page,
  baseName: string,
  parentId?: string
): Promise<CreatedFolder> =>
  page.evaluate(
    async ({ baseName, parentId }) => {
      const ref = (window as RealtimeSyncWindow).__HDB_WORKER_CLIENT_REF__;
      const api = ref?.client ?? ref?.getAPI?.();
      if (!api?.getQueryAPI || !api.getMutationAPI) {
        throw new Error('Worker tree APIs are not available');
      }
      const queryAPI = await api.getQueryAPI();
      const mutationAPI = await api.getMutationAPI();
      const trees = await queryAPI.listTrees();
      const tree = trees.find((candidate) => candidate.id === 'r') ?? trees[0];
      if (!tree) {
        throw new Error('Resources tree is not available');
      }

      const name = `${baseName} ${Date.now()}`;
      const result = await mutationAPI.createNode({
        nodeType: 'folder',
        treeId: tree.id,
        parentId: parentId ?? tree.rootId,
        name,
      });
      if (!result.success || !result.nodeId) {
        throw new Error(`createNode failed: ${result.error ?? 'unknown error'}`);
      }
      return {
        treeId: tree.id,
        rootId: tree.rootId,
        nodeId: result.nodeId,
        name,
      };
    },
    { baseName, parentId }
  );

const updateFolderThroughWorker = async (
  page: Page,
  nodeId: string,
  name: string
): Promise<void> => {
  await page.evaluate(
    async ({ nodeId, name }) => {
      const ref = (window as RealtimeSyncWindow).__HDB_WORKER_CLIENT_REF__;
      const api = ref?.client ?? ref?.getAPI?.();
      if (!api?.getMutationAPI) {
        throw new Error('Worker mutation API is not available');
      }
      const mutationAPI = await api.getMutationAPI();
      const result = await mutationAPI.updateNode({ nodeId, name });
      if (!result.success) {
        throw new Error(`updateNode failed: ${result.error ?? 'unknown error'}`);
      }
    },
    { nodeId, name }
  );
};

const removeFolderThroughWorker = async (page: Page, nodeId: string): Promise<void> => {
  await page.evaluate(async (targetNodeId) => {
    const ref = (window as RealtimeSyncWindow).__HDB_WORKER_CLIENT_REF__;
    const api = ref?.client ?? ref?.getAPI?.();
    if (!api?.getMutationAPI) {
      throw new Error('Worker mutation API is not available');
    }
    const mutationAPI = await api.getMutationAPI();
    const result = await mutationAPI.removeNodes([targetNodeId]);
    if (!result.success) {
      throw new Error(`removeNodes failed: ${result.error ?? 'unknown error'}`);
    }
  }, nodeId);
};

test.describe('TreeTable worker synchronization', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
    await page.goto(buildAppUrl('d/r'), { waitUntil: 'domcontentloaded' });
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
    await page.waitForFunction(
      () => Boolean((window as RealtimeSyncWindow).__HDB_WORKER_CLIENT_REF__?.client),
      null,
      { timeout: 15000 }
    );
  });

  test('worker-created root folder appears in the current TreeTable', async ({ page }) => {
    const folder = await createFolderThroughWorker(page, 'Worker Sync Create');

    await waitForSubTreeUpdate(page, 5000);

    const row = getNodeRow(page, folder.name);
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toHaveAttribute('data-node-id', folder.nodeId);
  });

  test('worker-updated folder name replaces the previous row text', async ({ page }) => {
    const folder = await createFolderThroughWorker(page, 'Worker Sync Rename');
    await expect(getNodeRow(page, folder.name)).toBeVisible({ timeout: 10000 });

    const nextName = `${folder.name} Updated`;
    await updateFolderThroughWorker(page, folder.nodeId, nextName);
    await waitForSubTreeUpdate(page, 5000);

    await expect(getNodeRow(page, nextName)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: folder.name, exact: true })).toHaveCount(0);
  });

  test('worker-removed folder leaves the current TreeTable', async ({ page }) => {
    const folder = await createFolderThroughWorker(page, 'Worker Sync Remove');
    const row = getNodeRow(page, folder.name);
    await expect(row).toBeVisible({ timeout: 10000 });

    await removeFolderThroughWorker(page, folder.nodeId);
    await waitForSubTreeUpdate(page, 5000);

    await expect(getNodeRow(page, folder.name)).toHaveCount(0);
  });

  test('multiple worker-created folders are rendered without a manual reload', async ({ page }) => {
    const folders = await Promise.all([
      createFolderThroughWorker(page, 'Worker Sync Batch A'),
      createFolderThroughWorker(page, 'Worker Sync Batch B'),
      createFolderThroughWorker(page, 'Worker Sync Batch C'),
    ]);

    await waitForSubTreeUpdate(page, 5000);

    for (const folder of folders) {
      await expect(getNodeRow(page, folder.name)).toBeVisible({ timeout: 10000 });
    }
  });

  test('worker-created child updates parent expansion state', async ({ page }) => {
    const parent = await createFolderThroughWorker(page, 'Worker Sync Parent');
    await expect(getNodeRow(page, parent.name)).toBeVisible({ timeout: 10000 });

    const child = await createFolderThroughWorker(page, 'Worker Sync Child', parent.nodeId);
    await waitForSubTreeUpdate(page, 5000);

    const parentRow = getNodeRow(page, parent.name);
    await expect(parentRow).toHaveAttribute('data-has-children', 'true', { timeout: 10000 });
    await parentRow.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page, 5000);

    await expect(
      page
        .locator(`[data-testid="console-node"][data-parent-id="${parent.nodeId}"]`)
        .filter({ hasText: child.name })
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('repeated navigation does not duplicate synchronized rows', async ({ page }) => {
    const folder = await createFolderThroughWorker(page, 'Worker Sync Stable');
    await expect(getNodeRow(page, folder.name)).toBeVisible({ timeout: 10000 });

    for (let index = 0; index < 3; index += 1) {
      await page.goto(buildAppUrl('about'), { waitUntil: 'domcontentloaded' });
      await page.goto(buildAppUrl('d/r'), { waitUntil: 'domcontentloaded' });
      await dismissGuidedTour(page);
      await waitForTreeTableLoad(page);
    }

    await expect(
      page.locator('[data-testid="console-node"]').filter({ hasText: folder.name })
    ).toHaveCount(1);
  });
});
