// ============================================================
// ImplSuffixRule — Pattern 4: Inappropriate .core.ts / .internal.ts / .impl.ts usage
//
// Detects implementation-detail suffixes (.core.ts, .internal.ts,
// .impl.ts) that are used without proper justification:
//   - .core.ts must only be used for algorithm-core extraction
//   - .internal.ts must only be used for same-directory private impl
//   - .impl.ts must only be used for interface implementation swap points
//
// When a suffix is used inappropriately (e.g. a hook internal
// implementation labelled as .core.ts), suggests a domain-specific
// rename or relocation into a sub-directory.
//
// Requirements: 1.2, 4.1, 4.4
// ============================================================

import path from 'node:path';

import type { FileAnalysis, Rule, Violation } from '../types.js';

// ---------------------------------------------------------------------------
// Suffix detection
// ---------------------------------------------------------------------------

type ImplSuffix = 'core' | 'internal' | 'impl';

const IMPL_SUFFIX_REGEX = /^(.+)\.(core|internal|impl)\.[^.]+$/;

/**
 * Parse the implementation-detail suffix from a file basename.
 * Returns the stem (without the suffix) and the suffix kind, or
 * `null` when the file does not use an impl suffix.
 */
export function parseImplSuffix(baseName: string): { stem: string; suffix: ImplSuffix } | null {
  const match = baseName.match(IMPL_SUFFIX_REGEX);
  if (!match) return null;
  return { stem: match[1], suffix: match[2] as ImplSuffix };
}

// ---------------------------------------------------------------------------
// Heuristic: is the file likely an algorithm core?
// ---------------------------------------------------------------------------

/**
 * A `.core.ts` file is considered legitimate when it contains
 * pure algorithmic logic — i.e. it exports only functions (no
 * hooks, no React, no side-effects) and is NOT a re-export wrapper.
 *
 * Hook files (stem starts with "use") are never legitimate .core.ts
 * because the guideline says hook internals should live in a
 * sub-directory, not use the .core.ts suffix.
 */
export function isLegitimateCoreSuffix(analysis: FileAnalysis, stem: string): boolean {
  // Re-export wrappers are never legitimate .core.ts
  if (analysis.isReExportOnly) return false;

  // Hook files should use sub-directory, not .core.ts
  if (stem.startsWith('use')) return false;

  // Must have own (non-reExport) exports
  const ownExports = analysis.exports.filter((e) => e.kind !== 'reExport');
  if (ownExports.length === 0) return false;

  // All own exports must be pure functions — no types, classes, consts
  // (types are fine alongside functions, but the primary must be functions)
  const hasFunctions = ownExports.some((e) => e.kind === 'function');
  const hasNonFunctionValues = ownExports.some(
    (e) => e.kind !== 'function' && e.kind !== 'type' && e.kind !== 'interface'
  );

  return hasFunctions && !hasNonFunctionValues;
}

// ---------------------------------------------------------------------------
// Heuristic: is the file a legitimate .internal.ts?
// ---------------------------------------------------------------------------

/**
 * A `.internal.ts` file is legitimate when it is NOT a re-export
 * wrapper and actually contains own exports (private implementation
 * within the same directory).
 */
export function isLegitimateInternalSuffix(analysis: FileAnalysis): boolean {
  if (analysis.isReExportOnly) return false;
  const ownExports = analysis.exports.filter((e) => e.kind !== 'reExport');
  return ownExports.length > 0;
}

// ---------------------------------------------------------------------------
// Heuristic: is the file a legitimate .impl.ts?
// ---------------------------------------------------------------------------

/**
 * A `.impl.ts` file is legitimate when it is NOT a re-export
 * wrapper and contains own exports (interface implementation).
 */
export function isLegitimateImplSuffix(analysis: FileAnalysis): boolean {
  if (analysis.isReExportOnly) return false;
  const ownExports = analysis.exports.filter((e) => e.kind !== 'reExport');
  return ownExports.length > 0;
}

// ---------------------------------------------------------------------------
// Suggested rename generation
// ---------------------------------------------------------------------------

/**
 * Build a suggested rename for a file with an inappropriate impl suffix.
 *
 * Strategy:
 *   - Hook .core.ts → move to sub-directory: `<stem>/<stem>.ts`
 *   - Re-export .core.ts → delete wrapper, rename target
 *   - Other .core.ts / .internal.ts / .impl.ts → drop suffix: `<stem>.ts`
 */
export function buildSuggestedRename(
  stem: string,
  suffix: ImplSuffix,
  extension: string,
  isReExportOnly: boolean
): string {
  if (suffix === 'core' && stem.startsWith('use')) {
    // Hook internal implementation → sub-directory
    return `${stem}/${stem}${extension}`;
  }

  if (isReExportOnly) {
    // Re-export wrapper → delete this file, rename the target
    return `(delete wrapper, rename target to ${stem}${extension})`;
  }

  // Default: drop the suffix
  return `${stem}${extension}`;
}

// ---------------------------------------------------------------------------
// Rule implementation
// ---------------------------------------------------------------------------

export const implSuffixRule: Rule = {
  name: 'ImplSuffixRule',

  evaluate(analysis: FileAnalysis): Violation[] {
    const { file } = analysis;
    const baseName = path.basename(file.absolutePath);

    const parsed = parseImplSuffix(baseName);
    if (!parsed) return [];

    const { stem, suffix } = parsed;

    // --- Evaluate legitimacy per suffix kind ---

    switch (suffix) {
      case 'core': {
        if (isLegitimateCoreSuffix(analysis, stem)) return [];
        break;
      }
      case 'internal': {
        if (isLegitimateInternalSuffix(analysis)) return [];
        break;
      }
      case 'impl': {
        if (isLegitimateImplSuffix(analysis)) return [];
        break;
      }
    }

    // --- Build violation ---

    const suggestedRename = buildSuggestedRename(
      stem,
      suffix,
      file.extension,
      analysis.isReExportOnly
    );

    const reason = analysis.isReExportOnly
      ? `is a re-export wrapper with .${suffix}.ts suffix`
      : stem.startsWith('use')
        ? `is a hook internal implementation using .${suffix}.ts (move to sub-directory instead)`
        : `uses .${suffix}.ts without clear justification`;

    return [
      {
        file,
        pattern: 4,
        severity: 'error',
        message: `File "${baseName}" ${reason}. Suggested: "${suggestedRename}".`,
        suggestedRename,
      },
    ];
  },
};
