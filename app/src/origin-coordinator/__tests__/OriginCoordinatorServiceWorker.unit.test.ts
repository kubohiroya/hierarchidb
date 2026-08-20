import {
  ORIGIN_COORDINATOR_DATABASE_NAME,
  ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
} from '@hierarchidb/origin-coordinator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type OriginCoordinatorExtendableEvent,
  type OriginCoordinatorMessageEvent,
  OriginCoordinatorServiceWorker,
  type OriginCoordinatorServiceWorkerClient,
  type OriginCoordinatorServiceWorkerScope,
} from '../OriginCoordinatorServiceWorker.js';

const RELEASE_ID = '0123456789abcdef0123456789abcdef01234567';
const OTHER_RELEASE_ID = '89abcdef0123456789abcdef0123456789abcdef';
const REGISTRATION_SCOPE = 'https://example.test/hierarchidb/';

type ExtendableListener = (event: OriginCoordinatorExtendableEvent) => void;
type MessageListener = (event: OriginCoordinatorMessageEvent) => void;

interface CoordinatorHarness {
  readonly coordinator: OriginCoordinatorServiceWorker;
  readonly listeners: Map<string, ExtendableListener | MessageListener>;
  readonly matchAll: ReturnType<typeof vi.fn>;
  readonly getClient: ReturnType<typeof vi.fn>;
  readonly claim: ReturnType<typeof vi.fn>;
}

function awaitRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('indexeddb-request-failed'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function deleteCoordinatorDatabase(): Promise<void> {
  await awaitRequest(indexedDB.deleteDatabase(ORIGIN_COORDINATOR_DATABASE_NAME));
}

function createHarness(
  clients: readonly OriginCoordinatorServiceWorkerClient[]
): CoordinatorHarness {
  const listeners = new Map<string, ExtendableListener | MessageListener>();
  const claim = vi.fn(async () => undefined);
  const matchAll = vi.fn(async () => clients);
  const getClient = vi.fn(async (id: string) => clients.find((client) => client.id === id));
  const scope = {
    clients: { claim, matchAll, get: getClient },
    indexedDB,
    registration: { scope: REGISTRATION_SCOPE },
    addEventListener(type: string, listener: ExtendableListener | MessageListener): void {
      listeners.set(type, listener);
    },
  } as unknown as OriginCoordinatorServiceWorkerScope;
  return {
    coordinator: new OriginCoordinatorServiceWorker(scope, RELEASE_ID),
    listeners,
    matchAll,
    getClient,
    claim,
  };
}

function getListener<T extends ExtendableListener | MessageListener>(
  listeners: ReadonlyMap<string, ExtendableListener | MessageListener>,
  type: string
): T {
  const listener = listeners.get(type);
  if (!listener) throw new Error(`missing-listener:${type}`);
  return listener as T;
}

async function dispatchExtendable(listener: ExtendableListener): Promise<void> {
  let waited: Promise<unknown> | null = null;
  listener({
    waitUntil(promise: Promise<unknown>): void {
      waited = promise;
    },
  } as OriginCoordinatorExtendableEvent);
  if (waited === null) throw new Error('waitUntil-was-not-called');
  await waited;
}

async function dispatchMessage(
  listener: MessageListener,
  source: OriginCoordinatorServiceWorkerClient,
  data: unknown
): Promise<unknown> {
  const channel = new MessageChannel();
  const response = new Promise<unknown>((resolve, reject) => {
    channel.port1.onmessage = (event: MessageEvent<unknown>) => resolve(event.data);
    channel.port1.onmessageerror = () => reject(new Error('message-response-failed'));
    channel.port1.start();
  });
  let waited: Promise<unknown> | null = null;
  listener({
    data,
    ports: [channel.port2],
    source,
    waitUntil(promise: Promise<unknown>): void {
      waited = promise;
    },
  } as unknown as OriginCoordinatorMessageEvent);
  if (waited === null) throw new Error('waitUntil-was-not-called');
  await waited;
  return await response;
}

function createClient(
  id: string,
  type: OriginCoordinatorServiceWorkerClient['type'],
  url: string,
  respond: (message: unknown, port: MessagePort) => void
): OriginCoordinatorServiceWorkerClient {
  return {
    id,
    type,
    url,
    postMessage(message: unknown, transfer?: Transferable[]): void {
      const port = transfer?.[0];
      if (!(port instanceof MessagePort)) throw new Error('missing-response-port');
      respond(message, port);
    },
  };
}

function compatibleResponse(message: unknown, port: MessagePort): void {
  if (
    typeof message !== 'object' ||
    message === null ||
    !('requestId' in message) ||
    typeof message.requestId !== 'string'
  ) {
    throw new Error('invalid-probe');
  }
  port.postMessage({
    type: 'HDB_COORDINATOR_CENSUS_RESPONSE',
    protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
    requestId: message.requestId,
    releaseId: RELEASE_ID,
    capabilities: [ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY],
  });
  port.close();
}

function createReadinessRequest(timeoutMs = 100): Record<string, unknown> {
  return {
    type: 'HDB_COORDINATOR_READINESS_REQUEST',
    protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
    requestId: 'request-1',
    timeoutMs,
  };
}

describe('OriginCoordinatorServiceWorker', () => {
  beforeEach(deleteCoordinatorDatabase);
  afterEach(deleteCoordinatorDatabase);

  it('initializes durable state, claims clients, and registers no fetch listener', async () => {
    const harness = createHarness([]);
    harness.coordinator.install();
    harness.coordinator.activate();
    harness.coordinator.listen();

    await dispatchExtendable(getListener(harness.listeners, 'install'));
    await dispatchExtendable(getListener(harness.listeners, 'activate'));

    expect(harness.claim).toHaveBeenCalledOnce();
    expect([...harness.listeners.keys()].sort()).toEqual(['activate', 'install', 'message']);
  });

  it('accepts exact HELLO only after durable state initialization', async () => {
    const source = createClient('window-1', 'window', `${REGISTRATION_SCOPE}tree`, () => {});
    const harness = createHarness([source]);
    harness.coordinator.install();
    harness.coordinator.listen();
    await dispatchExtendable(getListener(harness.listeners, 'install'));

    const result = await dispatchMessage(getListener(harness.listeners, 'message'), source, {
      type: 'HDB_COORDINATOR_HELLO',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      releaseId: RELEASE_ID,
      capabilities: [ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY],
    });

    expect(result).toEqual({
      type: 'HDB_COORDINATOR_HELLO_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      status: 'accepted',
      legacyYamlAccess: 'allowed',
    });
  });

  it('accepts HELLO from durable state after the service worker instance restarts', async () => {
    const source = createClient('window-1', 'window', `${REGISTRATION_SCOPE}tree`, () => {});
    const firstInstance = createHarness([source]);
    firstInstance.coordinator.install();
    await dispatchExtendable(getListener(firstInstance.listeners, 'install'));

    const restartedInstance = createHarness([source]);
    restartedInstance.coordinator.listen();
    const result = await dispatchMessage(
      getListener(restartedInstance.listeners, 'message'),
      source,
      {
        type: 'HDB_COORDINATOR_HELLO',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        releaseId: RELEASE_ID,
        capabilities: [ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY],
      }
    );

    expect(result).toMatchObject({ status: 'accepted', legacyYamlAccess: 'allowed' });
  });

  it('rejects a structurally valid HELLO from a different release', async () => {
    const source = createClient('window-1', 'window', `${REGISTRATION_SCOPE}tree`, () => {});
    const harness = createHarness([source]);
    harness.coordinator.install();
    harness.coordinator.listen();
    await dispatchExtendable(getListener(harness.listeners, 'install'));

    const result = await dispatchMessage(getListener(harness.listeners, 'message'), source, {
      type: 'HDB_COORDINATOR_HELLO',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      releaseId: OTHER_RELEASE_ID,
      capabilities: [ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY],
    });

    expect(result).toMatchObject({ status: 'rejected', code: 'INVALID_HELLO_REQUEST' });
  });

  it('counts compatible in-scope clients and excludes other paths and origins', async () => {
    const compatible = createClient(
      'window-1',
      'window',
      `${REGISTRATION_SCOPE}tree`,
      compatibleResponse
    );
    const otherPath = createClient('window-2', 'window', 'https://example.test/other/', () => {
      throw new Error('out-of-scope-client-was-probed');
    });
    const otherOrigin = createClient(
      'worker-1',
      'worker',
      'https://other.example/hierarchidb/worker.js',
      () => {
        throw new Error('other-origin-client-was-probed');
      }
    );
    const harness = createHarness([otherOrigin, otherPath, compatible]);
    harness.coordinator.install();
    harness.coordinator.listen();
    await dispatchExtendable(getListener(harness.listeners, 'install'));

    const result = await dispatchMessage(
      getListener(harness.listeners, 'message'),
      compatible,
      createReadinessRequest()
    );

    expect(harness.matchAll).toHaveBeenCalledWith({ includeUncontrolled: true, type: 'all' });
    expect(result).toEqual({
      type: 'HDB_COORDINATOR_READINESS_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      requestId: 'request-1',
      status: 'accepted',
      counts: {
        window: { compatible: 1, incompatible: 0, unresponsive: 0, discarded: 0 },
        worker: { compatible: 0, incompatible: 0, unresponsive: 0, discarded: 0 },
        sharedworker: { compatible: 0, incompatible: 0, unresponsive: 0, discarded: 0 },
      },
    });
  });

  it('accounts for every in-scope window and worker client', async () => {
    const clients = [
      createClient('window-2', 'window', `${REGISTRATION_SCOPE}tree/2`, compatibleResponse),
      createClient(
        'shared-1',
        'sharedworker',
        `${REGISTRATION_SCOPE}shared.js`,
        compatibleResponse
      ),
      createClient('window-1', 'window', `${REGISTRATION_SCOPE}tree/1`, compatibleResponse),
      createClient('worker-1', 'worker', `${REGISTRATION_SCOPE}worker.js`, compatibleResponse),
    ] as const;
    const harness = createHarness(clients);
    harness.coordinator.install();
    harness.coordinator.listen();
    await dispatchExtendable(getListener(harness.listeners, 'install'));

    const result = await dispatchMessage(
      getListener(harness.listeners, 'message'),
      clients[0],
      createReadinessRequest()
    );

    expect(result).toMatchObject({
      status: 'accepted',
      counts: {
        window: { compatible: 2 },
        worker: { compatible: 1 },
        sharedworker: { compatible: 1 },
      },
    });
  });

  it('rejects an exact census containing an incompatible client', async () => {
    const incompatible = createClient(
      'window-1',
      'window',
      `${REGISTRATION_SCOPE}tree`,
      (message, port) => {
        const requestId =
          typeof message === 'object' && message !== null && 'requestId' in message
            ? message.requestId
            : null;
        port.postMessage({
          type: 'HDB_COORDINATOR_CENSUS_RESPONSE',
          protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
          requestId,
          releaseId: RELEASE_ID,
          capabilities: [ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY],
          legacyName: 'client',
        });
        port.close();
      }
    );
    const harness = createHarness([incompatible]);
    harness.coordinator.install();
    harness.coordinator.listen();
    await dispatchExtendable(getListener(harness.listeners, 'install'));

    const result = await dispatchMessage(
      getListener(harness.listeners, 'message'),
      incompatible,
      createReadinessRequest()
    );

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'INCOMPATIBLE_CLIENT',
      counts: { window: { incompatible: 1 } },
    });
  });

  it('rejects a client census response from a different release', async () => {
    const incompatible = createClient(
      'worker-1',
      'worker',
      `${REGISTRATION_SCOPE}worker.js`,
      (message, port) => {
        const requestId =
          typeof message === 'object' && message !== null && 'requestId' in message
            ? message.requestId
            : null;
        port.postMessage({
          type: 'HDB_COORDINATOR_CENSUS_RESPONSE',
          protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
          requestId,
          releaseId: OTHER_RELEASE_ID,
          capabilities: [ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY],
        });
        port.close();
      }
    );
    const harness = createHarness([incompatible]);
    harness.coordinator.install();
    harness.coordinator.listen();
    await dispatchExtendable(getListener(harness.listeners, 'install'));

    const result = await dispatchMessage(
      getListener(harness.listeners, 'message'),
      incompatible,
      createReadinessRequest()
    );

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'INCOMPATIBLE_CLIENT',
      counts: { worker: { incompatible: 1 } },
    });
  });

  it('distinguishes silence from browser-proven client destruction', async () => {
    const unresponsive = createClient(
      'worker-1',
      'worker',
      `${REGISTRATION_SCOPE}worker.js`,
      () => {}
    );
    const discarded = createClient(
      'sharedworker-1',
      'sharedworker',
      `${REGISTRATION_SCOPE}shared-worker.js`,
      () => {}
    );
    const harness = createHarness([unresponsive, discarded]);
    harness.getClient.mockImplementation(async (id: string) =>
      id === unresponsive.id ? unresponsive : undefined
    );
    harness.coordinator.install();
    harness.coordinator.listen();
    await dispatchExtendable(getListener(harness.listeners, 'install'));

    const result = await dispatchMessage(
      getListener(harness.listeners, 'message'),
      unresponsive,
      createReadinessRequest(5)
    );

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'UNRESPONSIVE_CLIENT',
      counts: {
        worker: { unresponsive: 1, discarded: 0 },
        sharedworker: { unresponsive: 0, discarded: 1 },
      },
    });
  });
});
