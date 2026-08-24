import { describe, expect, it } from 'vitest';
import {
  getYamlStorageAccessDecision,
  isYamlStorageActualFenceEstablished,
} from '../getYamlStorageAccessDecision.js';
import {
  createYamlStorageActivation,
  createYamlStorageFreshActivation,
  reduceYamlStorageActivation,
} from '../reduceYamlStorageActivation.js';
import {
  YamlStorageAccessRequest,
  YamlStorageActivationErrorCode,
  YamlStorageActivationEvent,
  YamlStorageActivationPhase,
  YamlStorageActivationState,
} from '../yamlStorageActivationTypes.js';

const ACTIVATION_ID = 'activation-1';
const OPEN_REQUEST_ID = 'open-1';

function createInitialState(): YamlStorageActivationState {
  const result = createYamlStorageActivation({
    activationId: ACTIVATION_ID,
    currentVersion: 1,
    targetVersion: 2,
  });
  if (result.ok === false) {
    throw new Error(result.error.code);
  }
  return result.state;
}

function advanceToOpeningTarget(): YamlStorageActivationState {
  const preflight = reduceYamlStorageActivation(createInitialState(), {
    type: 'quiescing-completed',
    activationId: ACTIVATION_ID,
  });
  return reduceYamlStorageActivation(preflight, {
    type: 'preflight-completed',
    activationId: ACTIVATION_ID,
    openRequestId: OPEN_REQUEST_ID,
  });
}

function advanceToCanonicalReady(): YamlStorageActivationState {
  const versionchanging = reduceYamlStorageActivation(advanceToOpeningTarget(), {
    type: 'versionchange-started',
    activationId: ACTIVATION_ID,
    openRequestId: OPEN_REQUEST_ID,
  });
  const initializing = reduceYamlStorageActivation(versionchanging, {
    type: 'upgrade-committed',
    activationId: ACTIVATION_ID,
    openRequestId: OPEN_REQUEST_ID,
  });
  return reduceYamlStorageActivation(initializing, {
    type: 'initialization-succeeded',
    activationId: ACTIVATION_ID,
    openRequestId: OPEN_REQUEST_ID,
  });
}

function createEveryPhase(): readonly YamlStorageActivationState[] {
  const quiescing = createInitialState();
  const preflight = reduceYamlStorageActivation(quiescing, {
    type: 'quiescing-completed',
    activationId: ACTIVATION_ID,
  });
  const openingTarget = reduceYamlStorageActivation(preflight, {
    type: 'preflight-completed',
    activationId: ACTIVATION_ID,
    openRequestId: OPEN_REQUEST_ID,
  });
  const blocked = reduceYamlStorageActivation(openingTarget, {
    type: 'target-open-blocked',
    activationId: ACTIVATION_ID,
    openRequestId: OPEN_REQUEST_ID,
  });
  const versionchanging = reduceYamlStorageActivation(openingTarget, {
    type: 'versionchange-started',
    activationId: ACTIVATION_ID,
    openRequestId: OPEN_REQUEST_ID,
  });
  const initializing = reduceYamlStorageActivation(versionchanging, {
    type: 'upgrade-committed',
    activationId: ACTIVATION_ID,
    openRequestId: OPEN_REQUEST_ID,
  });
  const canonicalReady = reduceYamlStorageActivation(initializing, {
    type: 'initialization-succeeded',
    activationId: ACTIVATION_ID,
    openRequestId: OPEN_REQUEST_ID,
  });
  const rejected = reduceYamlStorageActivation(openingTarget, {
    type: 'activation-rejected',
    activationId: ACTIVATION_ID,
    openRequestId: OPEN_REQUEST_ID,
    stage: 'opening-target',
  });
  return Object.freeze([
    quiescing,
    preflight,
    openingTarget,
    blocked,
    versionchanging,
    initializing,
    canonicalReady,
    rejected,
  ]);
}

const EVENT_TYPES = [
  'quiescing-completed',
  'preflight-completed',
  'target-open-blocked',
  'versionchange-started',
  'upgrade-committed',
  'initialization-succeeded',
  'activation-rejected',
] as const satisfies readonly YamlStorageActivationEvent['type'][];

