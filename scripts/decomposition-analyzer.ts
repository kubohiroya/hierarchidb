// ============================================================
// CLI entry point for the decomposition-analyzer tool.
//
// Usage:
//   pnpm tsx scripts/decomposition-analyzer.ts [options]
//
// Options:
//   --format <json|table>   Output format (default: table)
//   --batch <n>             Top n files only
//   --target <dir>          Override target directories (repeatable)
//   --validate-only         Run plan validation only
//   --threshold <n>         Override line threshold (default: 600)
// ============================================================

import { Project } from 'ts-morph';

import { scanFiles } from './naming-audit/fileScanner.js';
import { evaluateRules } from './naming-audit/ruleEngine.js';
import { primaryExportRule } from './naming-audit/rules/primaryExportRule.js';
import { roleSuffixRule } from './naming-audit/rules/roleSuffixRule.js';
import { viewPatternRule } from './naming-audit/rules/viewPatternRule.js';
import type { FileAnalysis, FileScannerOptions, Rule, RuleEngineConfig } from './naming-audit/types.js';
import { groupByCohesion } from './decomposition/cohesionGrouper.js';
import { validatePlan, verifyApiPreservation } from './decomposition/planValidator.js';
import { loadProgress, saveProgress } from './decomposition/progressTracker.js';
import { reportResults } from './decomposition/reporter.js';
import { generateSplitPlan } from './decomposition/splitPlanGenerator.js';
import { analyzeStructure } from './decomposition/structureAnalyzer.js';
import { filterByThreshold } from './decomposition/thresholdFilter.js';
import type {
    AnalysisReport,
    NamingGuidelineConfig,
    SplitPlan,
    SplitPlanOptions,
    ValidationResult,
} from './decomposition/types.js';

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_TARGET_DIRS: readonly string[] = [
    'app/src/',
    'packages/*/src/',
    'plugins/*-plugin/src/',
];

const DEFAULT_EXCLUDE_PATTERNS: readonly string[] = ['dist/', '*.d.ts', '__tests__/'];

const DEFAULT_THRESHOLD = 600;

const PROGRESS_TRACKING_FILE = '.decomposition-progress.json';

const DEFAULT_NAMING_GUIDELINE: NamingGuidelineConfig = {
    hookPrefix: 'use',
    viewSuffix: 'View',
    typesFileName: 'types.ts',
    constantsFileName: 'constants.ts',
    utilsFileName: 'utils.ts',
    indexReExportOnly: true,
};

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliOptions {
    readonly format: 'json' | 'table';
    readonly batch: number | null;
    readonly targets: readonly string[];
    readonly validateOnly: boolean;
    readonly threshold: number;
}

function parseArgs(argv: readonly string[]): CliOptions {
    let format: 'json' | 'table' = 'table';
    let batch: number | null = null;
    const targets: string[] = [];
    let validateOnly = false;
    let threshold = DEFAULT_THRESHOLD;

    // Skip first two entries (node binary + script path)
    const args = argv.slice(2);

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--format': {
                const value = args[++i];
                if (value !== 'json' && value !== 'table') {
                    process.stderr.write(
                        `Error: Invalid format: "${String(value)}". Expected "json" or "table".\n`,
                    );
                    process.exit(2);
                }
                format = value;
                break;
            }
            case '--batch': {
                const value = args[++i];
                const parsed = Number(value);
                if (!Number.isInteger(parsed) || parsed <= 0) {
                    process.stderr.write(
                        `Error: Invalid batch value: "${String(value)}". Expected a positive integer.\n`,
                    );
                    process.exit(2);
                }
                batch = parsed;
                break;
            }
            case '--target': {
                const value = args[++i];
                if (!value) {
                    process.stderr.write('Error: Missing value for --target\n');
                    process.exit(2);
                }
                targets.push(value);
                break;
            }
            case '--validate-only': {
                validateOnly = true;
                break;
            }
            case '--threshold': {
                const value = args[++i];
                const parsed = Number(value);
                if (!Number.isInteger(parsed) || parsed <= 0) {
                    process.stderr.write(
                        `Error: Invalid threshold value: "${String(value)}". Expected a positive integer.\n`,
                    );
                    process.exit(2);
                }
                threshold = parsed;
                break;
            }
            default: {
                process.stderr.write(`Error: Unknown option: "${arg}"\n`);
                process.exit(2);
            }
        }
    }

    return {
        format,
        batch,
        targets: targets.length > 0 ? targets : DEFAULT_TARGET_DIRS,
        validateOnly,
        threshold,
    };
}

// ---------------------------------------------------------------------------
// Progress helpers (write to stderr so stdout stays clean for JSON output)
// ---------------------------------------------------------------------------

const isTTY = process.stderr.isTTY ?? false;

function clearLine(): void {
    if (isTTY) {
        process.stderr.write('\r\x1b[K');
    }
}

function progress(msg: string): void {
    if (isTTY) {
        clearLine();
        process.stderr.write(msg);
    } else {
        process.stderr.write(`${msg}\n`);
    }
}

