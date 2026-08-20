import { digestSha256Hex } from '@hierarchidb/util';
import type {
  YamlCoreDbReadOnlyInventoryResult,
  YamlCoreDbReadOnlyInventorySlotCounts,
} from '@hierarchidb/worker-api';
import {
  planYamlCoreDbMigration,
  type YamlCoreDbMigrationError,
  type YamlCoreDbMigrationPlan,
} from '@hierarchidb/yaml-api/migration';
import type { CoreDB } from './CoreDB.js';

const INVENTORY_CONTRACT_VERSION = 1 as const;
const INVENTORY_MIGRATION_ID = 'yaml-coredb-readonly-inventory';
const INVENTORY_FROM_CORE_DB_VERSION = 1;
const INVENTORY_TO_CORE_DB_VERSION = 2;

function hasOwnYamlFileNodeType(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  const descriptor = Object.getOwnPropertyDescriptor(value, 'nodeType');
  return (
    descriptor !== undefined &&
    Object.hasOwn(descriptor, 'value') &&
    descriptor.value === 'yaml-file'
  );
}

function freezeMigrationError(error: YamlCoreDbMigrationError): YamlCoreDbMigrationError {
  const context =
    error.context === undefined
      ? undefined
      : Object.freeze({
          ...(error.context.field === undefined ? {} : { field: error.context.field }),
          ...(error.context.reason === undefined ? {} : { reason: error.context.reason }),
        });
  const copy: YamlCoreDbMigrationError = {
    sourceIndex: error.sourceIndex,
    ...(error.nodeId === undefined ? {} : { nodeId: error.nodeId }),
    slot: error.slot,
    code: error.code,
    ...(context === undefined ? {} : { context }),
  };
  return Object.freeze(copy);
}

function createAcceptedResult(
  yamlNodeCount: number,
  plan: YamlCoreDbMigrationPlan
): YamlCoreDbReadOnlyInventoryResult {
  const mutableCounts = {
    legacyWithName: 0,
    hostSplitLegacy: 0,
    canonical: 0,
    temporaryPlaceholder: 0,
    metadataOnlyDraft: 0,
  };
  for (const entry of plan.entries) {
    if (entry.action === 'migrate') {
      if (entry.preimageRepresentation === 'legacy-with-name') {
        mutableCounts.legacyWithName += 1;
      } else {
        mutableCounts.hostSplitLegacy += 1;
      }
      continue;
    }
    if (entry.reason === 'canonical') {
      mutableCounts.canonical += 1;
    } else if (entry.reason === 'temporary-placeholder') {
      mutableCounts.temporaryPlaceholder += 1;
    } else {
      mutableCounts.metadataOnlyDraft += 1;
    }
  }
  const slotCounts: YamlCoreDbReadOnlyInventorySlotCounts = Object.freeze(mutableCounts);
  return Object.freeze({
    contractVersion: INVENTORY_CONTRACT_VERSION,
    status: 'accepted',
    yamlNodeCount,
    slotCount: plan.entries.length,
    invalidRecordCount: 0,
    errorCount: 0,
    slotCounts,
  });
}

function createRejectedResult(
  yamlNodeCount: number,
  errors: readonly YamlCoreDbMigrationError[]
): YamlCoreDbReadOnlyInventoryResult {
  const invalidSourceIndexes = new Set<number>();
  for (const error of errors) {
    if (error.sourceIndex >= 0) invalidSourceIndexes.add(error.sourceIndex);
  }
  if (invalidSourceIndexes.size === 0) {
    return Object.freeze({
      contractVersion: INVENTORY_CONTRACT_VERSION,
      status: 'failed',
      code: 'INVENTORY_PLANNING_FAILED',
    });
  }
  const frozenErrors = Object.freeze(errors.map(freezeMigrationError));
  return Object.freeze({
    contractVersion: INVENTORY_CONTRACT_VERSION,
    status: 'rejected',
    yamlNodeCount,
    invalidRecordCount: invalidSourceIndexes.size,
    errorCount: frozenErrors.length,
    errors: frozenErrors,
  });
}

/** Reads and classifies all persisted CoreDB YAML records without writing storage. */
export async function getYamlCoreDbReadOnlyInventory(
  coreDB: CoreDB
): Promise<YamlCoreDbReadOnlyInventoryResult> {
  let rawYamlNodes: readonly unknown[];
  try {
    const rawNodes: readonly unknown[] = await coreDB.runInTx('r', ['nodes'], async () =>
      coreDB.nodes.toArray()
    );
    rawYamlNodes = rawNodes.filter(hasOwnYamlFileNodeType);
  } catch {
    return Object.freeze({
      contractVersion: INVENTORY_CONTRACT_VERSION,
      status: 'failed',
      code: 'COREDB_READ_FAILED',
    });
  }

  try {
    const result = await planYamlCoreDbMigration({
      migrationId: INVENTORY_MIGRATION_ID,
      fromCoreDbVersion: INVENTORY_FROM_CORE_DB_VERSION,
      toCoreDbVersion: INVENTORY_TO_CORE_DB_VERSION,
      rawNodes: rawYamlNodes,
      digestSha256Hex,
    });
    return result.ok === true
      ? createAcceptedResult(rawYamlNodes.length, result.plan)
      : createRejectedResult(rawYamlNodes.length, result.errors);
  } catch {
    return Object.freeze({
      contractVersion: INVENTORY_CONTRACT_VERSION,
      status: 'failed',
      code: 'INVENTORY_PLANNING_FAILED',
    });
  }
}