const FAILURE_CODES = {
  quiescing: 'QUIESCING_FAILED',
  preflight: 'PREFLIGHT_FAILED',
  'opening-target': 'TARGET_OPEN_FAILED',
  blocked: 'TARGET_OPEN_FAILED',
  versionchanging: 'UPGRADE_FAILED',
  initializing: 'INITIALIZATION_FAILED',
} as const satisfies Readonly<
  Record<
    Exclude<YamlStorageActivationPhase, 'canonical-ready' | 'rejected'>,
    YamlStorageActivationErrorCode
  >
>;

const VALID_TRANSITIONS = {
  quiescing: { 'quiescing-completed': 'preflight' },
  preflight: { 'preflight-completed': 'opening-target' },
  'opening-target': {
    'target-open-blocked': 'blocked',
    'versionchange-started': 'versionchanging',
  },
  blocked: { 'versionchange-started': 'versionchanging' },
  versionchanging: { 'upgrade-committed': 'initializing' },
  initializing: { 'initialization-succeeded': 'canonical-ready' },
  'canonical-ready': {},
} as const satisfies Readonly<
  Record<
    Exclude<YamlStorageActivationPhase, 'rejected'>,
    Partial<Record<YamlStorageActivationEvent['type'], YamlStorageActivationPhase>>
  >
>;

function createEventForPhase(
  type: YamlStorageActivationEvent['type'],
  phase: YamlStorageActivationPhase
): YamlStorageActivationEvent {
  switch (type) {
    case 'quiescing-completed':
      return { type, activationId: ACTIVATION_ID };
    case 'activation-rejected':
      if (phase === 'quiescing' || phase === 'preflight') {
        return { type, activationId: ACTIVATION_ID, stage: phase };
      }
      return {
        type,
        activationId: ACTIVATION_ID,
        openRequestId: OPEN_REQUEST_ID,
        stage:
          phase === 'opening-target' ||
          phase === 'blocked' ||
          phase === 'versionchanging' ||
          phase === 'initializing'
            ? phase
            : 'initializing',
      };
    default:
      return { type, activationId: ACTIVATION_ID, openRequestId: OPEN_REQUEST_ID };
  }
}

describe('createYamlStorageActivation', () => {
  it.each([
    [{ activationId: '', currentVersion: 1, targetVersion: 2 }, 'INVALID_ACTIVATION_ID'],
    [
      { activationId: ACTIVATION_ID, currentVersion: 0, targetVersion: 2 },
      'INVALID_CURRENT_VERSION',
    ],
    [
      { activationId: ACTIVATION_ID, currentVersion: 1, targetVersion: 1.5 },
      'INVALID_TARGET_VERSION',
    ],
    [{ activationId: ACTIVATION_ID, currentVersion: 2, targetVersion: 2 }, 'INVALID_VERSION_RANGE'],
  ] as const)('rejects invalid explicit input with stable code', (input, code) => {
    const result = createYamlStorageActivation(input);

    if (result.ok === true) {
      throw new Error('expected invalid activation input');
    }
    expect(result).toEqual({ ok: false, error: { code, stage: 'input' } });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.error)).toBe(true);
  });

  it('creates an immutable quiescing state without defaulting the target version', () => {
    const result = createYamlStorageActivation({
      activationId: ACTIVATION_ID,
      currentVersion: 3,
      targetVersion: 5,
    });

    expect(result).toEqual({
      ok: true,
      state: {
        phase: 'quiescing',
        activationId: ACTIVATION_ID,
        currentVersion: 3,
        targetVersion: 5,
      },
    });
    expect(result.ok && Object.isFrozen(result.state)).toBe(true);
  });

  it('issues currentVersion zero only through the explicit fresh-activation factory', () => {
    const created = createYamlStorageFreshActivation({
      activationId: ACTIVATION_ID,
      targetVersion: 2,
    });
    expect(created).toMatchObject({
      ok: true,
      state: { phase: 'quiescing', currentVersion: 0, targetVersion: 2 },
    });
    if (!created.ok) throw new Error('fresh-activation-create-failed');
    let state = reduceYamlStorageActivation(created.state, {
      type: 'quiescing-completed',
      activationId: ACTIVATION_ID,
    });
    state = reduceYamlStorageActivation(state, {
      type: 'preflight-completed',
      activationId: ACTIVATION_ID,
      openRequestId: OPEN_REQUEST_ID,
    });
    state = reduceYamlStorageActivation(state, {
      type: 'versionchange-started',
      activationId: ACTIVATION_ID,
      openRequestId: OPEN_REQUEST_ID,
    });
    state = reduceYamlStorageActivation(state, {
      type: 'upgrade-committed',
      activationId: ACTIVATION_ID,
      openRequestId: OPEN_REQUEST_ID,
    });
    state = reduceYamlStorageActivation(state, {
      type: 'initialization-succeeded',
      activationId: ACTIVATION_ID,
      openRequestId: OPEN_REQUEST_ID,
    });

    expect(state).toMatchObject({
      phase: 'canonical-ready',
      currentVersion: 0,
      readinessProof: 'same-activation-fresh-create',
    });
  });
});

