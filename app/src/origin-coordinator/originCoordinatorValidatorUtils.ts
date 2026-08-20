import {
  isOriginCoordinatorReleaseId,
  ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
  ORIGIN_COORDINATOR_MAX_CENSUS_TIMEOUT_MS,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
  ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
  ORIGIN_COORDINATOR_YAML_STATE_KEY,
  type OriginCoordinatorBridgeCapabilities,
  type OriginCoordinatorCensusResponse,
  type OriginCoordinatorParticipantKind,
} from '@hierarchidb/origin-coordinator';
import type {
  OriginCoordinatorBridgeErrorCode,
  OriginCoordinatorBridgeErrorStage,
  OriginCoordinatorDurableState,
  OriginCoordinatorFoundationAllowedState,
  OriginCoordinatorHelloRequest,
  OriginCoordinatorHelloResult,
  OriginCoordinatorPersistedParticipant,
  OriginCoordinatorPersistedParticipantEvidence,
  OriginCoordinatorQuiescenceRequestErrorCode,
  OriginCoordinatorQuiescenceResult,
  OriginCoordinatorQuiescenceStartRequest,
  OriginCoordinatorQuiescenceStatusRequest,
  OriginCoordinatorReadinessRequest,
  OriginCoordinatorReadinessResult,
} from './types.js';

type OwnDataProperty =
  | Readonly<{ readonly found: false }>
  | Readonly<{ readonly found: true; readonly value: unknown }>;

function readOwnDataProperty(value: object, key: string): OwnDataProperty {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor
    ? { found: true, value: descriptor.value }
    : { found: false };
}

function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactOwnDataProperties(value: object, expectedKeys: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value);
  return (
    keys.length === expectedKeys.length &&
    keys.every((key) => typeof key === 'string' && expectedKeys.includes(key)) &&
    expectedKeys.every((key) => readOwnDataProperty(value, key).found)
  );
}

function readExactArray(value: unknown): readonly unknown[] | null {
  if (!Array.isArray(value) || Object.getOwnPropertySymbols(value).length !== 0) return null;
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== value.length + 1 || !names.includes('length')) return null;
  for (let index = 0; index < value.length; index += 1) {
    if (!names.includes(String(index)) || !readOwnDataProperty(value, String(index)).found) {
      return null;
    }
  }
  return value;
}

function readString(value: object, key: string): string | null {
  const property = readOwnDataProperty(value, key);
  return property.found && typeof property.value === 'string' ? property.value : null;
}

function readNumber(value: object, key: string): number | null {
  const property = readOwnDataProperty(value, key);
  return property.found && typeof property.value === 'number' ? property.value : null;
}

function hasOwnDataValue(value: object, key: string, expected: unknown): boolean {
  const property = readOwnDataProperty(value, key);
  return property.found && property.value === expected;
}

function hasProtocolVersion(value: object): boolean {
  const property = readOwnDataProperty(value, 'protocolVersion');
  return property.found && property.value === ORIGIN_COORDINATOR_PROTOCOL_VERSION;
}

function isBridgeCapabilities(value: unknown): value is OriginCoordinatorBridgeCapabilities {
  const items = readExactArray(value);
  return (
    items !== null &&
    items.length === 2 &&
    items[0] === ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY &&
    items[1] === ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY
  );
}

function isParticipantKind(value: unknown): value is OriginCoordinatorParticipantKind {
  return value === 'tab' || value === 'worker';
}

function compareParticipants(
  left: OriginCoordinatorPersistedParticipant,
  right: OriginCoordinatorPersistedParticipant
): number {
  if (left.participantKind !== right.participantKind) {
    return left.participantKind === 'tab' ? -1 : 1;
  }
  return left.participantId < right.participantId
    ? -1
    : left.participantId > right.participantId
      ? 1
      : 0;
}

