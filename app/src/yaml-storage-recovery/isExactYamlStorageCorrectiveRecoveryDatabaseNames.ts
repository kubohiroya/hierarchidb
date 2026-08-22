import type { YamlStorageCorrectiveRecoveryDatabaseNames } from './yamlStorageCorrectiveRecoveryTypes.js';

const DATABASE_PREFIX_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CANONICAL_CORE_SUFFIX = '-core';

/** Validates the complete, non-fallback database-name authority for corrective recovery. */
export function isExactYamlStorageCorrectiveRecoveryDatabaseNames(
  names: YamlStorageCorrectiveRecoveryDatabaseNames
): boolean {
  if (!names.canonicalCore.endsWith(CANONICAL_CORE_SUFFIX)) return false;
  const prefix = names.canonicalCore.slice(0, -CANONICAL_CORE_SUFFIX.length);
  return (
    DATABASE_PREFIX_PATTERN.test(prefix) &&
    names.coordinator === 'hierarchidb-origin-coordinator' &&
    names.canonicalCore === `${prefix}-core` &&
    names.interruptedCore === 'hidb-core' &&
    names.yaml === `${prefix}-yaml` &&
    names.recovery === `${prefix}-yaml-storage-recovery` &&
    new Set(Object.values(names)).size === 5
  );
}
