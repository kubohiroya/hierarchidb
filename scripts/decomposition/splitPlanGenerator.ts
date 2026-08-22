// ============================================================
// SplitPlanGenerator -- generates split plans for large files
// based on cohesion groups and file-type-specific patterns.
//
// Provides:
//   generateSplitPlan(structure, groups, options) – full split plan
//   applyContainerPresentationalPattern(structure, groups) – .tsx pattern
//   applyTsDecompositionPattern(structure, groups) – .ts patterns
// ============================================================

import type {
  CohesionGroup,
  FileStructure,
  GroupRole,
  ImportUpdate,
  SplitPattern,
  SplitPlan,
  SplitPlanOptions,
  SplitTarget,
  SymbolNode,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum overhead lines added per target (imports, whitespace, etc.). */
const MIN_OVERHEAD_LINES = 5;

/** Overhead ratio applied to raw symbol line counts. */
const OVERHEAD_RATIO = 0.1;

/** Minimum number of type/interface symbols to warrant a types.ts file. */
const TYPE_EXTRACTION_THRESHOLD = 3;

/** Minimum number of utility functions to warrant a utils.ts file. */
const UTILS_EXTRACTION_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Helpers – file naming
// ---------------------------------------------------------------------------

/** Regex for hook file names: 'use' followed by an uppercase letter. */
const HOOK_NAME_RE = /^use[A-Z]/;

/**
 * Derive a component name from a file path.
 * e.g. "src/ui/MyComponent.tsx" → "MyComponent"
 */
function deriveComponentName(filePath: string): string {
  const base = filePath.split('/').pop() ?? filePath;
  return base.replace(/\.[^.]+$/, '');
}

/**
 * Derive the parent directory from a file path.
 * e.g. "src/ui/MyComponent.tsx" → "src/ui"
 */
function deriveParentDir(filePath: string): string {
  const parts = filePath.split('/');
  parts.pop();
  return parts.join('/');
}

/**
 * Build a target path for a file within a component directory.
 * e.g. parentDir="src/ui", componentName="MyComponent", fileName="types.ts"
 *   → "src/ui/MyComponent/types.ts"
 */
function buildTargetPath(parentDir: string, dirName: string, fileName: string): string {
  if (parentDir === '') return `${dirName}/${fileName}`;
  return `${parentDir}/${dirName}/${fileName}`;
}

/**
 * Generate a camelCase file name from a symbol name.
 * Ensures the first character is lowercase.
 */
function toCamelCaseFileName(name: string, ext: string): string {
  const camel = name.charAt(0).toLowerCase() + name.slice(1);
  return `${camel}${ext}`;
}

// ---------------------------------------------------------------------------
// Helpers – line count estimation
// ---------------------------------------------------------------------------

/**
 * Estimate the line count for a set of symbols, including overhead.
 */
function estimateLineCount(symbols: readonly SymbolNode[]): number {
  const rawLines = symbols.reduce((sum, s) => sum + (s.endLine - s.startLine + 1), 0);
  const overhead = Math.max(MIN_OVERHEAD_LINES, Math.ceil(rawLines * OVERHEAD_RATIO));
  return rawLines + overhead;
}

/**
 * Estimate line count from a raw line total (when we don't have SymbolNode[]).
 */
function estimateFromRawLines(rawLines: number): number {
  const overhead = Math.max(MIN_OVERHEAD_LINES, Math.ceil(rawLines * OVERHEAD_RATIO));
  return rawLines + overhead;
}

// ---------------------------------------------------------------------------
// Helpers – symbol classification
// ---------------------------------------------------------------------------

/**
 * Collect all SymbolNode objects from a list of cohesion groups.
 */
function collectAllSymbols(groups: readonly CohesionGroup[]): SymbolNode[] {
  const symbols: SymbolNode[] = [];
  for (const g of groups) {
    for (const s of g.symbols) {
      symbols.push(s);
    }
  }
  return symbols;
}

/**
 * Check if a symbol is a type or interface.
 */
function isTypeSymbol(s: SymbolNode): boolean {
  return s.kind === 'type' || s.kind === 'interface';
}

/**
 * Check if a symbol is a non-exported utility function.
 */
function isUtilityFunction(s: SymbolNode): boolean {
  return !s.isExported && (s.kind === 'function' || s.kind === 'local');
}

/**
 * Check if a symbol is a hook (name starts with 'use' + uppercase).
 */
function isHookSymbol(s: SymbolNode): boolean {
  return HOOK_NAME_RE.test(s.name);
}

// ---------------------------------------------------------------------------
// Pattern detection
// ---------------------------------------------------------------------------

/**
 * Determine the split pattern based on file extension, content, and groups.
 */
function detectSplitPattern(
  structure: FileStructure,
  groups: readonly CohesionGroup[]
): SplitPattern {
  const ext = structure.file.extension;
  const metrics = structure.analysis.componentMetrics;
  const fileName = deriveComponentName(structure.file.relativePath);

  // .tsx with significant component metrics → container/presentational
  if (
    ext === '.tsx' &&
    metrics !== null &&
    (metrics.jsxLineCount > 50 || metrics.hookCallCount > 2)
  ) {
    return 'container-presentational';
  }

  // .ts hook file (name starts with use + uppercase)
  if (ext === '.ts' && HOOK_NAME_RE.test(fileName)) {
    return 'hook-decomposition';
  }

  // Check if groups are mostly types
  const allSymbols = collectAllSymbols(groups);
  const typeCount = allSymbols.filter(isTypeSymbol).length;
  if (typeCount > 0 && typeCount >= allSymbols.length * 0.7) {
    return 'type-extraction';
  }

  // .ts with single large exported function + helpers
  if (ext === '.ts') {
    const exportedFunctions = allSymbols.filter((s) => s.isExported && s.kind === 'function');
    const nonExported = allSymbols.filter((s) => !s.isExported);

    if (exportedFunctions.length === 1 && nonExported.length >= 2) {
      return 'single-main-with-helpers';
    }

    // Multiple independent exported functions
    if (exportedFunctions.length >= 2) {
      // Check if they are in separate groups (independent)
      const exportedGroups = groups.filter((g) =>
        g.symbols.some((s) => s.isExported && s.kind === 'function')
      );
      if (exportedGroups.length >= 2) {
        return 'multi-function';
      }
    }
  }

  return 'mixed';
}

// ---------------------------------------------------------------------------
// Extraction helpers (shared across patterns)
// ---------------------------------------------------------------------------

/**
 * Extract type symbols into a types.ts target if there are enough.
 * Returns [typesTarget | null, remainingGroups].
 */
function extractTypesTarget(
  groups: readonly CohesionGroup[],
  parentDir: string,
  dirName: string
): { typesTarget: SplitTarget | null; remaining: CohesionGroup[] } {
  const allSymbols = collectAllSymbols(groups);
  const typeSymbols = allSymbols.filter(isTypeSymbol);

  if (typeSymbols.length < TYPE_EXTRACTION_THRESHOLD) {
    return { typesTarget: null, remaining: [...groups] };
  }

  const typeNames = new Set(typeSymbols.map((s) => s.name));
  const typesTarget: SplitTarget = {
    targetPath: buildTargetPath(parentDir, dirName, 'types.ts'),
    symbols: [...typeNames],
    estimatedLineCount: estimateLineCount(typeSymbols),
    role: 'types',
  };

  // Remove type symbols from groups, keeping groups that still have symbols
  const remaining: CohesionGroup[] = [];
  for (const g of groups) {
    const kept = g.symbols.filter((s) => !typeNames.has(s.name));
    if (kept.length > 0) {
      remaining.push({
        ...g,
        symbols: kept,
        lineCount: kept.reduce((sum, s) => sum + (s.endLine - s.startLine + 1), 0),
      });
    }
  }

  return { typesTarget, remaining };
}

/**
 * Extract utility functions into a utils.ts target if there are enough.
 * Returns [utilsTarget | null, remainingGroups].
 */
function extractUtilsTarget(
  groups: readonly CohesionGroup[],
  parentDir: string,
  dirName: string
): { utilsTarget: SplitTarget | null; remaining: CohesionGroup[] } {
  const allSymbols = collectAllSymbols(groups);
  const utilSymbols = allSymbols.filter(isUtilityFunction);

  if (utilSymbols.length < UTILS_EXTRACTION_THRESHOLD) {
    return { utilsTarget: null, remaining: [...groups] };
  }

  const utilNames = new Set(utilSymbols.map((s) => s.name));
  const utilsTarget: SplitTarget = {
    targetPath: buildTargetPath(parentDir, dirName, 'utils.ts'),
    symbols: [...utilNames],
    estimatedLineCount: estimateLineCount(utilSymbols),
    role: 'utils',
  };

  const remaining: CohesionGroup[] = [];
  for (const g of groups) {
    const kept = g.symbols.filter((s) => !utilNames.has(s.name));
    if (kept.length > 0) {
      remaining.push({
        ...g,
        symbols: kept,
        lineCount: kept.reduce((sum, s) => sum + (s.endLine - s.startLine + 1), 0),
      });
    }
  }

  return { utilsTarget, remaining };
}

// ---------------------------------------------------------------------------
// Container/Presentational pattern (.tsx)
// ---------------------------------------------------------------------------

/**
 * Apply the Container/Presentational split pattern for .tsx files.
 *
 * Generates:
 *   ComponentName/ComponentName.tsx       (container)
 *   ComponentName/ComponentNameView.tsx   (view)
 *   ComponentName/useComponentNameState.ts (stateHook)
 *   ComponentName/types.ts               (if 3+ type symbols)
 *   ComponentName/utils.ts               (if 3+ utility functions)
 *   ComponentName/index.ts               (re-export, if needed)
 */
export function applyContainerPresentationalPattern(
  structure: FileStructure,
  groups: readonly CohesionGroup[]
): SplitTarget[] {
  const componentName = deriveComponentName(structure.file.relativePath);
  const parentDir = deriveParentDir(structure.file.relativePath);
  const targets: SplitTarget[] = [];

  // Extract types and utils first
  const { typesTarget, remaining: afterTypes } = extractTypesTarget(
    groups,
    parentDir,
    componentName
  );
  const { utilsTarget, remaining: afterUtils } = extractUtilsTarget(
    afterTypes,
    parentDir,
    componentName
  );

  if (typesTarget) targets.push(typesTarget);
  if (utilsTarget) targets.push(utilsTarget);

  // Classify remaining symbols into container, view, and stateHook buckets
  const hookSymbols: SymbolNode[] = [];
  const viewSymbols: SymbolNode[] = [];
  const containerSymbols: SymbolNode[] = [];

  for (const g of afterUtils) {
    for (const s of g.symbols) {
      if (isHookSymbol(s)) {
        hookSymbols.push(s);
      } else if (
        s.kind === 'function' &&
        !s.isExported &&
        (s.name.startsWith('render') || s.name.endsWith('View'))
      ) {
        viewSymbols.push(s);
      } else {
        containerSymbols.push(s);
      }
    }
  }

  // State hook target
  if (hookSymbols.length > 0) {
    targets.push({
      targetPath: buildTargetPath(parentDir, componentName, `use${componentName}State.ts`),
      symbols: hookSymbols.map((s) => s.name),
      estimatedLineCount: estimateLineCount(hookSymbols),
      role: 'stateHook',
    });
  }

  // View target (presentational component)
  if (viewSymbols.length > 0) {
    targets.push({
      targetPath: buildTargetPath(parentDir, componentName, `${componentName}View.tsx`),
      symbols: viewSymbols.map((s) => s.name),
      estimatedLineCount: estimateLineCount(viewSymbols),
      role: 'view',
    });
  }

  // Container target (main component with hook orchestration)
  if (containerSymbols.length > 0) {
    targets.push({
      targetPath: buildTargetPath(parentDir, componentName, `${componentName}.tsx`),
      symbols: containerSymbols.map((s) => s.name),
      estimatedLineCount: estimateLineCount(containerSymbols),
      role: 'container',
    });
  }

  // Index re-export target (only if we have multiple targets)
  if (targets.length > 1) {
    targets.push({
      targetPath: buildTargetPath(parentDir, componentName, 'index.ts'),
      symbols: [],
      estimatedLineCount: estimateFromRawLines(targets.length + 2),
      role: 'other',
    });
  }

  return targets;
}

// ---------------------------------------------------------------------------
// .ts decomposition patterns
// ---------------------------------------------------------------------------

/**
 * Apply .ts decomposition patterns based on the detected pattern type.
 *
 * Handles:
 *   - hook-decomposition: parent hook stays, children move to subdirectory
 *   - single-main-with-helpers: main stays, helpers move to subdirectory
 *   - multi-function: each independent group gets its own file
 *   - type-extraction: types move to types.ts
 *   - mixed: best-effort grouping by role
 */
export function applyTsDecompositionPattern(
  structure: FileStructure,
  groups: readonly CohesionGroup[]
): SplitTarget[] {
  const pattern = detectSplitPattern(structure, groups);

  switch (pattern) {
    case 'hook-decomposition':
      return applyHookDecomposition(structure, groups);
    case 'single-main-with-helpers':
      return applySingleMainWithHelpers(structure, groups);
    case 'multi-function':
      return applyMultiFunction(structure, groups);
    case 'type-extraction':
      return applyTypeExtraction(structure, groups);
    default:
      return applyMixedPattern(structure, groups);
  }
}

// ---------------------------------------------------------------------------
// Hook decomposition
// ---------------------------------------------------------------------------

function applyHookDecomposition(
  structure: FileStructure,
  groups: readonly CohesionGroup[]
): SplitTarget[] {
  const hookName = deriveComponentName(structure.file.relativePath);
  const parentDir = deriveParentDir(structure.file.relativePath);
  const targets: SplitTarget[] = [];

  // Extract types and utils
  const { typesTarget, remaining: afterTypes } = extractTypesTarget(groups, parentDir, hookName);
  const { utilsTarget, remaining: afterUtils } = extractUtilsTarget(
    afterTypes,
    parentDir,
    hookName
  );

  if (typesTarget) targets.push(typesTarget);
  if (utilsTarget) targets.push(utilsTarget);

  // Separate parent hook from child/helper hooks
  const parentHookSymbols: SymbolNode[] = [];
  const childHookSymbols: SymbolNode[] = [];
  const otherSymbols: SymbolNode[] = [];

  for (const g of afterUtils) {
    for (const s of g.symbols) {
      if (s.name === hookName && isHookSymbol(s)) {
        parentHookSymbols.push(s);
      } else if (isHookSymbol(s)) {
        childHookSymbols.push(s);
      } else {
        otherSymbols.push(s);
      }
    }
  }

  // Parent hook stays in original-named file within subdirectory
  if (parentHookSymbols.length > 0) {
    targets.push({
      targetPath: buildTargetPath(parentDir, hookName, `${hookName}.ts`),
      symbols: parentHookSymbols.map((s) => s.name),
      estimatedLineCount: estimateLineCount(parentHookSymbols),
      role: 'hook',
    });
  }

  // Child hooks each get their own file
  for (const s of childHookSymbols) {
    targets.push({
      targetPath: buildTargetPath(parentDir, hookName, `${s.name}.ts`),
      symbols: [s.name],
      estimatedLineCount: estimateLineCount([s]),
      role: 'hook',
    });
  }

  // Other symbols grouped together
  if (otherSymbols.length > 0) {
    targets.push({
      targetPath: buildTargetPath(parentDir, hookName, toCamelCaseFileName('helpers', '.ts')),
      symbols: otherSymbols.map((s) => s.name),
      estimatedLineCount: estimateLineCount(otherSymbols),
      role: 'other',
    });
  }

  // Index re-export
  if (targets.length > 1) {
    targets.push({
      targetPath: buildTargetPath(parentDir, hookName, 'index.ts'),
      symbols: [],
      estimatedLineCount: estimateFromRawLines(targets.length + 2),
      role: 'other',
    });
  }

  return targets;
}

// ---------------------------------------------------------------------------
// Single main with helpers
// ---------------------------------------------------------------------------

function applySingleMainWithHelpers(
  structure: FileStructure,
  groups: readonly CohesionGroup[]
): SplitTarget[] {
  const fileName = deriveComponentName(structure.file.relativePath);
  const parentDir = deriveParentDir(structure.file.relativePath);
  const targets: SplitTarget[] = [];

  // Extract types and utils
  const { typesTarget, remaining: afterTypes } = extractTypesTarget(groups, parentDir, fileName);
  const { utilsTarget, remaining: afterUtils } = extractUtilsTarget(
    afterTypes,
    parentDir,
    fileName
  );

  if (typesTarget) targets.push(typesTarget);
  if (utilsTarget) targets.push(utilsTarget);

  // Find the main exported function
  const allSymbols = collectAllSymbols(afterUtils);
  const mainSymbol = allSymbols.find((s) => s.isExported && s.kind === 'function');
  const helperSymbols = allSymbols.filter((s) => s !== mainSymbol);

  // Main function stays in original-named file
  if (mainSymbol) {
    targets.push({
      targetPath: buildTargetPath(parentDir, fileName, toCamelCaseFileName(mainSymbol.name, '.ts')),
      symbols: [mainSymbol.name],
      estimatedLineCount: estimateLineCount([mainSymbol]),
      role: 'main',
    });
  }

  // Helpers go to a helpers file in subdirectory
  if (helperSymbols.length > 0) {
    targets.push({
      targetPath: buildTargetPath(parentDir, fileName, 'helpers.ts'),
      symbols: helperSymbols.map((s) => s.name),
      estimatedLineCount: estimateLineCount(helperSymbols),
      role: 'other',
    });
  }

  // Index re-export
  if (targets.length > 1) {
    targets.push({
      targetPath: buildTargetPath(parentDir, fileName, 'index.ts'),
      symbols: [],
      estimatedLineCount: estimateFromRawLines(targets.length + 2),
      role: 'other',
    });
  }

  return targets;
}

// ---------------------------------------------------------------------------
// Multi-function
// ---------------------------------------------------------------------------

function applyMultiFunction(
  structure: FileStructure,
  groups: readonly CohesionGroup[]
): SplitTarget[] {
  const fileName = deriveComponentName(structure.file.relativePath);
  const parentDir = deriveParentDir(structure.file.relativePath);
  const targets: SplitTarget[] = [];

  // Extract types and utils
  const { typesTarget, remaining: afterTypes } = extractTypesTarget(groups, parentDir, fileName);
  const { utilsTarget, remaining: afterUtils } = extractUtilsTarget(
    afterTypes,
    parentDir,
    fileName
  );

  if (typesTarget) targets.push(typesTarget);
  if (utilsTarget) targets.push(utilsTarget);

  // Each remaining group gets its own file
  for (const g of afterUtils) {
    // Find the primary symbol (first exported, or first symbol)
    const primary = g.symbols.find((s) => s.isExported) ?? g.symbols[0];
    if (!primary) continue;

    const ext = structure.file.extension;
    const targetFileName =
      primary.kind === 'function'
        ? toCamelCaseFileName(primary.name, ext)
        : `${primary.name}${ext}`;

    targets.push({
      targetPath: buildTargetPath(parentDir, fileName, targetFileName),
      symbols: g.symbols.map((s) => s.name),
      estimatedLineCount: estimateLineCount(g.symbols),
      role: g.suggestedRole,
    });
  }

  // Index re-export
  if (targets.length > 1) {
    targets.push({
      targetPath: buildTargetPath(parentDir, fileName, 'index.ts'),
      symbols: [],
      estimatedLineCount: estimateFromRawLines(targets.length + 2),
      role: 'other',
    });
  }

  return targets;
}

// ---------------------------------------------------------------------------
// Type extraction
// ---------------------------------------------------------------------------

function applyTypeExtraction(
  structure: FileStructure,
  groups: readonly CohesionGroup[]
): SplitTarget[] {
  const fileName = deriveComponentName(structure.file.relativePath);
  const parentDir = deriveParentDir(structure.file.relativePath);
  const targets: SplitTarget[] = [];

  const allSymbols = collectAllSymbols(groups);
  const typeSymbols = allSymbols.filter(isTypeSymbol);
  const nonTypeSymbols = allSymbols.filter((s) => !isTypeSymbol(s));

  // Types go to types.ts
  if (typeSymbols.length > 0) {
    targets.push({
      targetPath: buildTargetPath(parentDir, fileName, 'types.ts'),
      symbols: typeSymbols.map((s) => s.name),
      estimatedLineCount: estimateLineCount(typeSymbols),
      role: 'types',
    });
  }

  // Remaining symbols stay in original-named file
  if (nonTypeSymbols.length > 0) {
    const ext = structure.file.extension;
    targets.push({
      targetPath: buildTargetPath(parentDir, fileName, `${fileName}${ext}`),
      symbols: nonTypeSymbols.map((s) => s.name),
      estimatedLineCount: estimateLineCount(nonTypeSymbols),
      role: 'other',
    });
  }

  return targets;
}

// ---------------------------------------------------------------------------
// Mixed pattern (fallback)
// ---------------------------------------------------------------------------

function applyMixedPattern(
  structure: FileStructure,
  groups: readonly CohesionGroup[]
): SplitTarget[] {
  const fileName = deriveComponentName(structure.file.relativePath);
  const parentDir = deriveParentDir(structure.file.relativePath);
  const targets: SplitTarget[] = [];

  // Extract types and utils
  const { typesTarget, remaining: afterTypes } = extractTypesTarget(groups, parentDir, fileName);
  const { utilsTarget, remaining: afterUtils } = extractUtilsTarget(
    afterTypes,
    parentDir,
    fileName
  );

  if (typesTarget) targets.push(typesTarget);
  if (utilsTarget) targets.push(utilsTarget);

  // Group remaining by role
  const roleGroups = new Map<GroupRole, SymbolNode[]>();
  for (const g of afterUtils) {
    const role = g.suggestedRole;
    const existing = roleGroups.get(role) ?? [];
    existing.push(...g.symbols);
    roleGroups.set(role, existing);
  }

  const ext = structure.file.extension;
  for (const [role, symbols] of roleGroups) {
    if (symbols.length === 0) continue;

    const primary = symbols.find((s) => s.isExported) ?? symbols[0];
    if (primary === undefined) continue;
    let targetFileName: string;

    switch (role) {
      case 'hook':
      case 'stateHook':
        targetFileName = `${primary.name}.ts`;
        break;
      case 'constants':
        targetFileName = 'constants.ts';
        break;
      case 'component':
      case 'container':
        targetFileName = `${primary.name}${ext}`;
        break;
      case 'view':
        targetFileName = `${primary.name}${ext.replace('.ts', '.tsx')}`;
        break;
      default:
        targetFileName = toCamelCaseFileName(primary.name, ext);
        break;
    }

    targets.push({
      targetPath: buildTargetPath(parentDir, fileName, targetFileName),
      symbols: symbols.map((s) => s.name),
      estimatedLineCount: estimateLineCount(symbols),
      role,
    });
  }

  // Index re-export
  if (targets.length > 1) {
    targets.push({
      targetPath: buildTargetPath(parentDir, fileName, 'index.ts'),
      symbols: [],
      estimatedLineCount: estimateFromRawLines(targets.length + 2),
      role: 'other',
    });
  }

  return targets;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a complete split plan for a single large file.
 *
 * 1. Detects the appropriate split pattern based on file type and content
 * 2. Applies the pattern to generate SplitTarget[]
 * 3. Ensures targets respect the line threshold where possible
 * 4. Generates compliant file names per naming guideline
 */
export function generateSplitPlan(
  structure: FileStructure,
  groups: readonly CohesionGroup[],
  options: SplitPlanOptions
): SplitPlan {
  const pattern = detectSplitPattern(structure, groups);

  // Apply the appropriate pattern
  let targets: SplitTarget[];
  switch (pattern) {
    case 'container-presentational':
      targets = applyContainerPresentationalPattern(structure, groups);
      break;
    case 'hook-decomposition':
    case 'single-main-with-helpers':
    case 'multi-function':
    case 'type-extraction':
    case 'mixed':
      targets = applyTsDecompositionPattern(structure, groups);
      break;
    default:
      targets = applyTsDecompositionPattern(structure, groups);
      break;
  }

  // Verify threshold compliance – split oversized targets if possible
  targets = enforceThreshold(targets, options.threshold, groups);

  // Import updates are left empty; the CLI will enrich them later
  const importUpdates: ImportUpdate[] = [];

  return {
    sourceFile: structure.file,
    sourceLineCount: structure.lineCount,
    targets,
    importUpdates,
    pattern,
  };
}

// ---------------------------------------------------------------------------
// Threshold enforcement
// ---------------------------------------------------------------------------

/**
 * Ensure all targets have estimatedLineCount <= threshold.
 * If a target exceeds the threshold and contains multiple symbols,
 * attempt to split it further using actual symbol line counts.
 * If it cannot be split (single symbol), keep it as-is and let
 * the validator flag it.
 */
function enforceThreshold(
  targets: readonly SplitTarget[],
  threshold: number,
  groups: readonly CohesionGroup[]
): SplitTarget[] {
  // Build a lookup from symbol name to SymbolNode for accurate line counts
  const symbolMap = new Map<string, SymbolNode>();
  for (const g of groups) {
    for (const s of g.symbols) {
      symbolMap.set(s.name, s);
    }
  }

  const result: SplitTarget[] = [];

  for (const target of targets) {
    if (target.estimatedLineCount <= threshold || target.symbols.length <= 1) {
      // Within threshold or cannot be split further
      result.push(target);
      continue;
    }

    // Resolve SymbolNode objects for accurate line-count-based splitting
    const resolvedSymbols: SymbolNode[] = [];
    for (const name of target.symbols) {
      const node = symbolMap.get(name);
      if (node) {
        resolvedSymbols.push(node);
      }
    }

    if (resolvedSymbols.length <= 1) {
      result.push(target);
      continue;
    }

    // Split into two halves based on cumulative line counts
    const totalLines = resolvedSymbols.reduce((sum, s) => sum + (s.endLine - s.startLine + 1), 0);
    const halfTarget = totalLines / 2;
    let accumulated = 0;
    let splitIdx = 0;

    for (let i = 0; i < resolvedSymbols.length; i++) {
      accumulated += resolvedSymbols[i].endLine - resolvedSymbols[i].startLine + 1;
      if (accumulated >= halfTarget) {
        splitIdx = i + 1;
        break;
      }
    }

    // Ensure at least one symbol in each half
    if (splitIdx === 0) splitIdx = 1;
    if (splitIdx >= resolvedSymbols.length) splitIdx = resolvedSymbols.length - 1;

    const firstSymbols = resolvedSymbols.slice(0, splitIdx);
    const secondSymbols = resolvedSymbols.slice(splitIdx);

    const basePath = target.targetPath.replace(/(\.[^.]+)$/, '');
    const ext = target.targetPath.match(/(\.[^.]+)$/)?.[1] ?? '.ts';

    result.push({
      targetPath: `${basePath}Part1${ext}`,
      symbols: firstSymbols.map((s) => s.name),
      estimatedLineCount: estimateLineCount(firstSymbols),
      role: target.role,
    });

    result.push({
      targetPath: `${basePath}Part2${ext}`,
      symbols: secondSymbols.map((s) => s.name),
      estimatedLineCount: estimateLineCount(secondSymbols),
      role: target.role,
    });
  }

  return result;
}
