import {
  ORIGIN_COORDINATOR_DATABASE_NAME,
  ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
  ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
} from '@hierarchidb/origin-coordinator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type OriginCoordinatorExtendableEvent,
  type OriginCoordinatorMessageEvent,
  OriginCoordinatorServiceWorker,
  type OriginCoordinatorServiceWorkerClient,
  type OriginCoordinatorServiceWorkerScope,
} from '../OriginCoordinatorServiceWorker.js';
import {
  readOriginCoordinatorStateDb,
  transitionOriginCoordinatorStateDb,
} from '../originCoordinatorStateDbUtils.js';

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
  clients: readonly OriginCoordinatorServiceWorkerClient[],
  coordinatorIndexedDb: IDBFactory = indexedDB
): CoordinatorHarness {
  const listeners = new Map<string, ExtendableListener | MessageListener>();
  const claim = vi.fn(async () => undefined);
  const matchAll = vi.fn(async () => clients);
  const getClient = vi.fn(async (id: string) => clients.find((client) => client.id === id));
  const scope = {
    clients: { claim, matchAll, get: getClient },
    indexedDB: coordinatorIndexedDb,
    registration: { scope: REGISTRATION_SCOPE },
    addEventListener(type: string, listener: ExtendableListener | MessageListener): void {
      listeners.set(type, listener);
    },
  } as unknown as OriginCoordinatorServiceWorkerScope;
  return {
    coordinator: new OriginCoordinatorServiceWorker(scope),
    listeners,
    matchAll,
    getClient,
    claim,
  };
}

function createFactoryThatFailsAfterOpen(successfulOpenCount: number): IDBFactory {
  let openCount = 0;
  return {
    cmp: indexedDB.cmp.bind(indexedDB),
    databases: indexedDB.databases.bind(indexedDB),
    deleteDatabase: indexedDB.deleteDatabase.bind(indexedDB),
    open(name: string, version?: number): IDBOpenDBRequest {
      openCount += 1;
      if (openCount <= successfulOpenCount) {
        return version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
      }
      const request = {
        error: new DOMException('forced-open-failure', 'UnknownError'),
        onblocked: null,
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        readyState: 'pending',
        result: undefined,
        source: null,
        transaction: null,
      } as unknown as IDBOpenDBRequest;
      queueMicrotask(() => request.onerror?.(new Event('error')));
      return request;
    },
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

function unwrapSharedWorkerRelay(message: unknown): unknown {
  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'HDB_COORDINATOR_SHARED_WORKER_RELAY_REQUEST' &&
    'request' in message
  ) {
    return message.request;
  }
  return message;
}

function compatibleResponse(message: unknown, port: MessagePort): void {
  const request = unwrapSharedWorkerRelay(message);
  if (
    typeof request !== 'object' ||
    request === null ||
    !('requestId' in request) ||
    typeof request.requestId !== 'string'
  ) {
    throw new Error('invalid-probe');
  }
  port.postMessage({
    type: 'HDB_COORDINATOR_CENSUS_RESPONSE',
    protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
    requestId: request.requestId,
    releaseId: RELEASE_ID,
    capabilities: [
      ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
      ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
    ],
  });
  port.close();
}

function quiescenceAcknowledgement(message: unknown, port: MessagePort): void {
  const request = unwrapSharedWorkerRelay(message);
  if (typeof request !== 'object' || request === null || !('type' in request)) {
    throw new Error('invalid-participant-request');
  }
  if (request.type === 'HDB_COORDINATOR_CENSUS_PROBE') {
    compatibleResponse(request, port);
    return;
  }
  if (
    request.type !== 'HDB_COORDINATOR_PARTICIPANT_QUIESCENCE_REQUEST' ||
    !('activationId' in request) ||
    !('quiescenceRequestId' in request) ||
    !('participantKind' in request) ||
    !('participantId' in request)
  ) {
    throw new Error('invalid-participant-request');
  }
  port.postMessage({
    type: 'HDB_COORDINATOR_PARTICIPANT_QUIESCENCE_RESULT',
    protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
    status: 'acknowledged',
    activationId: request.activationId,
    quiescenceRequestId: request.quiescenceRequestId,
    participantKind: request.participantKind,
    participantId: request.participantId,
    legacyYamlEntrypointsRevoked: true,
    ownedStorageHandlesClosed: true,
  });
  port.close();
}

function acknowledgeWindowOnly(message: unknown, port: MessagePort): void {
  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'HDB_COORDINATOR_SHARED_WORKER_RELAY_REQUEST'
  ) {
    return;
  }
  quiescenceAcknowledgement(message, port);
}

