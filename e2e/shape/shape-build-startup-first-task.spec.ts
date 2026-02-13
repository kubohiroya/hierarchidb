import '../utils/skip-if-disabled';
import { test, expect, type ConsoleMessage } from '@playwright/test';
import {
  buildAppUrl,
  clearTestData,
  dismissGuidedTour,
  setupConsoleErrorTracking,
  waitForTreeTableLoad,
} from '../utils/test-helpers';

type SelectedArrayByCountries = Record<string, boolean[]>;

type ConsolePayload = Record<string, unknown>;

type E2EAuthSeed = {
  accessToken: string;
  idToken: string;
  userinfoRaw: string;
  tokenExpiresAt: number | null;
};

// Supported auth seed inputs:
// - E2E_AUTH_ACCESS_TOKEN (required)
// - E2E_AUTH_ID_TOKEN (optional)
// - E2E_AUTH_USERINFO or E2E_AUTH_USERINFO_B64 (optional)
// - E2E_AUTH_TOKEN_EXPIRES_AT (optional)
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

const readConsolePayload = async (msg: ConsoleMessage): Promise<ConsolePayload | null> => {
  const args = msg.args();
  if (args.length < 2) return null;
  try {
    const value = await args[1]?.jsonValue();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as ConsolePayload;
  } catch {
    return null;
  }
};

const readString = (payload: ConsolePayload | null, key: string): string | null => {
  const value = payload?.[key];
  return typeof value === 'string' ? value : null;
};

