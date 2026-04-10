// ============================================================
// RuleEngine — orchestrates all naming-audit rules and applies
// the RouterExceptionFilter to downgrade violations in router-
// convention paths from 'error' to 'warning'.
//
// Requirements: 1.1, 1.4
// ============================================================

import type { FileAnalysis, Rule, RuleEngineConfig, Violation } from './types.js';

// ---------------------------------------------------------------------------
// Router exception filter
// ---------------------------------------------------------------------------

/**
 * Check whether a file path falls under one of the router exception
 * paths. Uses a simple prefix match against the file's relativePath
 * (which is relative to the sub-package root, e.g. "src/router/...").
 *
 * The config paths are normalised to strip trailing slashes and use
 * forward slashes for consistent matching.
 */
function isRouterException(relativePath: string, exceptionPaths: readonly string[]): boolean {
  const normalised = relativePath.replace(/\\/g, '/');
  return exceptionPaths.some((exPath) => {
    const normEx = exPath
      .replace(/\\/g, '/')
      .replace(/\/\*\*$/, '')
      .replace(/\/$/, '');
    return normalised.startsWith(`${normEx}/`) || normalised === normEx;
  });
}

/**
 * Downgrade a violation's severity from 'error' to 'warning' when
 * the file is inside a router exception path.
 */
function applyRouterException(violation: Violation, exceptionPaths: readonly string[]): Violation {
  if (violation.severity !== 'error') return violation;
  if (!isRouterException(violation.file.relativePath, exceptionPaths)) return violation;

  return {
    ...violation,
    severity: 'warning',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate all rules against a set of file analyses.
 *
 * 1. Each rule is applied to each analysis.
 * 2. Router exception paths downgrade 'error' → 'warning'.
 * 3. Results are returned as a flat array of violations.
 */
export function evaluateRules(
  analyses: readonly FileAnalysis[],
  rules: readonly Rule[],
  config: RuleEngineConfig
): Violation[] {
  const violations: Violation[] = [];

  for (const analysis of analyses) {
    for (const rule of rules) {
      const ruleViolations = rule.evaluate(analysis);
      for (const v of ruleViolations) {
        violations.push(applyRouterException(v, config.routerExceptionPaths));
      }
    }
  }

  return violations;
}
