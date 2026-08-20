import {
  hasExactYamlStorageLegacyFenceObjectKeys,
  readYamlStorageLegacyFenceOwnDataProperty,
} from './yamlStorageLegacyFenceGuards.internalUtils.js';
import {
  freezeIssuedYamlStorageLegacyFenceState,
  isIssuedYamlStorageLegacyFenceState,
} from './yamlStorageLegacyFenceProvenanceUtils.js';
import type {
  YamlStorageLegacyFenceError,
  YamlStorageLegacyFenceErrorCode,
  YamlStorageLegacyFenceEvent,
  YamlStorageLegacyFenceParticipant,
  YamlStorageLegacyFenceParticipantKind,
  YamlStorageLegacyFenceReduceResult,
  YamlStorageLegacyFenceRejectedState,
  YamlStorageLegacyFenceState,
} from './yamlStorageLegacyFenceTypes.js';

const ACKNOWLEDGED_EVENT_KEYS = [
  'type',
  'activationId',
  'quiescenceRequestId',
  'participantKind',
  'participantId',
  'legacyYamlEntrypointsRevoked',
  'ownedStorageHandlesClosed',
] as const;
const FAILED_EVENT_KEYS = [
  'type',
  'activationId',
  'quiescenceRequestId',
  'participantKind',
  'participantId',
] as const;

function freezeError(
  code: YamlStorageLegacyFenceErrorCode,
  stage: YamlStorageLegacyFenceError['stage']
): YamlStorageLegacyFenceError {
  return Object.freeze({ code, stage });
}

function invalidReduceResult(): YamlStorageLegacyFenceReduceResult {
  return Object.freeze({
    ok: false,
    error: freezeError('INVALID_FENCE_STATE', 'input'),
  });
}

function successfulReduceResult(
  state: YamlStorageLegacyFenceState
): YamlStorageLegacyFenceReduceResult {
  return Object.freeze({ ok: true, state });
}

function reject(
  state: Exclude<YamlStorageLegacyFenceState, YamlStorageLegacyFenceRejectedState>,
  code: YamlStorageLegacyFenceErrorCode
): YamlStorageLegacyFenceRejectedState {
  return freezeIssuedYamlStorageLegacyFenceState({
    phase: 'rejected',
    activationId: state.activationId,
    quiescenceRequestId: state.quiescenceRequestId,
    participants: state.participants,
    acknowledgedParticipants: state.acknowledgedParticipants,
    error: freezeError(code, state.phase),
  });
}

function readStringProperty(value: object, key: string): string | null {
  const property = readYamlStorageLegacyFenceOwnDataProperty(value, key);
  return property.found && typeof property.value === 'string' ? property.value : null;
}

function isParticipantKind(value: unknown): value is YamlStorageLegacyFenceParticipantKind {
  return value === 'tab' || value === 'worker';
}

function parseEvent(value: unknown): YamlStorageLegacyFenceEvent | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const typeProperty = readYamlStorageLegacyFenceOwnDataProperty(value, 'type');
  if (typeProperty.found === false) {
    return null;
  }
  const expectedKeys =
    typeProperty.value === 'participant-quiescence-acknowledged'
      ? ACKNOWLEDGED_EVENT_KEYS
      : typeProperty.value === 'participant-quiescence-failed'
        ? FAILED_EVENT_KEYS
        : null;
  if (expectedKeys === null || !hasExactYamlStorageLegacyFenceObjectKeys(value, expectedKeys)) {
    return null;
  }
  const activationId = readStringProperty(value, 'activationId');
  const quiescenceRequestId = readStringProperty(value, 'quiescenceRequestId');
  const participantKind = readYamlStorageLegacyFenceOwnDataProperty(value, 'participantKind');
  const participantId = readStringProperty(value, 'participantId');
  if (
    activationId === null ||
    activationId.length === 0 ||
    quiescenceRequestId === null ||
    quiescenceRequestId.length === 0 ||
    participantKind.found === false ||
    !isParticipantKind(participantKind.value) ||
    participantId === null ||
    participantId.length === 0
  ) {
    return null;
  }
  if (typeProperty.value === 'participant-quiescence-failed') {
    return {
      type: typeProperty.value,
      activationId,
      quiescenceRequestId,
      participantKind: participantKind.value,
      participantId,
    };
  }
  const legacyYamlEntrypointsRevoked = readYamlStorageLegacyFenceOwnDataProperty(
    value,
    'legacyYamlEntrypointsRevoked'
  );
  const ownedStorageHandlesClosed = readYamlStorageLegacyFenceOwnDataProperty(
    value,
    'ownedStorageHandlesClosed'
  );
  if (
    legacyYamlEntrypointsRevoked.found === false ||
    typeof legacyYamlEntrypointsRevoked.value !== 'boolean' ||
    ownedStorageHandlesClosed.found === false ||
    typeof ownedStorageHandlesClosed.value !== 'boolean'
  ) {
    return null;
  }
  return {
    type: 'participant-quiescence-acknowledged',
    activationId,
    quiescenceRequestId,
    participantKind: participantKind.value,
    participantId,
    legacyYamlEntrypointsRevoked: legacyYamlEntrypointsRevoked.value,
    ownedStorageHandlesClosed: ownedStorageHandlesClosed.value,
  };
}

