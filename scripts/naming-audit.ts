// ============================================================
// CLI entry point for the naming-audit tool.
//
// Usage:
//   pnpm tsx scripts/naming-audit.ts [options]
//
// Options:
//   --ci                 Compare the current report with --baseline
//   --baseline <file>    Base-revision JSON report (required with --ci)
//   --changed-since <ref> Audit files changed since the specified Git ref
//   --report-only        Emit a JSON report without failing on violations
//   --root <dir>         Repository root to audit (default: current directory)
//   --format <fmt>       Output format: "json" | "table" (default: "table")
//   --target <dir>       Override target directories (repeatable)
// ============================================================

import fs from 'node:fs';
import path from 'node:path';

import { createExportAnalyzer } from './naming-audit/exportAnalyzer.js';
import { scanFiles } from './naming-audit/fileScanner.js';
import {
  compareNamingAuditViolations,
  filterNamingAuditBaselineForAuditedFiles,
  parseNamingAuditViolationRecords,
  toNamingAuditViolationRecords,
} from './naming-audit/namingAuditCiUtils.js';
import {
  DEFAULT_NAMING_AUDIT_EXCLUDE_PATTERNS,
  DEFAULT_NAMING_AUDIT_TARGET_DIRS,
  NAMING_AUDIT_ROUTER_EXCEPTION_PATHS,
} from './naming-audit/namingAuditConstants.js';
import { readGitChangedPaths } from './naming-audit/readGitChangedPaths.js';
import { requiresNamingAuditFullScan } from './naming-audit/requiresNamingAuditFullScan.js';
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
import { reportNamingAuditComparison, reportViolations } from './naming-audit/violationReporter.js';

interface CliOptions {
  readonly baselinePath: string | null;
  readonly ci: boolean;
  readonly changedSince: string | null;
  readonly format: 'json' | 'table';
  readonly reportOnly: boolean;
  readonly rootDir: string;
  readonly targets: readonly string[];
}

function requireOptionValue(args: readonly string[], optionIndex: number, option: string): string {
  const value = args[optionIndex + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Missing value for ${option}.`);
  }
  return value;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let baselinePath: string | null = null;
  let ci = false;
  let changedSince: string | null = null;
  let format: 'json' | 'table' = 'table';
  let reportOnly = false;
  let rootDir = process.cwd();
  const targets: string[] = [];
  const args = argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--ci':
        ci = true;
        break;
      case '--baseline':
        baselinePath = requireOptionValue(args, index, '--baseline');
        index += 1;
        break;
      case '--changed-since':
        changedSince = requireOptionValue(args, index, '--changed-since');
        index += 1;
        break;
      case '--report-only':
        reportOnly = true;
        break;
      case '--root':
        rootDir = requireOptionValue(args, index, '--root');
        index += 1;
        break;
      case '--format': {
        const value = requireOptionValue(args, index, '--format');
        if (value !== 'json' && value !== 'table') {
          throw new Error(`Invalid format: "${value}". Expected "json" or "table".`);
        }
        format = value;
        index += 1;
        break;
      }
      case '--target':
        targets.push(requireOptionValue(args, index, '--target'));
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: "${String(arg)}".`);
    }
  }

  if (ci && baselinePath === null) {
    throw new Error('--ci requires --baseline <file>.');
  }
  if (!ci && baselinePath !== null) {
    throw new Error('--baseline is only valid with --ci.');
  }
  if (ci && reportOnly) {
    throw new Error('--ci and --report-only cannot be used together.');
  }
  if (reportOnly && format !== 'json') {
    throw new Error('--report-only requires --format json.');
  }

  return {
    baselinePath,
    ci,
    changedSince,
    format,
    reportOnly,
    rootDir: path.resolve(rootDir),
    targets: targets.length > 0 ? targets : DEFAULT_NAMING_AUDIT_TARGET_DIRS,
  };
}

