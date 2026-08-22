import '../utils/skip-if-disabled';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/canonicalAuthFixture';
import { buildAppUrl } from '../utils/test-helpers';
import {
  type BuildEvidence,
  type BuildStatusEvidence,
  cancelBuildDirectly,
  closeResumeDialogIfVisible,
  collectConsoleFailures,
  configureWorkerCorsProxy,
  createShapeNode,
  openShapeBuildStep,
  prepareAuthenticatedTree,
  readBuildEvidence,
  readBuildStatusEvidence,
  removeShapeNode,
  type ShapeNode,
  seedQueuedSession,
  startDeterministicGeoBoundariesProxy,
  type TaskEvidence,
  waitForOutcomeDialogClose,
} from './shape-build-session-lifecycle.test-support';

const START_BUTTON_TEST_ID = 'build-control-start-resume-button';
const PAUSE_BUTTON_TEST_ID = 'build-control-pause-button';
const RESET_MENU_BUTTON_TEST_ID = 'build-control-reset-delete-button';

const WAIT_FOR_STATUS_TIMEOUT_MS = 10_000;
const WAIT_FOR_SOURCE_TASK_TIMEOUT_MS = 10_000;
const WAIT_FOR_DOWNLOAD_TIMEOUT_MS = 10_000;
const WAIT_FOR_COMPLETION_TIMEOUT_MS = 45_000;
const WAIT_FOR_UI_TIMEOUT_MS = 7_500;
const WAIT_FOR_DIALOG_APPEAR_TIMEOUT_MS = 2_000;
const CLEANUP_TIMEOUT_MS = 3_000;
const SHORT_SCENARIO_TIMEOUT_MS = 45_000;
const LIFECYCLE_SCENARIO_TIMEOUT_MS = 75_000;

const waitForBuildStatus = async (
  page: Page,
  nodeId: string,
  expectedStatus: string,
  timeout = WAIT_FOR_STATUS_TIMEOUT_MS
): Promise<BuildEvidence> => {
  let latest: BuildStatusEvidence | null = null;
  const expectedActive = expectedStatus === 'running';
  const expected = {
    workerStatus: expectedStatus,
    persistedStatus: expectedStatus,
    runtimeStatus: expectedStatus,
    runtimeActive: expectedActive,
  };
  const deadline = Date.now() + timeout;
  let attempt = 0;
  while (Date.now() < deadline) {
    latest = await readBuildStatusEvidence(page, nodeId);
    if (
      expectedStatus !== 'paused' &&
      latest.persistedStatus === 'paused' &&
      latest.persistedStopReason === 'auth-required'
    ) {
      throw new Error(
        `Shape build paused for authentication while waiting for ${expectedStatus}: ${JSON.stringify(latest)}`
      );
    }
    const actual = {
      workerStatus: latest.workerStatus,
      persistedStatus: latest.persistedStatus,
      runtimeStatus: latest.runtimeStatus,
      runtimeActive: latest.runtimeActive,
    };
    if (
      actual.workerStatus === expected.workerStatus &&
      actual.persistedStatus === expected.persistedStatus &&
      actual.runtimeStatus === expected.runtimeStatus &&
      actual.runtimeActive === expected.runtimeActive
    ) {
      return readBuildEvidence(page, nodeId);
    }
    const interval = attempt === 0 ? 100 : attempt === 1 ? 250 : attempt === 2 ? 500 : 1_000;
    await page.waitForTimeout(interval);
    attempt += 1;
  }
  throw new Error(
    `Expected Shape build ${nodeId} to reach ${expectedStatus}: ${JSON.stringify({
      expected,
      latest,
    })}`
  );
};

