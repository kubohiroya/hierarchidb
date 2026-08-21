import {
  CORE_DB_LEGACY_NATIVE_VERSION,
  classifyInterruptedCoreV1Snapshot,
  type InterruptedCoreV1PreservationClassificationCode,
  type InterruptedCoreV1PreservationSummary,
  type InterruptedCoreV1Snapshot,
  validateCoreDbV1Schema,
} from '@hierarchidb/runtime-worker/yaml-storage-production';
import {
  INTERRUPTED_CORE_DATABASE_NAME,
  openExactInterruptedCoreDatabase,
} from './interruptedCoreDatabaseInspectionUtils.js';

const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const STORE_NAMES = Object.freeze([
  'trees',
  'nodes',
  'rootStates',
  'tags',
  'tagAssociations',
] as const satisfies readonly (keyof InterruptedCoreV1Snapshot)[]);

export interface InspectInterruptedCoreV1PreservationInput {
  readonly factory: IDBFactory;
  readonly releaseVersion: string;
  readonly timestamp: string;
  readonly digestSha256Hex: (bytes: Uint8Array) => Promise<string>;
}

export type InterruptedCoreV1PreservationInspectionCode =
  | InterruptedCoreV1PreservationClassificationCode
  | 'INTERRUPTED_CORE_V1_PRESERVATION_CONFIGURATION_INVALID'
  | 'INTERRUPTED_CORE_V1_PRESERVATION_DISCOVERY_UNAVAILABLE'
  | 'INTERRUPTED_CORE_V1_PRESERVATION_DISCOVERY_FAILED'
  | 'INTERRUPTED_CORE_V1_PRESERVATION_DATABASE_MISSING'
  | 'INTERRUPTED_CORE_V1_PRESERVATION_CATALOG_MISMATCH'
  | 'INTERRUPTED_CORE_V1_PRESERVATION_OPEN_FAILED'
  | 'INTERRUPTED_CORE_V1_PRESERVATION_OPEN_BLOCKED'
  | 'INTERRUPTED_CORE_V1_PRESERVATION_UNEXPECTED_UPGRADE'
  | 'INTERRUPTED_CORE_V1_PRESERVATION_TOPOLOGY_MISMATCH'
  | 'INTERRUPTED_CORE_V1_PRESERVATION_SNAPSHOT_READ_FAILED';

interface InterruptedCoreV1PreservationDatabaseSummary {
  readonly nativeVersion: number;
  readonly topologyStatus: 'exact-logical-v1' | 'mismatch';
  readonly preservation?: InterruptedCoreV1PreservationSummary;
}

export type InterruptedCoreV1PreservationInspectionResult =
  | Readonly<{
      readonly mode: 'recovery-interrupted-core-preservation';
      readonly status: 'accepted';
      readonly code: 'INTERRUPTED_CORE_V1_PRESERVATION_ACCEPTED';
      readonly timestamp: string;
      readonly releaseVersion: string;
      readonly interruptedCoreDb: Readonly<{
        readonly nativeVersion: 10;
        readonly topologyStatus: 'exact-logical-v1';
        readonly preservation: InterruptedCoreV1PreservationSummary;
      }>;
    }>
  | Readonly<{
      readonly mode: 'recovery-interrupted-core-preservation';
      readonly status: 'rejected';
      readonly code: Exclude<
        InterruptedCoreV1PreservationInspectionCode,
        'INTERRUPTED_CORE_V1_PRESERVATION_ACCEPTED'
      >;
      readonly timestamp?: string;
      readonly releaseVersion?: string;
      readonly interruptedCoreDb?: InterruptedCoreV1PreservationDatabaseSummary;
    }>;

type SnapshotReadResult =
  | Readonly<{ readonly ok: true; readonly snapshot: InterruptedCoreV1Snapshot }>
  | Readonly<{ readonly ok: false }>;

