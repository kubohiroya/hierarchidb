import {
  CORE_DB_LEGACY_NATIVE_VERSION,
  validateCoreDbV1Schema,
} from '@hierarchidb/runtime-worker/yaml-storage-production';
import {
  countAllInterruptedCoreDatabaseRecords,
  INTERRUPTED_CORE_DATABASE_NAME,
  openExactInterruptedCoreDatabase,
} from './interruptedCoreDatabaseInspectionUtils.js';

const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/u;

export interface InspectInterruptedCoreV1DatabaseInput {
  readonly factory: IDBFactory;
  readonly releaseVersion: string;
  readonly timestamp: string;
}

export type InterruptedCoreV1DatabaseInspectionCode =
  | 'INTERRUPTED_CORE_V1_DIAGNOSTIC_ACCEPTED'
  | 'INTERRUPTED_CORE_V1_DIAGNOSTIC_CONFIGURATION_INVALID'
  | 'INTERRUPTED_CORE_V1_DIAGNOSTIC_DISCOVERY_UNAVAILABLE'
  | 'INTERRUPTED_CORE_V1_DIAGNOSTIC_DISCOVERY_FAILED'
  | 'INTERRUPTED_CORE_V1_DIAGNOSTIC_DATABASE_MISSING'
  | 'INTERRUPTED_CORE_V1_DIAGNOSTIC_CATALOG_MISMATCH'
  | 'INTERRUPTED_CORE_V1_DIAGNOSTIC_OPEN_FAILED'
  | 'INTERRUPTED_CORE_V1_DIAGNOSTIC_OPEN_BLOCKED'
  | 'INTERRUPTED_CORE_V1_DIAGNOSTIC_UNEXPECTED_UPGRADE'
  | 'INTERRUPTED_CORE_V1_DIAGNOSTIC_TOPOLOGY_MISMATCH'
  | 'INTERRUPTED_CORE_V1_DIAGNOSTIC_COUNT_FAILED'
  | 'INTERRUPTED_CORE_V1_DIAGNOSTIC_INTERNAL_FAILED';

type InterruptedCoreV1DatabaseSummary = Readonly<{
  readonly nativeVersion: number;
  readonly topologyStatus: 'exact-logical-v1' | 'mismatch';
  readonly recordCount: number | null;
}>;

export type InterruptedCoreV1DatabaseInspectionResult =
  | Readonly<{
      readonly mode: 'recovery-interrupted-core-v1';
      readonly status: 'accepted';
      readonly code: 'INTERRUPTED_CORE_V1_DIAGNOSTIC_ACCEPTED';
      readonly timestamp: string;
      readonly releaseVersion: string;
      readonly interruptedCoreDb: Readonly<{
        readonly nativeVersion: number;
        readonly topologyStatus: 'exact-logical-v1';
        readonly recordCount: number;
      }>;
    }>
  | Readonly<{
      readonly mode: 'recovery-interrupted-core-v1';
      readonly status: 'rejected';
      readonly code: Exclude<
        InterruptedCoreV1DatabaseInspectionCode,
        'INTERRUPTED_CORE_V1_DIAGNOSTIC_ACCEPTED'
      >;
      readonly timestamp?: string;
      readonly releaseVersion?: string;
      readonly interruptedCoreDb?: InterruptedCoreV1DatabaseSummary;
    }>;

