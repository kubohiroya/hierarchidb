export const IDE_GSM_TRACKED_TABULAR_SOURCE_VERSION = 1 as const;
export const IDE_GSM_TRACKED_TABULAR_SOURCE_KIND = 'ide-gsm-tracked-tabular' as const;

export interface IdeGsmTrackedTabularSourceReference {
  readonly version: typeof IDE_GSM_TRACKED_TABULAR_SOURCE_VERSION;
  readonly kind: typeof IDE_GSM_TRACKED_TABULAR_SOURCE_KIND;
  readonly projectNodeId: string;
  readonly generationId: string;
  readonly relativePath: string;
  readonly snapshotId: string;
  readonly contentGenerationId: string;
}

export type StylerSourceReference = IdeGsmTrackedTabularSourceReference;

export type IdeGsmTrackedTabularSourceValidationCode =
  | 'INVALID_SOURCE_REFERENCE'
  | 'MISSING_PROJECT_NODE_ID'
  | 'MISSING_GENERATION_ID'
  | 'MISSING_RELATIVE_PATH'
  | 'MISSING_SNAPSHOT_ID'
  | 'MISSING_CONTENT_GENERATION_ID'
  | 'INVALID_LOGICAL_PATH'
  | 'FORBIDDEN_PUBLIC_FIELD';

export type IdeGsmTrackedTabularSourceValidationResult =
  | Readonly<{ readonly ok: true; readonly value: IdeGsmTrackedTabularSourceReference }>
  | Readonly<{ readonly ok: false; readonly code: IdeGsmTrackedTabularSourceValidationCode }>;

const FORBIDDEN_PUBLIC_FIELDS = [
  'endpoint',
  'endpointUrl',
  'graphqlUrl',
  'token',
  'jwt',
  'authToken',
  'absolutePath',
  'content',
  'csvText',
  'mountKind',
  'mountId',
  'sourceKind',
  'projectId',
  'spaceId',
  'originMountId',
  'originSourceKind',
] as const;

export function validateIdeGsmTrackedTabularSourceReference(
  value: unknown
): IdeGsmTrackedTabularSourceValidationResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, code: 'INVALID_SOURCE_REFERENCE' };
  }

  const record = value as Record<string, unknown>;
  for (const field of FORBIDDEN_PUBLIC_FIELDS) {
    if (Object.hasOwn(record, field)) {
      return { ok: false, code: 'FORBIDDEN_PUBLIC_FIELD' };
    }
  }

  if (
    record.version !== IDE_GSM_TRACKED_TABULAR_SOURCE_VERSION ||
    record.kind !== IDE_GSM_TRACKED_TABULAR_SOURCE_KIND
  ) {
    return { ok: false, code: 'INVALID_SOURCE_REFERENCE' };
  }
  if (!isTrimmedNonEmptyString(record.projectNodeId)) {
    return { ok: false, code: 'MISSING_PROJECT_NODE_ID' };
  }
  if (!isTrimmedNonEmptyString(record.generationId)) {
    return { ok: false, code: 'MISSING_GENERATION_ID' };
  }
  if (!isTrimmedNonEmptyString(record.relativePath)) {
    return { ok: false, code: 'MISSING_RELATIVE_PATH' };
  }
  if (!isSafeLogicalPath(record.relativePath) || !record.relativePath.endsWith('.csv')) {
    return { ok: false, code: 'INVALID_LOGICAL_PATH' };
  }
  if (!isTrimmedNonEmptyString(record.snapshotId)) {
    return { ok: false, code: 'MISSING_SNAPSHOT_ID' };
  }
  if (!isTrimmedNonEmptyString(record.contentGenerationId)) {
    return { ok: false, code: 'MISSING_CONTENT_GENERATION_ID' };
  }

  return {
    ok: true,
    value: {
      version: IDE_GSM_TRACKED_TABULAR_SOURCE_VERSION,
      kind: IDE_GSM_TRACKED_TABULAR_SOURCE_KIND,
      projectNodeId: record.projectNodeId,
      generationId: record.generationId,
      relativePath: record.relativePath,
      snapshotId: record.snapshotId,
      contentGenerationId: record.contentGenerationId,
    },
  };
}

export function isIdeGsmTrackedTabularSourceReference(
  value: unknown
): value is IdeGsmTrackedTabularSourceReference {
  return validateIdeGsmTrackedTabularSourceReference(value).ok;
}

function isTrimmedNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isSafeLogicalPath(value: string): boolean {
  if (value.startsWith('/') || value.startsWith('\\')) {
    return false;
  }
  if (/^[A-Za-z]:[\\/]/u.test(value)) {
    return false;
  }
  return !value.split(/[\\/]/u).includes('..');
}
