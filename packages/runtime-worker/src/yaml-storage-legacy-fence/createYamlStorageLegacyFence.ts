import {
  compareYamlStorageLegacyFenceParticipants,
  hasExactYamlStorageLegacyFenceObjectKeys,
  readExactYamlStorageLegacyFenceArray,
  readYamlStorageLegacyFenceOwnDataProperty,
} from './yamlStorageLegacyFenceGuards.internalUtils.js';
import { freezeIssuedYamlStorageLegacyFenceState } from './yamlStorageLegacyFenceProvenanceUtils.js';
import type {
  YamlStorageLegacyFenceCreateResult,
  YamlStorageLegacyFenceError,
  YamlStorageLegacyFenceErrorCode,
  YamlStorageLegacyFenceParticipant,
  YamlStorageLegacyFenceParticipantKind,
} from './yamlStorageLegacyFenceTypes.js';

const INPUT_KEYS = ['activationId', 'quiescenceRequestId', 'participants'] as const;
const PARTICIPANT_KEYS = ['participantKind', 'participantId'] as const;

function freezeInputError(code: YamlStorageLegacyFenceErrorCode): YamlStorageLegacyFenceError {
  return Object.freeze({ code, stage: 'input' });
}

function invalidCreateResult(
  code: YamlStorageLegacyFenceErrorCode
): YamlStorageLegacyFenceCreateResult {
  return Object.freeze({ ok: false, error: freezeInputError(code) });
}

function readStringProperty(value: object, key: string): string | null {
  const property = readYamlStorageLegacyFenceOwnDataProperty(value, key);
  return property.found && typeof property.value === 'string' ? property.value : null;
}

function isParticipantKind(value: unknown): value is YamlStorageLegacyFenceParticipantKind {
  return value === 'tab' || value === 'worker';
}

function parseParticipant(value: unknown): YamlStorageLegacyFenceParticipant | null {
  if (!hasExactYamlStorageLegacyFenceObjectKeys(value, PARTICIPANT_KEYS)) {
    return null;
  }
  const participantKind = readYamlStorageLegacyFenceOwnDataProperty(value, 'participantKind');
  const participantId = readStringProperty(value, 'participantId');
  if (
    participantKind.found === false ||
    !isParticipantKind(participantKind.value) ||
    participantId === null ||
    participantId.length === 0
  ) {
    return null;
  }
  return Object.freeze({ participantKind: participantKind.value, participantId });
}

export function createYamlStorageLegacyFence(input: unknown): YamlStorageLegacyFenceCreateResult {
  try {
    if (!hasExactYamlStorageLegacyFenceObjectKeys(input, INPUT_KEYS)) {
      return invalidCreateResult('INVALID_FENCE_INPUT');
    }
    const activationId = readStringProperty(input, 'activationId');
    if (activationId === null || activationId.length === 0) {
      return invalidCreateResult('INVALID_ACTIVATION_ID');
    }
    const quiescenceRequestId = readStringProperty(input, 'quiescenceRequestId');
    if (quiescenceRequestId === null || quiescenceRequestId.length === 0) {
      return invalidCreateResult('INVALID_QUIESCENCE_REQUEST_ID');
    }
    const participantsProperty = readYamlStorageLegacyFenceOwnDataProperty(input, 'participants');
    const rawParticipants =
      participantsProperty.found === true
        ? readExactYamlStorageLegacyFenceArray(participantsProperty.value)
        : null;
    if (rawParticipants === null) {
      return invalidCreateResult('INVALID_PARTICIPANT_SNAPSHOT');
    }
    if (rawParticipants.length === 0) {
      return invalidCreateResult('EMPTY_PARTICIPANT_SNAPSHOT');
    }

    const participants: YamlStorageLegacyFenceParticipant[] = [];
    const participantIds = new Set<string>();
    for (const rawParticipant of rawParticipants) {
      const participant = parseParticipant(rawParticipant);
      if (participant === null) {
        return invalidCreateResult('INVALID_PARTICIPANT');
      }
      if (participantIds.has(participant.participantId)) {
        return invalidCreateResult('DUPLICATE_PARTICIPANT_ID');
      }
      participantIds.add(participant.participantId);
      participants.push(participant);
    }
    participants.sort(compareYamlStorageLegacyFenceParticipants);
    const frozenParticipants = Object.freeze(participants);
    const frozenAcknowledgedParticipants = Object.freeze([] as YamlStorageLegacyFenceParticipant[]);
    const frozenDiscardedParticipants = Object.freeze([] as YamlStorageLegacyFenceParticipant[]);
    return Object.freeze({
      ok: true,
      state: freezeIssuedYamlStorageLegacyFenceState({
        phase: 'quiescing',
        activationId,
        quiescenceRequestId,
        participants: frozenParticipants,
        acknowledgedParticipants: frozenAcknowledgedParticipants,
        discardedParticipants: frozenDiscardedParticipants,
      }),
    });
  } catch {
    return invalidCreateResult('INVALID_FENCE_INPUT');
  }
}
