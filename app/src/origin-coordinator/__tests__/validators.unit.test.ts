import {
  isOriginCoordinatorReleaseId,
  ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
  ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
  ORIGIN_COORDINATOR_YAML_STATE_KEY,
} from '@hierarchidb/origin-coordinator';
import { describe, expect, it } from 'vitest';
import {
  parseOriginCoordinatorDurableState,
  parseOriginCoordinatorHelloRequest,
  parseOriginCoordinatorQuiescenceResult,
  parseOriginCoordinatorQuiescenceStartRequest,
  parseOriginCoordinatorQuiescenceStatusRequest,
  parseOriginCoordinatorReadinessRequest,
  parseOriginCoordinatorReadinessResult,
} from '../originCoordinatorValidatorUtils.js';

const RELEASE_ID = '0123456789abcdef0123456789abcdef01234567';

function createHelloRequest(): Record<string, unknown> {
  return {
    type: 'HDB_COORDINATOR_HELLO',
    protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
    releaseId: RELEASE_ID,
    capabilities: [
      ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
      ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
    ],
  };
}

function createCounts(): Record<string, Record<string, number>> {
  return {
    window: { compatible: 1, incompatible: 0, unresponsive: 0, discarded: 0 },
    worker: { compatible: 0, incompatible: 0, unresponsive: 0, discarded: 0 },
    sharedworker: { compatible: 0, incompatible: 0, unresponsive: 0, discarded: 0 },
  };
}

