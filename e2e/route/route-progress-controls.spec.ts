import '../utils/skip-if-disabled';
import { expect, test } from '@playwright/test';
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

type E2EAuthSeed = {
  accessToken: string;
  idToken: string;
  userinfoRaw: string;
  tokenExpiresAt: number | null;
};

const decodeBase64Utf8 = (value: string): string => {
  const utf8 = Buffer.from(value, 'base64').toString('utf8');
  return utf8.trim();
};

const readE2EAuthSeed = (): E2EAuthSeed => {
  const accessToken = (process.env.E2E_AUTH_ACCESS_TOKEN ?? '').trim();
  const idToken = (process.env.E2E_AUTH_ID_TOKEN ?? '').trim();
  const tokenExpiresAtRaw = (process.env.E2E_AUTH_TOKEN_EXPIRES_AT ?? '').trim();
  const userinfoRawFromEnv = (process.env.E2E_AUTH_USERINFO ?? '').trim();
  const userinfoRawFromB64 = (process.env.E2E_AUTH_USERINFO_B64 ?? '').trim();
  const userinfoRaw = userinfoRawFromEnv || (userinfoRawFromB64 ? decodeBase64Utf8(userinfoRawFromB64) : '');
  const tokenExpiresAt = Number.isFinite(Number(tokenExpiresAtRaw)) && tokenExpiresAtRaw.length > 0
    ? Number(tokenExpiresAtRaw)
    : null;
  return {
    accessToken,
    idToken,
    userinfoRaw,
    tokenExpiresAt,
  };
};

test.describe('Route build controls', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
  });

  test('build start button triggers route build lifecycle in UI', async ({ page }) => {
    test.setTimeout(120000);
    const authSeed = readE2EAuthSeed();
    if (!authSeed.accessToken) {
      throw new Error('E2E auth seed is missing: set E2E_AUTH_ACCESS_TOKEN');
    }

    await page.addInitScript((seed: E2EAuthSeed) => {
      const now = Date.now();
      localStorage.setItem('access_token', seed.accessToken);
      if (seed.idToken) {
        localStorage.setItem('id_token', seed.idToken);
      }
      if (seed.userinfoRaw) {
        localStorage.setItem('userinfo', seed.userinfoRaw);
      }
      if (typeof seed.tokenExpiresAt === 'number' && Number.isFinite(seed.tokenExpiresAt)) {
        localStorage.setItem('token_expires_at', String(seed.tokenExpiresAt));
      }
      localStorage.setItem('last_auth_completion', String(now));
    }, authSeed);

    await page.goto(buildAppUrl('t/r'), { waitUntil: 'networkidle' });
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
    await page.waitForFunction(() => Boolean((window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__?.client), null, {
      timeout: 20000,
    });
    await page.evaluate(async (accessToken: string) => {
      const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
      const api = ref?.client ?? ref?.getAPI?.();
      if (api?.setAuthToken) {
        await api.setAuthToken(accessToken, 'Bearer');
      }
    }, authSeed.accessToken);
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
    }, authSeed.accessToken);
    expect(
      verifyResult.ok,
      `E2E auth token should pass /auth/verify before build start (status=${verifyResult.status})`,
    ).toBe(true);

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