function findParticipant(
  participants: readonly YamlStorageLegacyFenceParticipant[],
  participantId: string
): YamlStorageLegacyFenceParticipant | null {
  return participants.find((participant) => participant.participantId === participantId) ?? null;
}

function hasAcknowledgement(
  acknowledgedParticipants: readonly YamlStorageLegacyFenceParticipant[],
  participantId: string
): boolean {
  return acknowledgedParticipants.some(
    (participant) => participant.participantId === participantId
  );
}

function addAcknowledgement(
  state: Exclude<YamlStorageLegacyFenceState, YamlStorageLegacyFenceRejectedState>,
  acknowledgedParticipant: YamlStorageLegacyFenceParticipant
): YamlStorageLegacyFenceState {
  const acknowledgedParticipants = Object.freeze(
    state.participants.filter(
      (participant) =>
        participant.participantId === acknowledgedParticipant.participantId ||
        hasAcknowledgement(state.acknowledgedParticipants, participant.participantId)
    )
  );
  return freezeIssuedYamlStorageLegacyFenceState({
    phase:
      acknowledgedParticipants.length === state.participants.length
        ? 'ready-for-preflight'
        : 'quiescing',
    activationId: state.activationId,
    quiescenceRequestId: state.quiescenceRequestId,
    participants: state.participants,
    acknowledgedParticipants,
  });
}

export function reduceYamlStorageLegacyFence(
  stateValue: unknown,
  eventValue: unknown
): YamlStorageLegacyFenceReduceResult {
  if (!isIssuedYamlStorageLegacyFenceState(stateValue)) {
    return invalidReduceResult();
  }
  if (stateValue.phase === 'rejected') {
    return successfulReduceResult(stateValue);
  }

  let event: YamlStorageLegacyFenceEvent | null;
  try {
    event = parseEvent(eventValue);
  } catch {
    event = null;
  }
  if (event === null) {
    return successfulReduceResult(reject(stateValue, 'INVALID_FENCE_EVENT'));
  }
  if (event.activationId !== stateValue.activationId) {
    return successfulReduceResult(reject(stateValue, 'ACTIVATION_ID_MISMATCH'));
  }
  if (event.quiescenceRequestId !== stateValue.quiescenceRequestId) {
    return successfulReduceResult(reject(stateValue, 'QUIESCENCE_REQUEST_ID_MISMATCH'));
  }
  if (stateValue.phase === 'ready-for-preflight') {
    return successfulReduceResult(reject(stateValue, 'ILLEGAL_TRANSITION'));
  }

  const participant = findParticipant(stateValue.participants, event.participantId);
  if (participant === null) {
    return successfulReduceResult(reject(stateValue, 'UNKNOWN_PARTICIPANT'));
  }
  if (participant.participantKind !== event.participantKind) {
    return successfulReduceResult(reject(stateValue, 'PARTICIPANT_KIND_MISMATCH'));
  }
  if (hasAcknowledgement(stateValue.acknowledgedParticipants, event.participantId)) {
    return successfulReduceResult(reject(stateValue, 'DUPLICATE_PARTICIPANT_ACK'));
  }
  if (event.type === 'participant-quiescence-failed') {
    return successfulReduceResult(reject(stateValue, 'PARTICIPANT_QUIESCENCE_FAILED'));
  }
  if (event.legacyYamlEntrypointsRevoked !== true) {
    return successfulReduceResult(reject(stateValue, 'LEGACY_ENTRYPOINTS_NOT_REVOKED'));
  }
  if (event.ownedStorageHandlesClosed !== true) {
    return successfulReduceResult(reject(stateValue, 'STORAGE_HANDLES_NOT_CLOSED'));
  }
  return successfulReduceResult(addAcknowledgement(stateValue, participant));
}
