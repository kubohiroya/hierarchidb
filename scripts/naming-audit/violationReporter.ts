// ============================================================
// ViolationReporter — formats and outputs detected violations.
//
// Supports two output formats:
//   - "table": human-readable console table
//   - "json":  machine-readable JSON array
//
// Exit codes:
//   0 — no error-level violations (warnings are allowed)
//   1 — at least one error-level violation detected
//
// Requirements: 1.1, 1.2, 1.3
// ============================================================

import { type NamingAuditComparison, toNamingAuditViolationRecords } from './namingAuditCiUtils.js';
import type { Violation } from './types.js';

// ---------------------------------------------------------------------------
// JSON reporter
// ---------------------------------------------------------------------------

function reportJson(violations: readonly Violation[]): void {
  const output = toNamingAuditViolationRecords(violations);
  console.log(JSON.stringify(output, null, 2));
}

// ---------------------------------------------------------------------------
// Table reporter
// ---------------------------------------------------------------------------

function severityIcon(severity: 'error' | 'warning'): string {
  return severity === 'error' ? '✖' : '⚠';
}

function reportTable(violations: readonly Violation[]): void {
  if (violations.length === 0) {
    console.log('✔ No naming violations found.');
    return;
  }

  // Group by sub-package for readability
  const grouped = new Map<string, Violation[]>();
  for (const v of violations) {
    const key = v.file.subPackage;
    const list = grouped.get(key);
    if (list) {
      list.push(v);
    } else {
      grouped.set(key, [v]);
    }
  }

  for (const [subPackage, items] of grouped) {
    console.log(`\n── ${subPackage} ──`);
    for (const v of items) {
      const icon = severityIcon(v.severity);
      console.log(`  ${icon} [P${v.pattern}] ${v.file.relativePath}`);
      console.log(`    ${v.message}`);
      console.log(`    → ${v.suggestedRename}`);
    }
  }

  // Summary
  const errors = violations.filter((v) => v.severity === 'error').length;
  const warnings = violations.filter((v) => v.severity === 'warning').length;
  console.log(`\n── Summary ──`);
  console.log(`  Total: ${violations.length}  Errors: ${errors}  Warnings: ${warnings}`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Report violations to stdout and return the appropriate exit code.
 *
 * @param violations - All detected violations
 * @param format     - Output format: "json" or "table"
 * @returns Exit code: 0 if no errors, 1 if error-level violations exist
 */
export function reportViolations(
  violations: readonly Violation[],
  format: 'json' | 'table'
): number {
  if (format === 'json') {
    reportJson(violations);
  } else {
    reportTable(violations);
  }

  const hasErrors = violations.some((v) => v.severity === 'error');
  return hasErrors ? 1 : 0;
}

export function reportNamingAuditComparison(
  comparison: NamingAuditComparison,
  format: 'json' | 'table'
): number {
  const summary = {
    baselineErrors: comparison.baselineErrorCount,
    currentErrors: comparison.currentErrorCount,
    unchangedErrors: comparison.unchangedErrorCount,
    newErrors: comparison.newErrors.length,
    resolvedErrors: comparison.resolvedErrors.length,
    baselineWarnings: comparison.baselineWarningCount,
    currentWarnings: comparison.currentWarningCount,
  };

  if (format === 'json') {
    console.error(JSON.stringify({ namingAuditComparison: summary }, null, 2));
  } else {
    console.log('\n── CI comparison (baseline -> head) ──');
    console.log(
      `  Errors: ${summary.baselineErrors} → ${summary.currentErrors} ` +
        `(unchanged: ${summary.unchangedErrors}, new: ${summary.newErrors}, resolved: ${summary.resolvedErrors})`
    );
    console.log(`  Warnings: ${summary.baselineWarnings} → ${summary.currentWarnings}`);

    if (comparison.newErrors.length === 0) {
      console.log('✔ No new naming errors introduced.');
    } else {
      console.log('\nNew naming errors:');
      for (const violation of comparison.newErrors) {
        console.log(`  ✖ [P${violation.pattern}] ${violation.subPackage}/${violation.file}`);
        console.log(`    ${violation.message}`);
      }
    }

    if (comparison.resolvedErrors.length > 0) {
      console.log('\nResolved baseline errors detected; baseline cleanup is handled separately:');
      for (const violation of comparison.resolvedErrors) {
        console.log(`  ✓ [P${violation.pattern}] ${violation.subPackage}/${violation.file}`);
      }
    }
  }

  return comparison.newErrors.length > 0 ? 1 : 0;
}