function parseParticipant(value: unknown): OriginCoordinatorPersistedParticipant | null {
  if (
    !isPlainObject(value) ||
    !hasExactOwnDataProperties(value, ['participantKind', 'participantId'])
  ) {
    return null;
  }
  const participantKind = readOwnDataProperty(value, 'participantKind');
  const participantId = readString(value, 'participantId');
  if (
    !participantKind.found ||
    !isParticipantKind(participantKind.value) ||
    participantId === null ||
    participantId.length === 0
  ) {
    return null;
  }
  return Object.freeze({ participantKind: participantKind.value, participantId });
}

function parseParticipantArray(
  value: unknown
): readonly OriginCoordinatorPersistedParticipant[] | null {
  const items = readExactArray(value);
  if (items === null || items.length === 0) return null;
  const participants: OriginCoordinatorPersistedParticipant[] = [];
  const participantIds = new Set<string>();
  for (const item of items) {
    const participant = parseParticipant(item);
    if (participant === null || participantIds.has(participant.participantId)) return null;
    participantIds.add(participant.participantId);
    participants.push(participant);
  }
  for (let index = 1; index < participants.length; index += 1) {
    const previous = participants[index - 1];
    const current = participants[index];
    if (!previous || !current || compareParticipants(previous, current) >= 0) return null;
  }
  return Object.freeze(participants);
}

function parseEvidence(value: unknown): OriginCoordinatorPersistedParticipantEvidence | null {
  if (
    !isPlainObject(value) ||
    !hasExactOwnDataProperties(value, ['participantKind', 'participantId', 'outcome'])
  ) {
    return null;
  }
  const participantKind = readOwnDataProperty(value, 'participantKind');
  const participantId = readString(value, 'participantId');
  const outcome = readString(value, 'outcome');
  if (
    !participantKind.found ||
    !isParticipantKind(participantKind.value) ||
    participantId === null ||
    participantId.length === 0 ||
    (outcome !== 'acknowledged' && outcome !== 'discarded')
  ) {
    return null;
  }
  return Object.freeze({ participantKind: participantKind.value, participantId, outcome });
}

function parseEvidenceArray(
  value: unknown,
  participants: readonly OriginCoordinatorPersistedParticipant[]
): readonly OriginCoordinatorPersistedParticipantEvidence[] | null {
  const items = readExactArray(value);
  if (items === null) return null;
  const participantById = new Map(
    participants.map((participant) => [participant.participantId, participant] as const)
  );
  const evidence: OriginCoordinatorPersistedParticipantEvidence[] = [];
  const evidenceIds = new Set<string>();
  for (const item of items) {
    const parsed = parseEvidence(item);
    const expected = parsed ? participantById.get(parsed.participantId) : undefined;
    if (
      parsed === null ||
      expected === undefined ||
      expected.participantKind !== parsed.participantKind ||
      evidenceIds.has(parsed.participantId)
    ) {
      return null;
    }
    evidenceIds.add(parsed.participantId);
    evidence.push(parsed);
  }
  for (let index = 1; index < evidence.length; index += 1) {
    const previous = evidence[index - 1];
    const current = evidence[index];
    if (!previous || !current || compareParticipants(previous, current) >= 0) return null;
  }
  return Object.freeze(evidence);
}

function isBridgeErrorCode(value: string | null): value is OriginCoordinatorBridgeErrorCode {
  return (
    value === 'LEGACY_FENCE_REJECTED' ||
    value === 'PARTICIPANT_UNRESPONSIVE' ||
    value === 'CLIENT_LOOKUP_FAILED' ||
    value === 'COORDINATOR_RESTARTED_DURING_QUIESCENCE'
  );
}

function isBridgeErrorStage(value: string | null): value is OriginCoordinatorBridgeErrorStage {
  return value === 'request' || value === 'quiescing' || value === 'reconstruction';
}

