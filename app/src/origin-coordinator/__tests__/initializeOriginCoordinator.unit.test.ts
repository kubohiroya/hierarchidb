import {
  ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
} from '@hierarchidb/origin-coordinator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RELEASE_ID = '0123456789abcdef0123456789abcdef01234567';

interface ServiceWorkerHarness {
  readonly serviceWorkerContainer: ServiceWorkerContainer;
  readonly register: ReturnType<typeof vi.fn>;
  readonly addEventListener: ReturnType<typeof vi.fn>;
  readonly order: string[];
}

function createServiceWorkerHarness(
  respond: (message: unknown, port: MessagePort) => void
): ServiceWorkerHarness {
  const order: string[] = [];
  const activeWorker = {
    state: 'activated',
    postMessage(message: unknown, transfer?: Transferable[]): void {
      const port = transfer?.[0];
      if (!(port instanceof MessagePort)) throw new Error('missing-response-port');
      order.push(
        typeof message === 'object' && message !== null && 'type' in message
          ? String(message.type)
          : 'unknown-message'
      );
      respond(message, port);
    },
  } as unknown as ServiceWorker;
  const registration = {
    active: activeWorker,
    installing: null,
    waiting: null,
  } as unknown as ServiceWorkerRegistration;
  const register = vi.fn(async () => {
    order.push('register');
    return registration;
  });
  const addEventListener = vi.fn(() => {
    order.push('responder-installed');
  });
  const serviceWorkerContainer = {
    register,
    addEventListener,
    removeEventListener: vi.fn(),
  } as unknown as ServiceWorkerContainer;
  return { serviceWorkerContainer, register, addEventListener, order };
}

function getRequestId(message: unknown): string {
  if (
    typeof message === 'object' &&
    message !== null &&
    'requestId' in message &&
    typeof message.requestId === 'string'
  ) {
    return message.requestId;
  }
  throw new Error('request-id-missing');
}

function createOptions() {
  return {
    releaseId: RELEASE_ID,
    registrationUrl: `${window.location.origin}/hierarchidb/hdb-origin-coordinator.js`,
    scope: `${window.location.origin}/hierarchidb/`,
    activeWorkerTimeoutMs: 100,
    messageTimeoutMs: 100,
    relaySharedWorkerRequest: vi.fn(),
    revokeLegacyYamlAccess: vi.fn(),
  } as const;
}