function hasExactTimestamp(value: string): boolean {
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function inputIsValid(input: InspectInterruptedCoreV1DatabaseInput): boolean {
  return (
    SOURCE_SHA_PATTERN.test(input.releaseVersion) &&
    hasExactTimestamp(input.timestamp) &&
    typeof input.factory.open === 'function'
  );
}

function rejected(
  code: Exclude<InterruptedCoreV1DatabaseInspectionCode, 'INTERRUPTED_CORE_V1_DIAGNOSTIC_ACCEPTED'>,
  context?: Readonly<{ readonly timestamp: string; readonly releaseVersion: string }>,
  interruptedCoreDb?: InterruptedCoreV1DatabaseSummary
): InterruptedCoreV1DatabaseInspectionResult {
  return Object.freeze({
    mode: 'recovery-interrupted-core-v1',
    status: 'rejected',
    code,
    ...(context === undefined ? {} : context),
    ...(interruptedCoreDb === undefined ? {} : { interruptedCoreDb }),
  });
}

/** Inspects only the fixed native-v10 interrupted CoreDB without authorizing recovery. */
export async function inspectInterruptedCoreV1Database(
  input: InspectInterruptedCoreV1DatabaseInput
): Promise<InterruptedCoreV1DatabaseInspectionResult> {
  try {
    if (!inputIsValid(input)) {
      return rejected('INTERRUPTED_CORE_V1_DIAGNOSTIC_CONFIGURATION_INVALID');
    }
    const context = Object.freeze({
      timestamp: input.timestamp,
      releaseVersion: input.releaseVersion,
    });
    if (typeof input.factory.databases !== 'function') {
      return rejected('INTERRUPTED_CORE_V1_DIAGNOSTIC_DISCOVERY_UNAVAILABLE', context);
    }
    let catalog: IDBDatabaseInfo[];
    try {
      catalog = await input.factory.databases();
    } catch {
      return rejected('INTERRUPTED_CORE_V1_DIAGNOSTIC_DISCOVERY_FAILED', context);
    }
    const matches = catalog.filter((entry) => entry.name === INTERRUPTED_CORE_DATABASE_NAME);
    if (matches.length === 0) {
      return rejected('INTERRUPTED_CORE_V1_DIAGNOSTIC_DATABASE_MISSING', context);
    }
    if (matches.length !== 1 || matches[0]?.version !== CORE_DB_LEGACY_NATIVE_VERSION) {
      return rejected('INTERRUPTED_CORE_V1_DIAGNOSTIC_CATALOG_MISMATCH', context);
    }
    const opened = await openExactInterruptedCoreDatabase(
      input.factory,
      CORE_DB_LEGACY_NATIVE_VERSION
    );
    if (opened.ok === false) {
      const code =
        opened.reason === 'blocked'
          ? 'INTERRUPTED_CORE_V1_DIAGNOSTIC_OPEN_BLOCKED'
          : opened.reason === 'upgrade'
            ? 'INTERRUPTED_CORE_V1_DIAGNOSTIC_UNEXPECTED_UPGRADE'
            : 'INTERRUPTED_CORE_V1_DIAGNOSTIC_OPEN_FAILED';
      return rejected(code, context);
    }
    try {
      if (!validateCoreDbV1Schema(opened.database)) {
        return rejected(
          'INTERRUPTED_CORE_V1_DIAGNOSTIC_TOPOLOGY_MISMATCH',
          context,
          Object.freeze({
            nativeVersion: CORE_DB_LEGACY_NATIVE_VERSION,
            topologyStatus: 'mismatch',
            recordCount: null,
          })
        );
      }
      const recordCount = await countAllInterruptedCoreDatabaseRecords(opened.database);
      if (recordCount === null) {
        return rejected(
          'INTERRUPTED_CORE_V1_DIAGNOSTIC_COUNT_FAILED',
          context,
          Object.freeze({
            nativeVersion: CORE_DB_LEGACY_NATIVE_VERSION,
            topologyStatus: 'exact-logical-v1',
            recordCount: null,
          })
        );
      }
      return Object.freeze({
        mode: 'recovery-interrupted-core-v1',
        status: 'accepted',
        code: 'INTERRUPTED_CORE_V1_DIAGNOSTIC_ACCEPTED',
        ...context,
        interruptedCoreDb: Object.freeze({
          nativeVersion: CORE_DB_LEGACY_NATIVE_VERSION,
          topologyStatus: 'exact-logical-v1',
          recordCount,
        }),
      });
    } finally {
      opened.database.close();
    }
  } catch {
    return rejected('INTERRUPTED_CORE_V1_DIAGNOSTIC_INTERNAL_FAILED');
  }
}