function isQuiescenceRequestErrorCode(
  value: string | null
): value is OriginCoordinatorQuiescenceRequestErrorCode {
  return (
    value === 'INVALID_QUIESCENCE_REQUEST' ||
    value === 'INVALID_DURABLE_STATE' ||
    value === 'COORDINATOR_STORAGE_FAILED' ||
    value === 'CLIENT_CENSUS_FAILED' ||
    value === 'QUIESCENCE_IDENTITY_MISMATCH'
  );
}

export function readOriginCoordinatorMessageType(value: unknown): string | null {
  try {
    return isPlainObject(value) ? readString(value, 'type') : null;
  } catch {
    return null;
  }
}

export function parseOriginCoordinatorFoundationAllowedState(
  value: unknown
): OriginCoordinatorFoundationAllowedState | null {
  try {
    if (
      !isPlainObject(value) ||
      !hasExactOwnDataProperties(value, ['key', 'protocolVersion', 'phase']) ||
      !hasOwnDataValue(value, 'protocolVersion', 1) ||
      readString(value, 'key') !== ORIGIN_COORDINATOR_YAML_STATE_KEY ||
      readString(value, 'phase') !== 'allowed'
    ) {
      return null;
    }
    return Object.freeze({
      key: ORIGIN_COORDINATOR_YAML_STATE_KEY,
      protocolVersion: 1,
      phase: 'allowed',
    });
  } catch {
    return null;
  }
}

export function parseOriginCoordinatorDurableState(
  value: unknown
): OriginCoordinatorDurableState | null {
  try {
    if (!isPlainObject(value) || !hasProtocolVersion(value)) return null;
    const phase = readString(value, 'phase');
    if (phase === 'allowed') {
      if (
        !hasExactOwnDataProperties(value, ['key', 'protocolVersion', 'phase']) ||
        readString(value, 'key') !== ORIGIN_COORDINATOR_YAML_STATE_KEY
      ) {
        return null;
      }
      return Object.freeze({
        key: ORIGIN_COORDINATOR_YAML_STATE_KEY,
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        phase,
      });
    }
    const rejected = phase === 'rejected';
    if (phase !== 'revoked' && !rejected) return null;
    const expectedKeys = rejected
      ? [
          'key',
          'protocolVersion',
          'phase',
          'activationId',
          'quiescenceRequestId',
          'participants',
          'evidence',
          'errorCode',
          'errorStage',
        ]
      : [
          'key',
          'protocolVersion',
          'phase',
          'status',
          'activationId',
          'quiescenceRequestId',
          'participants',
          'evidence',
        ];
    if (
      !hasExactOwnDataProperties(value, expectedKeys) ||
      readString(value, 'key') !== ORIGIN_COORDINATOR_YAML_STATE_KEY
    ) {
      return null;
    }
    const activationId = readString(value, 'activationId');
    const quiescenceRequestId = readString(value, 'quiescenceRequestId');
    const participantsProperty = readOwnDataProperty(value, 'participants');
    const evidenceProperty = readOwnDataProperty(value, 'evidence');
    const participants = participantsProperty.found
      ? parseParticipantArray(participantsProperty.value)
      : null;
    const evidence =
      participants && evidenceProperty.found
        ? parseEvidenceArray(evidenceProperty.value, participants)
        : null;
    if (
      activationId === null ||
      activationId.length === 0 ||
      quiescenceRequestId === null ||
      quiescenceRequestId.length === 0 ||
      participants === null ||
      evidence === null
    ) {
      return null;
    }
    if (rejected) {
      const errorCode = readString(value, 'errorCode');
      const errorStage = readString(value, 'errorStage');
      if (!isBridgeErrorCode(errorCode) || !isBridgeErrorStage(errorStage)) return null;
      return Object.freeze({
        key: ORIGIN_COORDINATOR_YAML_STATE_KEY,
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        phase,
        activationId,
        quiescenceRequestId,
        participants,
        evidence,
        errorCode,
        errorStage,
      });
    }
    const status = readString(value, 'status');
    if (status !== 'quiescing' && status !== 'ready-for-preflight') return null;
    if (
      (status === 'quiescing' && evidence.length >= participants.length) ||
      (status === 'ready-for-preflight' && evidence.length !== participants.length)
    ) {
      return null;
    }
    return Object.freeze({
      key: ORIGIN_COORDINATOR_YAML_STATE_KEY,
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      phase,
      status,
      activationId,
      quiescenceRequestId,
      participants,
      evidence,
    });
  } catch {
    return null;
  }
}