describe('initializeOriginCoordinator', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('installs the responder only after accepted HELLO and returns strict readiness', async () => {
    const harness = createServiceWorkerHarness((message, port) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'HDB_COORDINATOR_HELLO'
      ) {
        port.postMessage({
          type: 'HDB_COORDINATOR_HELLO_RESULT',
          protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
          status: 'accepted',
          legacyYamlAccess: 'allowed',
        });
      } else {
        port.postMessage({
          type: 'HDB_COORDINATOR_READINESS_RESULT',
          protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
          requestId: getRequestId(message),
          status: 'accepted',
          actualFenceEstablished: false,
          counts: {
            window: { compatible: 1, incompatible: 0, unresponsive: 0, discarded: 0 },
            worker: { compatible: 0, incompatible: 0, unresponsive: 0, discarded: 0 },
            sharedworker: {
              compatible: 0,
              incompatible: 0,
              unresponsive: 0,
              discarded: 0,
            },
          },
        });
      }
      port.close();
    });
    vi.stubGlobal('navigator', { serviceWorker: harness.serviceWorkerContainer });
    const { initializeOriginCoordinator } = await import('../initializeOriginCoordinator.js');

    const gate = await initializeOriginCoordinator(createOptions());
    if (gate.status !== 'activation-allowed') throw new Error('activation-gate-missing');
    const handle = gate.coordinator;
    const readiness = await handle.getReadiness({ requestId: 'request-1', timeoutMs: 100 });

    expect(harness.register).toHaveBeenCalledWith(
      createOptions().registrationUrl,
      expect.objectContaining({
        scope: createOptions().scope,
        type: 'module',
        updateViaCache: 'none',
      })
    );
    expect(harness.order).toEqual([
      'register',
      'HDB_COORDINATOR_HELLO',
      'responder-installed',
      'HDB_COORDINATOR_READINESS_REQUEST',
    ]);
    expect(readiness.status).toBe('accepted');
    expect(harness.addEventListener).toHaveBeenCalledOnce();
  });

  it('sends strict quiescence start and status queries through the accepted handle', async () => {
    const harness = createServiceWorkerHarness((message, port) => {
      if (typeof message !== 'object' || message === null || !('type' in message)) {
        throw new Error('invalid-request');
      }
      if (message.type === 'HDB_COORDINATOR_HELLO') {
        port.postMessage({
          type: 'HDB_COORDINATOR_HELLO_RESULT',
          protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
          status: 'accepted',
          legacyYamlAccess: 'allowed',
        });
      } else if (
        message.type === 'HDB_COORDINATOR_QUIESCENCE_START_REQUEST' ||
        message.type === 'HDB_COORDINATOR_QUIESCENCE_STATUS_REQUEST'
      ) {
        port.postMessage({
          type: 'HDB_COORDINATOR_QUIESCENCE_RESULT',
          protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
          status: 'ready-for-preflight',
          activationId: 'activation-1',
          quiescenceRequestId: 'quiescence-1',
          actualFenceEstablished: false,
          progress: { participantCount: 2, acknowledgedCount: 1, discardedCount: 1 },
        });
      } else {
        throw new Error('unexpected-request');
      }
      port.close();
    });
    vi.stubGlobal('navigator', { serviceWorker: harness.serviceWorkerContainer });
    const { initializeOriginCoordinator } = await import('../initializeOriginCoordinator.js');
    const gate = await initializeOriginCoordinator(createOptions());
    if (gate.status !== 'activation-allowed') throw new Error('activation-gate-missing');
    const handle = gate.coordinator;

    await expect(
      handle.startQuiescence({
        activationId: 'activation-1',
        quiescenceRequestId: 'quiescence-1',
        timeoutMs: 100,
      })
    ).resolves.toMatchObject({ status: 'ready-for-preflight', actualFenceEstablished: false });
    await expect(
      handle.getQuiescenceStatus({
        activationId: 'activation-1',
        quiescenceRequestId: 'quiescence-1',
      })
    ).resolves.toMatchObject({ status: 'ready-for-preflight', actualFenceEstablished: false });
    expect(harness.order).toEqual([
      'register',
      'HDB_COORDINATOR_HELLO',
      'responder-installed',
      'HDB_COORDINATOR_QUIESCENCE_START_REQUEST',
      'HDB_COORDINATOR_QUIESCENCE_STATUS_REQUEST',
    ]);
  });

  it('does not install a responder or continue after HELLO rejection', async () => {
    const harness = createServiceWorkerHarness((_message, port) => {
      port.postMessage({
        type: 'HDB_COORDINATOR_HELLO_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        status: 'rejected',
        code: 'INVALID_DURABLE_STATE',
      });
      port.close();
    });
    vi.stubGlobal('navigator', { serviceWorker: harness.serviceWorkerContainer });
    const { initializeOriginCoordinator } = await import('../initializeOriginCoordinator.js');

    await expect(initializeOriginCoordinator(createOptions())).rejects.toMatchObject({
      code: 'HELLO_REJECTED',
    });
    expect(harness.order).toEqual(['register', 'HDB_COORDINATOR_HELLO']);
    expect(harness.addEventListener).not.toHaveBeenCalled();
  });

  it('returns strict canonical successor evidence for the durable revoked gate', async () => {
    const harness = createServiceWorkerHarness((_message, port) => {
      port.postMessage({
        type: 'HDB_COORDINATOR_HELLO_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        status: 'rejected',
        code: 'LEGACY_YAML_ACCESS_REVOKED',
      });
      port.close();
    });
    vi.stubGlobal('navigator', { serviceWorker: harness.serviceWorkerContainer });
    const { initializeOriginCoordinator } = await import('../initializeOriginCoordinator.js');

    await expect(initializeOriginCoordinator(createOptions())).resolves.toEqual({
      status: 'canonical-revoked',
      coordinatorGate: 'revoked-ready-for-preflight',
      helloCode: 'LEGACY_YAML_ACCESS_REVOKED',
    });
    expect(harness.order).toEqual(['register', 'HDB_COORDINATOR_HELLO']);
    expect(harness.addEventListener).not.toHaveBeenCalled();
  });

  it('makes a missing HELLO response a visible timeout failure', async () => {
    const harness = createServiceWorkerHarness(() => {});
    vi.stubGlobal('navigator', { serviceWorker: harness.serviceWorkerContainer });
    const { initializeOriginCoordinator } = await import('../initializeOriginCoordinator.js');

    await expect(
      initializeOriginCoordinator({ ...createOptions(), messageTimeoutMs: 1 })
    ).rejects.toMatchObject({ code: 'MESSAGE_TIMEOUT' });
    expect(harness.addEventListener).not.toHaveBeenCalled();
  });

  it('sanitizes a native registration rejection', async () => {
    const harness = createServiceWorkerHarness(() => {});
    harness.register.mockRejectedValue(
      new Error('registration failed for https://example.test/private-endpoint')
    );
    vi.stubGlobal('navigator', { serviceWorker: harness.serviceWorkerContainer });
    const { initializeOriginCoordinator } = await import('../initializeOriginCoordinator.js');

    await expect(initializeOriginCoordinator(createOptions())).rejects.toMatchObject({
      code: 'REGISTRATION_FAILED',
      message: 'Origin coordinator failed: REGISTRATION_FAILED',
    });
    expect(harness.addEventListener).not.toHaveBeenCalled();
  });

  it('rejects invalid capabilities returned by the coordinator', async () => {
    const harness = createServiceWorkerHarness((_message, port) => {
      port.postMessage({
        type: 'HDB_COORDINATOR_HELLO_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        status: 'accepted',
        legacyYamlAccess: 'allowed',
        capabilities: [ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY],
      });
      port.close();
    });
    vi.stubGlobal('navigator', { serviceWorker: harness.serviceWorkerContainer });
    const { initializeOriginCoordinator } = await import('../initializeOriginCoordinator.js');

    await expect(initializeOriginCoordinator(createOptions())).rejects.toMatchObject({
      code: 'INVALID_COORDINATOR_RESPONSE',
    });
    expect(harness.addEventListener).not.toHaveBeenCalled();
  });
});
