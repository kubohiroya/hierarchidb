import { createYamlStoragePostActivationReady } from '../yaml-storage-activation/createYamlStoragePostActivationReady.js';
import { validateCanonicalYamlStorageCoreDb } from './validateCanonicalYamlStorageCoreDb.js';
import { openExistingCoreDb } from './yamlStorageCoreDbSchemaUtils.js';
import type {
  InspectCanonicalYamlStorageCoreDbInput,
  InspectCanonicalYamlStorageCoreDbResult,
  YamlStorageCoreDbError,
  YamlStorageCoreDbErrorCode,
} from './yamlStorageCoreDbTypes.js';
import {
  CORE_DB_CANONICAL_LOGICAL_VERSION,
  CORE_DB_CANONICAL_NATIVE_VERSION,
} from './yamlStorageCoreDbVersionConstants.js';

function failedResult(
  code: YamlStorageCoreDbErrorCode,
  planningErrors?: YamlStorageCoreDbError['planningErrors']
): InspectCanonicalYamlStorageCoreDbResult {
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code,
      ...(planningErrors === undefined ? {} : { planningErrors }),
    }),
  });
}

function isValidInput(input: InspectCanonicalYamlStorageCoreDbInput): boolean {
  return (
    typeof input.activationId === 'string' &&
    input.activationId.length > 0 &&
    typeof input.databaseName === 'string' &&
    input.databaseName.length > 0 &&
    input.targetVersion === CORE_DB_CANONICAL_LOGICAL_VERSION &&
    typeof input.openRequestId === 'string' &&
    input.openRequestId.length > 0 &&
    input.coordinatorGate === 'revoked-ready-for-preflight' &&
    typeof input.environment.digestSha256Hex === 'function' &&
    typeof input.environment.initializeCoreDb === 'function'
  );
}

/** Validates an already-activated CoreDB before a revoked successor starts canonical runtime. */
export async function inspectCanonicalYamlStorageCoreDb(
  input: InspectCanonicalYamlStorageCoreDbInput
): Promise<InspectCanonicalYamlStorageCoreDbResult> {
  if (!isValidInput(input)) return failedResult('INVALID_ACTIVATION_INPUT');
  const opened = await openExistingCoreDb(
    input.environment.indexedDB,
    input.databaseName,
    CORE_DB_CANONICAL_NATIVE_VERSION
  );
  if (opened.ok === false) return failedResult(opened.code);

  let validationResult: Awaited<ReturnType<typeof validateCanonicalYamlStorageCoreDb>>;
  try {
    validationResult = await validateCanonicalYamlStorageCoreDb(
      opened.database,
      input.environment.digestSha256Hex
    );
  } catch {
    return failedResult('CORE_DB_SNAPSHOT_FAILED');
  } finally {
    opened.database.close();
  }
  if (validationResult.ok === false) {
    return failedResult(validationResult.code, validationResult.planningErrors);
  }

  try {
    await input.environment.initializeCoreDb();
  } catch {
    return failedResult('CORE_DB_INITIALIZATION_FAILED');
  }
  const ready = createYamlStoragePostActivationReady({
    activationId: input.activationId,
    currentVersion: input.targetVersion,
    targetVersion: input.targetVersion,
    openRequestId: input.openRequestId,
    coordinatorGate: input.coordinatorGate,
    schemaValidated: true,
    canonicalSnapshotValidated: true,
    initializationSucceeded: true,
  });
  return ready.ok
    ? Object.freeze({ ok: true, state: ready.state })
    : failedResult('POST_ACTIVATION_CANONICAL_VALIDATION_FAILED');
}
