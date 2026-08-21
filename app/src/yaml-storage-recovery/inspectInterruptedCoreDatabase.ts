import { validateCoreDbV2StoreTopology } from '@hierarchidb/runtime-worker/yaml-storage-production';
import {
  countAllInterruptedCoreDatabaseRecords,
  INTERRUPTED_CORE_DATABASE_NAME,
  openExactInterruptedCoreDatabase,
} from './interruptedCoreDatabaseInspectionUtils.js';

const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/u;

export interface InspectInterruptedCoreDatabaseInput {
  readonly factory: IDBFactory;
  readonly releaseVersion: string;
  readonly timestamp: string;
}

export type InterruptedCoreDatabaseInspectionCode =
  | 'INTERRUPTED_CORE_DIAGNOSTIC_ACCEPTED'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_CONFIGURATION_INVALID'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_DISCOVERY_UNAVAILABLE'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_DISCOVERY_FAILED'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_DATABASE_MISSING'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_CATALOG_MISMATCH'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_OPEN_FAILED'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_OPEN_BLOCKED'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_UNEXPECTED_UPGRADE'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_TOPOLOGY_MISMATCH'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_COUNT_FAILED'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_INTERNAL_FAILED';

type InterruptedCoreDatabaseSummary = Readonly<{
  readonly nativeVersion: number;
  readonly topologyStatus: 'exact-logical-v2' | 'mismatch';
  readonly recordCount: number | null;
}>;

export type InterruptedCoreDatabaseInspectionResult =
  | Readonly<{
      readonly mode: 'recovery-interrupted-core';
      readonly status: 'accepted';
      readonly code: 'INTERRUPTED_CORE_DIAGNOSTIC_ACCEPTED';
      readonly timestamp: string;
      readonly releaseVersion: string;
      readonly interruptedCoreDb: Readonly<{
        readonly nativeVersion: number;
        readonly topologyStatus: 'exact-logical-v2';
        readonly recordCount: number;
      }>;
    }>
  | Readonly<{
      readonly mode: 'recovery-interrupted-core';
      readonly status: 'rejected';
      readonly code: Exclude<
        InterruptedCoreDatabaseInspectionCode,
        'INTERRUPTED_CORE_DIAGNOSTIC_ACCEPTED'
      >;
      readonly timestamp?: string;
      readonly releaseVersion?: string;
      readonly interruptedCoreDb?: InterruptedCoreDatabaseSummary;
    }>;

function hasExactTimestamp(value: string): boolean {
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function inputIsValid(input: InspectInterruptedCoreDatabaseInput): boolean {
  return (
    SOURCE_SHA_PATTERN.test(input.releaseVersion) &&
    hasExactTimestamp(input.timestamp) &&
    typeof input.factory.open === 'function'
  );
}

function rejected(
  code: Exclude<InterruptedCoreDatabaseInspectionCode, 'INTERRUPTED_CORE_DIAGNOSTIC_ACCEPTED'>,
  context?: Readonly<{ readonly timestamp: string; readonly releaseVersion: string }>,
  interruptedCoreDb?: InterruptedCoreDatabaseSummary
): InterruptedCoreDatabaseInspectionResult {
  return Object.freeze({
    mode: 'recovery-interrupted-core',
    status: 'rejected',
    code,
    ...(context === undefined ? {} : context),
    ...(interruptedCoreDb === undefined ? {} : { interruptedCoreDb }),
  });
}

/** Inspects only the fixed interrupted CoreDB name without authorizing recovery. */
export async function inspectInterruptedCoreDatabase(
  input: InspectInterruptedCoreDatabaseInput
): Promise<InterruptedCoreDatabaseInspectionResult> {
  try {
    if (!inputIsValid(input)) {
      return rejected('INTERRUPTED_CORE_DIAGNOSTIC_CONFIGURATION_INVALID');
    }
    const context = Object.freeze({
      timestamp: input.timestamp,
      releaseVersion: input.releaseVersion,
    });
    if (typeof input.factory.databases !== 'function') {
      return rejected('INTERRUPTED_CORE_DIAGNOSTIC_DISCOVERY_UNAVAILABLE', context);
    }
    let catalog: IDBDatabaseInfo[];
    try {
      catalog = await input.factory.databases();
    } catch {
      return rejected('INTERRUPTED_CORE_DIAGNOSTIC_DISCOVERY_FAILED', context);
    }
    const matches = catalog.filter((entry) => entry.name === INTERRUPTED_CORE_DATABASE_NAME);
    if (matches.length === 0) {
      return rejected('INTERRUPTED_CORE_DIAGNOSTIC_DATABASE_MISSING', context);
    }
    const nativeVersion = matches[0]?.version;
    if (
      matches.length !== 1 ||
      typeof nativeVersion !== 'number' ||
      !Number.isSafeInteger(nativeVersion) ||
      nativeVersion <= 0
    ) {
      return rejected('INTERRUPTED_CORE_DIAGNOSTIC_CATALOG_MISMATCH', context);
    }
    const opened = await openExactInterruptedCoreDatabase(input.factory, nativeVersion);
    if (opened.ok === false) {
      const code =
        opened.reason === 'blocked'
          ? 'INTERRUPTED_CORE_DIAGNOSTIC_OPEN_BLOCKED'
          : opened.reason === 'upgrade'
            ? 'INTERRUPTED_CORE_DIAGNOSTIC_UNEXPECTED_UPGRADE'
            : 'INTERRUPTED_CORE_DIAGNOSTIC_OPEN_FAILED';
      return rejected(code, context);
    }
    try {
      if (!validateCoreDbV2StoreTopology(opened.database)) {
        return rejected(
          'INTERRUPTED_CORE_DIAGNOSTIC_TOPOLOGY_MISMATCH',
          context,
          Object.freeze({ nativeVersion, topologyStatus: 'mismatch', recordCount: null })
        );
      }
      const recordCount = await countAllInterruptedCoreDatabaseRecords(opened.database);
      if (recordCount === null) {
        return rejected(
          'INTERRUPTED_CORE_DIAGNOSTIC_COUNT_FAILED',
          context,
          Object.freeze({
            nativeVersion,
            topologyStatus: 'exact-logical-v2',
            recordCount: null,
          })
        );
      }
      return Object.freeze({
        mode: 'recovery-interrupted-core',
        status: 'accepted',
        code: 'INTERRUPTED_CORE_DIAGNOSTIC_ACCEPTED',
        ...context,
        interruptedCoreDb: Object.freeze({
          nativeVersion,
          topologyStatus: 'exact-logical-v2',
          recordCount,
        }),
      });
    } finally {
      opened.database.close();
    }
  } catch {
    return rejected('INTERRUPTED_CORE_DIAGNOSTIC_INTERNAL_FAILED');
  }
}
