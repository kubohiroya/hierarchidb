import type { InconsistencyPattern, Severity, Violation } from './types.js';

export interface NamingAuditViolationRecord {
  readonly file: string;
  readonly subPackage: string;
  readonly pattern: InconsistencyPattern;
  readonly severity: Severity;
  readonly message: string;
  readonly suggestedRename: string;
}

export interface NamingAuditComparison {
  readonly baselineErrorCount: number;
  readonly currentErrorCount: number;
  readonly unchangedErrorCount: number;
  readonly baselineWarningCount: number;
  readonly currentWarningCount: number;
  readonly newErrors: readonly NamingAuditViolationRecord[];
  readonly resolvedErrors: readonly NamingAuditViolationRecord[];
}

export interface NamingAuditAuditedFileRecord {
  readonly relativePath: string;
  readonly subPackage: string;
}

const VIOLATION_RECORD_KEYS = [
  'file',
  'message',
  'pattern',
  'severity',
  'subPackage',
  'suggestedRename',
] as const;

function isPattern(value: unknown): value is InconsistencyPattern {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
}

function isSeverity(value: unknown): value is Severity {
  return value === 'error' || value === 'warning';
}

function parseViolationRecord(value: unknown, index: number): NamingAuditViolationRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Naming audit baseline entry ${index} must be an object.`);
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== VIOLATION_RECORD_KEYS.length ||
    keys.some((key, keyIndex) => key !== VIOLATION_RECORD_KEYS[keyIndex]) ||
    typeof record.file !== 'string' ||
    record.file.length === 0 ||
    typeof record.subPackage !== 'string' ||
    record.subPackage.length === 0 ||
    !isPattern(record.pattern) ||
    !isSeverity(record.severity) ||
    typeof record.message !== 'string' ||
    record.message.length === 0 ||
    typeof record.suggestedRename !== 'string' ||
    record.suggestedRename.length === 0
  ) {
    throw new Error(`Naming audit baseline entry ${index} does not match the violation schema.`);
  }

  return {
    file: record.file,
    subPackage: record.subPackage,
    pattern: record.pattern,
    severity: record.severity,
    message: record.message,
    suggestedRename: record.suggestedRename,
  };
}

export function parseNamingAuditViolationRecords(value: unknown): NamingAuditViolationRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('Naming audit baseline must be a JSON array.');
  }

  return value.map((entry, index) => parseViolationRecord(entry, index));
}

export function toNamingAuditViolationRecords(
  violations: readonly Violation[]
): NamingAuditViolationRecord[] {
  return violations.map((violation) => ({
    file: violation.file.relativePath,
    subPackage: violation.file.subPackage,
    pattern: violation.pattern,
    severity: violation.severity,
    message: violation.message,
    suggestedRename: violation.suggestedRename,
  }));
}

function violationKey(record: NamingAuditViolationRecord): string {
  return JSON.stringify([
    record.subPackage,
    record.file,
    record.pattern,
    record.severity,
    record.message,
    record.suggestedRename,
  ]);
}

function sortRecords(records: readonly NamingAuditViolationRecord[]): NamingAuditViolationRecord[] {
  return [...records].sort((left, right) => violationKey(left).localeCompare(violationKey(right)));
}

function fileScopeKey(subPackage: string, relativePath: string): string {
  return JSON.stringify([subPackage, relativePath]);
}

export function filterNamingAuditBaselineForAuditedFiles(
  baseline: readonly NamingAuditViolationRecord[],
  auditedFiles: readonly NamingAuditAuditedFileRecord[]
): NamingAuditViolationRecord[] {
  const auditedFileKeys = new Set(
    auditedFiles.map((file) => fileScopeKey(file.subPackage, file.relativePath))
  );
  return baseline.filter((record) =>
    auditedFileKeys.has(fileScopeKey(record.subPackage, record.file))
  );
}

export function compareNamingAuditViolations(
  baseline: readonly NamingAuditViolationRecord[],
  current: readonly NamingAuditViolationRecord[]
): NamingAuditComparison {
  const baselineErrors = baseline.filter((record) => record.severity === 'error');
  const currentErrors = current.filter((record) => record.severity === 'error');
  const availableBaselineErrors = new Map<string, NamingAuditViolationRecord[]>();

  for (const record of baselineErrors) {
    const key = violationKey(record);
    const bucket = availableBaselineErrors.get(key);
    if (bucket === undefined) {
      availableBaselineErrors.set(key, [record]);
    } else {
      bucket.push(record);
    }
  }

  const newErrors: NamingAuditViolationRecord[] = [];
  let unchangedErrorCount = 0;

  for (const record of currentErrors) {
    const key = violationKey(record);
    const bucket = availableBaselineErrors.get(key);
    const matched = bucket?.pop();
    if (matched === undefined) {
      newErrors.push(record);
    } else {
      unchangedErrorCount += 1;
    }
  }

  const resolvedErrors = [...availableBaselineErrors.values()].flat();

  return {
    baselineErrorCount: baselineErrors.length,
    currentErrorCount: currentErrors.length,
    unchangedErrorCount,
    baselineWarningCount: baseline.filter((record) => record.severity === 'warning').length,
    currentWarningCount: current.filter((record) => record.severity === 'warning').length,
    newErrors: sortRecords(newErrors),
    resolvedErrors: sortRecords(resolvedErrors),
  };
}
