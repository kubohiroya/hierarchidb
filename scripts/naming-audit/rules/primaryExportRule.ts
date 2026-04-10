// ============================================================
// PrimaryExportRule — Pattern 1: Primary_Export mismatch
//
// Checks whether the file stem matches the primary export
// symbol name. When they don't match, suggests renaming the
// file to match the primary export.
// ============================================================

import path from 'node:path';

import type { FileAnalysis, Rule, Violation } from '../types.js';

/**
 * Extract the stem (name without extension) from a file path.
 * Handles double extensions like .core.ts, .internal.ts, .impl.ts.
 */
function fileStem(filePath: string): string {
    const base = path.basename(filePath);
    const match = base.match(/^(.+?)\.(?:core|internal|impl)?\.[^.]+$/);
    if (match) return match[1];
    return path.parse(base).name;
}

/**
 * Determine the expected file name based on the primary export name
 * and the original file extension.
 */
function buildExpectedFileName(primaryExportName: string, extension: string): string {
    return `${primaryExportName}${extension}`;
}

export const primaryExportRule: Rule = {
    name: 'PrimaryExportRule',

    evaluate(analysis: FileAnalysis): Violation[] {
        const { file, primaryExport, exports, isReExportOnly } = analysis;

        // Skip index.ts files — they are re-export entry points
        const baseName = path.basename(file.absolutePath);
        if (baseName === 'index.ts' || baseName === 'index.tsx') {
            return [];
        }

        // Skip re-export-only files — handled by ViewPatternRule
        if (isReExportOnly) {
            return [];
        }

        // Skip files with no exports
        if (exports.length === 0 || primaryExport === null) {
            return [];
        }

        const stem = fileStem(file.absolutePath);
        const primaryName = primaryExport.name;

        // Skip wildcard re-exports that resolved as primary
        if (primaryName === '*') {
            return [];
        }

        // For .tsx files: exact (PascalCase) match required
        // For .ts files: case-insensitive match (hooks are camelCase, e.g. useXxx.ts)
        const matches = file.extension === '.tsx'
            ? stem === primaryName
            : stem.toLowerCase() === primaryName.toLowerCase();

        if (matches) {
            return [];
        }

        const suggestedRename = buildExpectedFileName(primaryName, file.extension);

        return [
            {
                file,
                pattern: 1,
                severity: 'error',
                message: `File "${baseName}" does not match primary export "${primaryName}". Expected "${suggestedRename}".`,
                suggestedRename,
            },
        ];
    },
};