const waitForRunningSourceTask = async (page: Page, nodeId: string): Promise<TaskEvidence> => {
  let sourceTask: TaskEvidence | undefined;
  let latest: BuildStatusEvidence | null = null;
  const deadline = Date.now() + WAIT_FOR_SOURCE_TASK_TIMEOUT_MS;
  let attempt = 0;
  while (Date.now() < deadline) {
    latest = await readBuildStatusEvidence(page, nodeId);
    if (
      latest.workerStatus === 'failed' ||
      latest.persistedStatus === 'failed' ||
      latest.runtimeStatus === 'failed'
    ) {
      throw new Error(
        `Build failed before a running source task appeared: ${JSON.stringify(latest)}`
      );
    }
    sourceTask = latest.tasks.find(
      (task) => task.stage === 'source' && task.status === 'running' && task.progress < 100
    );
    if (sourceTask) break;
    const interval = attempt === 0 ? 100 : attempt === 1 ? 200 : 500;
    await page.waitForTimeout(interval);
    attempt += 1;
  }
  if (!sourceTask) {
    throw new Error(
      `Expected the authoritative source snapshot to contain a running task: ${JSON.stringify(latest)}`
    );
  }
  await expect(page.locator(`[data-task-id="${sourceTask.taskId}"]`)).toBeVisible({
    timeout: WAIT_FOR_UI_TIMEOUT_MS,
  });
  return sourceTask;
};

