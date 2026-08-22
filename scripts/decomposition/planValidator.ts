// ============================================================
// PlanValidator — validates split plans against naming rules,
// threshold constraints, circular imports, and API preservation.
//
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.5, 8.1
// ============================================================

import * as path from 'node:path';
import type {
  ApiPreservationResult,
  CircularImportWarning,
  DependencyGraph,
  FileStructure,
  NamingViolation,
  SplitPlan,
  SplitTarget,
  ValidationResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLD = 600;

/** File names that are explicitly forbidden by the naming guideline. */
const FORBIDDEN_NAMES: ReadonlySet<string> = new Set([
  'helper.ts',
  'common.ts',
  'shared.ts',
  'misc.ts',
  'temp.ts',
  'util.ts',
]);

// ---------------------------------------------------------------------------
// Naming validation helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a file name matches the `use*.ts` hook pattern.
 * Must start with "use" followed by an uppercase letter and end with ".ts".
 */
function isValidHookName(fileName: string): boolean {
  return /^use[A-Z][a-zA-Z0-9]*\.ts$/.test(fileName);
}

/** Check whether a file name matches the `*View.tsx` presentational pattern. */
function isValidViewName(fileName: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*View\.tsx$/.test(fileName);
}

/** Check whether a file name is PascalCase with .tsx extension. */
function isPascalCaseTsx(fileName: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*\.tsx$/.test(fileName);
}

/** Check whether a file name is camelCase with .ts extension. */
function isCamelCaseTs(fileName: string): boolean {
  return /^[a-z][a-zA-Z0-9]*\.ts$/.test(fileName);
}

// ---------------------------------------------------------------------------
// validateNaming
// ---------------------------------------------------------------------------

/**
 * Check each target's file name against the naming guideline rules.
 *
 * Rules checked:
 * 1. Hook files must match `use*.ts` (start with 'use' + uppercase, .ts not .tsx)
 * 2. View/presentational components must end with `View.tsx`
 * 3. Type files must be named `types.ts`
 * 4. Constants files must be named `constants.ts`
 * 5. Utils files must be named `utils.ts`
 * 6. Index files must be named `index.ts`
 * 7. Component files must be PascalCase with .tsx extension
 * 8. Regular function files should be camelCase with .ts extension
 * 9. No forbidden names
 */
export function validateNaming(targets: readonly SplitTarget[]): NamingViolation[] {
  const violations: NamingViolation[] = [];

  for (const target of targets) {
    const fileName = path.basename(target.targetPath);
    const role = target.role;

    // Rule 9: Forbidden names check (applies to all targets)
    if (FORBIDDEN_NAMES.has(fileName)) {
      violations.push({
        targetPath: target.targetPath,
        rule: 'forbidden-name',
        message: `File name "${fileName}" is forbidden by the naming guideline`,
        suggestedFix: suggestForbiddenNameFix(fileName, role),
      });
      continue;
    }

    // Role-specific rules
    switch (role) {
      case 'hook':
      case 'stateHook': {
        // Rule 1: Hook files must match use*.ts
        if (!isValidHookName(fileName)) {
          violations.push({
            targetPath: target.targetPath,
            rule: 'hook-naming',
            message: `Hook file "${fileName}" must match use*.ts pattern (start with "use" + uppercase letter, .ts extension)`,
            suggestedFix: suggestHookFix(fileName, target.targetPath),
          });
        }
        break;
      }
      case 'view': {
        // Rule 2: View/presentational components must end with View.tsx
        if (!isValidViewName(fileName)) {
          violations.push({
            targetPath: target.targetPath,
            rule: 'view-naming',
            message: `Presentational component "${fileName}" must end with View.tsx`,
            suggestedFix: suggestViewFix(fileName, target.targetPath),
          });
        }
        break;
      }
      case 'types': {
        // Rule 3: Type files must be named types.ts
        if (fileName !== 'types.ts') {
          violations.push({
            targetPath: target.targetPath,
            rule: 'types-naming',
            message: `Type file "${fileName}" must be named types.ts`,
            suggestedFix: replaceFileName(target.targetPath, 'types.ts'),
          });
        }
        break;
      }
      case 'constants': {
        // Rule 4: Constants files must be named constants.ts
        if (fileName !== 'constants.ts') {
          violations.push({
            targetPath: target.targetPath,
            rule: 'constants-naming',
            message: `Constants file "${fileName}" must be named constants.ts`,
            suggestedFix: replaceFileName(target.targetPath, 'constants.ts'),
          });
        }
        break;
      }
      case 'utils': {
        // Rule 5: Utils files must be named utils.ts
        if (fileName !== 'utils.ts') {
          violations.push({
            targetPath: target.targetPath,
            rule: 'utils-naming',
            message: `Utils file "${fileName}" must be named utils.ts`,
            suggestedFix: replaceFileName(target.targetPath, 'utils.ts'),
          });
        }
        break;
      }
      case 'component':
      case 'container': {
        // Rule 7: Component files must be PascalCase with .tsx extension
        if (!isPascalCaseTsx(fileName)) {
          violations.push({
            targetPath: target.targetPath,
            rule: 'component-naming',
            message: `Component file "${fileName}" must be PascalCase with .tsx extension`,
            suggestedFix: suggestComponentFix(fileName, target.targetPath),
          });
        }
        break;
      }
      case 'main':
      case 'other': {
        // Rule 6: Index files must be named index.ts
        if (fileName === 'index.ts' || fileName === 'index.tsx') {
          // index files are acceptable for 'main'/'other' roles
          if (fileName === 'index.tsx') {
            violations.push({
              targetPath: target.targetPath,
              rule: 'index-naming',
              message: `Index file must use .ts extension, not .tsx`,
              suggestedFix: replaceFileName(target.targetPath, 'index.ts'),
            });
          }
          break;
        }
        // Rule 8: Regular function files should be camelCase with .ts extension
        if (!isCamelCaseTs(fileName) && !isPascalCaseTsx(fileName)) {
          violations.push({
            targetPath: target.targetPath,
            rule: 'file-naming',
            message: `File "${fileName}" should be camelCase with .ts extension or PascalCase with .tsx extension`,
            suggestedFix: suggestGenericFix(fileName, target.targetPath),
          });
        }
        break;
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Suggestion helpers
// ---------------------------------------------------------------------------

function replaceFileName(targetPath: string, newFileName: string): string {
  const dir = path.dirname(targetPath);
  return path.posix.join(dir, newFileName);
}

function suggestForbiddenNameFix(fileName: string, role: string): string {
  // Suggest a more specific name based on role
  const base = fileName.replace(/\.(ts|tsx)$/, '');
  switch (role) {
    case 'utils':
      return 'utils.ts';
    case 'types':
      return 'types.ts';
    case 'constants':
      return 'constants.ts';
    default:
      return `${base}Functions.ts`;
  }
}

function suggestHookFix(fileName: string, targetPath: string): string {
  const base = fileName.replace(/\.(ts|tsx)$/, '');
  // If it already starts with "use", just fix the extension
  if (base.startsWith('use')) {
    return replaceFileName(targetPath, `${base}.ts`);
  }
  // Otherwise, prefix with "use" and capitalize
  const capitalized = base.charAt(0).toUpperCase() + base.slice(1);
  return replaceFileName(targetPath, `use${capitalized}.ts`);
}

function suggestViewFix(fileName: string, targetPath: string): string {
  const base = fileName.replace(/\.(ts|tsx)$/, '');
  // Remove existing "View" suffix if present with wrong extension
  const cleanBase = base.replace(/View$/, '');
  const capitalized = cleanBase.charAt(0).toUpperCase() + cleanBase.slice(1);
  return replaceFileName(targetPath, `${capitalized}View.tsx`);
}

function suggestComponentFix(fileName: string, targetPath: string): string {
  const base = fileName.replace(/\.(ts|tsx)$/, '');
  const capitalized = base.charAt(0).toUpperCase() + base.slice(1);
  return replaceFileName(targetPath, `${capitalized}.tsx`);
}

function suggestGenericFix(fileName: string, targetPath: string): string {
  const base = fileName.replace(/\.(ts|tsx)$/, '');
  const camelCase = base.charAt(0).toLowerCase() + base.slice(1);
  return replaceFileName(targetPath, `${camelCase}.ts`);
}

// ---------------------------------------------------------------------------
// detectCircularImports
// ---------------------------------------------------------------------------

/**
 * Detect circular imports in the proposed split structure.
 *
 * Builds a directed graph between targets based on symbol references
 * from the original DependencyGraph, then uses DFS to detect cycles.
 *
 * When no graph is provided, returns an empty array (cannot determine
 * import edges without dependency information).
 */
export function detectCircularImports(
  plan: SplitPlan,
  graph?: DependencyGraph
): CircularImportWarning[] {
  const targets = plan.targets;
  if (targets.length <= 1) {
    return [];
  }

  // Build a map from symbol name to target path
  const symbolToTarget = new Map<string, string>();
  for (const target of targets) {
    for (const sym of target.symbols) {
      symbolToTarget.set(sym, target.targetPath);
    }
  }

  // Without a dependency graph we cannot determine actual import edges
  if (!graph) {
    return [];
  }

  // Build a target-level directed graph: target A → target B means
  // a symbol in A references a symbol in B (requiring an import).
  const targetEdges = new Map<string, Set<string>>();
  const edgeSymbols = new Map<string, Set<string>>(); // "from->to" → symbol names

  for (const target of targets) {
    targetEdges.set(target.targetPath, new Set());
  }

  for (const node of graph.nodes) {
    const fromTarget = symbolToTarget.get(node.name);
    if (fromTarget === undefined) continue;

    const refs = graph.edges.get(node.name) ?? [];
    for (const ref of refs) {
      const toTarget = symbolToTarget.get(ref);
      if (toTarget === undefined || toTarget === fromTarget) continue;

      const edges = targetEdges.get(fromTarget);
      if (edges) {
        edges.add(toTarget);
      }

      const edgeKey = `${fromTarget}->${toTarget}`;
      let syms = edgeSymbols.get(edgeKey);
      if (!syms) {
        syms = new Set();
        edgeSymbols.set(edgeKey, syms);
      }
      syms.add(node.name);
      syms.add(ref);
    }
  }

  // DFS-based cycle detection on the target graph
  const warnings: CircularImportWarning[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const pathStack: string[] = [];

  function dfs(targetPath: string): void {
    visited.add(targetPath);
    inStack.add(targetPath);
    pathStack.push(targetPath);

    const neighbors = targetEdges.get(targetPath) ?? new Set<string>();
    for (const neighbor of neighbors) {
      if (inStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = pathStack.indexOf(neighbor);
        const cycle = pathStack.slice(cycleStart);

        const involved = new Set<string>();
        for (let i = 0; i < cycle.length; i++) {
          const from = cycle[i];
          const to = cycle[(i + 1) % cycle.length];
          const key = `${from}->${to}`;
          const syms = edgeSymbols.get(key);
          if (syms) {
            for (const s of syms) {
              involved.add(s);
            }
          }
        }

        warnings.push({
          cycle,
          message: `Circular import detected: ${cycle.join(' → ')} → ${neighbor}`,
        });
      } else if (!visited.has(neighbor)) {
        dfs(neighbor);
      }
    }

    pathStack.pop();
    inStack.delete(targetPath);
  }

  for (const target of targets) {
    if (!visited.has(target.targetPath)) {
      dfs(target.targetPath);
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// verifyApiPreservation
// ---------------------------------------------------------------------------

/**
 * Verify that all public APIs from the original file are preserved
 * in the split plan.
 */
export function verifyApiPreservation(
  original: FileStructure,
  plan: SplitPlan
): ApiPreservationResult {
  // Collect all exported symbol names from the original
  const originalExports = new Set<string>();
  for (const exp of original.analysis.exports) {
    originalExports.add(exp.name);
  }

  // Collect all symbol names from all split targets
  const targetSymbols = new Set<string>();
  for (const target of plan.targets) {
    for (const sym of target.symbols) {
      targetSymbols.add(sym);
    }
  }

  // Find missing exports
  const missingExports: string[] = [];
  for (const exp of originalExports) {
    if (!targetSymbols.has(exp)) {
      missingExports.push(exp);
    }
  }

  const preserved = missingExports.length === 0;
  const message = preserved
    ? `All ${originalExports.size} public APIs are preserved in the split plan`
    : `${missingExports.length} of ${originalExports.size} public APIs are missing: ${missingExports.join(', ')}`;

  return {
    preserved,
    missingExports,
    message,
  };
}

// ---------------------------------------------------------------------------
// validatePlan
// ---------------------------------------------------------------------------

/**
 * Orchestrate all validations on a split plan.
 *
 * 1. Naming validation
 * 2. Circular import detection
 * 3. Threshold violation check (targets exceeding 600 lines)
 * 4. API preservation is skipped here (requires FileStructure, called separately)
 */
export function validatePlan(plan: SplitPlan): ValidationResult {
  const namingViolations = validateNaming(plan.targets);
  const circularImports = detectCircularImports(plan);

  // Check threshold violations: targets exceeding the default threshold
  const thresholdViolations: string[] = [];
  for (const target of plan.targets) {
    if (target.estimatedLineCount > DEFAULT_THRESHOLD) {
      thresholdViolations.push(target.targetPath);
    }
  }

  // API preservation placeholder (requires FileStructure, called separately)
  const apiPreservation: ApiPreservationResult = {
    preserved: true,
    missingExports: [],
    message: 'API preservation check skipped (requires FileStructure)',
  };

  const valid =
    namingViolations.length === 0 &&
    circularImports.length === 0 &&
    thresholdViolations.length === 0;

  return {
    valid,
    namingViolations,
    circularImports,
    apiPreservation,
    thresholdViolations,
  };
}
