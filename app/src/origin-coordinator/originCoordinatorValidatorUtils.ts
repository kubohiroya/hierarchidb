import {
  isOriginCoordinatorReleaseId,
  ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
  ORIGIN_COORDINATOR_MAX_CENSUS_TIMEOUT_MS,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
  ORIGIN_COORDINATOR_YAML_STATE_KEY,
  type OriginCoordinatorCensusResponse,
} from '@hierarchidb/origin-coordinator';
import type {
  OriginCoordinatorAllowedState,
  OriginCoordinatorHelloRequest,
  OriginCoordinatorHelloResult,
  OriginCoordinatorReadinessRequest,
  OriginCoordinatorReadinessResult,
} from './types.js';

type OwnDataProperty =
  | { readonly found: false }
  | { readonly found: true; readonly value: unknown };

function readOwnDataProperty(value: object, key: string): OwnDataProperty {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !('value' in descriptor)) {
    return { found: false };
  }
  return { found: true, value: descriptor.value };
}

function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactOwnDataProperties(value: object, expectedKeys: readonly string[]): boolean {
  const names = Object.getOwnPropertyNames(value).sort();
  const expected = [...expectedKeys].sort();
  if (names.length !== expected.length || Object.getOwnPropertySymbols(value).length !== 0) {
    return false;
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (names[index] !== expected[index]) return false;
  }
  return expected.every((key) => readOwnDataProperty(value, key).found);
}

function isFoundationCapabilities(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  if (Object.getOwnPropertySymbols(value).length !== 0) return false;
  const names = Object.getOwnPropertyNames(value).sort();
  if (names.length !== 2 || names[0] !== '0' || names[1] !== 'length') return false;
  const item = readOwnDataProperty(value, '0');
  const length = readOwnDataProperty(value, 'length');
  return (
    item.found &&
    item.value === ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY &&
    length.found &&
    length.value === 1
  );
}

function readString(value: object, key: string): string | null {
  const property = readOwnDataProperty(value, key);
  return property.found && typeof property.value === 'string' ? property.value : null;
}

function readNumber(value: object, key: string): number | null {
  const property = readOwnDataProperty(value, key);
  return property.found && typeof property.value === 'number' ? property.value : null;
}

function hasProtocolVersion(value: object): boolean {
  const property = readOwnDataProperty(value, 'protocolVersion');
  return property.found && property.value === ORIGIN_COORDINATOR_PROTOCOL_VERSION;
}

export function parseOriginCoordinatorAllowedState(
  value: unknown
): OriginCoordinatorAllowedState | null {
  try {
    if (
      !isPlainObject(value) ||
      !hasExactOwnDataProperties(value, ['key', 'protocolVersion', 'phase']) ||
      !hasProtocolVersion(value)
    ) {
      return null;
    }
    const key = readString(value, 'key');
    const phase = readString(value, 'phase');
    if (key !== ORIGIN_COORDINATOR_YAML_STATE_KEY || phase !== 'allowed') return null;
    return Object.freeze({
      key: ORIGIN_COORDINATOR_YAML_STATE_KEY,
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      phase: 'allowed',
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
    const type = readString(value, 'type');
    const releaseId = readString(value, 'releaseId');
    const capabilities = readOwnDataProperty(value, 'capabilities');
    if (
      type !== 'HDB_COORDINATOR_HELLO' ||
      !isOriginCoordinatorReleaseId(releaseId) ||
      !capabilities.found ||
      !isFoundationCapabilities(capabilities.value)
    ) {
      return null;
    }
    return Object.freeze({
      type,
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      releaseId,
      capabilities: Object.freeze([ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY] as const),
    });
  } catch {
    return null;
  }
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
    const type = readString(value, 'type');
    const requestId = readString(value, 'requestId');
    const timeoutMs = readNumber(value, 'timeoutMs');
    if (
      type !== 'HDB_COORDINATOR_READINESS_REQUEST' ||
      requestId === null ||
      requestId.length === 0 ||
      timeoutMs === null ||
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs <= 0 ||
      timeoutMs > ORIGIN_COORDINATOR_MAX_CENSUS_TIMEOUT_MS
    ) {
      return null;
    }
    return Object.freeze({
      type,
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
    const type = readString(value, 'type');
    const requestId = readString(value, 'requestId');
    const releaseId = readString(value, 'releaseId');
    const capabilities = readOwnDataProperty(value, 'capabilities');
    if (
      type !== 'HDB_COORDINATOR_CENSUS_RESPONSE' ||
      requestId === null ||
      requestId.length === 0 ||
      !isOriginCoordinatorReleaseId(releaseId) ||
      !capabilities.found ||
      !isFoundationCapabilities(capabilities.value)
    ) {
      return null;
    }
    return Object.freeze({
      type,
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      requestId,
      releaseId,
      capabilities: Object.freeze([ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY] as const),
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
    const type = readString(value, 'type');
    if (type !== 'HDB_COORDINATOR_HELLO_RESULT') return null;
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
        type,
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        status,
        legacyYamlAccess: 'allowed',
      });
    }
    if (status !== 'rejected') return null;
    if (!hasExactOwnDataProperties(value, ['type', 'protocolVersion', 'status', 'code'])) {
      return null;
    }
    const code = readString(value, 'code');
    if (
      code !== 'INVALID_HELLO_REQUEST' &&
      code !== 'INVALID_DURABLE_STATE' &&
      code !== 'COORDINATOR_STORAGE_FAILED'
    ) {
      return null;
    }
    return Object.freeze({
      type,
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
    const type = readString(value, 'type');
    const requestId = readString(value, 'requestId');
    if (
      type !== 'HDB_COORDINATOR_READINESS_RESULT' ||
      requestId === null ||
      requestId.length === 0
    ) {
      return null;
    }
    const expectedKeys =
      status === 'accepted'
        ? ['type', 'protocolVersion', 'requestId', 'status', 'counts']
        : ['type', 'protocolVersion', 'requestId', 'status', 'code', 'counts'];
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
        type,
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        requestId,
        status,
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
      code !== 'UNRESPONSIVE_CLIENT'
    ) {
      return null;
    }
    return Object.freeze({
      type,
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      requestId,
      status,
      code,
      counts,
    });
  } catch {
    return null;
  }
}
