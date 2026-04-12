// ============================================================
// ThresholdFilter -- filters files by line count and computes
// priority scores for decomposition analysis.
// ============================================================

import fs from 'node:fs';

import type { FileEntry, FileAnalysis, ThresholdResult } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Patterns that identify test files to exclude from analysis. */
const TEST_PATH_PATTERNS: readonly RegExp[] = [
    /__tests__\//,
    /\.test\.tsx?$/,
    /\.spec\.tsx?$/,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return true when the file path matches a test-file pattern.
 *
 * Excluded patterns:
 *   - paths containing `__tests__/`
 *   - files ending with `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`
 */
function isTestFile(filePath: string): boolean {
    return TEST_PATH_PATTERNS.some((re) => re.test(filePath));
}

/**
 * Count the number of lines in a file by reading its content.
 * Returns 0 when the file cannot be read.
 */
function countLines(absolutePath: string): number {
    try {
        const content = fs.readFileSync(absolutePath, 'utf-8');
        return content.split('\n').length;
    } catch {
        return 0;
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute priority score as `lineCount × exportCount`.
 */
export function computePriorityScore(
    lineCount: number,
    exportCount: number,
): number {
    return lineCount * exportCount;
}

/**
 * Filter a FileEntry array to files with lineCount >= threshold,
 * excluding test files. Results are sorted by lineCount descending.
 *
 * When an `analyses` map is provided, exportCount and
 * estimatedCohesionGroups are populated from the analysis data.
 * Otherwise they default to 0.
 */
export function filterByThreshold(
    files: readonly FileEntry[],
    threshold: number,
    analyses?: ReadonlyMap<string, FileAnalysis>,
): ThresholdResult[] {
    const results: ThresholdResult[] = [];

    for (const file of files) {
        // Skip test files
        if (isTestFile(file.relativePath) || isTestFile(file.absolutePath)) {
            continue;
        }

        const lineCount = countLines(file.absolutePath);

        if (lineCount < threshold) {
            continue;
        }

        const analysis = analyses?.get(file.absolutePath);
        const exportCount = analysis ? analysis.exports.length : 0;

        results.push({
            file,
            lineCount,
            exportCount,
            estimatedCohesionGroups: 0,
            priorityScore: computePriorityScore(lineCount, exportCount),
        });
    }

    // Sort by lineCount descending
    results.sort((a, b) => b.lineCount - a.lineCount);

    return results;
}
