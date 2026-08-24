import { describe, expect, it, vi } from 'vitest';
import { createYamlStorageLegacyFence } from '../createYamlStorageLegacyFence.js';
import { getYamlStorageLegacyFenceDecision } from '../getYamlStorageLegacyFenceDecision.js';
import { reduceYamlStorageLegacyFence } from '../reduceYamlStorageLegacyFence.js';
import {
  YamlStorageLegacyFenceEvent,
  YamlStorageLegacyFenceState,
} from '../yamlStorageLegacyFenceTypes.js';

const ACTIVATION_ID = 'activation-1';
const QUIESCENCE_REQUEST_ID = 'quiescence-1';

function createInput() {
  return {
    activationId: ACTIVATION_ID,
    quiescenceRequestId: QUIESCENCE_REQUEST_ID,
    participants: [
      { participantKind: 'worker', participantId: 'worker-1' },
      { participantKind: 'tab', participantId: 'tab-2' },
      { participantKind: 'tab', participantId: 'tab-1' },
    ],
  } as const;
}

function createState(): YamlStorageLegacyFenceState {
  const result = createYamlStorageLegacyFence(createInput());
  if (result.ok === false) {
    throw new Error(result.error.code);
  }
  return result.state;
}

function createAcknowledgement(
  participantKind: 'tab' | 'worker',
  participantId: string
): YamlStorageLegacyFenceEvent {
  return {
    type: 'participant-quiescence-acknowledged',
    activationId: ACTIVATION_ID,
    quiescenceRequestId: QUIESCENCE_REQUEST_ID,
    participantKind,
    participantId,
    legacyYamlEntrypointsRevoked: true,
    ownedStorageHandlesClosed: true,
  };
}

function createDiscard(
  participantKind: 'tab' | 'worker',
  participantId: string
): YamlStorageLegacyFenceEvent {
  return {
    type: 'participant-context-discarded',
    activationId: ACTIVATION_ID,
    quiescenceRequestId: QUIESCENCE_REQUEST_ID,
    participantKind,
    participantId,
  };
}

function reduceSuccessfully(
  state: YamlStorageLegacyFenceState,
  event: unknown
): YamlStorageLegacyFenceState {
  const result = reduceYamlStorageLegacyFence(state, event);
  if (result.ok === false) {
    throw new Error(result.error.code);
  }
  return result.state;
}

function acknowledgeAll(state: YamlStorageLegacyFenceState): YamlStorageLegacyFenceState {
  let current = state;
  for (const participant of state.participants) {
    current = reduceSuccessfully(
      current,
      createAcknowledgement(participant.participantKind, participant.participantId)
    );
  }
  return current;
}

function expectRejected(
  state: YamlStorageLegacyFenceState,
  event: unknown,
  code: string
): YamlStorageLegacyFenceState {
  const rejected = reduceSuccessfully(state, event);
  expect(rejected).toMatchObject({ phase: 'rejected', error: { code } });
  expect(getYamlStorageLegacyFenceDecision(rejected)).toEqual({
    readyForPreflight: false,
    actualFenceEstablished: false,
    code: 'QUIESCENCE_REJECTED',
  });
  return rejected;
}

