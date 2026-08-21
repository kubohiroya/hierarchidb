import { freezeIssuedYamlStorageActivationState } from './yamlStorageActivationProvenanceUtils.js';
import type {
  YamlStorageActivationError,
  YamlStoragePostActivationReadyInput,
  YamlStoragePostActivationReadyResult,
} from './yamlStorageActivationTypes.js';

const INPUT_KEYS = Object.freeze([
  'activationId',
  'currentVersion',
  'targetVersion',
  'openRequestId',
  'coordinatorGate',
  'schemaValidated',
  'canonicalSnapshotValidated',
  'initializationSucceeded',
] as const);

function invalidEvidence(): YamlStoragePostActivationReadyResult {
  const error: YamlStorageActivationError = Object.freeze({
    code: 'INVALID_POST_ACTIVATION_EVIDENCE',
    stage: 'post-activation-boot',
  });
  return Object.freeze({ ok: false, error });
}

function isPlainRecord(value: unknown): value is Readonly<Record<PropertyKey, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readOwnDataProperty(
  value: Readonly<Record<PropertyKey, unknown>>,
  key: PropertyKey
):
  | Readonly<{ readonly found: false }>
  | Readonly<{ readonly found: true; readonly value: unknown }> {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !Object.hasOwn(descriptor, 'value')) {
    return Object.freeze({ found: false });
  }
  return Object.freeze({ found: true, value: descriptor.value });
}

function parseInput(value: unknown): YamlStoragePostActivationReadyInput | null {
  try {
    if (!isPlainRecord(value)) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== INPUT_KEYS.length ||
      ownKeys.some((key) => !INPUT_KEYS.includes(key as (typeof INPUT_KEYS)[number]))
    ) {
      return null;
    }
    const properties = Object.fromEntries(
      INPUT_KEYS.map((key) => [key, readOwnDataProperty(value, key)])
    ) as Record<(typeof INPUT_KEYS)[number], ReturnType<typeof readOwnDataProperty>>;
    const activationIdProperty = properties.activationId;
    const currentVersionProperty = properties.currentVersion;
    const targetVersionProperty = properties.targetVersion;
    const openRequestIdProperty = properties.openRequestId;
    const coordinatorGateProperty = properties.coordinatorGate;
    const schemaValidatedProperty = properties.schemaValidated;
    const canonicalSnapshotValidatedProperty = properties.canonicalSnapshotValidated;
    const initializationSucceededProperty = properties.initializationSucceeded;
    if (
      activationIdProperty.found === false ||
      currentVersionProperty.found === false ||
      targetVersionProperty.found === false ||
      openRequestIdProperty.found === false ||
      coordinatorGateProperty.found === false ||
      schemaValidatedProperty.found === false ||
      canonicalSnapshotValidatedProperty.found === false ||
      initializationSucceededProperty.found === false
    ) {
      return null;
    }

    const activationId = activationIdProperty.value;
    const currentVersion = currentVersionProperty.value;
    const targetVersion = targetVersionProperty.value;
    const openRequestId = openRequestIdProperty.value;
    if (
      typeof activationId !== 'string' ||
      activationId.length === 0 ||
      typeof openRequestId !== 'string' ||
      openRequestId.length === 0 ||
      typeof currentVersion !== 'number' ||
      !Number.isSafeInteger(currentVersion) ||
      currentVersion <= 0 ||
      typeof targetVersion !== 'number' ||
      !Number.isSafeInteger(targetVersion) ||
      targetVersion <= 0 ||
      currentVersion !== targetVersion ||
      coordinatorGateProperty.value !== 'revoked-ready-for-preflight' ||
      schemaValidatedProperty.value !== true ||
      canonicalSnapshotValidatedProperty.value !== true ||
      initializationSucceededProperty.value !== true
    ) {
      return null;
    }
    return {
      activationId,
      currentVersion,
      targetVersion,
      openRequestId,
      coordinatorGate: 'revoked-ready-for-preflight',
      schemaValidated: true,
      canonicalSnapshotValidated: true,
      initializationSucceeded: true,
    };
  } catch {
    return null;
  }
}

/** Issues canonical-ready only from complete post-activation boot evidence. */
export function createYamlStoragePostActivationReady(
  inputValue: unknown
): YamlStoragePostActivationReadyResult {
  const input = parseInput(inputValue);
  if (input === null) return invalidEvidence();
  const state = freezeIssuedYamlStorageActivationState({
    phase: 'canonical-ready',
    activationId: input.activationId,
    currentVersion: input.currentVersion,
    targetVersion: input.targetVersion,
    openRequestId: input.openRequestId,
    upgradeCommitted: true,
    initializationSucceeded: true,
    readinessProof: 'post-activation-boot',
  });
  return Object.freeze({ ok: true, state });
}