test.describe('Shape build startup first-task UX', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
  });

  test('does not hit awaiting-first-task 45s timeout after build start and observes first-task evidence', async ({ page }) => {
    test.setTimeout(180000);
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

    await page.goto(buildAppUrl('t/r'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
    await page.waitForFunction(() => Boolean((window as any).__HDB_WORKER_CLIENT_REF__?.client), null, {
      timeout: 20000,
    });

    await page.evaluate(async (accessToken: string) => {
      const ref = (window as any).__HDB_WORKER_CLIENT_REF__;
      const api = ref?.client ?? ref?.getAPI?.();
      if (api?.setCorsProxyBaseURL) {
        await api.setCorsProxyBaseURL('');
      }
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

    const selectedArrayByCountries: SelectedArrayByCountries = { JP: [true] };
    const buildConfig = await page.evaluate(() => {
      return {
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
    });

    const shapeNode = await page.evaluate(async ({ buildConfig, selectedArrayByCountries }) => {
      const client = (window as any).__HDB_WORKER_CLIENT_REF__?.client;
      if (!client) throw new Error('Worker client not ready');
      const queryAPI = await client.getQueryAPI();
      const mutationAPI = await client.getMutationAPI();
      const updaterAPI = await client.getTreeNodeUpdaterAPI();

      const trees = await queryAPI.listTrees();
      const tree = trees.find((t: { id: string }) => t.id === 'r') ?? trees[0];
      if (!tree) throw new Error('No tree available');
      const createResult = await mutationAPI.createNode({
        nodeType: 'shape',
        treeId: tree.id,
        parentId: tree.rootId,
        name: `Shape Startup ${Date.now()}`,
      });
      if (!createResult.success) {
        throw new Error(`Failed to create shape node: ${String(createResult.error ?? 'unknown')}`);
      }
      const nodeId = createResult.nodeId;
      const draftPayload = {
        name: `Shape Startup ${Date.now()}`,
        description: 'E2E startup first-task test',
        buildConfig,
        selectedArrayByCountries,
        processingStatus: 'idle',
        licenseAgreement: true,
        licenseAgreedAt: new Date().toISOString(),
      };
      await updaterAPI.updateTreeNode(nodeId, {
        mode: 'save-draft',
        data: draftPayload,
        draftData: draftPayload,
      });
      return { treeId: tree.id, pageNodeId: tree.rootId, nodeId, name: draftPayload.name };
    }, { buildConfig, selectedArrayByCountries });

    await page.goto(buildAppUrl(`t/${shapeNode.treeId}/${shapeNode.pageNodeId}`), {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await waitForTreeTableLoad(page);

    const shapeNodeLink = page.locator(`a[href$="/${shapeNode.nodeId}"]`).first();
    await expect(shapeNodeLink).toBeVisible({ timeout: 20000 });
    await shapeNodeLink.click();

    const startupTimeoutLogs: string[] = [];
    const firstTaskSuccessLogs: string[] = [];
    const firstTaskFailureLogs: string[] = [];
    const authRequiredLogs: string[] = [];
    const startupTrace: string[] = [];
    const pushStartupTrace = (entry: string): void => {
      startupTrace.push(entry);
      if (startupTrace.length > 60) {
        startupTrace.splice(0, startupTrace.length - 60);
      }
    };
    const pendingConsoleTasks = new Set<Promise<void>>();
    const handleStartupConsole = (msg: ConsoleMessage) => {
      const pending = (async () => {
        const text = msg.text();
        if (text.includes('[ShapeBuildProgressStep]') || text.includes('[ShapeBuildStartResumeTrace]')) {
          pushStartupTrace(text);
        }
        if (text.includes('Authentication required')) {
          authRequiredLogs.push(text);
          return;
        }
        if (!text.includes('[ShapeBuildProgressStep]')) return;
        const payload = await readConsolePayload(msg);

        if (text.includes('build session transition timeout')) {
          const phase = readString(payload, 'phase');
          const elapsed = payload?.elapsedMs;
          startupTimeoutLogs.push(
            `timeout phase=${phase ?? '-'} elapsedMs=${typeof elapsed === 'number' ? elapsed : '-'}`
          );
          return;
        }

        if (text.includes('build session transition finish')) {
          const message = readString(payload, 'message');
          if (message?.includes('Build did not start task processing (awaiting-first-task')) {
            startupTimeoutLogs.push(message);
            return;
          }
          if (message?.includes('Build completed without generating tasks.')) {
            firstTaskSuccessLogs.push(JSON.stringify(payload));
          }
          return;
        }

        if (text.includes('build startup step finish')) {
          const step = readString(payload, 'step');
          if (step !== 'awaiting-first-task') return;
          const outcome = readString(payload, 'outcome');
          if (outcome === 'success') {
            firstTaskSuccessLogs.push(JSON.stringify(payload));
            return;
          }
          if (outcome === 'error' || outcome === 'cancelled' || outcome === 'failed') {
            firstTaskFailureLogs.push(JSON.stringify(payload));
          }
        }
      })();
      pendingConsoleTasks.add(pending);
      void pending.finally(() => {
        pendingConsoleTasks.delete(pending);
      });
    };
    page.on('console', handleStartupConsole);

    try {
      const openEditButton = page.getByRole('button', { name: /ノードを編集|Edit/i }).first();
      await expect(openEditButton).toBeVisible({ timeout: 10000 });
      await openEditButton.click();

      const buildStepButton = page.getByRole('button', { name: /^5\s*(ビルド|Build)/ }).first();
      await expect(buildStepButton).toBeVisible({ timeout: 10000 });
      await buildStepButton.click();

      const launchBuildButtonByTestId = page.getByTestId('build-control-start-resume-button');
      const launchBuildButton = await launchBuildButtonByTestId.isVisible({ timeout: 3000 }).catch(() => false)
        ? launchBuildButtonByTestId
        : page.getByRole('button', { name: /ビルドを開始|ビルド開始|Start|Build/i }).first();
      await expect(launchBuildButton).toBeVisible({ timeout: 10000 });
      await expect(launchBuildButton).toBeEnabled({ timeout: 20000 });
      await launchBuildButton.click();

      const waitStartMs = Date.now();
      while (Date.now() - waitStartMs < 60000) {
        await Promise.allSettled(Array.from(pendingConsoleTasks));
        if (authRequiredLogs.length > 0) {
          throw new Error(`Auth required during build start: ${authRequiredLogs[0]}`);
        }
        if (startupTimeoutLogs.length > 0) {
          throw new Error(`Startup timeout detected: ${startupTimeoutLogs[0]}`);
        }
        if (firstTaskFailureLogs.length > 0) {
          throw new Error(`Startup failed before first-task signal: ${firstTaskFailureLogs[0]}`);
        }
        if (firstTaskSuccessLogs.length > 0) {
          break;
        }
        await page.waitForTimeout(250);
      }
      if (firstTaskSuccessLogs.length === 0) {
        const recentTrace = startupTrace.slice(-15).join('\n');
        throw new Error(
          `No explicit startup outcome within 60s.\nRecent startup trace:\n${recentTrace || '(none)'}`
        );
      }

      expect(authRequiredLogs).toHaveLength(0);
      expect(startupTimeoutLogs).toHaveLength(0);
      expect(firstTaskFailureLogs).toHaveLength(0);
      expect(firstTaskSuccessLogs.length).toBeGreaterThan(0);
    } finally {
      page.off('console', handleStartupConsole);
    }
  });
});