export function parseOriginCoordinatorHelloRequest(
  value: unknown
): OriginCoordinatorHelloRequest | null {
  try {
    if (
      !isPlainObject(value) ||
      !hasExactOwnDataProperties(value, ['type', 'protocolVersion', 'releaseId', 'capabilities']) ||
      !hasProtocolVersion(value)
    ) {
      return null;
    }
    const releaseId = readString(value, 'releaseId');
    const capabilities = readOwnDataProperty(value, 'capabilities');
    if (
      readString(value, 'type') !== 'HDB_COORDINATOR_HELLO' ||
      !isOriginCoordinatorReleaseId(releaseId) ||
      !capabilities.found ||
      !isBridgeCapabilities(capabilities.value)
    ) {
      return null;
    }
    return Object.freeze({
      type: 'HDB_COORDINATOR_HELLO',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      releaseId,
      capabilities: Object.freeze([
        ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
        ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
      ] as const),
    });
  } catch {
    return null;
  }
}

function isValidTimeout(timeoutMs: number | null): timeoutMs is number {
  return (
    timeoutMs !== null &&
    Number.isSafeInteger(timeoutMs) &&
    timeoutMs > 0 &&
    timeoutMs <= ORIGIN_COORDINATOR_MAX_CENSUS_TIMEOUT_MS
  );
}

export function parseOriginCoordinatorReadinessRequest(
  value: unknown
): OriginCoordinatorReadinessRequest | null {
  try {
    if (
      !isPlainObject(value) ||
      !hasExactOwnDataProperties(value, ['type', 'protocolVersion', 'requestId', 'timeoutMs']) ||
      !hasProtocolVersion(value)
    ) {
      return null;
    }
    const requestId = readString(value, 'requestId');
    const timeoutMs = readNumber(value, 'timeoutMs');
    if (
      readString(value, 'type') !== 'HDB_COORDINATOR_READINESS_REQUEST' ||
      requestId === null ||
      requestId.length === 0 ||
      !isValidTimeout(timeoutMs)
    ) {
      return null;
    }
    return Object.freeze({
      type: 'HDB_COORDINATOR_READINESS_REQUEST',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      requestId,
      timeoutMs,
    });
  } catch {
    return null;
  }
}

export function parseOriginCoordinatorCensusResponse(
  value: unknown
): OriginCoordinatorCensusResponse | null {
  try {
    if (
      !isPlainObject(value) ||
      !hasExactOwnDataProperties(value, [
        'type',
        'protocolVersion',
        'requestId',
        'releaseId',
        'capabilities',
      ]) ||
      !hasProtocolVersion(value)
    ) {
      return null;
    }
    const requestId = readString(value, 'requestId');
    const releaseId = readString(value, 'releaseId');
    const capabilities = readOwnDataProperty(value, 'capabilities');
    if (
      readString(value, 'type') !== 'HDB_COORDINATOR_CENSUS_RESPONSE' ||
      requestId === null ||
      requestId.length === 0 ||
      !isOriginCoordinatorReleaseId(releaseId) ||
      !capabilities.found ||
      !isBridgeCapabilities(capabilities.value)
    ) {
      return null;
    }
    return Object.freeze({
      type: 'HDB_COORDINATOR_CENSUS_RESPONSE',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      requestId,
      releaseId,
      capabilities: Object.freeze([
        ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
        ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
      ] as const),
    });
  } catch {
    return null;
  }
}

