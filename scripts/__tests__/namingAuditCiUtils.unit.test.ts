import { afterEach, describe, expect, it, vi } from 'vitest';

import { isExcluded } from '../naming-audit/fileScanner.js';
import {
  compareNamingAuditViolations,
  type NamingAuditViolationRecord,
  parseNamingAuditViolationRecords,
} from '../naming-audit/namingAuditCiUtils.js';
import { DEFAULT_NAMING_AUDIT_EXCLUDE_PATTERNS } from '../naming-audit/namingAuditConstants.js';
import { reportNamingAuditComparison } from '../naming-audit/violationReporter.js';

function makeViolation(
  overrides: Partial<NamingAuditViolationRecord> = {}
): NamingAuditViolationRecord {
  return {
    file: 'ui/components/OldName.ts',
    subPackage: 'shape-plugin',
    pattern: 1,
    severity: 'error',
    message: 'File does not match its primary export.',
    suggestedRename: 'NewName.ts',
    ...overrides,
  };
}

describe('parseNamingAuditViolationRecords', () => {
  it('accepts records that match the baseline schema', () => {
    const record = makeViolation();
    expect(parseNamingAuditViolationRecords([record])).toEqual([record]);
  });

  it('rejects a non-array baseline', () => {
    expect(() => parseNamingAuditViolationRecords({})).toThrow(
      'Naming audit baseline must be a JSON array.'
    );
  });

  it('rejects an entry with an invalid severity', () => {
    expect(() =>
      parseNamingAuditViolationRecords([{ ...makeViolation(), severity: 'ignored' }])
    ).toThrow('Naming audit baseline entry 0 does not match the violation schema.');
  });

  it('rejects an entry with a missing required field', () => {
    const { suggestedRename: _suggestedRename, ...incomplete } = makeViolation();
    expect(() => parseNamingAuditViolationRecords([incomplete])).toThrow(
      'Naming audit baseline entry 0 does not match the violation schema.'
    );
  });

  it('rejects an entry with an unexpected field', () => {
    expect(() => parseNamingAuditViolationRecords([{ ...makeViolation(), ignored: true }])).toThrow(
      'Naming audit baseline entry 0 does not match the violation schema.'
    );
  });

  it('rejects an entry with an empty required string', () => {
    expect(() => parseNamingAuditViolationRecords([makeViolation({ file: '' })])).toThrow(
      'Naming audit baseline entry 0 does not match the violation schema.'
    );
  });
});

describe('compareNamingAuditViolations', () => {
  it('accepts unchanged errors and reports warning counts without failing them', () => {
    const error = makeViolation();
    const baselineWarning = makeViolation({ severity: 'warning', pattern: 5 });
    const currentWarning = makeViolation({
      severity: 'warning',
      pattern: 5,
      file: 'ui/components/AnotherComponent.tsx',
    });

    const comparison = compareNamingAuditViolations(
      [error, baselineWarning],
      [error, currentWarning]
    );

    expect(comparison).toMatchObject({
      baselineErrorCount: 1,
      currentErrorCount: 1,
      unchangedErrorCount: 1,
      baselineWarningCount: 1,
      currentWarningCount: 1,
      newErrors: [],
      resolvedErrors: [],
    });
  });

  it('reports a newly introduced error', () => {
    const newError = makeViolation({ file: 'ui/components/NewViolation.ts' });
    const comparison = compareNamingAuditViolations([], [newError]);

    expect(comparison.newErrors).toEqual([newError]);
    expect(comparison.resolvedErrors).toEqual([]);
  });

  it('reports a resolved error without treating it as a failure', () => {
    const resolvedError = makeViolation();
    const comparison = compareNamingAuditViolations([resolvedError], []);

    expect(comparison.newErrors).toEqual([]);
    expect(comparison.resolvedErrors).toEqual([resolvedError]);
  });

  it('treats a changed error message as a new or worsened violation', () => {
    const baselineError = makeViolation();
    const worsenedError = makeViolation({ message: 'A stricter naming error was detected.' });
    const comparison = compareNamingAuditViolations([baselineError], [worsenedError]);

    expect(comparison.newErrors).toEqual([worsenedError]);
    expect(comparison.resolvedErrors).toEqual([baselineError]);
  });

  it('compares duplicate errors as a multiset', () => {
    const duplicate = makeViolation();
    const comparison = compareNamingAuditViolations([duplicate], [duplicate, duplicate]);

    expect(comparison.unchangedErrorCount).toBe(1);
    expect(comparison.newErrors).toEqual([duplicate]);
  });
});

describe('reportNamingAuditComparison', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns success when the current report contains only existing errors', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const existingError = makeViolation();
    const comparison = compareNamingAuditViolations([existingError], [existingError]);

    expect(reportNamingAuditComparison(comparison, 'table')).toBe(0);
  });

  it('returns failure when the current report contains a new error', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const comparison = compareNamingAuditViolations([], [makeViolation()]);

    expect(reportNamingAuditComparison(comparison, 'table')).toBe(1);
  });
});

describe('Naming Audit test-file exclusions', () => {
  it.each([
    'ui/__tests__/Component.unit.test.ts',
    'ui/Component.test.ts',
    'ui/Component.test.tsx',
    'ui/Component.spec.ts',
    'ui/Component.spec.tsx',
  ])('excludes %s', (relativePath) => {
    expect(isExcluded(relativePath, DEFAULT_NAMING_AUDIT_EXCLUDE_PATTERNS)).toBe(true);
  });

  it('does not exclude production source files', () => {
    expect(isExcluded('ui/components/Component.tsx', DEFAULT_NAMING_AUDIT_EXCLUDE_PATTERNS)).toBe(
      false
    );
  });
});
