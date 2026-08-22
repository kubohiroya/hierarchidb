// ============================================================
// Type definitions for the decomposition analyzer tool.
// ============================================================

import type {
  ComponentMetrics,
  ExportInfo,
  ExportKind,
  FileAnalysis,
  FileEntry,
} from '../naming-audit/types.js';

// Re-export imported types for downstream convenience.
export type { FileEntry, FileAnalysis, ExportInfo, ExportKind, ComponentMetrics };

// ---------------------------------------------------------------------------
// ThresholdFilter types
// ---------------------------------------------------------------------------

/** Result of threshold filtering for a single file. */
export interface ThresholdResult {
  readonly file: FileEntry;
  readonly lineCount: number;
  readonly exportCount: number;
  readonly estimatedCohesionGroups: number;
  readonly priorityScore: number;
}

// ---------------------------------------------------------------------------
// StructureAnalyzer types
// ---------------------------------------------------------------------------

/** A symbol extracted from a file with its location and references. */
export interface SymbolNode {
  readonly name: string;
  readonly kind: ExportKind | 'local';
  readonly isExported: boolean;
  readonly startLine: number;
  readonly endLine: number;
  /** Names of other symbols in the same file that this symbol references. */
  readonly references: readonly string[];
}

/** Dependency graph: adjacency list of symbol references within a file. */
export interface DependencyGraph {
  readonly nodes: readonly SymbolNode[];
  /** Map from symbol name to names of symbols it depends on. */
  readonly edges: ReadonlyMap<string, readonly string[]>;
}

/** Full structural analysis of a single file. */
export interface FileStructure {
  readonly file: FileEntry;
  readonly lineCount: number;
  readonly analysis: FileAnalysis;
  readonly graph: DependencyGraph;
  readonly cohesionGroups: readonly CohesionGroup[];
}

// ---------------------------------------------------------------------------
// CohesionGrouper types
// ---------------------------------------------------------------------------

/** A group of tightly coupled symbols that should stay together. */
export interface CohesionGroup {
  readonly id: string;
  readonly symbols: readonly SymbolNode[];
  readonly lineCount: number;
  /** Suggested role for this group (types, utils, hook, component, etc.). */
  readonly suggestedRole: GroupRole;
}

export type GroupRole =
  | 'types'
  | 'utils'
  | 'constants'
  | 'hook'
  | 'stateHook'
  | 'component'
  | 'view'
  | 'container'
  | 'main'
  | 'other';

/** Warning about circular references between cohesion groups. */
export interface CycleWarning {
  readonly groupIds: readonly string[];
  readonly involvedSymbols: readonly string[];
  readonly message: string;
}

// ---------------------------------------------------------------------------
// SplitPlanGenerator types
// ---------------------------------------------------------------------------

/** A single target file in a split plan. */
export interface SplitTarget {
  readonly targetPath: string;
  readonly symbols: readonly string[];
  readonly estimatedLineCount: number;
  readonly role: GroupRole;
}

/** Complete split plan for a single source file. */
export interface SplitPlan {
  readonly sourceFile: FileEntry;
  readonly sourceLineCount: number;
  readonly targets: readonly SplitTarget[];
  readonly importUpdates: readonly ImportUpdate[];
  readonly pattern: SplitPattern;
}

export type SplitPattern =
  | 'container-presentational'
  | 'hook-decomposition'
  | 'multi-function'
  | 'single-main-with-helpers'
  | 'type-extraction'
  | 'mixed';

/** An import statement that needs updating after the split. */
export interface ImportUpdate {
  readonly importingFile: string;
  readonly oldImportPath: string;
  readonly newImportPath: string;
  readonly importedSymbols: readonly string[];
}

// ---------------------------------------------------------------------------
// PlanValidator types
// ---------------------------------------------------------------------------

export interface NamingViolation {
  readonly targetPath: string;
  readonly rule: string;
  readonly message: string;
  readonly suggestedFix: string;
}

export interface CircularImportWarning {
  readonly cycle: readonly string[];
  readonly message: string;
}

export interface ApiPreservationResult {
  readonly preserved: boolean;
  readonly missingExports: readonly string[];
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly namingViolations: readonly NamingViolation[];
  readonly circularImports: readonly CircularImportWarning[];
  readonly apiPreservation: ApiPreservationResult;
  readonly thresholdViolations: readonly string[];
}

// ---------------------------------------------------------------------------
// SplitPlanOptions
// ---------------------------------------------------------------------------

export interface SplitPlanOptions {
  readonly threshold: number;
  readonly namingGuideline: NamingGuidelineConfig;
}

export interface NamingGuidelineConfig {
  readonly hookPrefix: 'use';
  readonly viewSuffix: 'View';
  readonly typesFileName: 'types.ts';
  readonly constantsFileName: 'constants.ts';
  readonly utilsFileName: 'utils.ts';
  readonly indexReExportOnly: boolean;
}

// ---------------------------------------------------------------------------
// Reporter types
// ---------------------------------------------------------------------------

export interface AnalysisReport {
  readonly thresholdResults: readonly ThresholdResult[];
  readonly splitPlans: readonly SplitPlan[];
  readonly validationResults: readonly ValidationResult[];
  readonly progressState: ProgressState;
}

// ---------------------------------------------------------------------------
// ProgressTracker types
// ---------------------------------------------------------------------------

export interface ProgressState {
  readonly completedFiles: readonly string[];
  readonly totalTargetFiles: number;
  readonly remainingCount: number;
  readonly lastUpdated: string;
}