describe('createYamlStorageLegacyFence', () => {
  it('creates a deeply frozen deterministic participant snapshot', () => {
    const state = createState();

    expect(state).toEqual({
      phase: 'quiescing',
      activationId: ACTIVATION_ID,
      quiescenceRequestId: QUIESCENCE_REQUEST_ID,
      participants: [
        { participantKind: 'tab', participantId: 'tab-1' },
        { participantKind: 'tab', participantId: 'tab-2' },
        { participantKind: 'worker', participantId: 'worker-1' },
      ],
      acknowledgedParticipants: [],
      discardedParticipants: [],
    });
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.participants)).toBe(true);
    expect(state.participants.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(state.acknowledgedParticipants)).toBe(true);
    expect(Object.isFrozen(state.discardedParticipants)).toBe(true);
    expect('openRequestId' in state).toBe(false);
  });

  it('does not mutate or normalize the caller input', () => {
    const input = createInput();
    const before = structuredClone(input);

    const result = createYamlStorageLegacyFence(input);

    expect(result.ok).toBe(true);
    expect(input).toEqual(before);
    expect(input.participants[0]?.participantId).toBe('worker-1');
  });

  it.each([
    [null, 'INVALID_FENCE_INPUT'],
    [{}, 'INVALID_FENCE_INPUT'],
    [{ ...createInput(), extra: true }, 'INVALID_FENCE_INPUT'],
    [{ ...createInput(), activationId: '' }, 'INVALID_ACTIVATION_ID'],
    [{ ...createInput(), quiescenceRequestId: '' }, 'INVALID_QUIESCENCE_REQUEST_ID'],
    [{ ...createInput(), participants: [] }, 'EMPTY_PARTICIPANT_SNAPSHOT'],
    [{ ...createInput(), participants: {} }, 'INVALID_PARTICIPANT_SNAPSHOT'],
    [
      {
        ...createInput(),
        participants: [
          { participantKind: 'tab', participantId: 'same' },
          { participantKind: 'worker', participantId: 'same' },
        ],
      },
      'DUPLICATE_PARTICIPANT_ID',
    ],
    [
      {
        ...createInput(),
        participants: [{ participantKind: 'other', participantId: 'participant-1' }],
      },
      'INVALID_PARTICIPANT',
    ],
    [
      {
        ...createInput(),
        participants: [{ participantKind: 'tab', participantId: '' }],
      },
      'INVALID_PARTICIPANT',
    ],
  ])('rejects invalid input without defaults: %#', (input, code) => {
    const result = createYamlStorageLegacyFence(input);

    expect(result).toEqual({ ok: false, error: { code, stage: 'input' } });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.ok === false) {
      expect(Object.isFrozen(result.error)).toBe(true);
    }
  });

  it('rejects sparse and decorated participant arrays', () => {
    const sparse: unknown[] = [];
    sparse.length = 1;
    const decorated = [{ participantKind: 'tab', participantId: 'tab-1' }];
    Object.defineProperty(decorated, 'extra', { value: true });

    expect(createYamlStorageLegacyFence({ ...createInput(), participants: sparse })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PARTICIPANT_SNAPSHOT' },
    });
    expect(
      createYamlStorageLegacyFence({ ...createInput(), participants: decorated })
    ).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PARTICIPANT_SNAPSHOT' },
    });
  });

  it('does not invoke input or participant accessors and redacts Proxy failures', () => {
    const inputGetter = vi.fn(() => 'secret-input');
    const participantGetter = vi.fn(() => 'secret-participant');
    const participantArrayGetter = vi.fn(() => {
      throw new Error('secret-participant-array');
    });
    const inputWithAccessor = createInput() as Record<string, unknown>;
    Object.defineProperty(inputWithAccessor, 'activationId', { get: inputGetter });
    const participantWithAccessor = { participantKind: 'tab' } as Record<string, unknown>;
    Object.defineProperty(participantWithAccessor, 'participantId', { get: participantGetter });
    const participantArray = new Proxy(createInput().participants, {
      get: participantArrayGetter,
    });
    const proxy = new Proxy(createInput(), {
      ownKeys() {
        throw new Error('credential-proxy-secret');
      },
    });

    expect(createYamlStorageLegacyFence(inputWithAccessor)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_FENCE_INPUT' },
    });
    expect(
      createYamlStorageLegacyFence({ ...createInput(), participants: [participantWithAccessor] })
    ).toMatchObject({ ok: false, error: { code: 'INVALID_PARTICIPANT' } });
    expect(createYamlStorageLegacyFence(proxy)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_FENCE_INPUT' },
    });
    expect(
      createYamlStorageLegacyFence({ ...createInput(), participants: participantArray })
    ).toMatchObject({
      ok: true,
    });
    expect(inputGetter).not.toHaveBeenCalled();
    expect(participantGetter).not.toHaveBeenCalled();
    expect(participantArrayGetter).not.toHaveBeenCalled();
  });
});