export function parseOriginCoordinatorQuiescenceStartRequest(
  value: unknown
): OriginCoordinatorQuiescenceStartRequest | null {
  try {
    if (
      !isPlainObject(value) ||
      !hasExactOwnDataProperties(value, [
        'type',
        'protocolVersion',
        'activationId',
        'quiescenceRequestId',
        'timeoutMs',
      ]) ||
      !hasProtocolVersion(value)
    ) {
      return null;
    }
    const activationId = readString(value, 'activationId');
    const quiescenceRequestId = readString(value, 'quiescenceRequestId');
    const timeoutMs = readNumber(value, 'timeoutMs');
    if (
      readString(value, 'type') !== 'HDB_COORDINATOR_QUIESCENCE_START_REQUEST' ||
      activationId === null ||
      activationId.length === 0 ||
      quiescenceRequestId === null ||
      quiescenceRequestId.length === 0 ||
      !isValidTimeout(timeoutMs)
    ) {
      return null;
    }
    return Object.freeze({
      type: 'HDB_COORDINATOR_QUIESCENCE_START_REQUEST',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      activationId,
      quiescenceRequestId,
      timeoutMs,
    });
  } catch {
    return null;
  }
}

export function parseOriginCoordinatorQuiescenceStatusRequest(
  value: unknown
): OriginCoordinatorQuiescenceStatusRequest | null {
  try {
    if (
      !isPlainObject(value) ||
      !hasExactOwnDataProperties(value, [
        'type',
        'protocolVersion',
        'activationId',
        'quiescenceRequestId',
      ]) ||
      !hasProtocolVersion(value)
    ) {
      return null;
    }
    const activationId = readString(value, 'activationId');
    const quiescenceRequestId = readString(value, 'quiescenceRequestId');
    if (
      readString(value, 'type') !== 'HDB_COORDINATOR_QUIESCENCE_STATUS_REQUEST' ||
      activationId === null ||
      activationId.length === 0 ||
      quiescenceRequestId === null ||
      quiescenceRequestId.length === 0
    ) {
      return null;
    }
    return Object.freeze({
      type: 'HDB_COORDINATOR_QUIESCENCE_STATUS_REQUEST',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      activationId,
      quiescenceRequestId,
    });
  } catch {
    return null;
  }
}

export function parseOriginCoordinatorHelloResult(
  value: unknown
): OriginCoordinatorHelloResult | null {
  try {
    if (!isPlainObject(value) || !hasProtocolVersion(value)) return null;
    const status = readString(value, 'status');
    if (readString(value, 'type') !== 'HDB_COORDINATOR_HELLO_RESULT') return null;
    if (status === 'accepted') {
      if (
        !hasExactOwnDataProperties(value, [
          'type',
          'protocolVersion',
          'status',
          'legacyYamlAccess',
        ]) ||
        readString(value, 'legacyYamlAccess') !== 'allowed'
      ) {
        return null;
      }
      return Object.freeze({
        type: 'HDB_COORDINATOR_HELLO_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        status,
        legacyYamlAccess: 'allowed',
      });
    }
    if (
      status !== 'rejected' ||
      !hasExactOwnDataProperties(value, ['type', 'protocolVersion', 'status', 'code'])
    ) {
      return null;
    }
    const code = readString(value, 'code');
    if (
      code !== 'INVALID_HELLO_REQUEST' &&
      code !== 'INVALID_DURABLE_STATE' &&
      code !== 'COORDINATOR_STORAGE_FAILED' &&
      code !== 'LEGACY_YAML_ACCESS_REVOKED' &&
      code !== 'LEGACY_YAML_ACCESS_REJECTED'
    ) {
      return null;
    }
    return Object.freeze({
      type: 'HDB_COORDINATOR_HELLO_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      status,
      code,
    });
  } catch {
    return null;
  }
}

