// ============================================================
// SeparationThresholdRule — Container/Presentational separation threshold
//
// Reports .tsx components that exceed the separation threshold:
//   - JSX line count > 50, OR
//   - Hook call count > 2
//
// These components are candidates for splitting into:
//   ComponentName.tsx (Container)
//   ComponentNameView.tsx (Presentational)
//   useComponentNameState.ts (State hook)
//
// Requirements: 1.2, 7.4
// ============================================================

import path from 'node:path';

import type { ComponentMetrics, FileAnalysis, Rule, Violation } from '../types.js';

// ---------------------------------------------------------------------------
// Thresholds (from design doc / requirements 7.4)
// ---------------------------------------------------------------------------

/** Maximum JSX lines before separation is recommended. */
export const JSX_LINE_THRESHOLD = 50;

/** Maximum hook calls before separation is recommended. */
export const HOOK_CALL_THRESHOLD = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileStem(filePath: string): string {
  return path.parse(path.basename(filePath)).name;
}

/**
 * Determine whether a component exceeds the separation threshold.
 *
 * Returns true when:
 *   - jsxLineCount > JSX_LINE_THRESHOLD, OR
 *   - hookCallCount > HOOK_CALL_THRESHOLD
 */
export function exceedsThreshold(metrics: ComponentMetrics): boolean {
  return metrics.jsxLineCount > JSX_LINE_THRESHOLD || metrics.hookCallCount > HOOK_CALL_THRESHOLD;
}

/**
 * Build a human-readable reason string describing which thresholds
 * were exceeded.
 */
function buildReason(metrics: ComponentMetrics): string {
  const parts: string[] = [];

  if (metrics.jsxLineCount > JSX_LINE_THRESHOLD) {
    parts.push(`JSX lines: ${metrics.jsxLineCount} (threshold: ${JSX_LINE_THRESHOLD})`);
  }
  if (metrics.hookCallCount > HOOK_CALL_THRESHOLD) {
    parts.push(`hook calls: ${metrics.hookCallCount} (threshold: ${HOOK_CALL_THRESHOLD})`);
  }

  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Rule implementation
// ---------------------------------------------------------------------------

export const separationThresholdRule: Rule = {
  name: 'SeparationThresholdRule',

  evaluate(analysis: FileAnalysis): Violation[] {
    const { file, componentMetrics, isReExportOnly, exports } = analysis;

    // --- Only applies to .tsx files ---
    if (file.extension !== '.tsx') return [];

    // --- Skip index.tsx ---
    const baseName = path.basename(file.absolutePath);
    if (baseName === 'index.tsx') return [];

    // --- Skip re-export wrappers (handled by ViewPatternRule) ---
    if (isReExportOnly) return [];

    // --- Skip files with no exports ---
    if (exports.length === 0) return [];

    // --- Skip files without component metrics ---
    if (componentMetrics === null) return [];

    // --- Skip files that already use React.memo (likely already separated) ---
    if (componentMetrics.usesReactMemo) return [];

    // --- Skip *View.tsx files (already presentational) ---
    const stem = fileStem(file.absolutePath);
    if (stem.endsWith('View')) return [];

    // --- Check threshold ---
    if (!exceedsThreshold(componentMetrics)) return [];

    const reason = buildReason(componentMetrics);
    const suggestedContainer = `${stem}.tsx`;
    const suggestedView = `${stem}View.tsx`;
    const suggestedHook = `use${stem.charAt(0).toUpperCase()}${stem.slice(1)}State.ts`;

    return [
      {
        file,
        pattern: 5,
        severity: 'warning',
        message:
          `Component "${baseName}" exceeds separation threshold (${reason}). ` +
          `Consider splitting into ${suggestedContainer} + ${suggestedView} + ${suggestedHook}.`,
        suggestedRename: `${suggestedContainer} + ${suggestedView} + ${suggestedHook}`,
      },
    ];
  },
};
