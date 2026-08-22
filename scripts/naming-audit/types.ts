// ============================================================
// Core type definitions for the naming-audit tool.
// ============================================================

// ---------------------------------------------------------------------------
// FileScanner types
// ---------------------------------------------------------------------------

/** A single file discovered by the scanner. */
export interface FileEntry {
  /** Absolute path to the file */
  readonly absolutePath: string;
  /** Path relative to the sub-package root (e.g., "src/ui/components/Foo.tsx") */
  readonly relativePath: string;
  /** Sub-package identifier (e.g., "shape-plugin", "app") */
  readonly subPackage: string;
  /** File extension: ".ts" | ".tsx" */
  readonly extension: '.ts' | '.tsx';
}

/** Options passed to the file scanner. */
export interface FileScannerOptions {
  /** Repository root used to resolve target directories */
  readonly rootDir: string;
  /** Target directories to scan */
  readonly targetDirs: readonly string[];
  /** Glob patterns to exclude */
  readonly excludePatterns: readonly string[];
  /** Repository-relative or absolute files to include; omit for a full scan */
  readonly includeFiles?: readonly string[];
  /** Allow selected files to be absent from the scanned revision */
  readonly allowMissingIncludeFiles?: boolean;
}

// ---------------------------------------------------------------------------
// ExportAnalyzer types
// ---------------------------------------------------------------------------

/** The syntactic kind of an exported symbol. */
export type ExportKind =
  | 'function'
  | 'class'
  | 'const'
  | 'type'
  | 'interface'
  | 'enum'
  | 'reExport';

/** Metadata for a single export from a file. */
export interface ExportInfo {
  readonly name: string;
  readonly kind: ExportKind;
  readonly isDefault: boolean;
}

/** Metrics collected from a .tsx component file. */
export interface ComponentMetrics {
  readonly jsxLineCount: number;
  readonly hookCallCount: number;
  readonly usesReactMemo: boolean;
  readonly hookNames: readonly string[];
}

/** Full analysis result for a single file. */
export interface FileAnalysis {
  readonly file: FileEntry;
  /** Primary export: the main symbol exported from this file */
  readonly primaryExport: ExportInfo | null;
  /** All exports from this file */
  readonly exports: readonly ExportInfo[];
  /** Whether this file is a re-export-only wrapper */
  readonly isReExportOnly: boolean;
  /** For .tsx files: number of JSX lines, hook call count */
  readonly componentMetrics: ComponentMetrics | null;
}

// ---------------------------------------------------------------------------
// RuleEngine types
// ---------------------------------------------------------------------------

/** Severity level of a detected violation. */
export type Severity = 'error' | 'warning';

/**
 * Inconsistency pattern identifier.
 *
 * 1 – Primary export name ≠ file name
 * 2 – Role suffix not normalised
 * 3 – (reserved)
 * 4 – Inappropriate .core.ts / .internal.ts / .impl.ts usage
 * 5 – Container/Presentational mixed
 * 6 – View suffix missing on presentational component
 */
export type InconsistencyPattern = 1 | 2 | 3 | 4 | 5 | 6;

/** A single naming-convention violation detected by a rule. */
export interface Violation {
  readonly file: FileEntry;
  readonly pattern: InconsistencyPattern;
  readonly severity: Severity;
  readonly message: string;
  readonly suggestedRename: string;
}

/** A rule that can evaluate a file analysis and produce violations. */
export interface Rule {
  readonly name: string;
  evaluate(analysis: FileAnalysis): Violation[];
}

/** Configuration for the rule engine. */
export interface RuleEngineConfig {
  /** Paths to treat as router-convention exceptions (warning instead of error) */
  readonly routerExceptionPaths: readonly string[];
}

// ---------------------------------------------------------------------------
// Data-model types
// ---------------------------------------------------------------------------

/** Classification of a file's role based on its content and naming. */
export type FileRole =
  | 'component'
  | 'view'
  | 'container'
  | 'hook'
  | 'stateHook'
  | 'types'
  | 'constants'
  | 'utils'
  | 'validators'
  | 'index'
  | 'internal'
  | 'impl'
  | 'core'
  | 'other';

/** Result of classifying a single file. */
export interface FileClassification {
  readonly file: FileEntry;
  readonly detectedRole: FileRole;
  readonly expectedRole: FileRole;
  readonly primaryExportName: string | null;
  readonly expectedFileName: string | null;
}

/** Audit summary for a sub-package. */
export interface AuditSummary {
  readonly subPackage: string;
  readonly totalFiles: number;
  readonly violations: readonly Violation[];
  readonly warnings: readonly Violation[];
  readonly compliant: number;
}
