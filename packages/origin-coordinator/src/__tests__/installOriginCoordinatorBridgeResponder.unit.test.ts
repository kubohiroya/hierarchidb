import { describe, expect, it, vi } from 'vitest';
import {
  ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
  ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
} from '../constants.js';
import { installOriginCoordinatorBridgeResponder } from '../installOriginCoordinatorBridgeResponder.js';
import { parseOriginCoordinatorSharedWorkerRelayRequest } from '../originCoordinatorProtocolValidatorUtils.js';
import type { OriginCoordinatorMessageTarget } from '../types.js';

const RELEASE_ID = '0123456789abcdef0123456789abcdef01234567';

interface ResponderHarness {
  readonly target: OriginCoordinatorMessageTarget;
  dispatch(data: unknown, port: MessagePort): void;
}

function createHarness(): ResponderHarness {
  let listener: ((event: MessageEvent<unknown>) => void) | null = null;
  return {
    target: {
      addEventListener(_type, nextListener): void {
        listener = nextListener;
      },
      removeEventListener(_type, currentListener): void {
        if (listener === currentListener) listener = null;
      },
    },
    dispatch(data, port): void {
      if (listener === null) throw new Error('responder-listener-missing');
      listener({ data, ports: [port] } as unknown as MessageEvent<unknown>);
    },
  };
}

function dispatchWithResponse(harness: ResponderHarness, data: unknown): Promise<unknown> {
  const channel = new MessageChannel();
  const response = new Promise<unknown>((resolve) => {
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      channel.port1.close();
      resolve(event.data);
    };
    channel.port1.start();
  });
  harness.dispatch(data, channel.port2);
  return response;
}

function createQuiescenceRequest() {
  return {
    type: 'HDB_COORDINATOR_PARTICIPANT_QUIESCENCE_REQUEST',
    protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
    activationId: 'activation-1',
    quiescenceRequestId: 'quiescence-1',
    participantKind: 'tab',
    participantId: 'client-1',
  } as const;
}

