import { planYamlCoreDbMigration } from '@hierarchidb/yaml-api/migration';
import { readAllCoreDbNodes, validateCoreDbV2Schema } from './yamlStorageCoreDbSchemaUtils.js';
import type {
  YamlStorageCoreDbError,
  YamlStorageCoreDbErrorCode,
} from './yamlStorageCoreDbTypes.js';
import { selectYamlStorageRawNodes } from './yamlStorageRawSnapshotUtils.js';

const CANONICAL_VALIDATION_MIGRATION_ID = 'yaml-coredb-canonical-validation';

export type ValidateCanonicalYamlStorageCoreDbResult =
  | Readonly<{ readonly ok: true }>
  | Readonly<{
      readonly ok: false;
      readonly code: YamlStorageCoreDbErrorCode;
      readonly planningErrors?: YamlStorageCoreDbError['planningErrors'];
    }>;

/** Proves exact v2 topology and a canonical-only YAML snapshot without writing. */
export async function validateCanonicalYamlStorageCoreDb(
  database: IDBDatabase,
  digestSha256Hex: (bytes: Uint8Array) => Promise<string>
): Promise<ValidateCanonicalYamlStorageCoreDbResult> {
  if (!validateCoreDbV2Schema(database)) {
    return Object.freeze({ ok: false, code: 'CORE_DB_SCHEMA_MISMATCH' });
  }

  let rawYamlNodes: readonly unknown[];
  try {
    const selected = selectYamlStorageRawNodes(await readAllCoreDbNodes(database));
    if (!selected.ok) return Object.freeze({ ok: false, code: 'CORE_DB_SNAPSHOT_FAILED' });
    rawYamlNodes = selected.rawYamlNodes;
  } catch {
    return Object.freeze({ ok: false, code: 'CORE_DB_SNAPSHOT_FAILED' });
  }

  let planningResult: Awaited<ReturnType<typeof planYamlCoreDbMigration>>;
  try {
    planningResult = await planYamlCoreDbMigration({
      migrationId: CANONICAL_VALIDATION_MIGRATION_ID,
      fromCoreDbVersion: 1,
      toCoreDbVersion: 2,
      rawNodes: rawYamlNodes,
      digestSha256Hex,
    });
  } catch {
    return Object.freeze({
      ok: false,
      code: 'POST_ACTIVATION_CANONICAL_VALIDATION_FAILED',
    });
  }
  if (planningResult.ok === false) {
    return Object.freeze({
      ok: false,
      code: 'POST_ACTIVATION_CANONICAL_VALIDATION_FAILED',
      planningErrors: Object.freeze([...planningResult.errors]),
    });
  }
  if (planningResult.plan.entries.some((entry) => entry.action !== 'validated-noop')) {
    return Object.freeze({
      ok: false,
      code: 'POST_ACTIVATION_CANONICAL_VALIDATION_FAILED',
    });
  }
  return Object.freeze({ ok: true });
}