describe('reduceYamlStorageActivation', () => {
  it('advances through the only valid direct path to canonical-ready', () => {
    const ready = advanceToCanonicalReady();

    expect(ready).toMatchObject({
      phase: 'canonical-ready',
      activationId: ACTIVATION_ID,
      openRequestId: OPEN_REQUEST_ID,
      upgradeCommitted: true,
      initializationSucceeded: true,
      readinessProof: 'same-activation-upgrade',
    });
    expect(Object.isFrozen(ready)).toBe(true);
    expect(isYamlStorageActualFenceEstablished(ready)).toBe(true);
  });

  it('resumes blocked target opening only with the same open request', () => {
    const blocked = reduceYamlStorageActivation(advanceToOpeningTarget(), {
      type: 'target-open-blocked',
      activationId: ACTIVATION_ID,
      openRequestId: OPEN_REQUEST_ID,
    });
    expect(blocked.phase).toBe('blocked');
    expect(isYamlStorageActualFenceEstablished(blocked)).toBe(false);

    const resumed = reduceYamlStorageActivation(blocked, {
      type: 'versionchange-started',
      activationId: ACTIVATION_ID,
      openRequestId: OPEN_REQUEST_ID,
    });
    expect(resumed.phase).toBe('versionchanging');
    expect(isYamlStorageActualFenceEstablished(resumed)).toBe(true);
  });

  it('terminally rejects a different request after blocked', () => {
    const blocked = reduceYamlStorageActivation(advanceToOpeningTarget(), {
      type: 'target-open-blocked',
      activationId: ACTIVATION_ID,
      openRequestId: OPEN_REQUEST_ID,
    });
    const rejected = reduceYamlStorageActivation(blocked, {
      type: 'versionchange-started',
      activationId: ACTIVATION_ID,
      openRequestId: 'open-2',
    });

    expect(rejected).toMatchObject({
      phase: 'rejected',
      actualFenceEstablished: false,
      error: { code: 'OPEN_REQUEST_ID_MISMATCH', stage: 'blocked' },
    });
    const afterTerminalEvent = reduceYamlStorageActivation(rejected, {
      type: 'versionchange-started',
      activationId: ACTIVATION_ID,
      openRequestId: OPEN_REQUEST_ID,
    });
    expect(afterTerminalEvent).toBe(rejected);
  });

  it('fails closed for activation mismatch and illegal transition', () => {
    const activationMismatch = reduceYamlStorageActivation(createInitialState(), {
      type: 'quiescing-completed',
      activationId: 'activation-2',
    });
    expect(activationMismatch).toMatchObject({
      phase: 'rejected',
      error: { code: 'ACTIVATION_ID_MISMATCH', stage: 'quiescing' },
    });

    const illegal = reduceYamlStorageActivation(createInitialState(), {
      type: 'upgrade-committed',
      activationId: ACTIVATION_ID,
      openRequestId: OPEN_REQUEST_ID,
    });
    expect(illegal).toMatchObject({
      phase: 'rejected',
      error: { code: 'ILLEGAL_TRANSITION', stage: 'quiescing' },
    });
  });

  it('rejects an empty open request identifier before target opening', () => {
    const preflight = reduceYamlStorageActivation(createInitialState(), {
      type: 'quiescing-completed',
      activationId: ACTIVATION_ID,
    });
    const rejected = reduceYamlStorageActivation(preflight, {
      type: 'preflight-completed',
      activationId: ACTIVATION_ID,
      openRequestId: '',
    });

    expect(rejected).toMatchObject({
      phase: 'rejected',
      error: { code: 'INVALID_OPEN_REQUEST_ID', stage: 'preflight' },
    });
  });

  it('retains an established actual fence when upgrade rejects', () => {
    const versionchanging = reduceYamlStorageActivation(advanceToOpeningTarget(), {
      type: 'versionchange-started',
      activationId: ACTIVATION_ID,
      openRequestId: OPEN_REQUEST_ID,
    });
    const rejected = reduceYamlStorageActivation(versionchanging, {
      type: 'activation-rejected',
      activationId: ACTIVATION_ID,
      openRequestId: OPEN_REQUEST_ID,
      stage: 'versionchanging',
    });

    expect(rejected).toMatchObject({
      phase: 'rejected',
      actualFenceEstablished: true,
      error: { code: 'UPGRADE_FAILED', stage: 'versionchanging' },
    });
    expect(isYamlStorageActualFenceEstablished(rejected)).toBe(true);
  });

  it('keeps only a stable code and stage for an explicit rejection', () => {
    const rejected = reduceYamlStorageActivation(advanceToOpeningTarget(), {
      type: 'activation-rejected',
      activationId: ACTIVATION_ID,
      openRequestId: OPEN_REQUEST_ID,
      stage: 'opening-target',
    });

    expect(rejected).toMatchObject({
      phase: 'rejected',
      error: { code: 'TARGET_OPEN_FAILED', stage: 'opening-target' },
    });
    if (rejected.phase !== 'rejected') {
      throw new Error('expected rejected state');
    }
    expect(Object.keys(rejected.error)).toEqual(['code', 'stage']);
    expect(Object.isFrozen(rejected.error)).toBe(true);
  });

  it.each(
    createEveryPhase().flatMap((state) =>
      EVENT_TYPES.map((eventType) => ({
        phase: state.phase,
        state,
        eventType,
      }))
    )
  )('covers the $phase × $eventType transition', ({ phase, state, eventType }) => {
    const event = createEventForPhase(eventType, phase);
    const next = reduceYamlStorageActivation(state, event);

    if (phase === 'rejected') {
      expect(next).toBe(state);
      return;
    }

    if (eventType === 'activation-rejected' && phase in FAILURE_CODES) {
      expect(next).toMatchObject({
        phase: 'rejected',
        error: {
          code: FAILURE_CODES[phase as keyof typeof FAILURE_CODES],
          stage: phase,
        },
      });
      expect(Object.isFrozen(next)).toBe(true);
      return;
    }

    const expectedPhase = VALID_TRANSITIONS[phase][
      eventType as keyof (typeof VALID_TRANSITIONS)[typeof phase]
    ] as YamlStorageActivationPhase | undefined;
    if (expectedPhase !== undefined) {
      expect(next.phase).toBe(expectedPhase);
      expect(Object.isFrozen(next)).toBe(true);
      return;
    }

    expect(next).toMatchObject({
      phase: 'rejected',
      error: { code: 'ILLEGAL_TRANSITION', stage: phase },
    });
    expect(Object.isFrozen(next)).toBe(true);
  });

  it.each(
    createEveryPhase().filter(
      (state): state is Exclude<YamlStorageActivationState, { readonly phase: 'rejected' }> =>
        state.phase !== 'rejected'
    )
  )('rejects an activation ID mismatch from $phase', (state) => {
    const rejected = reduceYamlStorageActivation(state, {
      type: 'quiescing-completed',
      activationId: 'activation-mismatch',
    });

    expect(rejected).toMatchObject({
      phase: 'rejected',
      actualFenceEstablished:
        state.phase === 'versionchanging' ||
        state.phase === 'initializing' ||
        state.phase === 'canonical-ready',
      error: { code: 'ACTIVATION_ID_MISMATCH', stage: state.phase },
    });
  });

  it.each(
    createEveryPhase().filter(
      (state): state is Extract<YamlStorageActivationState, { readonly openRequestId: string }> =>
        state.phase === 'opening-target' ||
        state.phase === 'blocked' ||
        state.phase === 'versionchanging' ||
        state.phase === 'initializing' ||
        state.phase === 'canonical-ready'
    )
  )('rejects an open request ID mismatch from $phase', (state) => {
    const rejected = reduceYamlStorageActivation(state, {
      type: 'versionchange-started',
      activationId: ACTIVATION_ID,
      openRequestId: 'open-mismatch',
    });

    expect(rejected).toMatchObject({
      phase: 'rejected',
      actualFenceEstablished:
        state.phase === 'versionchanging' ||
        state.phase === 'initializing' ||
        state.phase === 'canonical-ready',
      error: { code: 'OPEN_REQUEST_ID_MISMATCH', stage: state.phase },
    });
  });

  it.each(
    createEveryPhase().filter((state) => state.phase !== 'quiescing' && state.phase !== 'rejected')
  )('rejects an invalid open request ID from $phase', (state) => {
    const rejected = reduceYamlStorageActivation(state, {
      type: 'versionchange-started',
      activationId: ACTIVATION_ID,
      openRequestId: '',
    });

    expect(rejected).toMatchObject({
      phase: 'rejected',
      error: { code: 'INVALID_OPEN_REQUEST_ID', stage: state.phase },
    });
  });

  it('does not issue provenance to fabricated input passed through the reducer', () => {
    const fabricatedInitializing = Object.freeze({
      phase: 'initializing',
      activationId: ACTIVATION_ID,
      currentVersion: 1,
      targetVersion: 2,
      openRequestId: OPEN_REQUEST_ID,
      upgradeCommitted: true,
    }) as YamlStorageActivationState;
    const reduced = reduceYamlStorageActivation(fabricatedInitializing, {
      type: 'initialization-succeeded',
      activationId: ACTIVATION_ID,
      openRequestId: OPEN_REQUEST_ID,
    });

    expect(reduced).toBe(fabricatedInitializing);
    expect(isYamlStorageActualFenceEstablished(reduced)).toBe(false);
    expect(
      getYamlStorageAccessDecision(reduced, {
        domain: 'runtime',
        representation: 'canonical',
        operation: 'query',
      })
    ).toEqual({ allowed: false, code: 'INVALID_ACTIVATION_STATE' });
  });
});