describe('installOriginCoordinatorBridgeResponder', () => {
  it('returns the exact protocol v2 capability tuple and client release evidence', async () => {
    const harness = createHarness();
    const responder = installOriginCoordinatorBridgeResponder({
      target: harness.target,
      releaseId: RELEASE_ID,
      revokeLegacyYamlAccess: vi.fn(),
    });

    await expect(
      dispatchWithResponse(harness, {
        type: 'HDB_COORDINATOR_CENSUS_PROBE',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        requestId: 'request-1',
      })
    ).resolves.toEqual({
      type: 'HDB_COORDINATOR_CENSUS_RESPONSE',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      requestId: 'request-1',
      releaseId: RELEASE_ID,
      capabilities: [
        ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
        ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
      ],
    });
    responder.uninstall();
    const channel = new MessageChannel();
    expect(() => harness.dispatch({}, channel.port2)).toThrow('responder-listener-missing');
    channel.port1.close();
    channel.port2.close();
  });

  it('revokes once, acknowledges exact evidence, and keeps the same identity idempotent', async () => {
    const harness = createHarness();
    const revokeLegacyYamlAccess = vi.fn(async () => {});
    const responder = installOriginCoordinatorBridgeResponder({
      target: harness.target,
      releaseId: RELEASE_ID,
      revokeLegacyYamlAccess,
    });
    const request = createQuiescenceRequest();

    const first = dispatchWithResponse(harness, request);
    expect(() => responder.assertLegacyYamlAccessAllowed()).toThrow(
      'origin-coordinator-legacy-yaml-access-revoked'
    );
    const second = dispatchWithResponse(harness, request);

    const expected = {
      type: 'HDB_COORDINATOR_PARTICIPANT_QUIESCENCE_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      status: 'acknowledged',
      activationId: request.activationId,
      quiescenceRequestId: request.quiescenceRequestId,
      participantKind: request.participantKind,
      participantId: request.participantId,
      legacyYamlEntrypointsRevoked: true,
      ownedStorageHandlesClosed: true,
    };
    await expect(first).resolves.toEqual(expected);
    await expect(second).resolves.toEqual(expected);
    expect(revokeLegacyYamlAccess).toHaveBeenCalledTimes(1);
  });

  it('fails a different identity after local revocation without invoking cleanup again', async () => {
    const harness = createHarness();
    const revokeLegacyYamlAccess = vi.fn();
    installOriginCoordinatorBridgeResponder({
      target: harness.target,
      releaseId: RELEASE_ID,
      revokeLegacyYamlAccess,
    });
    await dispatchWithResponse(harness, createQuiescenceRequest());
    const conflicting = { ...createQuiescenceRequest(), quiescenceRequestId: 'quiescence-2' };

    await expect(dispatchWithResponse(harness, conflicting)).resolves.toEqual({
      type: 'HDB_COORDINATOR_PARTICIPANT_QUIESCENCE_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      status: 'failed',
      activationId: conflicting.activationId,
      quiescenceRequestId: conflicting.quiescenceRequestId,
      participantKind: conflicting.participantKind,
      participantId: conflicting.participantId,
    });
    expect(revokeLegacyYamlAccess).toHaveBeenCalledTimes(1);
  });

  it('returns a sanitized failure when owned resource cleanup fails', async () => {
    const harness = createHarness();
    installOriginCoordinatorBridgeResponder({
      target: harness.target,
      releaseId: RELEASE_ID,
      revokeLegacyYamlAccess: () => {
        throw new Error('secret-storage-error');
      },
    });

    await expect(dispatchWithResponse(harness, createQuiescenceRequest())).resolves.toEqual({
      type: 'HDB_COORDINATOR_PARTICIPANT_QUIESCENCE_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      status: 'failed',
      activationId: 'activation-1',
      quiescenceRequestId: 'quiescence-1',
      participantKind: 'tab',
      participantId: 'client-1',
    });
  });

  it('forwards an exact SharedWorker relay without claiming the window gate', () => {
    const harness = createHarness();
    const relaySharedWorkerRequest = vi.fn();
    const responder = installOriginCoordinatorBridgeResponder({
      target: harness.target,
      releaseId: RELEASE_ID,
      relaySharedWorkerRequest,
      revokeLegacyYamlAccess: vi.fn(),
    });
    const channel = new MessageChannel();
    const relay = {
      type: 'HDB_COORDINATOR_SHARED_WORKER_RELAY_REQUEST',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      targetClientId: 'shared-client-1',
      targetClientUrl: 'https://example.test/hierarchidb/shared-worker.js',
      request: {
        type: 'HDB_COORDINATOR_CENSUS_PROBE',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        requestId: 'request-1',
      },
    } as const;

    harness.dispatch(relay, channel.port2);

    expect(relaySharedWorkerRequest).toHaveBeenCalledOnce();
    expect(relaySharedWorkerRequest.mock.calls[0]?.[0]).toEqual(relay);
    expect(relaySharedWorkerRequest.mock.calls[0]?.[1]).toBe(channel.port2);
    expect(() => responder.assertLegacyYamlAccessAllowed()).not.toThrow();
    channel.port1.close();
    channel.port2.close();
  });

  it('rejects a relay whose target identity and nested quiescence identity differ', () => {
    expect(
      parseOriginCoordinatorSharedWorkerRelayRequest({
        type: 'HDB_COORDINATOR_SHARED_WORKER_RELAY_REQUEST',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        targetClientId: 'shared-client-1',
        targetClientUrl: 'https://example.test/hierarchidb/shared-worker.js',
        request: {
          ...createQuiescenceRequest(),
          participantKind: 'worker',
          participantId: 'shared-client-2',
        },
      })
    ).toBeNull();
  });

  it('ignores malformed and accessor-backed requests without invoking getters', () => {
    const harness = createHarness();
    const revokeLegacyYamlAccess = vi.fn();
    installOriginCoordinatorBridgeResponder({
      target: harness.target,
      releaseId: RELEASE_ID,
      revokeLegacyYamlAccess,
    });
    const getter = vi.fn(() => 'secret');
    const request = createQuiescenceRequest() as Record<string, unknown>;
    Object.defineProperty(request, 'participantId', { get: getter });
    const postMessage = vi.fn();

    harness.dispatch(request, { postMessage, close: vi.fn() } as unknown as MessagePort);

    expect(getter).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
    expect(revokeLegacyYamlAccess).not.toHaveBeenCalled();
  });
});
