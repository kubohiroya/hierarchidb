// ============================================================
// CLI entry point for the naming-audit tool.
//
// Usage:
//   pnpm tsx scripts/naming-audit.ts [options]
//
// Options:
//   --ci              CI mode (same behaviour, explicit intent flag)
//   --format <fmt>    Output format: "json" | "table" (default: "table")
//   --target <dir>    Override target directories (repeatable)
// ============================================================

import { createExportAnalyzer } from './naming-audit/exportAnalyzer.js';
import { scanFiles } from './naming-audit/fileScanner.js';
import { evaluateRules } from './naming-audit/ruleEngine.js';
import { implSuffixRule } from './naming-audit/rules/implSuffixRule.js';
import { primaryExportRule } from './naming-audit/rules/primaryExportRule.js';
import { roleSuffixRule } from './naming-audit/rules/roleSuffixRule.js';
import { separationThresholdRule } from './naming-audit/rules/separationThresholdRule.js';
import { viewPatternRule } from './naming-audit/rules/viewPatternRule.js';
import type {
  FileAnalysis,
  FileScannerOptions,
  Rule,
  RuleEngineConfig,
} from './naming-audit/types.js';
import { reportViolations } from './naming-audit/violationReporter.js';

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_TARGET_DIRS: readonly string[] = [
  'app/src/',
  'packages/*/src/',
  'plugins/*-plugin/src/',
];

const DEFAULT_EXCLUDE_PATTERNS: readonly string[] = ['dist/', '*.d.ts', '__tests__/'];

const ROUTER_EXCEPTION_PATHS: readonly string[] = ['app/src/router/**'];

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliOptions {
  readonly ci: boolean;
  readonly format: 'json' | 'table';
  readonly targets: readonly string[];
}

function parseArgs(argv: readonly string[]): CliOptions {
  let ci = false;
  let format: 'json' | 'table' = 'table';
  const targets: string[] = [];

  // Skip first two entries (node binary + script path)
  const args = argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--ci':
        ci = true;
        break;
      case '--format': {
        const value = args[++i];
        if (value !== 'json' && value !== 'table') {
          console.error(`Invalid format: "${value}". Expected "json" or "table".`);
          process.exit(2);
        }
        format = value;
        break;
      }
      case '--target': {
        const value = args[++i];
        if (!value) {
          console.error('Missing value for --target');
          process.exit(2);
        }
        targets.push(value);
        break;
      }
      default:
        console.error(`Unknown option: "${arg}"`);
        process.exit(2);
    }
  }

  return {
    ci,
    format,
    targets: targets.length > 0 ? targets : DEFAULT_TARGET_DIRS,
  };
}

// ---------------------------------------------------------------------------
// All rules
// ---------------------------------------------------------------------------

const ALL_RULES: readonly Rule[] = [
  primaryExportRule,
  roleSuffixRule,
  implSuffixRule,
  viewPatternRule,
  separationThresholdRule,
];

// ExportAnalyzer — reusable ts-morph Project instance
const exportAnalyzer = createExportAnalyzer();

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

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

  const ruleConfig: RuleEngineConfig = {
    routerExceptionPaths: ROUTER_EXCEPTION_PATHS,
  };

  // Step 1: Scan files
  progress('Scanning files…');
  const files = scanFiles(scannerOptions);
  progressDone(`✔ Scanned ${files.length} files`);

  // Step 2: Analyse exports for each file
  const analyses: FileAnalysis[] = [];
  for (let i = 0; i < files.length; i++) {
    progress(`Analysing exports… (${i + 1}/${files.length}) ${files[i].relativePath}`);
    analyses.push(exportAnalyzer.analyze(files[i]));
  }
  progressDone(`✔ Analysed ${analyses.length} files`);

  // Step 3: Evaluate rules
  progress('Evaluating rules…');
  const violations = evaluateRules(analyses, ALL_RULES, ruleConfig);
  progressDone(`✔ Evaluated ${ALL_RULES.length} rules — ${violations.length} violation(s) found`);

  // Step 4: Report violations and determine exit code
  const exitCode = reportViolations(violations, options.format);

  process.exit(exitCode);
}

main();
