import { expect, test } from './fixtures/canonicalAuthFixture';

type ReadinessResult = {
  readonly status: string;
  readonly code?: string;
  readonly actualFenceEstablished: boolean;
  readonly counts: {
    readonly window: {
      readonly compatible: number;
      readonly incompatible: number;
      readonly unresponsive: number;
    };
    readonly worker: {
      readonly compatible: number;
      readonly incompatible: number;
      readonly unresponsive: number;
    };
    readonly sharedworker: {
      readonly compatible: number;
      readonly incompatible: number;
      readonly unresponsive: number;
    };
  };
};

test('post-activation coordinator rejects readiness after revoking the legacy gate', async ({
  baseURL,
  canonicalAuth,
  page,
}) => {
  test.setTimeout(60_000);
  if (typeof baseURL !== 'string') throw new Error('playwright-base-url-missing');
  await canonicalAuth.signIn();
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
  const readiness = await page.evaluate(async (): Promise<ReadinessResult> => {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (!(worker instanceof ServiceWorker)) throw new Error('origin-coordinator-worker-missing');
    const request = {
      type: 'HDB_COORDINATOR_READINESS_REQUEST',
      protocolVersion: 2,
      requestId: 'e2e-stable-acceptance-census',
      timeoutMs: 5_000,
    };
    return await new Promise<ReadinessResult>((resolve, reject) => {
      const channel = new MessageChannel();
      let settled = false;
      const finish = (value: ReadinessResult | null, error: Error | null): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        channel.port1.close();
        if (error) {
          reject(error);
        } else if (value) {
          resolve(value);
        } else {
          reject(new Error('origin-coordinator-empty-readiness-response'));
        }
      };
      const timer = setTimeout(
        () => finish(null, new Error('origin-coordinator-readiness-timeout')),
        10_000
      );
      channel.port1.onmessage = (event: MessageEvent<ReadinessResult>) => finish(event.data, null);
      channel.port1.onmessageerror = () =>
        finish(null, new Error('origin-coordinator-readiness-message-error'));
      channel.port1.start();
      worker.postMessage(request, [channel.port2]);
    });
  });
  expect(readiness).toMatchObject({
    status: 'rejected',
    code: 'LEGACY_YAML_ACCESS_REVOKED',
    actualFenceEstablished: false,
    counts: {
      window: { compatible: 0, incompatible: 0, unresponsive: 0 },
      worker: { compatible: 0, incompatible: 0, unresponsive: 0 },
      sharedworker: { compatible: 0, incompatible: 0, unresponsive: 0 },
    },
  });

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

  expect(durableRecords).toHaveLength(1);
  expect(durableRecords[0]).toMatchObject({
    key: 'yaml-storage',
    protocolVersion: 2,
    phase: 'revoked',
    status: 'ready-for-preflight',
  });
});

test('country availability Dedicated Worker responds on its owner channel', async ({
  baseURL,
  page,
}) => {
  if (typeof baseURL !== 'string') throw new Error('playwright-base-url-missing');
  const workerHostUrl = `${baseURL.replace(/\/*$/u, '')}/dedicated-worker-e2e-host.html`;
  await page.route(workerHostUrl, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Dedicated Worker E2E Host</title>',
    });
  });
  await page.goto(workerHostUrl, { waitUntil: 'domcontentloaded' });

  const response = await page.evaluate(async (): Promise<unknown> => {
    const worker = new Worker(new URL('countryAvailability.worker.js', document.baseURI), {
      type: 'module',
    });
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const channel = new MessageChannel();
        let settled = false;
        const finish = (value: unknown, error: Error | null): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          worker.removeEventListener('error', onWorkerError);
          worker.removeEventListener('messageerror', onWorkerMessageError);
          channel.port1.close();
          if (error === null) {
            resolve(value);
          } else {
            reject(error);
          }
        };
        const onWorkerError = (event: ErrorEvent): void => {
          const stack = event.error instanceof Error ? event.error.stack : undefined;
          finish(
            undefined,
            new Error(
              `dedicated-worker-script-error: ${event.message} (${event.filename}:${event.lineno}:${event.colno})${stack ? `\n${stack}` : ''}`
            )
          );
        };
        const onWorkerMessageError = (): void => {
          finish(undefined, new Error('dedicated-worker-message-error'));
        };
        const timer = setTimeout(
          () => finish(undefined, new Error('dedicated-worker-responder-timeout')),
          5_000
        );
        worker.addEventListener('error', onWorkerError);
        worker.addEventListener('messageerror', onWorkerMessageError);
        channel.port1.onmessage = (event: MessageEvent<unknown>) => finish(event.data, null);
        channel.port1.onmessageerror = () =>
          finish(undefined, new Error('dedicated-worker-response-message-error'));
        channel.port1.start();
        try {
          worker.postMessage(
            {
              type: 'HDB_COORDINATOR_CENSUS_PROBE',
              protocolVersion: 2,
              requestId: 'e2e-country-availability-worker-probe',
            },
            [channel.port2]
          );
        } catch {
          channel.port2.close();
          finish(undefined, new Error('dedicated-worker-probe-dispatch-failed'));
        }
      });
    } finally {
      worker.terminate();
    }
  });

  expect(response).toMatchObject({
    type: 'HDB_COORDINATOR_CENSUS_RESPONSE',
    protocolVersion: 2,
    requestId: 'e2e-country-availability-worker-probe',
    capabilities: ['origin-coordinator-foundation-v1', 'yaml-storage-quiescence-bridge-v1'],
  });
});
