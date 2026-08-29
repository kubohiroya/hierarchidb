import './utils/skip-if-disabled';
import { expect, type Page, test } from '@playwright/test';
import {
  buildAppUrl,
  clearTestData,
  dismissGuidedTour,
  setupConsoleErrorTracking,
  waitForDraftUpdate,
  waitForTreeTableLoad,
} from './utils/test-helpers';

type TreeSummary = {
  id: string;
  rootId: string;
};

type WorkerQueryAPI = {
  listTrees: () => Promise<TreeSummary[]>;
};

type WorkerAPI = {
  getQueryAPI?: () => Promise<WorkerQueryAPI>;
  runStagedFolderAction?: (input: {
    runId: string;
    sourceNodeId: string;
    config: {
      version: 1;
      staging: {
        mode: 'temporary-copy';
        name: string;
        cleanup: 'retain';
      };
      overlay: {
        nodes: [];
      };
      actions: [];
    };
  }) => Promise<unknown>;
};

type WorkerClientRef = {
  client?: WorkerAPI;
  getAPI?: () => WorkerAPI | undefined;
};

type WindowWithWorkerRef = Window & {
  __HDB_WORKER_CLIENT_REF__?: WorkerClientRef;
};

const createFlowCases = [
  {
    nodeType: 'spreadsheet',
    menuLabel: /^(Spreadsheet|スプレッドシート)/i,
    stepLabels: [/^1\.?\s*(Info|Basic Info|基本情報)/i, /^2\.?\s*(Data Source|データソース)/i],
  },
  {
    nodeType: 'location',
    menuLabel: /^(Location|ロケーション)/i,
    stepLabels: [/^1\.?\s*(Info|Basic Info|基本情報)/i, /^2\.?\s*(Data Source|データソース)/i],
  },
  {
    nodeType: 'styler',
    menuLabel: /^(Styler|スタイラー)/i,
    stepLabels: [/^1\.?\s*(Info|Basic Info|基本情報)/i, /^2\.?\s*(Data Source|データソース)/i],
  },
] as const;

const isCanonicalRuntimeAdapterEnabled = process.env.VITE_CANONICAL_BUILD_RUNTIME_ADAPTER === '1';

const waitForWorkerAPI = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    () => {
      const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
      return Boolean(ref?.client ?? ref?.getAPI?.());
    },
    null,
    { timeout: 30000 }
  );
};

const getDialogNameInput = (page: Page) =>
  page
    .locator('input[name="name"]')
    .or(page.getByLabel(/Folder Name|名称|Name/))
    .first();

const openCreateMenuItem = async (page: Page, label: RegExp): Promise<void> => {
  const createMenuButton = page
    .locator(
      '#speed-dial-create-button, button[aria-label="作成"], button[aria-label="Create new item"]'
    )
    .or(page.getByRole('button', { name: /^Create$|^作成$/ }))
    .last();
  await expect(createMenuButton).toBeVisible({ timeout: 5000 });
  await createMenuButton.click();

  const targetMenuItem = page.getByRole('menuitem', { name: label }).first();
  await expect(targetMenuItem).toBeVisible({ timeout: 5000 });
  await targetMenuItem.click();
};

const expectCreateRoute = async (page: Page, nodeType: string): Promise<void> => {
  await expect(page).toHaveURL(new RegExp(`/${nodeType}/create(?:/|$)`), { timeout: 10000 });
};

const expectStepButtons = async (page: Page, stepLabels: readonly RegExp[]): Promise<void> => {
  for (const stepLabel of stepLabels) {
    await expect(page.getByRole('button', { name: stepLabel }).first()).toBeVisible({
      timeout: 10000,
    });
  }
};