function hasExactTimestamp(value: string): boolean {
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function rejected(
  code: Exclude<
    InterruptedCoreV1PreservationInspectionCode,
    'INTERRUPTED_CORE_V1_PRESERVATION_ACCEPTED'
  >,
  context?: Readonly<{ readonly timestamp: string; readonly releaseVersion: string }>,
  interruptedCoreDb?: InterruptedCoreV1PreservationDatabaseSummary
): InterruptedCoreV1PreservationInspectionResult {
  return Object.freeze({
    mode: 'recovery-interrupted-core-preservation',
    status: 'rejected',
    code,
    ...(context === undefined ? {} : context),
    ...(interruptedCoreDb === undefined ? {} : { interruptedCoreDb }),
  });
}

function readSnapshot(database: IDBDatabase): Promise<SnapshotReadResult> {
  return new Promise((resolve) => {
    let settled = false;
    const values: Partial<Record<keyof InterruptedCoreV1Snapshot, readonly unknown[]>> = {};
    const finish = (result: SnapshotReadResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(STORE_NAMES, 'readonly');
      for (const storeName of STORE_NAMES) {
        const request = transaction.objectStore(storeName).getAll();
        request.onerror = () => finish(Object.freeze({ ok: false }));
        request.onsuccess = () => {
          values[storeName] = Object.freeze([...request.result]);
        };
      }
    } catch {
      finish(Object.freeze({ ok: false }));
      return;
    }
    transaction.onerror = () => finish(Object.freeze({ ok: false }));
    transaction.onabort = () => finish(Object.freeze({ ok: false }));
    transaction.oncomplete = () => {
      const trees = values.trees;
      const nodes = values.nodes;
      const rootStates = values.rootStates;
      const tags = values.tags;
      const tagAssociations = values.tagAssociations;
      if (
        trees === undefined ||
        nodes === undefined ||
        rootStates === undefined ||
        tags === undefined ||
        tagAssociations === undefined
      ) {
        finish(Object.freeze({ ok: false }));
        return;
      }
      finish(
        Object.freeze({
          ok: true,
          snapshot: Object.freeze({ trees, nodes, rootStates, tags, tagAssociations }),
        })
      );
    };
  });
}

/** Reads and classifies only the fixed non-empty interrupted CoreDB without recovery authority. */
export async function inspectInterruptedCoreV1Preservation(
  input: InspectInterruptedCoreV1PreservationInput
): Promise<InterruptedCoreV1PreservationInspectionResult> {
  try {
    if (
      !SOURCE_SHA_PATTERN.test(input.releaseVersion) ||
      !hasExactTimestamp(input.timestamp) ||
      typeof input.factory.open !== 'function' ||
      typeof input.digestSha256Hex !== 'function'
    ) {
      return rejected('INTERRUPTED_CORE_V1_PRESERVATION_CONFIGURATION_INVALID');
    }
    const context = Object.freeze({
      timestamp: input.timestamp,
      releaseVersion: input.releaseVersion,
    });
    if (typeof input.factory.databases !== 'function') {
      return rejected('INTERRUPTED_CORE_V1_PRESERVATION_DISCOVERY_UNAVAILABLE', context);
    }
    let catalog: IDBDatabaseInfo[];
    try {
      catalog = await input.factory.databases();
    } catch {
      return rejected('INTERRUPTED_CORE_V1_PRESERVATION_DISCOVERY_FAILED', context);
    }
    const matches = catalog.filter((entry) => entry.name === INTERRUPTED_CORE_DATABASE_NAME);
    if (matches.length === 0) {
      return rejected('INTERRUPTED_CORE_V1_PRESERVATION_DATABASE_MISSING', context);
    }
    if (matches.length !== 1 || matches[0]?.version !== CORE_DB_LEGACY_NATIVE_VERSION) {
      return rejected('INTERRUPTED_CORE_V1_PRESERVATION_CATALOG_MISMATCH', context);
    }
    const opened = await openExactInterruptedCoreDatabase(
      input.factory,
      CORE_DB_LEGACY_NATIVE_VERSION
    );
    if (opened.ok === false) {
      const code =
        opened.reason === 'blocked'
          ? 'INTERRUPTED_CORE_V1_PRESERVATION_OPEN_BLOCKED'
          : opened.reason === 'upgrade'
            ? 'INTERRUPTED_CORE_V1_PRESERVATION_UNEXPECTED_UPGRADE'
            : 'INTERRUPTED_CORE_V1_PRESERVATION_OPEN_FAILED';
      return rejected(code, context);
    }
    try {
      if (!validateCoreDbV1Schema(opened.database)) {
        return rejected(
          'INTERRUPTED_CORE_V1_PRESERVATION_TOPOLOGY_MISMATCH',
          context,
          Object.freeze({
            nativeVersion: CORE_DB_LEGACY_NATIVE_VERSION,
            topologyStatus: 'mismatch',
          })
        );
      }
      const snapshot = await readSnapshot(opened.database);
      if (snapshot.ok === false) {
        return rejected(
          'INTERRUPTED_CORE_V1_PRESERVATION_SNAPSHOT_READ_FAILED',
          context,
          Object.freeze({
            nativeVersion: CORE_DB_LEGACY_NATIVE_VERSION,
            topologyStatus: 'exact-logical-v1',
          })
        );
      }
      const classification = await classifyInterruptedCoreV1Snapshot({
        snapshot: snapshot.snapshot,
        digestSha256Hex: input.digestSha256Hex,
      });
      const interruptedCoreDb = Object.freeze({
        nativeVersion: CORE_DB_LEGACY_NATIVE_VERSION,
        topologyStatus: 'exact-logical-v1' as const,
        ...(classification.summary === undefined ? {} : { preservation: classification.summary }),
      });
      if (classification.ok === false) {
        return rejected(classification.code, context, interruptedCoreDb);
      }
      return Object.freeze({
        mode: 'recovery-interrupted-core-preservation',
        status: 'accepted',
        code: classification.code,
        ...context,
        interruptedCoreDb: Object.freeze({
          nativeVersion: CORE_DB_LEGACY_NATIVE_VERSION,
          topologyStatus: 'exact-logical-v1',
          preservation: classification.summary,
        }),
      });
    } finally {
      opened.database.close();
    }
  } catch {
    return rejected('INTERRUPTED_CORE_V1_PRESERVATION_INTERNAL_FAILED');
  }
}
