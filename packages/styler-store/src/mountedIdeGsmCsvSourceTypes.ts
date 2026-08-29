export const MOUNTED_IDE_GSM_CSV_SOURCE_VERSION = 1 as const;
export const MOUNTED_IDE_GSM_CSV_SOURCE_KIND = 'ide-gsm-mounted-csv' as const;

export type MountedIdeGsmCsvSourceKind = 'project-root' | 'fdm-space-root';

export interface MountedIdeGsmCsvSourceReference {
  readonly version: typeof MOUNTED_IDE_GSM_CSV_SOURCE_VERSION;
  readonly kind: typeof MOUNTED_IDE_GSM_CSV_SOURCE_KIND;
  readonly mountId: string;
  readonly sourceKind: MountedIdeGsmCsvSourceKind;
  readonly relativePath: string;
  readonly projectId?: string;
  readonly spaceId?: string;
}

export type StylerSourceReference = MountedIdeGsmCsvSourceReference;

export type MountedIdeGsmCsvSourceValidationCode =
  | 'INVALID_SOURCE_REFERENCE'
  | 'UNSUPPORTED_SOURCE_KIND'
  | 'MISSING_MOUNT_ID'
  | 'MISSING_PROJECT_ID'
  | 'MISSING_SPACE_ID'
  | 'MISSING_RELATIVE_PATH'
  | 'INVALID_LOGICAL_PATH'
  | 'FORBIDDEN_PUBLIC_FIELD';

export type MountedIdeGsmCsvSourceValidationResult =
  | Readonly<{ readonly ok: true; readonly value: MountedIdeGsmCsvSourceReference }>
  | Readonly<{ readonly ok: false; readonly code: MountedIdeGsmCsvSourceValidationCode }>;

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
] as const;

export function validateMountedIdeGsmCsvSourceReference(
  value: unknown
): MountedIdeGsmCsvSourceValidationResult {
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
    record.version !== MOUNTED_IDE_GSM_CSV_SOURCE_VERSION ||
    record.kind !== MOUNTED_IDE_GSM_CSV_SOURCE_KIND
  ) {
    return { ok: false, code: 'INVALID_SOURCE_REFERENCE' };
  }

  if (!isNonEmptyString(record.mountId) || record.mountId.trim() !== record.mountId) {
    return { ok: false, code: 'MISSING_MOUNT_ID' };
  }

  if (record.sourceKind !== 'project-root' && record.sourceKind !== 'fdm-space-root') {
    return { ok: false, code: 'UNSUPPORTED_SOURCE_KIND' };
  }

  if (!isNonEmptyString(record.relativePath)) {
    return { ok: false, code: 'MISSING_RELATIVE_PATH' };
  }
  if (!isSafeLogicalPath(record.relativePath, false) || !record.relativePath.endsWith('.csv')) {
    return { ok: false, code: 'INVALID_LOGICAL_PATH' };
  }

  if (record.sourceKind === 'project-root') {
    if (!isNonEmptyString(record.projectId) || !isSafeLogicalPath(record.projectId, false)) {
      return { ok: false, code: 'MISSING_PROJECT_ID' };
    }
    if (record.spaceId !== undefined) {
      return { ok: false, code: 'INVALID_SOURCE_REFERENCE' };
    }
    return {
      ok: true,
      value: {
        version: MOUNTED_IDE_GSM_CSV_SOURCE_VERSION,
        kind: MOUNTED_IDE_GSM_CSV_SOURCE_KIND,
        mountId: record.mountId,
        sourceKind: record.sourceKind,
        projectId: record.projectId,
        relativePath: record.relativePath,
      },
    };
  }

  if (!isNonEmptyString(record.spaceId)) {
    return { ok: false, code: 'MISSING_SPACE_ID' };
  }
  if (record.projectId !== undefined) {
    return { ok: false, code: 'INVALID_SOURCE_REFERENCE' };
  }

  return {
    ok: true,
    value: {
      version: MOUNTED_IDE_GSM_CSV_SOURCE_VERSION,
      kind: MOUNTED_IDE_GSM_CSV_SOURCE_KIND,
      mountId: record.mountId,
      sourceKind: record.sourceKind,
      spaceId: record.spaceId,
      relativePath: record.relativePath,
    },
  };
}

export function isMountedIdeGsmCsvSourceReference(
  value: unknown
): value is MountedIdeGsmCsvSourceReference {
  return validateMountedIdeGsmCsvSourceReference(value).ok;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isSafeLogicalPath(value: string, allowEmpty: boolean): boolean {
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) {
    return false;
  }
  if (trimmed !== value || trimmed.startsWith('/') || trimmed.startsWith('\\')) {
    return false;
  }
  if (/^[A-Za-z]:[\\/]/u.test(trimmed)) {
    return false;
  }
  return !trimmed.split(/[\\/]/u).includes('..');
}