function progressDone(msg: string): void {
    clearLine();
    process.stderr.write(`${msg}\n`);
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

function main(): void {
    const options = parseArgs(process.argv);

    const scannerOptions: FileScannerOptions = {
        targetDirs: options.targets,
        excludePatterns: DEFAULT_EXCLUDE_PATTERNS,
    };

    const splitPlanOptions: SplitPlanOptions = {
        threshold: options.threshold,
        namingGuideline: DEFAULT_NAMING_GUIDELINE,
    };

    // Audit Tool integration (requirement 8.1): use ruleEngine to validate
    // naming compliance of split target file names.
    const auditRules: readonly Rule[] = [
        primaryExportRule,
        roleSuffixRule,
        viewPatternRule,
    ];
    const ruleConfig: RuleEngineConfig = {
        routerExceptionPaths: [],
    };

    // Step 1: Scan files
    progress('Scanning files...');
    const files = scanFiles(scannerOptions);
    progressDone(`Scanned ${String(files.length)} files`);

    // Step 2: Filter by threshold
    progress('Filtering by threshold...');
    const thresholdResults = filterByThreshold(files, options.threshold);
    progressDone(`Filtered to ${String(thresholdResults.length)} files above ${String(options.threshold)} lines`);

    // Apply batch limit to threshold results if specified
    const batchedResults = options.batch !== null
        ? thresholdResults.slice(0, options.batch)
        : thresholdResults;

    // Step 3: Create ts-morph project for structural analysis
    const project = new Project({ skipAddingFilesFromTsConfig: true });

    // Step 4: Analyze structure, group by cohesion, generate split plans, validate
    const splitPlans: SplitPlan[] = [];
    const validationResults: ValidationResult[] = [];
    const totalFiltered = batchedResults.length;

    for (let i = 0; i < totalFiltered; i++) {
        const result = batchedResults[i];
        progress(`Analyzing structure... (${String(i + 1)}/${String(totalFiltered)}) ${result.file.relativePath}`);

        // Analyze structure
        const structure = analyzeStructure(result.file, project);

        // Group by cohesion
        const groups = groupByCohesion(structure.graph);

        // Generate split plan
        const plan = generateSplitPlan(structure, groups, splitPlanOptions);
        splitPlans.push(plan);

        // Validate plan
        const validation = validatePlan(plan);

        // Also verify API preservation with the full structure
        const apiResult = verifyApiPreservation(structure, plan);
        const enrichedValidation: ValidationResult = {
            ...validation,
            apiPreservation: apiResult,
            valid: validation.valid && apiResult.preserved,
        };
        validationResults.push(enrichedValidation);
    }
    progressDone('Analyzing complete');

    // Step 5: Run naming-audit ruleEngine validation on split targets
    // (Integration with Audit Tool per requirement 8.1)
    progress('Validating plans...');
    // Build synthetic FileAnalysis entries for split targets and run
    // the audit-tool ruleEngine to catch naming violations the
    // planValidator might not cover.
    const syntheticAnalyses: FileAnalysis[] = [];
    for (const plan of splitPlans) {
        for (const target of plan.targets) {
            syntheticAnalyses.push({
                file: {
                    absolutePath: target.targetPath,
                    relativePath: target.targetPath,
                    subPackage: plan.sourceFile.subPackage,
                    extension: target.targetPath.endsWith('.tsx') ? '.tsx' : '.ts',
                },
                primaryExport: target.symbols.length > 0
                    ? { name: target.symbols[0], kind: 'function', isDefault: false }
                    : null,
                exports: target.symbols.map((s) => ({
                    name: s,
                    kind: 'function' as const,
                    isDefault: false,
                })),
                isReExportOnly: target.role === 'other' && target.symbols.length === 0,
                componentMetrics: null,
            });
        }
    }
    const auditViolations = evaluateRules(syntheticAnalyses, auditRules, ruleConfig);
    if (auditViolations.length > 0) {
        process.stderr.write(
            `Audit tool found ${String(auditViolations.length)} naming violation(s) in split targets\n`,
        );
    }
    progressDone('Validation complete');

    // Step 6: Load/save progress
    const progressState = loadProgress(PROGRESS_TRACKING_FILE);
    const updatedProgress = {
        ...progressState,
        totalTargetFiles: thresholdResults.length,
        remainingCount: thresholdResults.length - progressState.completedFiles.length,
        lastUpdated: new Date().toISOString(),
    };
    saveProgress(updatedProgress, PROGRESS_TRACKING_FILE);

    // Step 7: Report results
    const report: AnalysisReport = {
        thresholdResults: batchedResults,
        splitPlans,
        validationResults,
        progressState: updatedProgress,
    };

    reportResults(report, options.format);
    progressDone('Done');

    // Exit code: 1 if any validation violations, 0 otherwise
    const hasViolations = validationResults.some((v) => !v.valid);
    process.exit(hasViolations ? 1 : 0);
}

main();