describe('getYamlStorageAccessDecision', () => {
  const runtimeRequests: readonly YamlStorageAccessRequest[] = (
    ['legacy', 'canonical'] as const
  ).flatMap((representation) =>
    (['query', 'mutation', 'reader', 'writer'] as const).map((operation) => ({
      domain: 'runtime' as const,
      representation,
      operation,
    }))
  );

  it('denies all runtime access in every phase except canonical-ready', () => {
    const states = createEveryPhase().filter((state) => state.phase !== 'canonical-ready');

    for (const state of states) {
      for (const request of runtimeRequests) {
        expect(getYamlStorageAccessDecision(state, request).allowed).toBe(false);
      }
    }
  });

  it('publishes only canonical runtime operations after commit and initialization', () => {
    const ready = advanceToCanonicalReady();

    for (const request of runtimeRequests) {
      const decision = getYamlStorageAccessDecision(ready, request);
      expect(decision.allowed).toBe(
        request.domain === 'runtime' && request.representation === 'canonical'
      );
      expect(Object.isFrozen(decision)).toBe(true);
    }
  });

  it.each(['query', 'mutation', 'reader', 'writer'] as const)(
    'always denies yaml-db %s access',
    (operation) => {
      const request: YamlStorageAccessRequest = { domain: 'yaml-db', operation };

      for (const state of createEveryPhase()) {
        expect(getYamlStorageAccessDecision(state, request)).toEqual({
          allowed: false,
          code: 'YAML_DB_UNAVAILABLE',
        });
      }
    }
  );

  it('fails closed for a malformed access request at runtime', () => {
    const malformedRequest = {
      domain: 'runtime',
      representation: 'canonical',
      operation: 'unknown',
    } as unknown as YamlStorageAccessRequest;

    expect(getYamlStorageAccessDecision(advanceToCanonicalReady(), malformedRequest)).toEqual({
      allowed: false,
      code: 'INVALID_ACCESS_REQUEST',
    });
  });

  it.each(
    createEveryPhase().flatMap((state) =>
      runtimeRequests.map((request) => ({ state, request, phase: state.phase }))
    )
  )(
    'returns the exact runtime decision for $phase / $request.representation / $request.operation',
    ({ state, request }) => {
      const decision = getYamlStorageAccessDecision(state, request);
      const expected =
        request.domain === 'runtime' && request.representation === 'legacy'
          ? { allowed: false, code: 'LEGACY_RUNTIME_UNAVAILABLE' }
          : state.phase === 'canonical-ready'
            ? { allowed: true, code: 'CANONICAL_READY' }
            : state.phase === 'rejected'
              ? { allowed: false, code: 'ACTIVATION_REJECTED' }
              : { allowed: false, code: 'ACTIVATION_IN_PROGRESS' };

      expect(decision).toEqual(expected);
      expect(Object.isFrozen(decision)).toBe(true);
    }
  );

  it('denies fabricated, cloned, and mutable structural states with a typed decision', () => {
    const issuedReady = advanceToCanonicalReady();
    const fabricatedReady = Object.freeze({
      phase: 'canonical-ready',
      activationId: ACTIVATION_ID,
      currentVersion: 1,
      targetVersion: 2,
      openRequestId: OPEN_REQUEST_ID,
      upgradeCommitted: true,
      initializationSucceeded: true,
      readinessProof: 'same-activation-upgrade',
    }) as YamlStorageActivationState;
    const clonedReady = { ...issuedReady } as YamlStorageActivationState;
    const mutableReady = {
      phase: 'canonical-ready',
      activationId: ACTIVATION_ID,
      currentVersion: 1,
      targetVersion: 2,
      openRequestId: OPEN_REQUEST_ID,
      upgradeCommitted: true,
      initializationSucceeded: true,
      readinessProof: 'same-activation-upgrade',
    } as YamlStorageActivationState;
    const request: YamlStorageAccessRequest = {
      domain: 'runtime',
      representation: 'canonical',
      operation: 'writer',
    };

    for (const state of [fabricatedReady, clonedReady, mutableReady]) {
      expect(getYamlStorageAccessDecision(state, request)).toEqual({
        allowed: false,
        code: 'INVALID_ACTIVATION_STATE',
      });
      expect(isYamlStorageActualFenceEstablished(state)).toBe(false);
    }
    expect(getYamlStorageAccessDecision(issuedReady, request)).toEqual({
      allowed: true,
      code: 'CANONICAL_READY',
    });
  });

  it('rejects null, malformed, accessor, Proxy, and unknown-representation requests', () => {
    let getterWasCalled = false;
    const accessorRequest = {
      domain: 'runtime',
      representation: 'canonical',
    };
    Object.defineProperty(accessorRequest, 'operation', {
      enumerable: true,
      get() {
        getterWasCalled = true;
        throw new Error('request-getter-message-must-not-leak');
      },
    });
    const symbolRequest = {
      domain: 'runtime',
      representation: 'canonical',
      operation: 'query',
      [Symbol('unexpected')]: true,
    };
    const proxyRequest = new Proxy(
      { domain: 'runtime', representation: 'canonical', operation: 'query' },
      {
        ownKeys() {
          throw new Error('request-proxy-message-must-not-leak');
        },
      }
    );
    const invalidRequests: readonly unknown[] = [
      null,
      undefined,
      [],
      new Date(0),
      {},
      { domain: 'unknown', operation: 'query' },
      { domain: 'runtime', operation: 'query' },
      { domain: 'runtime', representation: 'unknown', operation: 'query' },
      { domain: 'runtime', representation: 'canonical', operation: 'unknown' },
      { domain: 'runtime', representation: 'canonical', operation: 'query', extra: true },
      { domain: 'yaml-db', representation: 'canonical', operation: 'query' },
      symbolRequest,
      accessorRequest,
      proxyRequest,
    ];

    for (const request of invalidRequests) {
      const decision = getYamlStorageAccessDecision(
        advanceToCanonicalReady(),
        request as YamlStorageAccessRequest
      );
      expect(decision).toEqual({ allowed: false, code: 'INVALID_ACCESS_REQUEST' });
      expect(Object.isFrozen(decision)).toBe(true);
      expect(JSON.stringify(decision)).not.toContain('message-must-not-leak');
    }
    expect(getterWasCalled).toBe(false);
  });

  it('keeps every issued state and nested rejection error immutable', () => {
    for (const state of createEveryPhase()) {
      expect(Object.isFrozen(state)).toBe(true);
      if (state.phase === 'rejected') {
        expect(Object.isFrozen(state.error)).toBe(true);
      }
    }
  });
});