const waitForDownloadRequest = async (
  page: Page,
  nodeId: string,
  network: {
    readonly requestCount: number;
    readonly authorizedRequestCount: number;
    readonly unauthorizedRequestCount: number;
    readonly rejectedOriginRequestCount: number;
    readonly rejectedTargetRequestCount: number;
    readonly downloadRequestCount: number;
    readonly observedUrls: readonly string[];
  },
  previousCount: number,
  consoleFailures: { readonly consoleErrors: string[]; readonly pageErrors: string[] },
  timeout = WAIT_FOR_DOWNLOAD_TIMEOUT_MS
): Promise<void> => {
  try {
    const deadline = Date.now() + timeout;
    let latest: BuildStatusEvidence | null = null;
    let attempt = 0;
    while (Date.now() < deadline) {
      latest = await readBuildStatusEvidence(page, nodeId);
      if (
        latest.workerStatus === 'failed' ||
        latest.persistedStatus === 'failed' ||
        latest.runtimeStatus === 'failed'
      ) {
        throw new Error(`Build failed before its source download: ${JSON.stringify(latest)}`);
      }
      if (network.downloadRequestCount > previousCount) return;
      const interval = attempt === 0 ? 100 : attempt === 1 ? 250 : 500;
      await page.waitForTimeout(interval);
      attempt += 1;
    }
    throw new Error(
      `Timed out waiting for source download count to exceed ${previousCount}: ${JSON.stringify(latest)}`
    );
  } catch (error) {
    const evidence = await readBuildEvidence(page, nodeId).catch((diagnosticError) => ({
      diagnosticReadError:
        diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError),
    }));
    const networkEvidence = {
      requestCount: network.requestCount,
      authorizedRequestCount: network.authorizedRequestCount,
      unauthorizedRequestCount: network.unauthorizedRequestCount,
      rejectedOriginRequestCount: network.rejectedOriginRequestCount,
      rejectedTargetRequestCount: network.rejectedTargetRequestCount,
      downloadRequestCount: network.downloadRequestCount,
      observedUrls: network.observedUrls,
    };
    throw new Error(
      `No source download was observed. Evidence: ${JSON.stringify(evidence)}. ` +
        `Network: ${JSON.stringify(networkEvidence)}. ` +
        `Browser errors: ${JSON.stringify([
          ...consoleFailures.consoleErrors,
          ...consoleFailures.pageErrors,
        ])}. Cause: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const assertCanonicalTaskContracts = (tasks: TaskEvidence[]): void => {
  expect(tasks.length).toBeGreaterThan(0);
  for (const task of tasks) {
    expect(task.taskId.length).toBeGreaterThan(0);
    expect(Number.isInteger(task.version)).toBe(true);
    expect(task.version).toBeGreaterThan(0);
    expect(Number.isFinite(task.progress)).toBe(true);
    expect(task.progress).toBeGreaterThanOrEqual(0);
    expect(task.progress).toBeLessThanOrEqual(100);
  }
};

const closeCompletionDialog = async (page: Page): Promise<void> => {
  const completionDialog = page
    .getByRole('dialog')
    .filter({ hasText: /Build completed|ビルド.*完了/i })
    .first();
  try {
    await expect(completionDialog).toBeVisible({ timeout: WAIT_FOR_DIALOG_APPEAR_TIMEOUT_MS });
  } catch {
    return;
  }
  await waitForOutcomeDialogClose(page);
};

const assertDeleteMenuMatchesPersistence = async (
  page: Page,
  counts: {
    sourceApiCacheCount: number;
    sourceFilteredCacheCount: number;
    geometryCacheCount: number;
    geometryTaskCount: number;
    tileEmitTaskCount: number;
    geometryErrorCount: number;
    featureMetadataCount: number;
    vectorTileCount: number;
  }
): Promise<void> => {
  await closeResumeDialogIfVisible(page, 500);
  const resetMenuButton = page.getByTestId(RESET_MENU_BUTTON_TEST_ID);
  await expect(resetMenuButton).toBeEnabled({ timeout: WAIT_FOR_UI_TIMEOUT_MS });
  await resetMenuButton.click({ timeout: WAIT_FOR_UI_TIMEOUT_MS });
  await expect(
    page.getByRole('menuitem', { name: /Reset build session|ビルドセッションをリセット/i })
  ).toBeEnabled();

  const apiCache = page.getByRole('menuitem', { name: /Delete API cache|APIキャッシュを削除/i });
  const filtered = page.getByRole('menuitem', {
    name: /Delete filtered cache|フィルター処理キャッシュを削除/i,
  });
  const geometry = page.getByRole('menuitem', {
    name: /Delete simplified cache|簡略化キャッシュを削除/i,
  });
  const tileEmit = page.getByRole('menuitem', {
    name: /Delete tile emit cache|タイルデータを削除/i,
  });
  const metadata = page.getByRole('menuitem', {
    name: /Delete feature metadata|フィーチャーメタデータを削除/i,
  });
  if (counts.sourceApiCacheCount > 0) await expect(apiCache).toBeEnabled();
  else await expect(apiCache).toBeDisabled();
  if (counts.sourceFilteredCacheCount > 0) await expect(filtered).toBeEnabled();
  else await expect(filtered).toBeDisabled();
  if (counts.geometryCacheCount + counts.geometryTaskCount + counts.geometryErrorCount > 0) {
    await expect(geometry).toBeEnabled();
  } else await expect(geometry).toBeDisabled();
  if (counts.vectorTileCount + counts.tileEmitTaskCount > 0) await expect(tileEmit).toBeEnabled();
  else await expect(tileEmit).toBeDisabled();
  if (counts.featureMetadataCount > 0) await expect(metadata).toBeEnabled();
  else await expect(metadata).toBeDisabled();
  const menu = apiCache.locator('xpath=ancestor::*[@role="menu"][1]');
  const menuPopover = menu.locator(
    'xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " MuiPopover-root ")][1]'
  );
  await menuPopover.locator('.MuiBackdrop-root').click({ position: { x: 1, y: 1 } });
  await expect(menu).toBeHidden();
};

const assertSessionAgreement = (
  evidence: Awaited<ReturnType<typeof readBuildEvidence>>,
  status: string,
  isActive: boolean
): void => {
  expect(evidence.workerStatus).toBe(status);
  expect(evidence.persistedStatus).toBe(status);
  expect(evidence.runtimeStatus).toBe(status);
  expect(evidence.runtimeActive).toBe(isActive);
};

const runWithTimeout = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
};

const cleanupShapeNodeBestEffort = async (page: Page, nodeId: string): Promise<void> => {
  const cleanup = removeShapeNode(page, nodeId);
  cleanup.catch(() => undefined);
  try {
    await runWithTimeout(cleanup, CLEANUP_TIMEOUT_MS, 'Shape E2E cleanup');
  } catch (error) {
    await runWithTimeout(
      page.close({ runBeforeUnload: false }).catch(() => undefined),
      1_000,
      'Shape E2E page close'
    ).catch(() => undefined);
    throw error;
  }
};

test.describe('Shape canonical build-session lifecycle', () => {
  test('rejects non-canonical origin, token, protocol, and upstream targets', async ({
    canonicalAuth,
  }) => {
    const network = await startDeterministicGeoBoundariesProxy(canonicalAuth.authorizationHeader);
    const appOrigin = new URL(buildAppUrl()).origin;
    const requestProxy = async (
      targetUrl: string,
      origin: string,
      authorization: string
    ): Promise<Response> => {
      const proxyUrl = new URL(network.corsProxyBaseURL);
      proxyUrl.searchParams.set('url', targetUrl);
      return fetch(proxyUrl, {
        headers: {
          Authorization: authorization,
          Origin: origin,
        },
      });
    };

    try {
      const canonicalMetadataUrl = 'https://geoboundaries.org/api/current/gbOpen/ALL/ALL/';
      await expect(
        requestProxy(
          canonicalMetadataUrl,
          'https://non-canonical.invalid',
          canonicalAuth.authorizationHeader
        )
      ).resolves.toMatchObject({ status: 403 });
      await expect(
        requestProxy(canonicalMetadataUrl, appOrigin, 'Bearer invalid-e2e-token')
      ).resolves.toMatchObject({ status: 401 });
      await expect(
        requestProxy(
          'http://geoboundaries.org/api/current/gbOpen/ALL/ALL/',
          appOrigin,
          canonicalAuth.authorizationHeader
        )
      ).resolves.toMatchObject({ status: 403 });
      await expect(
        requestProxy(
          'https://non-canonical.invalid/api/current/gbOpen/ALL/ALL/',
          appOrigin,
          canonicalAuth.authorizationHeader
        )
      ).resolves.toMatchObject({ status: 403 });
      await expect(
        requestProxy(canonicalMetadataUrl, appOrigin, canonicalAuth.authorizationHeader)
      ).resolves.toMatchObject({ status: 200 });

      expect(network.requestCount).toBe(4);
      expect(network.authorizedRequestCount).toBe(3);
      expect(network.unauthorizedRequestCount).toBe(1);
      expect(network.rejectedOriginRequestCount).toBe(1);
      expect(network.rejectedTargetRequestCount).toBe(2);
    } finally {
      await network.close();
    }
  });

  test('keeps Worker and persistence aligned through pause, resume, and reload', async ({
    page,
    canonicalAuth,
  }) => {
    test.setTimeout(LIFECYCLE_SCENARIO_TIMEOUT_MS);
    const consoleFailures = collectConsoleFailures(page);
    let network: Awaited<ReturnType<typeof startDeterministicGeoBoundariesProxy>> | null = null;
    let node: ShapeNode | null = null;
    let primaryFailure: unknown = null;
    let cleanupFailure: unknown = null;

    try {
      await canonicalAuth.signIn();
      await page.evaluate(() => localStorage.setItem('hidb_auth_debug', '1'));
      network = await startDeterministicGeoBoundariesProxy(canonicalAuth.authorizationHeader);
      await prepareAuthenticatedTree(page, network.corsProxyBaseURL);
      node = await createShapeNode(page, {
        label: 'Shape canonical lifecycle',
        selectedArrayByCountries: { JP: [true] },
      });
      const nodeId = node.nodeId;
      await openShapeBuildStep(page, node);

      await expect(page.locator('[aria-label="Completed 0/0"]').first()).toBeVisible();
      await expect(page.locator('[data-task-id]')).toHaveCount(0);
      await expect(page.getByTestId(START_BUTTON_TEST_ID)).toBeEnabled();

      network.setDownloadDelay(1_000);
      await page.getByTestId(START_BUTTON_TEST_ID).click();
      await waitForDownloadRequest(page, nodeId, network, 0, consoleFailures);
      const initialSourceTask = await waitForRunningSourceTask(page, nodeId);
      expect(initialSourceTask.progress).toBeLessThan(100);
      await expect(page.getByTestId(PAUSE_BUTTON_TEST_ID)).toBeEnabled();
      await page.getByTestId(PAUSE_BUTTON_TEST_ID).click();

      const paused = await waitForBuildStatus(page, nodeId, 'paused');
      assertSessionAgreement(paused, 'paused', false);
      await closeResumeDialogIfVisible(page);
      await expect(page.getByTestId(START_BUTTON_TEST_ID)).toHaveAccessibleName(
        /Resume Build|ビルド.*再開/i
      );

      network.setDownloadDelay(0);
      await page.getByTestId(START_BUTTON_TEST_ID).click();
      let completed: BuildEvidence;
      try {
        completed = await waitForBuildStatus(
          page,
          nodeId,
          'completed',
          WAIT_FOR_COMPLETION_TIMEOUT_MS
        );
      } catch (error) {
        const authStorage = await page.evaluate(() => ({
          accessTokenPresent: localStorage.getItem('access_token') !== null,
          userinfoPresent: localStorage.getItem('userinfo') !== null,
        }));
        const stalledEvidence = await readBuildStatusEvidence(page, nodeId);
        const diagnostics = await consoleFailures.readDiagnostics();
        throw new Error(
          [
            error instanceof Error ? error.message : String(error),
            `network=${JSON.stringify({
              requestCount: network.requestCount,
              authorizedRequestCount: network.authorizedRequestCount,
              unauthorizedRequestCount: network.unauthorizedRequestCount,
              rejectedOriginRequestCount: network.rejectedOriginRequestCount,
              rejectedTargetRequestCount: network.rejectedTargetRequestCount,
              downloadRequestCount: network.downloadRequestCount,
              observedUrls: network.observedUrls,
            })}`,
            `authStorage=${JSON.stringify(authStorage)}`,
            `stalledEvidence=${JSON.stringify(stalledEvidence)}`,
            `diagnostics=${JSON.stringify(diagnostics)}`,
          ].join('\n')
        );
      }
      assertSessionAgreement(completed, 'completed', false);
      assertCanonicalTaskContracts(completed.tasks);
      expect(new Set(completed.tasks.map((task) => task.stage))).toEqual(
        new Set(['source', 'geometry', 'tileEmit'])
      );
      expect(
        completed.tasks.every((task) => task.status === 'completed' || task.status === 'recycled')
      ).toBe(true);
      expect(completed.sourceApiCacheCount).toBeGreaterThan(0);
      expect(completed.sourceFilteredCacheCount).toBeGreaterThan(0);
      expect(completed.geometryCacheCount).toBeGreaterThan(0);
      expect(completed.tileMetadataCount).toBeGreaterThan(0);
      expect(completed.featureMetadataCount).toBeGreaterThan(0);
      expect(completed.vectorTileCount).toBeGreaterThan(0);
      expect(completed.vectorTileBytes).toBeGreaterThan(0);
      expect(completed.tileMetadataCount).toBe(completed.vectorTileCount);
      expect(completed.geometryTaskCount).toBe(
        completed.tasks.filter((task) => task.stage === 'geometry').length
      );
      expect(completed.tileEmitTaskCount).toBe(
        completed.tasks.filter((task) => task.stage === 'tileEmit').length
      );
      expect(network.authorizedRequestCount).toBeGreaterThan(0);
      expect(network.unauthorizedRequestCount).toBe(0);
      expect(network.rejectedOriginRequestCount).toBe(0);
      expect(network.rejectedTargetRequestCount).toBe(0);

      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
      await configureWorkerCorsProxy(page, network.corsProxyBaseURL);
      const reloadedCompleted = await readBuildEvidence(page, nodeId);
      assertSessionAgreement(reloadedCompleted, 'completed', false);
      expect(reloadedCompleted.vectorTileCount).toBeGreaterThan(0);

      await closeCompletionDialog(page);
      await consoleFailures.assertNoUnexpectedErrors();
    } catch (error) {
      primaryFailure = error;
    }
    if (node && primaryFailure === null) {
      try {
        await cleanupShapeNodeBestEffort(page, node.nodeId);
      } catch (error) {
        cleanupFailure = error;
        console.warn('[shape E2E] cleanup failed', error);
      }
    }
    try {
      await network?.close();
    } catch (error) {
      cleanupFailure = cleanupFailure ?? error;
    }
    if (primaryFailure !== null) {
      const diagnostics = await consoleFailures.readDiagnostics();
      throw new Error(
        [
          primaryFailure instanceof Error
            ? (primaryFailure.stack ?? primaryFailure.message)
            : String(primaryFailure),
          `consoleErrors=${JSON.stringify(consoleFailures.consoleErrors)}`,
          `pageErrors=${JSON.stringify(consoleFailures.pageErrors)}`,
          `diagnostics=${JSON.stringify(diagnostics)}`,
        ].join('\n')
      );
    }
    if (cleanupFailure !== null) throw cleanupFailure;
  });

  test('fails explicitly when a non-empty selection cannot generate an expected source task', async ({
    page,
    canonicalAuth,
  }) => {
    test.setTimeout(SHORT_SCENARIO_TIMEOUT_MS);
    const consoleFailures = collectConsoleFailures(page);
    let network: Awaited<ReturnType<typeof startDeterministicGeoBoundariesProxy>> | null = null;
    let node: ShapeNode | null = null;
    let cleanupNodeAfterTest = false;

    try {
      await canonicalAuth.signIn();
      network = await startDeterministicGeoBoundariesProxy(canonicalAuth.authorizationHeader);
      await prepareAuthenticatedTree(page, network.corsProxyBaseURL);
      node = await createShapeNode(page, {
        label: 'Shape canonical missing task',
        selectedArrayByCountries: { ZZ: [true] },
      });
      await openShapeBuildStep(page, node);
      await page.getByTestId(START_BUTTON_TEST_ID).click();

      const failed = await waitForBuildStatus(
        page,
        node.nodeId,
        'failed',
        WAIT_FOR_STATUS_TIMEOUT_MS
      );
      assertSessionAgreement(failed, 'failed', false);
      expect(failed.persistedStopReason).toBe('failed');
      expect(failed.tasks).toHaveLength(0);
      const failureDialogs = page.getByRole('dialog').filter({
        hasText: /Build failed|ビルド.*失敗/i,
      });
      await expect(failureDialogs).toHaveCount(1, { timeout: WAIT_FOR_UI_TIMEOUT_MS });
      const failureDialog = failureDialogs.first();
      await expect(failureDialog.getByText(/failed|失敗/i).first()).toBeVisible();
      expect(failed.geometryCacheCount).toBe(0);
      expect(failed.tileMetadataCount).toBe(0);
      expect(failed.featureMetadataCount).toBe(0);
      expect(failed.geometryErrorCount).toBe(0);
      expect(failed.vectorTileCount).toBe(0);
      expect(failed.vectorTileBytes).toBe(0);
      await waitForOutcomeDialogClose(page);
      await assertDeleteMenuMatchesPersistence(page, failed);
      const expectedMissingTaskDiagnostic = /No source task payloads generated/;
      await consoleFailures.assertNoUnexpectedErrors([
        /^\[shapeBuildAPI\] failed to generate payloads even after refresh\b/,
        /^\[shapeBuildAPI\] Failed to plan source total\b.*No source task payloads generated/,
        /^\[ShapeBuildProgressStep\] start\/resume failed\b.*No source task payloads generated/,
        /^\[ShapeBuildProgressStep\] build session transition finish\b.*Failed to start or resume build/,
      ]);
      await consoleFailures.assertObservedError(expectedMissingTaskDiagnostic);
      cleanupNodeAfterTest = true;
    } finally {
      try {
        if (node && cleanupNodeAfterTest) {
          await cleanupShapeNodeBestEffort(page, node.nodeId).catch((error) => {
            console.warn('[shape E2E] cleanup failed', error);
          });
        }
      } finally {
        await network?.close();
      }
    }
  });

  test('cancels queued work as idle plus stopReason', async ({ page, canonicalAuth }) => {
    test.setTimeout(SHORT_SCENARIO_TIMEOUT_MS);
    const consoleFailures = collectConsoleFailures(page);
    let node: ShapeNode | null = null;
    let cleanupNodeAfterTest = false;

    try {
      await canonicalAuth.signIn();
      await prepareAuthenticatedTree(page, '');
      node = await createShapeNode(page, {
        label: 'Shape canonical queued cancel',
        selectedArrayByCountries: {},
      });

      await seedQueuedSession(page, node.nodeId);
      await cancelBuildDirectly(page, node.nodeId);
      const cancelled = await waitForBuildStatus(
        page,
        node.nodeId,
        'idle',
        WAIT_FOR_STATUS_TIMEOUT_MS
      );
      assertSessionAgreement(cancelled, 'idle', false);
      expect(cancelled.persistedStopReason).toBe('user-pause');
      expect(cancelled.tasks).toHaveLength(0);

      await consoleFailures.assertNoUnexpectedErrors();
      cleanupNodeAfterTest = true;
    } finally {
      if (node && cleanupNodeAfterTest) {
        await cleanupShapeNodeBestEffort(page, node.nodeId).catch((error) => {
          console.warn('[shape E2E] cleanup failed', error);
        });
      }
    }
  });
});