const ALL_RULES: readonly Rule[] = [
  primaryExportRule,
  roleSuffixRule,
  implSuffixRule,
  viewPatternRule,
  separationThresholdRule,
];

const isTTY = process.stderr.isTTY ?? false;

function clearLine(): void {
  if (isTTY) {
    process.stderr.write('\r\x1b[K');
  }
}

function progress(message: string): void {
  if (isTTY) {
    clearLine();
    process.stderr.write(message);
  } else {
    process.stderr.write(`${message}\n`);
  }
}

function progressDone(message: string): void {
  clearLine();
  process.stderr.write(`${message}\n`);
}

function readBaselineReport(baselinePath: string): unknown {
  const resolvedPath = path.resolve(baselinePath);
  const contents = fs.readFileSync(resolvedPath, 'utf8');
  return JSON.parse(contents) as unknown;
}

function run(): number {
  const options = parseArgs(process.argv);
  const rootStat = fs.statSync(options.rootDir);
  if (!rootStat.isDirectory()) {
    throw new Error(`Naming audit root is not a directory: ${options.rootDir}`);
  }

  const changedPaths =
    options.changedSince === null ? null : readGitChangedPaths(options.changedSince);
  const requiresFullScan = changedPaths?.some(requiresNamingAuditFullScan) ?? false;

  const auditsAlternateRevision = path.resolve(process.cwd()) !== options.rootDir;
  const scannerOptions: FileScannerOptions = {
    rootDir: options.rootDir,
    targetDirs: options.targets,
    excludePatterns: DEFAULT_NAMING_AUDIT_EXCLUDE_PATTERNS,
    includeFiles: changedPaths !== null && !requiresFullScan ? changedPaths : undefined,
    allowMissingIncludeFiles: auditsAlternateRevision,
  };
  const ruleConfig: RuleEngineConfig = {
    routerExceptionPaths: NAMING_AUDIT_ROUTER_EXCEPTION_PATHS,
  };
  const tsConfigPath = path.join(options.rootDir, 'tsconfig.json');
  const exportAnalyzer = createExportAnalyzer(tsConfigPath);

  progress(
    requiresFullScan
      ? 'Naming Audit implementation changed; scanning all files…'
      : changedPaths === null
        ? 'Scanning files…'
        : `Scanning files changed since ${options.changedSince}…`
  );
  const files = scanFiles(scannerOptions);
  if (files.length === 0 && (changedPaths === null || requiresFullScan)) {
    throw new Error(`Naming audit found no files under root: ${options.rootDir}`);
  }
  progressDone(`✔ Scanned ${files.length} files`);

  const analyses: FileAnalysis[] = [];
  for (const [index, file] of files.entries()) {
    progress(`Analysing exports… (${index + 1}/${files.length}) ${file.relativePath}`);
    analyses.push(exportAnalyzer.analyze(file));
  }
  progressDone(`✔ Analysed ${analyses.length} files`);

  progress('Evaluating rules…');
  const violations = evaluateRules(analyses, ALL_RULES, ruleConfig);
  progressDone(`✔ Evaluated ${ALL_RULES.length} rules — ${violations.length} violation(s) found`);

  const fullReportExitCode = reportViolations(violations, options.format);
  if (options.reportOnly) {
    return 0;
  }
  if (!options.ci) {
    return fullReportExitCode;
  }

  const baselinePath = options.baselinePath;
  if (baselinePath === null) {
    throw new Error('CI baseline path is missing after argument validation.');
  }
  const baselineRecords = filterNamingAuditBaselineForAuditedFiles(
    parseNamingAuditViolationRecords(readBaselineReport(baselinePath)),
    files
  );
  const currentRecords = toNamingAuditViolationRecords(violations);
  const comparison = compareNamingAuditViolations(baselineRecords, currentRecords);
  return reportNamingAuditComparison(comparison, options.format);
}

try {
  process.exit(run());
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Naming audit failed: ${message}`);
  process.exit(2);
}