describe('reduceYamlStorageLegacyFence', () => {
  it('becomes ready only after every expected participant acknowledges both facts', () => {
    const initial = createState();
    const first = reduceSuccessfully(initial, createAcknowledgement('worker', 'worker-1'));
    const second = reduceSuccessfully(first, createAcknowledgement('tab', 'tab-2'));
    const ready = reduceSuccessfully(second, createAcknowledgement('tab', 'tab-1'));

    expect(first.phase).toBe('quiescing');
    expect(second.phase).toBe('quiescing');
    expect(getYamlStorageLegacyFenceDecision(second)).toEqual({
      readyForPreflight: false,
      actualFenceEstablished: false,
      code: 'QUIESCENCE_IN_PROGRESS',
    });
    expect(ready.phase).toBe('ready-for-preflight');
    expect(ready.acknowledgedParticipants).toEqual(initial.participants);
    expect(ready.discardedParticipants).toEqual([]);
    expect(getYamlStorageLegacyFenceDecision(ready)).toEqual({
      readyForPreflight: true,
      actualFenceEstablished: false,
      code: 'READY_FOR_PREFLIGHT',
    });
    expect(Object.isFrozen(ready)).toBe(true);
    expect(Object.isFrozen(ready.acknowledgedParticipants)).toBe(true);
    expect(Object.isFrozen(ready.discardedParticipants)).toBe(true);
  });

  it('becomes ready with exactly one acknowledgement or discard per participant', () => {
    const initial = createState();
    const first = reduceSuccessfully(initial, createDiscard('tab', 'tab-2'));
    const second = reduceSuccessfully(first, createAcknowledgement('worker', 'worker-1'));
    const ready = reduceSuccessfully(second, createDiscard('tab', 'tab-1'));

    expect(first.phase).toBe('quiescing');
    expect(second.phase).toBe('quiescing');
    expect(ready.phase).toBe('ready-for-preflight');
    expect(ready.acknowledgedParticipants).toEqual([
      { participantKind: 'worker', participantId: 'worker-1' },
    ]);
    expect(ready.discardedParticipants).toEqual([
      { participantKind: 'tab', participantId: 'tab-1' },
      { participantKind: 'tab', participantId: 'tab-2' },
    ]);
  });

  it('produces the same acknowledged order for every event order', () => {
    const initial = createState();
    const forward = acknowledgeAll(initial);
    let reverse = initial;
    for (const participant of [...initial.participants].reverse()) {
      reverse = reduceSuccessfully(
        reverse,
        createAcknowledgement(participant.participantKind, participant.participantId)
      );
    }

    expect(reverse.acknowledgedParticipants).toEqual(forward.acknowledgedParticipants);
    expect(reverse.phase).toBe('ready-for-preflight');
  });

  it.each([
    [
      { ...createAcknowledgement('tab', 'tab-1'), activationId: 'stale-activation' },
      'ACTIVATION_ID_MISMATCH',
    ],
    [
      { ...createAcknowledgement('tab', 'tab-1'), quiescenceRequestId: 'stale-request' },
      'QUIESCENCE_REQUEST_ID_MISMATCH',
    ],
    [createAcknowledgement('tab', 'unknown'), 'UNKNOWN_PARTICIPANT'],
    [createAcknowledgement('worker', 'tab-1'), 'PARTICIPANT_KIND_MISMATCH'],
    [
      { ...createAcknowledgement('tab', 'tab-1'), legacyYamlEntrypointsRevoked: false },
      'LEGACY_ENTRYPOINTS_NOT_REVOKED',
    ],
    [
      { ...createAcknowledgement('tab', 'tab-1'), ownedStorageHandlesClosed: false },
      'STORAGE_HANDLES_NOT_CLOSED',
    ],
    [
      {
        type: 'participant-quiescence-failed',
        activationId: ACTIVATION_ID,
        quiescenceRequestId: QUIESCENCE_REQUEST_ID,
        participantKind: 'tab',
        participantId: 'tab-1',
      },
      'PARTICIPANT_QUIESCENCE_FAILED',
    ],
  ] as const)('terminally rejects invalid acknowledgement: %#', (event, code) => {
    expectRejected(createState(), event, code);
  });

  it('terminally rejects a duplicate acknowledgement', () => {
    const acknowledged = reduceSuccessfully(createState(), createAcknowledgement('tab', 'tab-1'));

    expectRejected(
      acknowledged,
      createAcknowledgement('tab', 'tab-1'),
      'DUPLICATE_PARTICIPANT_ACK'
    );
  });

  it('terminally rejects duplicate and conflicting participant evidence', () => {
    const discarded = reduceSuccessfully(createState(), createDiscard('tab', 'tab-1'));
    expectRejected(discarded, createDiscard('tab', 'tab-1'), 'DUPLICATE_PARTICIPANT_DISCARD');
    expectRejected(
      discarded,
      createAcknowledgement('tab', 'tab-1'),
      'PARTICIPANT_EVIDENCE_CONFLICT'
    );

    const acknowledged = reduceSuccessfully(createState(), createAcknowledgement('tab', 'tab-1'));
    expectRejected(acknowledged, createDiscard('tab', 'tab-1'), 'PARTICIPANT_EVIDENCE_CONFLICT');
  });

  it.each([
    null,
    [],
    {},
    { ...createAcknowledgement('tab', 'tab-1'), extra: true },
    { ...createAcknowledgement('tab', 'tab-1'), participantKind: 'other' },
    { ...createAcknowledgement('tab', 'tab-1'), legacyYamlEntrypointsRevoked: 'true' },
  ])('terminally rejects malformed events without throwing: %#', (event) => {
    expectRejected(createState(), event, 'INVALID_FENCE_EVENT');
  });

  it('rejects symbol properties on inputs, participants, and events', () => {
    const symbol = Symbol('unsafe');
    const input = { ...createInput(), [symbol]: true };
    const participant = { participantKind: 'tab', participantId: 'tab-1', [symbol]: true };
    const event = { ...createAcknowledgement('tab', 'tab-1'), [symbol]: true };

    expect(createYamlStorageLegacyFence(input)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_FENCE_INPUT' },
    });
    expect(
      createYamlStorageLegacyFence({ ...createInput(), participants: [participant] })
    ).toMatchObject({ ok: false, error: { code: 'INVALID_PARTICIPANT' } });
    expectRejected(createState(), event, 'INVALID_FENCE_EVENT');
  });

  it('does not invoke event accessors or expose Proxy failure messages', () => {
    const eventGetter = vi.fn(() => 'secret-event');
    const eventWithAccessor = createAcknowledgement('tab', 'tab-1') as Record<string, unknown>;
    Object.defineProperty(eventWithAccessor, 'participantId', { get: eventGetter });
    const proxy = new Proxy(createAcknowledgement('tab', 'tab-1'), {
      ownKeys() {
        throw new Error('credential-event-proxy-secret');
      },
    });

    expectRejected(createState(), eventWithAccessor, 'INVALID_FENCE_EVENT');
    expectRejected(createState(), proxy, 'INVALID_FENCE_EVENT');
    expect(eventGetter).not.toHaveBeenCalled();
  });

  it('rejects all events after ready and keeps rejected state terminal', () => {
    const ready = acknowledgeAll(createState());
    const rejected = expectRejected(
      ready,
      createAcknowledgement('tab', 'tab-1'),
      'ILLEGAL_TRANSITION'
    );
    const getter = vi.fn(() => 'secret-after-terminal');
    const ignoredEvent = {} as Record<string, unknown>;
    Object.defineProperty(ignoredEvent, 'type', { get: getter });

    const terminalResult = reduceYamlStorageLegacyFence(rejected, ignoredEvent);

    expect(terminalResult).toEqual({ ok: true, state: rejected });
    if (terminalResult.ok === true) {
      expect(terminalResult.state).toBe(rejected);
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it.each([
    ['quiescing', 'participant-quiescence-acknowledged'],
    ['quiescing', 'participant-quiescence-failed'],
    ['quiescing', 'participant-context-discarded'],
    ['ready-for-preflight', 'participant-quiescence-acknowledged'],
    ['ready-for-preflight', 'participant-quiescence-failed'],
    ['ready-for-preflight', 'participant-context-discarded'],
    ['rejected', 'participant-quiescence-acknowledged'],
    ['rejected', 'participant-quiescence-failed'],
    ['rejected', 'participant-context-discarded'],
  ] as const)('covers the %s × %s transition', (phase, eventType) => {
    const state =
      phase === 'quiescing'
        ? createState()
        : phase === 'ready-for-preflight'
          ? acknowledgeAll(createState())
          : reduceSuccessfully(createState(), {
              ...createAcknowledgement('tab', 'tab-1'),
              legacyYamlEntrypointsRevoked: false,
            });
    const event =
      eventType === 'participant-quiescence-acknowledged'
        ? createAcknowledgement('tab', 'tab-1')
        : eventType === 'participant-context-discarded'
          ? createDiscard('tab', 'tab-1')
          : {
              type: eventType,
              activationId: ACTIVATION_ID,
              quiescenceRequestId: QUIESCENCE_REQUEST_ID,
              participantKind: 'tab',
              participantId: 'tab-1',
            };
    const next = reduceSuccessfully(state, event);

    if (phase === 'rejected') {
      expect(next).toBe(state);
      return;
    }
    if (phase === 'ready-for-preflight') {
      expect(next).toMatchObject({
        phase: 'rejected',
        error: { code: 'ILLEGAL_TRANSITION' },
      });
      return;
    }
    expect(next.phase).toBe(
      eventType === 'participant-quiescence-failed' ? 'rejected' : 'quiescing'
    );
  });

  it('fails closed for fabricated, cloned, and mutable states', () => {
    const issued = createState();
    const clone = structuredClone(issued);
    const mutable = { ...issued };

    for (const state of [clone, mutable, Object.freeze({ ...issued })]) {
      expect(reduceYamlStorageLegacyFence(state, createAcknowledgement('tab', 'tab-1'))).toEqual({
        ok: false,
        error: { code: 'INVALID_FENCE_STATE', stage: 'input' },
      });
      expect(getYamlStorageLegacyFenceDecision(state)).toEqual({
        readyForPreflight: false,
        actualFenceEstablished: false,
        code: 'INVALID_LEGACY_FENCE_STATE',
      });
    }
  });

  it('keeps errors sanitized and never stores raw acknowledgements', () => {
    const rejected = expectRejected(
      createState(),
      {
        ...createAcknowledgement('tab', 'tab-1'),
        legacyYamlEntrypointsRevoked: false,
      },
      'LEGACY_ENTRYPOINTS_NOT_REVOKED'
    );

    if (rejected.phase !== 'rejected') {
      throw new Error('expected rejected state');
    }
    expect(Object.keys(rejected.error)).toEqual(['code', 'stage']);
    expect(Object.keys(rejected)).toEqual([
      'phase',
      'activationId',
      'quiescenceRequestId',
      'participants',
      'acknowledgedParticipants',
      'discardedParticipants',
      'error',
    ]);
    expect(JSON.stringify(rejected)).not.toContain('legacyYamlEntrypointsRevoked');
    expect(JSON.stringify(rejected)).not.toContain('ownedStorageHandlesClosed');
    expect(Object.isFrozen(rejected.error)).toBe(true);
  });
});

describe('getYamlStorageLegacyFenceDecision', () => {
  it.each([
    ['quiescing', createState()],
    ['ready-for-preflight', acknowledgeAll(createState())],
    [
      'rejected',
      reduceSuccessfully(createState(), {
        ...createAcknowledgement('tab', 'tab-1'),
        legacyYamlEntrypointsRevoked: false,
      }),
    ],
  ])('never claims an actual storage fence in %s', (_phase, state) => {
    expect(getYamlStorageLegacyFenceDecision(state).actualFenceEstablished).toBe(false);
  });
});