const openPluginCreateFlow = async (
  page: Page,
  options: {
    nodeType: string;
    menuLabel: RegExp;
    stepLabels: readonly RegExp[];
  }
): Promise<void> => {
  await page.goto(buildAppUrl('d/r'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitForTreeTableLoad(page);
  await openCreateMenuItem(page, options.menuLabel);
  await expectCreateRoute(page, options.nodeType);
  await expect(getDialogNameInput(page)).toBeVisible({ timeout: 10000 });
  await expectStepButtons(page, options.stepLabels);
};

const seedCompletedStagedFolderActionRun = async (page: Page): Promise<string> => {
  return page.evaluate(async () => {
    const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
    const api = ref?.client ?? ref?.getAPI?.();
    if (!api?.getQueryAPI || !api.runStagedFolderAction) {
      throw new Error('Worker staged-folder-action API is not ready');
    }
    const queryAPI = await api.getQueryAPI();
    const trees = await queryAPI.listTrees();
    const tree = trees.find((item) => item.id === 'r') ?? trees[0];
    if (!tree) {
      throw new Error('No tree available for staged-folder-action E2E');
    }
    const runId = `e2e-staged-folder-action-${Date.now()}`;
    await api.runStagedFolderAction({
      runId,
      sourceNodeId: tree.rootId,
      config: {
        version: 1,
        staging: {
          mode: 'temporary-copy',
          name: `E2E staged UI ${Date.now()}`,
          cleanup: 'retain',
        },
        overlay: {
          nodes: [],
        },
        actions: [],
      },
    });
    return runId;
  });
};

test.describe
  .serial('Plugin and build-session UI wiring', () => {
    test.beforeEach(async ({ page }) => {
      setupConsoleErrorTracking(page);
      await clearTestData(page);
      await page.goto(buildAppUrl('d/r'), { waitUntil: 'domcontentloaded', timeout: 120000 });
      await dismissGuidedTour(page);
      await waitForTreeTableLoad(page);
      await waitForWorkerAPI(page);
    });

    test('Basemap create flow is reachable from the UI and commits a visible node', async ({
      page,
    }) => {
      await openCreateMenuItem(page, /^(Basemap|ベースマップ)/i);
      await expectCreateRoute(page, 'basemap');
      await expectStepButtons(page, [
        /^1\.?\s*(Info|Basic Info|基本情報)/i,
        /^2\.?\s*(Map Style|地図スタイル)/i,
        /^3(?:\s*3\.)?\s*(Preview|プレビュー|Map Viewport|地図表示範囲)/i,
      ]);

      await expect(getDialogNameInput(page)).toBeVisible({ timeout: 10000 });
      const nextButton = page.locator('#dialog-footer-next-button');
      await expect(nextButton).toBeEnabled({ timeout: 10000 });
      await nextButton.click();

      await expect(page.getByRole('button', { name: /Streets/i }).first()).toBeVisible({
        timeout: 10000,
      });
      await expect(nextButton).toBeEnabled({ timeout: 10000 });
      await nextButton.click();

      const zoomInput = page.locator('input[name="zoom"]').first();
      await expect(zoomInput).toBeVisible({ timeout: 10000 });
      await zoomInput.fill('3');

      const saveButton = page.getByRole('button', { name: /^Save$|^保存$/ }).last();
      await expect(saveButton).toBeEnabled({ timeout: 10000 });
      await saveButton.click();

      await waitForDraftUpdate(page);
      await expect(
        page.locator('[data-testid="console-node"]').filter({ hasText: /Basemap|ベースマップ/i })
      ).toBeVisible({ timeout: 15000 });
    });

    for (const createFlowCase of createFlowCases) {
      test(`${createFlowCase.nodeType} create flow opens from the UI and exposes its configured steps`, async ({
        page,
      }) => {
        await openPluginCreateFlow(page, createFlowCase);
      });
    }

    test('staged-folder-action runtime records are reachable from the AppBar session queue', async ({
      page,
    }) => {
      test.skip(
        !isCanonicalRuntimeAdapterEnabled,
        'Set VITE_CANONICAL_BUILD_RUNTIME_ADAPTER=1 to expose staged-folder-action runtime records through the shared build-session queue.'
      );

      const runId = await seedCompletedStagedFolderActionRun(page);
      const resumeDialog = page.getByRole('dialog', {
        name: /Build sessions|ビルドセッション一覧/i,
      });
      await expect(resumeDialog).toContainText(runId, { timeout: 15000 });
      await expect(resumeDialog).toContainText(/Completed|完了/i, { timeout: 10000 });
      await resumeDialog.getByRole('button', { name: /Close|閉じる/i }).click();
      await expect(resumeDialog).toBeHidden({ timeout: 10000 });

      const stagedQueueButton = page.getByTestId('build-session-queue-button-staged-folder-action');

      await expect(stagedQueueButton).toBeEnabled({ timeout: 15000 });
      await stagedQueueButton.click();

      const stagedQueuePopper = page.getByTestId('build-session-queue-popper-staged-folder-action');
      await expect(stagedQueuePopper).toBeVisible({ timeout: 10000 });
      await expect(stagedQueuePopper).toContainText(runId, { timeout: 10000 });
      await expect(stagedQueuePopper).toContainText(/Completed|完了/i, { timeout: 10000 });
    });
  });
