import { expect, test } from '@playwright/test';

type ReadinessResult = {
  readonly status: string;
  readonly actualFenceEstablished: boolean;
  readonly counts: {
    readonly window: {
      readonly compatible: number;
      readonly incompatible: number;
      readonly unresponsive: number;
    };
    readonly worker: { readonly incompatible: number; readonly unresponsive: number };
    readonly sharedworker: {
      readonly compatible: number;
      readonly incompatible: number;
      readonly unresponsive: number;
    };
  };
};

test('production bridge census accounts for the window and SharedWorker without mutating the gate', async ({
  baseURL,
  page,
}) => {
  if (typeof baseURL !== 'string') throw new Error('playwright-base-url-missing');
  await page.goto(`${baseURL.replace(/\/*$/u, '')}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () =>
      (
        window as Window & {
          __HDB_WORKER_CLIENT_REF__?: { readonly isInitialized?: boolean };
        }
      ).__HDB_WORKER_CLIENT_REF__?.isInitialized === true,
    undefined,
    { timeout: 20_000 }
  );
  await page.waitForFunction(
    () =>
      typeof (
        window as Window & {
          __HDB_ORIGIN_COORDINATOR_REF__?: unknown;
        }
      ).__HDB_ORIGIN_COORDINATOR_REF__ === 'object'
  );

  const readiness = await page.evaluate(async (): Promise<ReadinessResult> => {
    const coordinator = (
      window as Window & {
        __HDB_ORIGIN_COORDINATOR_REF__?: {
          getReadiness(input: { requestId: string; timeoutMs: number }): Promise<ReadinessResult>;
        };
      }
    ).__HDB_ORIGIN_COORDINATOR_REF__;
    if (!coordinator) throw new Error('origin-coordinator-handle-missing');
    return await coordinator.getReadiness({
      requestId: 'e2e-stable-acceptance-census',
      timeoutMs: 5_000,
    });
  });

  expect(readiness).toMatchObject({
    status: 'accepted',
    actualFenceEstablished: false,
    counts: {
      window: { incompatible: 0, unresponsive: 0 },
      worker: { incompatible: 0, unresponsive: 0 },
      sharedworker: { incompatible: 0, unresponsive: 0 },
    },
  });
  expect(readiness.counts.window.compatible).toBeGreaterThanOrEqual(1);
  expect(readiness.counts.sharedworker.compatible).toBeGreaterThanOrEqual(1);

  const durableRecords = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('hierarchidb-origin-coordinator', 2);
      request.onerror = () => reject(request.error ?? new Error('coordinator-db-open-failed'));
      request.onsuccess = () => resolve(request.result);
    });
    try {
      return await new Promise<unknown[]>((resolve, reject) => {
        const transaction = database.transaction('coordinator-state', 'readonly');
        const request = transaction.objectStore('coordinator-state').getAll();
        request.onerror = () => reject(request.error ?? new Error('coordinator-state-read-failed'));
        request.onsuccess = () => resolve(request.result);
      });
    } finally {
      database.close();
    }
  });

  expect(durableRecords).toEqual([{ key: 'yaml-storage', protocolVersion: 2, phase: 'allowed' }]);
});