function parseClientTypeCounts(value: unknown) {
  if (
    !isPlainObject(value) ||
    !hasExactOwnDataProperties(value, ['compatible', 'incompatible', 'unresponsive', 'discarded'])
  ) {
    return null;
  }
  const compatible = readNumber(value, 'compatible');
  const incompatible = readNumber(value, 'incompatible');
  const unresponsive = readNumber(value, 'unresponsive');
  const discarded = readNumber(value, 'discarded');
  if (
    compatible === null ||
    incompatible === null ||
    unresponsive === null ||
    discarded === null ||
    ![compatible, incompatible, unresponsive, discarded].every(
      (count) => Number.isSafeInteger(count) && count >= 0
    )
  ) {
    return null;
  }
  return Object.freeze({ compatible, incompatible, unresponsive, discarded });
}

export function parseOriginCoordinatorReadinessResult(
  value: unknown
): OriginCoordinatorReadinessResult | null {
  try {
    if (!isPlainObject(value) || !hasProtocolVersion(value)) return null;
    const status = readString(value, 'status');
    const requestId = readString(value, 'requestId');
    if (
      readString(value, 'type') !== 'HDB_COORDINATOR_READINESS_RESULT' ||
      requestId === null ||
      requestId.length === 0 ||
      !hasOwnDataValue(value, 'actualFenceEstablished', false)
    ) {
      return null;
    }
    const expectedKeys =
      status === 'accepted'
        ? ['type', 'protocolVersion', 'requestId', 'status', 'actualFenceEstablished', 'counts']
        : [
            'type',
            'protocolVersion',
            'requestId',
            'status',
            'actualFenceEstablished',
            'code',
            'counts',
          ];
    if (!hasExactOwnDataProperties(value, expectedKeys)) return null;
    const countsValue = readOwnDataProperty(value, 'counts');
    if (
      !countsValue.found ||
      !isPlainObject(countsValue.value) ||
      !hasExactOwnDataProperties(countsValue.value, ['window', 'worker', 'sharedworker'])
    ) {
      return null;
    }
    const windowValue = readOwnDataProperty(countsValue.value, 'window');
    const workerValue = readOwnDataProperty(countsValue.value, 'worker');
    const sharedWorkerValue = readOwnDataProperty(countsValue.value, 'sharedworker');
    const windowCounts = windowValue.found ? parseClientTypeCounts(windowValue.value) : null;
    const workerCounts = workerValue.found ? parseClientTypeCounts(workerValue.value) : null;
    const sharedworkerCounts = sharedWorkerValue.found
      ? parseClientTypeCounts(sharedWorkerValue.value)
      : null;
    if (!windowCounts || !workerCounts || !sharedworkerCounts) return null;
    const counts = Object.freeze({
      window: windowCounts,
      worker: workerCounts,
      sharedworker: sharedworkerCounts,
    });
    if (status === 'accepted') {
      return Object.freeze({
        type: 'HDB_COORDINATOR_READINESS_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        requestId,
        status,
        actualFenceEstablished: false,
        counts,
      });
    }
    if (status !== 'rejected') return null;
    const code = readString(value, 'code');
    if (
      code !== 'INVALID_READINESS_REQUEST' &&
      code !== 'INVALID_DURABLE_STATE' &&
      code !== 'COORDINATOR_STORAGE_FAILED' &&
      code !== 'CLIENT_CENSUS_FAILED' &&
      code !== 'INCOMPATIBLE_CLIENT' &&
      code !== 'UNRESPONSIVE_CLIENT' &&
      code !== 'MISSING_PRODUCTION_WINDOW' &&
      code !== 'MISSING_PRODUCTION_SHARED_WORKER' &&
      code !== 'LEGACY_YAML_ACCESS_REVOKED' &&
      code !== 'LEGACY_YAML_ACCESS_REJECTED'
    ) {
      return null;
    }
    return Object.freeze({
      type: 'HDB_COORDINATOR_READINESS_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      requestId,
      status,
      actualFenceEstablished: false,
      code,
      counts,
    });
  } catch {
    return null;
  }
}