describe('origin coordinator validators', () => {
  it('accepts only an exact lowercase full source SHA', () => {
    expect(isOriginCoordinatorReleaseId(RELEASE_ID)).toBe(true);
    expect(isOriginCoordinatorReleaseId(RELEASE_ID.toUpperCase())).toBe(false);
    expect(isOriginCoordinatorReleaseId(RELEASE_ID.slice(1))).toBe(false);
    expect(isOriginCoordinatorReleaseId(`${RELEASE_ID}0`)).toBe(false);
  });

  it('canonicalizes an exact HELLO request', () => {
    expect(parseOriginCoordinatorHelloRequest(createHelloRequest())).toEqual({
      type: 'HDB_COORDINATOR_HELLO',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      releaseId: RELEASE_ID,
      capabilities: [
        ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
        ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
      ],
    });
  });

  it('rejects extra and symbol properties', () => {
    expect(
      parseOriginCoordinatorHelloRequest({ ...createHelloRequest(), legacyName: 'coordinator' })
    ).toBeNull();
    const withSymbol = createHelloRequest();
    withSymbol[Symbol('unexpected')] = true;
    expect(parseOriginCoordinatorHelloRequest(withSymbol)).toBeNull();
  });

  it.each([
    [ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY, ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY],
    [ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY],
    [
      ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
      ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
      'unexpected-capability',
    ],
  ])('rejects a non-exact bridge capability tuple: %j', (...capabilities) => {
    expect(
      parseOriginCoordinatorHelloRequest({ ...createHelloRequest(), capabilities })
    ).toBeNull();
  });

  it('rejects an accessor without invoking its getter', () => {
    let getterCalls = 0;
    const request = createHelloRequest();
    Object.defineProperty(request, 'releaseId', {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return RELEASE_ID;
      },
    });

    expect(parseOriginCoordinatorHelloRequest(request)).toBeNull();
    expect(getterCalls).toBe(0);
  });

  it.each([0, -1, 1.5, 30_001, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid explicit census timeout: %s',
    (timeoutMs) => {
      expect(
        parseOriginCoordinatorReadinessRequest({
          type: 'HDB_COORDINATOR_READINESS_REQUEST',
          protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
          requestId: 'request-1',
          timeoutMs,
        })
      ).toBeNull();
    }
  );

  it('rejects non-integral and extra readiness counts', () => {
    const fractional = createCounts();
    fractional.window.compatible = 0.5;
    expect(
      parseOriginCoordinatorReadinessResult({
        type: 'HDB_COORDINATOR_READINESS_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        requestId: 'request-1',
        status: 'accepted',
        actualFenceEstablished: false,
        counts: fractional,
      })
    ).toBeNull();

    const extra = createCounts();
    extra.window.unknown = 0;
    expect(
      parseOriginCoordinatorReadinessResult({
        type: 'HDB_COORDINATOR_READINESS_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        requestId: 'request-1',
        status: 'accepted',
        actualFenceEstablished: false,
        counts: extra,
      })
    ).toBeNull();
  });

  it('accepts only deterministic durable participants and matching evidence', () => {
    const valid = {
      key: ORIGIN_COORDINATOR_YAML_STATE_KEY,
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      phase: 'revoked',
      status: 'quiescing',
      activationId: 'activation-1',
      quiescenceRequestId: 'quiescence-1',
      participants: [
        { participantKind: 'tab', participantId: 'window-1' },
        { participantKind: 'worker', participantId: 'worker-1' },
      ],
      evidence: [
        {
          participantKind: 'tab',
          participantId: 'window-1',
          outcome: 'acknowledged',
        },
      ],
    };

    expect(parseOriginCoordinatorDurableState(valid)).toEqual(valid);
    expect(
      parseOriginCoordinatorDurableState({
        ...valid,
        participants: [...valid.participants].reverse(),
      })
    ).toBeNull();
    expect(
      parseOriginCoordinatorDurableState({
        ...valid,
        participants: [valid.participants[0], valid.participants[0]],
      })
    ).toBeNull();
    expect(
      parseOriginCoordinatorDurableState({
        ...valid,
        evidence: [{ ...valid.evidence[0], participantKind: 'worker' }],
      })
    ).toBeNull();
    expect(
      parseOriginCoordinatorDurableState({
        ...valid,
        evidence: [{ ...valid.evidence[0], legacyName: 'window' }],
      })
    ).toBeNull();
    expect(
      parseOriginCoordinatorDurableState({
        ...valid,
        status: 'ready-for-preflight',
      })
    ).toBeNull();
  });

  it('rejects non-exact quiescence requests and impossible result progress', () => {
    const start = {
      type: 'HDB_COORDINATOR_QUIESCENCE_START_REQUEST',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      activationId: 'activation-1',
      quiescenceRequestId: 'quiescence-1',
      timeoutMs: 100,
    };
    const status = {
      type: 'HDB_COORDINATOR_QUIESCENCE_STATUS_REQUEST',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      activationId: 'activation-1',
      quiescenceRequestId: 'quiescence-1',
    };

    expect(parseOriginCoordinatorQuiescenceStartRequest(start)).toEqual(start);
    expect(
      parseOriginCoordinatorQuiescenceStartRequest({ ...start, legacyName: 'request' })
    ).toBeNull();
    expect(parseOriginCoordinatorQuiescenceStatusRequest(status)).toEqual(status);
    expect(
      parseOriginCoordinatorQuiescenceStatusRequest({ ...status, quiescenceRequestId: '' })
    ).toBeNull();
    expect(
      parseOriginCoordinatorQuiescenceResult({
        type: 'HDB_COORDINATOR_QUIESCENCE_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        status: 'ready-for-preflight',
        activationId: 'activation-1',
        quiescenceRequestId: 'quiescence-1',
        actualFenceEstablished: false,
        progress: { participantCount: 2, acknowledgedCount: 1, discardedCount: 0 },
      })
    ).toBeNull();
    expect(
      parseOriginCoordinatorQuiescenceResult({
        type: 'HDB_COORDINATOR_QUIESCENCE_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        status: 'quiescing',
        activationId: 'activation-1',
        quiescenceRequestId: 'quiescence-1',
        actualFenceEstablished: false,
        progress: { participantCount: 1, acknowledgedCount: 1, discardedCount: 0 },
      })
    ).toBeNull();
  });
});
