// ============================================================
// ViewPatternRule — Patterns 5 & 6:
//   Pattern 5: Container/Presentational mixed component
//   Pattern 6: View suffix missing on presentational component
//
// Also detects re-export-only wrapper .tsx files (Pattern B)
// that should be deleted in favour of the real implementation.
//
// Requirements: 1.2, 5.3, 7.1
// ============================================================

import path from 'node:path';

import type { FileAnalysis, Rule, Violation } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VIEW_SUFFIX_REGEX = /View$/;

/**
 * Extract the stem (name without extension) from a file path.
 */
function fileStem(filePath: string): string {
  return path.parse(path.basename(filePath)).name;
}

/**
 * Check whether a .tsx file is a hook file (primary export starts with "use").
 * Hook .tsx files are excluded from View pattern checks.
 */
function isHookFile(analysis: FileAnalysis): boolean {
  if (analysis.primaryExport === null) return false;
  return analysis.primaryExport.name.startsWith('use');
}

/**
 * Check whether a .tsx file is an index file.
 */
function isIndexFile(filePath: string): boolean {
  const base = path.basename(filePath);
  return base === 'index.tsx';
}

// ---------------------------------------------------------------------------
// Re-export wrapper detection (Pattern B)
// ---------------------------------------------------------------------------

/**
 * Detect a re-export-only .tsx wrapper file.
 *
 * Pattern B: A .tsx file whose only purpose is to re-export from
 * another file (typically a *View.tsx). These wrappers should be
 * deleted and the target file renamed.
 *
 * Returns a Violation when the file is a re-export wrapper, or
 * null when it is not.
 */
function detectReExportWrapper(analysis: FileAnalysis): Violation | null {
  const { file, isReExportOnly, primaryExport } = analysis;

  if (!isReExportOnly) return null;

  const stem = fileStem(file.absolutePath);
  const baseName = path.basename(file.absolutePath);

  // Build a suggested action: delete this wrapper, rename the target
  const suggestedRename = primaryExport
    ? `(delete ${baseName}, rename target to ${primaryExport.name}${file.extension})`
    : `(delete re-export wrapper ${baseName})`;

  return {
    file,
    pattern: 5,
    severity: 'error',
    message:
      `File "${baseName}" is a re-export-only wrapper (Pattern B). ` +
      `Delete this file and rename the implementation file to "${stem}${file.extension}".`,
    suggestedRename,
  };
}

// ---------------------------------------------------------------------------
// View suffix detection (Pattern 6)
// ---------------------------------------------------------------------------

/**
 * Detect a presentational .tsx component that is missing the *View.tsx suffix.
 *
 * A component is considered presentational when:
 *   - It is a .tsx file
 *   - It has componentMetrics (i.e. it contains JSX)
 *   - It has zero hook calls (hookCallCount === 0)
 *   - It does NOT already have the *View.tsx suffix
 *
 * Returns a Violation when the suffix is missing, or null otherwise.
 */
function detectMissingViewSuffix(analysis: FileAnalysis): Violation | null {
  const { file, componentMetrics } = analysis;

  if (componentMetrics === null) return null;

  // Only flag files with zero hooks — they are purely presentational
  if (componentMetrics.hookCallCount !== 0) return null;

  const stem = fileStem(file.absolutePath);
  const baseName = path.basename(file.absolutePath);

  // Already has the View suffix — compliant
  if (VIEW_SUFFIX_REGEX.test(stem)) return null;

  const suggestedRename = `${stem}View${file.extension}`;

  return {
    file,
    pattern: 6,
    severity: 'error',
    message:
      `File "${baseName}" is a presentational component (0 hook calls) ` +
      `but does not use the "*View.tsx" suffix. Rename to "${suggestedRename}".`,
    suggestedRename,
  };
}

// ---------------------------------------------------------------------------
// Rule implementation
// ---------------------------------------------------------------------------

export const viewPatternRule: Rule = {
  name: 'ViewPatternRule',

  evaluate(analysis: FileAnalysis): Violation[] {
    const { file, exports } = analysis;

    // --- Only applies to .tsx files ---
    if (file.extension !== '.tsx') return [];

    // --- Skip index.tsx files ---
    if (isIndexFile(file.absolutePath)) return [];

    // --- Skip hook files (use*.tsx — though discouraged, they exist) ---
    if (isHookFile(analysis)) return [];

    // --- Skip files with no exports ---
    if (exports.length === 0) return [];

    const violations: Violation[] = [];

    // --- Check for re-export wrapper (Pattern B → Pattern 5) ---
    const wrapperViolation = detectReExportWrapper(analysis);
    if (wrapperViolation !== null) {
      violations.push(wrapperViolation);
      // Re-export wrappers don't need further checks
      return violations;
    }

    // --- Check for missing View suffix (Pattern 6) ---
    const viewSuffixViolation = detectMissingViewSuffix(analysis);
    if (viewSuffixViolation !== null) {
      violations.push(viewSuffixViolation);
    }

    return violations;
  },
};