function createReadinessRequest(timeoutMs = 100): Record<string, unknown> {
  return {
    type: 'HDB_COORDINATOR_READINESS_REQUEST',
    protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
    requestId: 'request-1',
    timeoutMs,
  };
}

function createQuiescenceRequest(timeoutMs = 100): Record<string, unknown> {
  return {
    type: 'HDB_COORDINATOR_QUIESCENCE_START_REQUEST',
    protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
    activationId: 'activation-1',
    quiescenceRequestId: 'quiescence-1',
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
      capabilities: [
        ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
        ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
      ],
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
        capabilities: [
          ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
          ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
        ],
      }
    );

    expect(result).toMatchObject({ status: 'accepted', legacyYamlAccess: 'allowed' });
  });

  it('accepts a structurally valid HELLO from a different release', async () => {
    const source = createClient('window-1', 'window', `${REGISTRATION_SCOPE}tree`, () => {});
    const harness = createHarness([source]);
    harness.coordinator.install();
    harness.coordinator.listen();
    await dispatchExtendable(getListener(harness.listeners, 'install'));

    const result = await dispatchMessage(getListener(harness.listeners, 'message'), source, {
      type: 'HDB_COORDINATOR_HELLO',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      releaseId: OTHER_RELEASE_ID,
      capabilities: [
        ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
        ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
      ],
    });

    expect(result).toMatchObject({ status: 'accepted', legacyYamlAccess: 'allowed' });
  });

  it('counts compatible in-scope clients and excludes other paths and origins', async () => {
    const compatible = createClient(
      'window-1',
      'window',
      `${REGISTRATION_SCOPE}tree`,
      compatibleResponse
    );
    const sharedWorker = createClient(
      'shared-1',
      'sharedworker',
      `${REGISTRATION_SCOPE}shared.js`,
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
    const harness = createHarness([otherOrigin, otherPath, compatible, sharedWorker]);
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
      actualFenceEstablished: false,
      counts: {
        window: { compatible: 1, incompatible: 0, unresponsive: 0, discarded: 0 },
        worker: { compatible: 0, incompatible: 0, unresponsive: 0, discarded: 0 },
        sharedworker: { compatible: 1, incompatible: 0, unresponsive: 0, discarded: 0 },
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

  it('relays a SharedWorker census through a window instead of direct client messaging', async () => {
    const directSharedWorkerDispatch = vi.fn(() => {
      throw new Error('shared-worker-direct-dispatch-forbidden');
    });
    const windowClient = createClient(
      'window-1',
      'window',
      `${REGISTRATION_SCOPE}tree`,
      compatibleResponse
    );
    const sharedWorker = createClient(
      'shared-1',
      'sharedworker',
      `${REGISTRATION_SCOPE}shared.js`,
      directSharedWorkerDispatch
    );
    const harness = createHarness([windowClient, sharedWorker]);
    harness.coordinator.install();
    harness.coordinator.listen();
    await dispatchExtendable(getListener(harness.listeners, 'install'));

    await expect(
      dispatchMessage(
        getListener(harness.listeners, 'message'),
        windowClient,
        createReadinessRequest()
      )
    ).resolves.toMatchObject({
      status: 'accepted',
      counts: { sharedworker: { compatible: 1 } },
    });
    expect(directSharedWorkerDispatch).not.toHaveBeenCalled();
  });

  it('rejects duplicate exact SharedWorker URLs as incompatible relay targets', async () => {
    const windowClient = createClient(
      'window-1',
      'window',
      `${REGISTRATION_SCOPE}tree`,
      compatibleResponse
    );
    const sharedWorkerUrl = `${REGISTRATION_SCOPE}shared.js`;
    const first = createClient('shared-1', 'sharedworker', sharedWorkerUrl, compatibleResponse);
    const second = createClient('shared-2', 'sharedworker', sharedWorkerUrl, compatibleResponse);
    const harness = createHarness([windowClient, first, second]);
    harness.coordinator.install();
    harness.coordinator.listen();
    await dispatchExtendable(getListener(harness.listeners, 'install'));

    await expect(
      dispatchMessage(
        getListener(harness.listeners, 'message'),
        windowClient,
        createReadinessRequest()
      )
    ).resolves.toMatchObject({
      status: 'rejected',
      code: 'INCOMPATIBLE_CLIENT',
      counts: { sharedworker: { compatible: 0, incompatible: 2 } },
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

  it('accepts a client census response from a different release', async () => {
    const otherRelease = createClient(
      'shared-1',
      'sharedworker',
      `${REGISTRATION_SCOPE}shared.js`,
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
          capabilities: [
            ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
            ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
          ],
        });
        port.close();
      }
    );
    const windowClient = createClient(
      'window-1',
      'window',
      `${REGISTRATION_SCOPE}tree`,
      (message, port) => {
        const request = unwrapSharedWorkerRelay(message);
        if (
          typeof message === 'object' &&
          message !== null &&
          'type' in message &&
          message.type === 'HDB_COORDINATOR_SHARED_WORKER_RELAY_REQUEST' &&
          typeof request === 'object' &&
          request !== null &&
          'requestId' in request
        ) {
          port.postMessage({
            type: 'HDB_COORDINATOR_CENSUS_RESPONSE',
            protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
            requestId: request.requestId,
            releaseId: OTHER_RELEASE_ID,
            capabilities: [
              ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
              ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
            ],
          });
          port.close();
          return;
        }
        compatibleResponse(message, port);
      }
    );
    const harness = createHarness([windowClient, otherRelease]);
    harness.coordinator.install();
    harness.coordinator.listen();
    await dispatchExtendable(getListener(harness.listeners, 'install'));

    const result = await dispatchMessage(
      getListener(harness.listeners, 'message'),
      windowClient,
      createReadinessRequest()
    );

    expect(result).toMatchObject({
      status: 'accepted',
      counts: { sharedworker: { compatible: 1, incompatible: 0 } },
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

  it('persists the complete snapshot before dispatch and becomes ready after exact acknowledgements', async () => {
    const observedPhases: string[] = [];
    const respond = (message: unknown, port: MessagePort): void => {
      void readOriginCoordinatorStateDb(indexedDB).then((state) => {
        if (state.ok) observedPhases.push(state.state.phase);
        quiescenceAcknowledgement(message, port);
      });
    };
    const windowClient = createClient('window-1', 'window', `${REGISTRATION_SCOPE}tree`, respond);
    const sharedWorker = createClient(
      'shared-1',
      'sharedworker',
      `${REGISTRATION_SCOPE}shared.js`,
      respond
    );
    const harness = createHarness([sharedWorker, windowClient]);
    harness.coordinator.install();
    harness.coordinator.listen();
    await dispatchExtendable(getListener(harness.listeners, 'install'));

    const result = await dispatchMessage(
      getListener(harness.listeners, 'message'),
      windowClient,
      createQuiescenceRequest()
    );
    const durable = await readOriginCoordinatorStateDb(indexedDB);

    expect(observedPhases).toEqual(['revoked', 'revoked']);
    expect(result).toMatchObject({
      status: 'ready-for-preflight',
      actualFenceEstablished: false,
      progress: { participantCount: 2, acknowledgedCount: 2, discardedCount: 0 },
    });
    expect(durable).toMatchObject({
      ok: true,
      state: {
        phase: 'revoked',
        status: 'ready-for-preflight',
        participants: [
          { participantKind: 'tab', participantId: 'window-1' },
          { participantKind: 'worker', participantId: 'shared-1' },
        ],
      },
    });
  });

  it('does not dispatch participant messages when the initial durable transition fails', async () => {
    const respond = vi.fn(quiescenceAcknowledgement);
    const windowClient = createClient('window-1', 'window', `${REGISTRATION_SCOPE}tree`, respond);
    const harness = createHarness([windowClient], createFactoryThatFailsAfterOpen(1));
    harness.coordinator.install();
    harness.coordinator.listen();
    await dispatchExtendable(getListener(harness.listeners, 'install'));

    const result = await dispatchMessage(
      getListener(harness.listeners, 'message'),
      windowClient,
      createQuiescenceRequest()
    );

    expect(result).toEqual({
      type: 'HDB_COORDINATOR_QUIESCENCE_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      status: 'request-rejected',
      code: 'COORDINATOR_STORAGE_FAILED',
      actualFenceEstablished: false,
    });
    expect(respond).not.toHaveBeenCalled();
  });

  it('accepts discard only after clients.get successfully proves absence', async () => {
    const windowClient = createClient(
      'window-1',
      'window',
      `${REGISTRATION_SCOPE}tree`,
      acknowledgeWindowOnly
    );
    const discarded = createClient(
      'shared-1',
      'sharedworker',
      `${REGISTRATION_SCOPE}shared.js`,
      () => {}
    );
    const harness = createHarness([windowClient, discarded]);
    harness.getClient.mockImplementation(async (id: string) =>
      id === discarded.id ? undefined : windowClient
    );
    harness.coordinator.install();
    harness.coordinator.listen();
    await dispatchExtendable(getListener(harness.listeners, 'install'));

    const result = await dispatchMessage(
      getListener(harness.listeners, 'message'),
      windowClient,
      createQuiescenceRequest()
    );

    expect(result).toMatchObject({
      status: 'ready-for-preflight',
      progress: { acknowledgedCount: 1, discardedCount: 1 },
      actualFenceEstablished: false,
    });
  });

  it('rejects terminally when browser client lookup fails', async () => {
    const windowClient = createClient(
      'window-1',
      'window',
      `${REGISTRATION_SCOPE}tree`,
      acknowledgeWindowOnly
    );
    const lookupFailure = createClient(
      'shared-1',
      'sharedworker',
      `${REGISTRATION_SCOPE}shared.js`,
      () => {}
    );
    const harness = createHarness([windowClient, lookupFailure]);
    harness.getClient.mockImplementation(async (id: string) => {
      if (id === lookupFailure.id) throw new Error('secret-browser-failure');
      return windowClient;
    });
    harness.coordinator.install();
    harness.coordinator.listen();
    await dispatchExtendable(getListener(harness.listeners, 'install'));

    const result = await dispatchMessage(
      getListener(harness.listeners, 'message'),
      windowClient,
      createQuiescenceRequest(5)
    );

    expect(result).toEqual({
      type: 'HDB_COORDINATOR_QUIESCENCE_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      status: 'rejected',
      activationId: 'activation-1',
      quiescenceRequestId: 'quiescence-1',
      errorCode: 'CLIENT_LOOKUP_FAILED',
      errorStage: 'quiescing',
      actualFenceEstablished: false,
      progress: { participantCount: 2, acknowledgedCount: 1, discardedCount: 0 },
    });
  });

  it('rejects terminally when a participant cannot prove both revocation conditions', async () => {
    const incompleteEvidence = (message: unknown, port: MessagePort): void => {
      if (
        typeof message !== 'object' ||
        message === null ||
        !('activationId' in message) ||
        !('quiescenceRequestId' in message) ||
        !('participantKind' in message) ||
        !('participantId' in message)
      ) {
        throw new Error('invalid-participant-request');
      }
      port.postMessage({
        type: 'HDB_COORDINATOR_PARTICIPANT_QUIESCENCE_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        status: 'acknowledged',
        activationId: message.activationId,
        quiescenceRequestId: message.quiescenceRequestId,
        participantKind: message.participantKind,
        participantId: message.participantId,
        legacyYamlEntrypointsRevoked: true,
        ownedStorageHandlesClosed: false,
      });
      port.close();
    };
    const windowClient = createClient(
      'window-1',
      'window',
      `${REGISTRATION_SCOPE}tree`,
      incompleteEvidence
    );
    const harness = createHarness([windowClient]);
    harness.coordinator.install();
    harness.coordinator.listen();
    await dispatchExtendable(getListener(harness.listeners, 'install'));

    const result = await dispatchMessage(
      getListener(harness.listeners, 'message'),
      windowClient,
      createQuiescenceRequest()
    );

    expect(result).toEqual({
      type: 'HDB_COORDINATOR_QUIESCENCE_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      status: 'rejected',
      activationId: 'activation-1',
      quiescenceRequestId: 'quiescence-1',
      errorCode: 'LEGACY_FENCE_REJECTED',
      errorStage: 'quiescing',
      actualFenceEstablished: false,
      progress: { participantCount: 1, acknowledgedCount: 0, discardedCount: 0 },
    });
  });

  it('reconstructs the same ready decision from durable input and evidence after restart', async () => {
    const windowClient = createClient(
      'window-1',
      'window',
      `${REGISTRATION_SCOPE}tree`,
      quiescenceAcknowledgement
    );
    const first = createHarness([windowClient]);
    first.coordinator.install();
    first.coordinator.listen();
    await dispatchExtendable(getListener(first.listeners, 'install'));
    await expect(
      dispatchMessage(
        getListener(first.listeners, 'message'),
        windowClient,
        createQuiescenceRequest()
      )
    ).resolves.toMatchObject({ status: 'ready-for-preflight' });

    const restarted = createHarness([windowClient]);
    restarted.coordinator.listen();
    const result = await dispatchMessage(
      getListener(restarted.listeners, 'message'),
      windowClient,
      {
        type: 'HDB_COORDINATOR_QUIESCENCE_STATUS_REQUEST',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        activationId: 'activation-1',
        quiescenceRequestId: 'quiescence-1',
      }
    );

    expect(result).toEqual({
      type: 'HDB_COORDINATOR_QUIESCENCE_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      status: 'ready-for-preflight',
      activationId: 'activation-1',
      quiescenceRequestId: 'quiescence-1',
      actualFenceEstablished: false,
      progress: { participantCount: 1, acknowledgedCount: 1, discardedCount: 0 },
    });
  });

  it('reconstructs a leftover quiescing request as terminal restart rejection', async () => {
    const windowClient = createClient(
      'window-1',
      'window',
      `${REGISTRATION_SCOPE}tree`,
      quiescenceAcknowledgement
    );
    const first = createHarness([windowClient]);
    first.coordinator.install();
    await dispatchExtendable(getListener(first.listeners, 'install'));
    const transitioned = await transitionOriginCoordinatorStateDb(indexedDB, (state) =>
      state.phase === 'allowed'
        ? {
            key: state.key,
            protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
            phase: 'revoked',
            status: 'quiescing',
            activationId: 'activation-1',
            quiescenceRequestId: 'quiescence-1',
            participants: [{ participantKind: 'tab', participantId: 'window-1' }],
            evidence: [],
          }
        : null
    );
    expect(transitioned.ok).toBe(true);

    const restarted = createHarness([windowClient]);
    restarted.coordinator.listen();
    const result = await dispatchMessage(
      getListener(restarted.listeners, 'message'),
      windowClient,
      {
        type: 'HDB_COORDINATOR_QUIESCENCE_STATUS_REQUEST',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        activationId: 'activation-1',
        quiescenceRequestId: 'quiescence-1',
      }
    );

    expect(result).toMatchObject({
      status: 'rejected',
      errorCode: 'COORDINATOR_RESTARTED_DURING_QUIESCENCE',
      errorStage: 'reconstruction',
      actualFenceEstablished: false,
    });
  });
});
