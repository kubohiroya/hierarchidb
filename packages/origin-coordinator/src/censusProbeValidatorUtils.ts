import { ORIGIN_COORDINATOR_PROTOCOL_VERSION } from './constants.js';
import type { OriginCoordinatorCensusProbe } from './types.js';

const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/u;

function readOwnDataProperty(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
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
  return expected.every((key, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return names[index] === key && descriptor !== undefined && 'value' in descriptor;
  });
}

export function isOriginCoordinatorReleaseId(value: unknown): value is string {
  return typeof value === 'string' && SOURCE_SHA_PATTERN.test(value);
}

export function parseOriginCoordinatorCensusProbe(
  value: unknown
): OriginCoordinatorCensusProbe | null {
  try {
    if (
      !isPlainObject(value) ||
      !hasExactOwnDataProperties(value, ['type', 'protocolVersion', 'requestId'])
    ) {
      return null;
    }
    const type = readOwnDataProperty(value, 'type');
    const protocolVersion = readOwnDataProperty(value, 'protocolVersion');
    const requestId = readOwnDataProperty(value, 'requestId');
    if (
      type !== 'HDB_COORDINATOR_CENSUS_PROBE' ||
      protocolVersion !== ORIGIN_COORDINATOR_PROTOCOL_VERSION ||
      typeof requestId !== 'string' ||
      requestId.length === 0
    ) {
      return null;
    }
    return Object.freeze({ type, protocolVersion, requestId });
  } catch {
    return null;
  }
}
