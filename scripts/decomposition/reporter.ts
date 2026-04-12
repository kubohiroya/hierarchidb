// ============================================================
// Reporter -- outputs AnalysisReport in JSON or table format.
// ============================================================

import type {
    AnalysisReport,
    ThresholdResult,
    SplitPlan,
    ValidationResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pad a string to the right (left-align) to the given width. */
function padRight(text: string, width: number): string {
    if (text.length >= width) {
        return text;
    }
    return text + ' '.repeat(width - text.length);
}

/** Pad a string to the left (right-align) to the given width. */
function padLeft(text: string, width: number): string {
    if (text.length >= width) {
        return text;
    }
    return ' '.repeat(width - text.length) + text;
}

// ---------------------------------------------------------------------------
// Column widths
// ---------------------------------------------------------------------------

const COL_LINES = 8;
const COL_EXPORTS = 10;
const COL_GROUPS = 8;
const COL_PRIORITY = 10;

// ---------------------------------------------------------------------------
// Table formatting
// ---------------------------------------------------------------------------

/**
 * Compute the width of the File Path column based on the longest path
 * in the result set, with a minimum of the header length.
 */
function computePathWidth(results: readonly ThresholdResult[]): number {
    const header = 'File Path';
    let max = header.length;
    for (const r of results) {
        if (r.file.relativePath.length > max) {
            max = r.file.relativePath.length;
        }
    }
    return max;
}

/** Build a single table row from a ThresholdResult. */
function formatRow(r: ThresholdResult, pathWidth: number): string {
    return [
        padRight(r.file.relativePath, pathWidth),
        padLeft(String(r.lineCount), COL_LINES),
        padLeft(String(r.exportCount), COL_EXPORTS),
        padLeft(String(r.estimatedCohesionGroups), COL_GROUPS),
        padLeft(String(r.priorityScore), COL_PRIORITY),
    ].join(' | ');
}

/** Build the header row. */
function formatHeader(pathWidth: number): string {
    return [
        padRight('File Path', pathWidth),
        padLeft('Lines', COL_LINES),
        padLeft('Exports', COL_EXPORTS),
        padLeft('Groups', COL_GROUPS),
        padLeft('Priority', COL_PRIORITY),
    ].join(' | ');
}

/** Build the separator row (dashes). */
function formatSeparator(pathWidth: number): string {
    return [
        '-'.repeat(pathWidth),
        '-'.repeat(COL_LINES),
        '-'.repeat(COL_EXPORTS),
        '-'.repeat(COL_GROUPS),
        '-'.repeat(COL_PRIORITY),
    ].join('-+-');
}

// ---------------------------------------------------------------------------
// Split plan section
// ---------------------------------------------------------------------------

/** Format a single split plan for table output. */
function formatSplitPlan(plan: SplitPlan): string {
    const lines: string[] = [];
    lines.push(`  Source: ${plan.sourceFile.relativePath} (${plan.pattern})`);
    for (const target of plan.targets) {
        lines.push(
            `    -> ${target.targetPath} (~${String(target.estimatedLineCount)} lines)`,
        );
    }
    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Validation section
// ---------------------------------------------------------------------------

/** Format validation violations for table output. */
function formatValidationViolations(
    validationResults: readonly ValidationResult[],
): string {
    const lines: string[] = [];
    for (const result of validationResults) {
        if (result.valid) {
            continue;
        }
        for (const v of result.namingViolations) {
            lines.push(`  [naming] ${v.targetPath}: ${v.message} (fix: ${v.suggestedFix})`);
        }
        for (const c of result.circularImports) {
            lines.push(`  [circular] ${c.cycle.join(' -> ')}: ${c.message}`);
        }
        if (!result.apiPreservation.preserved) {
            lines.push(`  [api] ${result.apiPreservation.message}`);
        }
        for (const t of result.thresholdViolations) {
            lines.push(`  [threshold] ${t}`);
        }
    }
    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Report analysis results to stdout.
 *
 * - `json` format: outputs the entire AnalysisReport as formatted JSON.
 * - `table` format: outputs a fixed-width text table with summary sections.
 */
export function reportResults(
    results: AnalysisReport,
    format: 'json' | 'table',
): void {
    if (format === 'json') {
        reportJson(results);
    } else {
        reportTable(results);
    }
}

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

function reportJson(results: AnalysisReport): void {
    process.stdout.write(JSON.stringify(results, null, 2));
}

// ---------------------------------------------------------------------------
// Table output
// ---------------------------------------------------------------------------

function reportTable(results: AnalysisReport): void {
    const { thresholdResults, splitPlans, validationResults } = results;
    const output: string[] = [];

    // --- Main table ---
    if (thresholdResults.length > 0) {
        const pathWidth = computePathWidth(thresholdResults);
        output.push(formatHeader(pathWidth));
        output.push(formatSeparator(pathWidth));
        for (const r of thresholdResults) {
            output.push(formatRow(r, pathWidth));
        }
    }

    // Summary line
    output.push('');
    output.push(`Total: ${String(thresholdResults.length)} files above threshold`);

    // --- Split plans ---
    if (splitPlans.length > 0) {
        output.push('');
        output.push('Split Plans:');
        for (const plan of splitPlans) {
            output.push(formatSplitPlan(plan));
        }
    }

    // --- Violations ---
    const violationText = formatValidationViolations(validationResults);
    if (violationText.length > 0) {
        output.push('');
        output.push('Violations:');
        output.push(violationText);
    }

    process.stdout.write(output.join('\n') + '\n');
}
