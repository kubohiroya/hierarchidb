import { ORIGIN_COORDINATOR_PROTOCOL_VERSION } from './constants.js';
import type {
  OriginCoordinatorCensusProbe,
  OriginCoordinatorParticipantKind,
  OriginCoordinatorParticipantQuiescenceRequest,
  OriginCoordinatorParticipantQuiescenceResult,
  OriginCoordinatorSharedWorkerRelayRequest,
} from './types.js';

const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/u;

type OwnDataProperty =
  | Readonly<{ readonly found: false }>
  | Readonly<{ readonly found: true; readonly value: unknown }>;

function readOwnDataProperty(value: object, key: string): OwnDataProperty {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor
    ? { found: true, value: descriptor.value }
    : { found: false };
}

function hasExactOwnDataProperties(
  value: unknown,
  expectedKeys: readonly string[]
): value is object {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  return (
    keys.length === expectedKeys.length &&
    keys.every((key) => typeof key === 'string' && expectedKeys.includes(key)) &&
    expectedKeys.every((key) => readOwnDataProperty(value, key).found)
  );
}

function readString(value: object, key: string): string | null {
  const property = readOwnDataProperty(value, key);
  return property.found && typeof property.value === 'string' ? property.value : null;
}

function isParticipantKind(value: unknown): value is OriginCoordinatorParticipantKind {
  return value === 'tab' || value === 'worker';
}

export function isOriginCoordinatorReleaseId(value: unknown): value is string {
  return typeof value === 'string' && SOURCE_SHA_PATTERN.test(value);
}

export function parseOriginCoordinatorCensusProbe(
  value: unknown
): OriginCoordinatorCensusProbe | null {
  try {
    if (!hasExactOwnDataProperties(value, ['type', 'protocolVersion', 'requestId'])) return null;
    const type = readString(value, 'type');
    const protocolVersion = readOwnDataProperty(value, 'protocolVersion');
    const requestId = readString(value, 'requestId');
    if (
      type !== 'HDB_COORDINATOR_CENSUS_PROBE' ||
      !protocolVersion.found ||
      protocolVersion.value !== ORIGIN_COORDINATOR_PROTOCOL_VERSION ||
      requestId === null ||
      requestId.length === 0
    ) {
      return null;
    }
    return Object.freeze({ type, protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION, requestId });
  } catch {
    return null;
  }
}

export function parseOriginCoordinatorParticipantQuiescenceRequest(
  value: unknown
): OriginCoordinatorParticipantQuiescenceRequest | null {
  try {
    if (
      !hasExactOwnDataProperties(value, [
        'type',
        'protocolVersion',
        'activationId',
        'quiescenceRequestId',
        'participantKind',
        'participantId',
      ])
    ) {
      return null;
    }
    const type = readString(value, 'type');
    const protocolVersion = readOwnDataProperty(value, 'protocolVersion');
    const activationId = readString(value, 'activationId');
    const quiescenceRequestId = readString(value, 'quiescenceRequestId');
    const participantKind = readOwnDataProperty(value, 'participantKind');
    const participantId = readString(value, 'participantId');
    if (
      type !== 'HDB_COORDINATOR_PARTICIPANT_QUIESCENCE_REQUEST' ||
      !protocolVersion.found ||
      protocolVersion.value !== ORIGIN_COORDINATOR_PROTOCOL_VERSION ||
      activationId === null ||
      activationId.length === 0 ||
      quiescenceRequestId === null ||
      quiescenceRequestId.length === 0 ||
      !participantKind.found ||
      !isParticipantKind(participantKind.value) ||
      participantId === null ||
      participantId.length === 0
    ) {
      return null;
    }
    return Object.freeze({
      type,
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      activationId,
      quiescenceRequestId,
      participantKind: participantKind.value,
      participantId,
    });
  } catch {
    return null;
  }
}