function parseProgress(value: unknown) {
  if (
    !isPlainObject(value) ||
    !hasExactOwnDataProperties(value, ['participantCount', 'acknowledgedCount', 'discardedCount'])
  ) {
    return null;
  }
  const participantCount = readNumber(value, 'participantCount');
  const acknowledgedCount = readNumber(value, 'acknowledgedCount');
  const discardedCount = readNumber(value, 'discardedCount');
  if (
    participantCount === null ||
    acknowledgedCount === null ||
    discardedCount === null ||
    ![participantCount, acknowledgedCount, discardedCount].every(
      (count) => Number.isSafeInteger(count) && count >= 0
    ) ||
    participantCount === 0 ||
    acknowledgedCount + discardedCount > participantCount
  ) {
    return null;
  }
  return Object.freeze({ participantCount, acknowledgedCount, discardedCount });
}

export function parseOriginCoordinatorQuiescenceResult(
  value: unknown
): OriginCoordinatorQuiescenceResult | null {
  try {
    if (
      !isPlainObject(value) ||
      !hasProtocolVersion(value) ||
      readString(value, 'type') !== 'HDB_COORDINATOR_QUIESCENCE_RESULT' ||
      !hasOwnDataValue(value, 'actualFenceEstablished', false)
    ) {
      return null;
    }
    const status = readString(value, 'status');
    if (status === 'request-rejected') {
      if (
        !hasExactOwnDataProperties(value, [
          'type',
          'protocolVersion',
          'status',
          'actualFenceEstablished',
          'code',
        ])
      ) {
        return null;
      }
      const code = readString(value, 'code');
      if (!isQuiescenceRequestErrorCode(code)) return null;
      return Object.freeze({
        type: 'HDB_COORDINATOR_QUIESCENCE_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        status,
        actualFenceEstablished: false,
        code,
      });
    }
    const rejected = status === 'rejected';
    if (status !== 'quiescing' && status !== 'ready-for-preflight' && !rejected) return null;
    const expectedKeys = rejected
      ? [
          'type',
          'protocolVersion',
          'status',
          'activationId',
          'quiescenceRequestId',
          'actualFenceEstablished',
          'progress',
          'errorCode',
          'errorStage',
        ]
      : [
          'type',
          'protocolVersion',
          'status',
          'activationId',
          'quiescenceRequestId',
          'actualFenceEstablished',
          'progress',
        ];
    if (!hasExactOwnDataProperties(value, expectedKeys)) return null;
    const activationId = readString(value, 'activationId');
    const quiescenceRequestId = readString(value, 'quiescenceRequestId');
    const progressProperty = readOwnDataProperty(value, 'progress');
    const progress = progressProperty.found ? parseProgress(progressProperty.value) : null;
    if (
      activationId === null ||
      activationId.length === 0 ||
      quiescenceRequestId === null ||
      quiescenceRequestId.length === 0 ||
      progress === null ||
      (status === 'quiescing' &&
        progress.acknowledgedCount + progress.discardedCount >= progress.participantCount) ||
      (status === 'ready-for-preflight' &&
        progress.acknowledgedCount + progress.discardedCount !== progress.participantCount)
    ) {
      return null;
    }
    if (rejected) {
      const errorCode = readString(value, 'errorCode');
      const errorStage = readString(value, 'errorStage');
      if (!isBridgeErrorCode(errorCode) || !isBridgeErrorStage(errorStage)) return null;
      return Object.freeze({
        type: 'HDB_COORDINATOR_QUIESCENCE_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        status,
        activationId,
        quiescenceRequestId,
        actualFenceEstablished: false,
        progress,
        errorCode,
        errorStage,
      });
    }
    return Object.freeze({
      type: 'HDB_COORDINATOR_QUIESCENCE_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      status,
      activationId,
      quiescenceRequestId,
      actualFenceEstablished: false,
      progress,
    });
  } catch {
    return null;
  }
}