export function parseOriginCoordinatorSharedWorkerRelayRequest(
  value: unknown
): OriginCoordinatorSharedWorkerRelayRequest | null {
  try {
    if (
      !hasExactOwnDataProperties(value, [
        'type',
        'protocolVersion',
        'targetClientId',
        'targetClientUrl',
        'request',
      ])
    ) {
      return null;
    }
    const type = readString(value, 'type');
    const protocolVersion = readOwnDataProperty(value, 'protocolVersion');
    const targetClientId = readString(value, 'targetClientId');
    const targetClientUrl = readString(value, 'targetClientUrl');
    const requestProperty = readOwnDataProperty(value, 'request');
    if (
      type !== 'HDB_COORDINATOR_SHARED_WORKER_RELAY_REQUEST' ||
      !protocolVersion.found ||
      protocolVersion.value !== ORIGIN_COORDINATOR_PROTOCOL_VERSION ||
      targetClientId === null ||
      targetClientId.length === 0 ||
      targetClientUrl === null ||
      targetClientUrl.length === 0 ||
      !requestProperty.found
    ) {
      return null;
    }
    const censusProbe = parseOriginCoordinatorCensusProbe(requestProperty.value);
    if (censusProbe !== null) {
      return Object.freeze({
        type,
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        targetClientId,
        targetClientUrl,
        request: censusProbe,
      });
    }
    const quiescenceRequest = parseOriginCoordinatorParticipantQuiescenceRequest(
      requestProperty.value
    );
    if (
      quiescenceRequest === null ||
      quiescenceRequest.participantKind !== 'worker' ||
      quiescenceRequest.participantId !== targetClientId
    ) {
      return null;
    }
    return Object.freeze({
      type,
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      targetClientId,
      targetClientUrl,
      request: quiescenceRequest,
    });
  } catch {
    return null;
  }
}

export function parseOriginCoordinatorParticipantQuiescenceResult(
  value: unknown
): OriginCoordinatorParticipantQuiescenceResult | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const status = readString(value, 'status');
    const expectedKeys =
      status === 'acknowledged'
        ? [
            'type',
            'protocolVersion',
            'status',
            'activationId',
            'quiescenceRequestId',
            'participantKind',
            'participantId',
            'legacyYamlEntrypointsRevoked',
            'ownedStorageHandlesClosed',
          ]
        : status === 'failed'
          ? [
              'type',
              'protocolVersion',
              'status',
              'activationId',
              'quiescenceRequestId',
              'participantKind',
              'participantId',
            ]
          : null;
    if (expectedKeys === null || !hasExactOwnDataProperties(value, expectedKeys)) return null;
    const type = readString(value, 'type');
    const protocolVersion = readOwnDataProperty(value, 'protocolVersion');
    const activationId = readString(value, 'activationId');
    const quiescenceRequestId = readString(value, 'quiescenceRequestId');
    const participantKind = readOwnDataProperty(value, 'participantKind');
    const participantId = readString(value, 'participantId');
    if (
      type !== 'HDB_COORDINATOR_PARTICIPANT_QUIESCENCE_RESULT' ||
      !protocolVersion.found ||
      protocolVersion.value !== ORIGIN_COORDINATOR_PROTOCOL_VERSION ||
      activationId === null ||
      activationId.length === 0 ||
      quiescenceRequestId === null ||
      quiescenceRequestId.length === 0 ||
      !participantKind.found ||
      !isParticipantKind(participantKind.value) ||
      participantId === null ||
      participantId.length === 0
    ) {
      return null;
    }
    if (status === 'failed') {
      return Object.freeze({
        type,
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        status,
        activationId,
        quiescenceRequestId,
        participantKind: participantKind.value,
        participantId,
      });
    }
    const legacyYamlEntrypointsRevoked = readOwnDataProperty(value, 'legacyYamlEntrypointsRevoked');
    const ownedStorageHandlesClosed = readOwnDataProperty(value, 'ownedStorageHandlesClosed');
    if (
      !legacyYamlEntrypointsRevoked.found ||
      typeof legacyYamlEntrypointsRevoked.value !== 'boolean' ||
      !ownedStorageHandlesClosed.found ||
      typeof ownedStorageHandlesClosed.value !== 'boolean'
    ) {
      return null;
    }
    return Object.freeze({
      type,
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      status: 'acknowledged',
      activationId,
      quiescenceRequestId,
      participantKind: participantKind.value,
      participantId,
      legacyYamlEntrypointsRevoked: legacyYamlEntrypointsRevoked.value,
      ownedStorageHandlesClosed: ownedStorageHandlesClosed.value,
    });
  } catch {
    return null;
  }
}
