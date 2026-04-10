// ============================================================
// RoleSuffixRule — Pattern 2: Role suffix inconsistency
//
// Checks whether single-role files (types-only, constants-only,
// utils-only) use the correct normalised suffix. Also flags
// banned generic file names (helper.ts, common.ts, etc.).
// ============================================================

import path from 'node:path';

import type { ExportInfo, FileAnalysis, Rule, Violation } from '../types.js';

// ---------------------------------------------------------------------------
// Banned generic names → suggested replacement
// ---------------------------------------------------------------------------

const BANNED_GENERIC_NAMES = new Set([
    'helper',
    'helpers',
    'common',
    'shared',
    'misc',
    'temp',
]);

// ---------------------------------------------------------------------------
// Role detection helpers
// ---------------------------------------------------------------------------

type SingleRole = 'types' | 'constants' | 'utils';

/**
 * Determine whether a file is a "single-role" file based on its
 * non-reExport exports. Returns the detected role or `null` when
 * the file has mixed roles or no qualifying exports.
 */
export function detectSingleRole(exports: readonly ExportInfo[]): SingleRole | null {
    // Filter out re-exports — only look at "own" exports
    const own = exports.filter((e) => e.kind !== 'reExport');

    if (own.length === 0) return null;

    // Types-only: every export is 'type' or 'interface'
    const allTypes = own.every((e) => e.kind === 'type' || e.kind === 'interface');
    if (allTypes) return 'types';

    // Constants-only: every export is 'const' AND none are functions
    const allConsts = own.every((e) => e.kind === 'const');
    const anyFunction = own.some((e) => e.kind === 'function');
    if (allConsts && !anyFunction) return 'constants';

    // Utils-only: every export is 'function' (pure functions)
    const allFunctions = own.every((e) => e.kind === 'function');
    if (allFunctions) return 'utils';

    return null; // mixed roles
}

// ---------------------------------------------------------------------------
// Suffix validation helpers
// ---------------------------------------------------------------------------

const ROLE_SUFFIX_MAP: Record<SingleRole, { suffix: string; standalone: string }> = {
    types: { suffix: 'Types', standalone: 'types' },
    constants: { suffix: 'Constants', standalone: 'constants' },
    utils: { suffix: 'Utils', standalone: 'utils' },
};

/**
 * Check whether the file stem already has the correct suffix for
 * the given role.
 *
 * Valid patterns:
 *   - stem ends with the PascalCase suffix (e.g. "shapeDialogStepTypes")
 *   - stem is exactly the standalone name (e.g. "types")
 */
export function hasCorrectSuffix(stem: string, role: SingleRole): boolean {
    const { suffix, standalone } = ROLE_SUFFIX_MAP[role];
    return stem.endsWith(suffix) || stem === standalone;
}

// ---------------------------------------------------------------------------
// Suggested rename generation
// ---------------------------------------------------------------------------

/**
 * Build a suggested file name for a file that should have a role suffix.
 *
 * Strategy:
 *   - Strip known wrong suffixes (Props, Defs, Helpers, etc.)
 *   - Append the correct role suffix in camelCase
 *   - If the stem is a banned generic name, replace entirely
 */
export function buildSuggestedRename(
    stem: string,
    role: SingleRole,
    dirName: string,
): string {
    const { suffix, standalone } = ROLE_SUFFIX_MAP[role];

    // If the stem is a banned generic name, try to use the standalone form
    // or prefix with directory name as domain
    const lowerStem = stem.toLowerCase();
    if (BANNED_GENERIC_NAMES.has(lowerStem)) {
        // helper/helpers → utils; common/shared/misc/temp → <domain>Suffix
        if (lowerStem === 'helper' || lowerStem === 'helpers') {
            return `${standalone}.ts`;
        }
        // For other banned names, use directory name as domain prefix
        const domain = sanitiseDomain(dirName);
        if (domain) {
            return `${domain}${suffix}.ts`;
        }
        return `${standalone}.ts`;
    }

    // Strip known wrong suffixes to extract the domain prefix
    const domain = stripWrongSuffix(stem);

    if (domain) {
        // Ensure camelCase: first char lowercase
        const camelDomain = domain.charAt(0).toLowerCase() + domain.slice(1);
        return `${camelDomain}${suffix}.ts`;
    }

    // Fallback: just append the suffix
    const camelStem = stem.charAt(0).toLowerCase() + stem.slice(1);
    return `${camelStem}${suffix}.ts`;
}

/** Known wrong suffixes that indicate a role but don't match the convention. */
const WRONG_SUFFIXES = [
    'Props', 'Defs', 'Definitions', 'Interfaces',
    'Helpers', 'Helper',
    'Consts', 'Config',
];

function stripWrongSuffix(stem: string): string | null {
    for (const wrong of WRONG_SUFFIXES) {
        if (stem.endsWith(wrong) && stem.length > wrong.length) {
            return stem.slice(0, -wrong.length);
        }
    }
    return null;
}

function sanitiseDomain(dirName: string): string {
    // Convert kebab-case directory name to camelCase domain prefix
    return dirName
        .split('-')
        .map((part, i) => (i === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
        .join('');
}

// ---------------------------------------------------------------------------
// Rule implementation
// ---------------------------------------------------------------------------

export const roleSuffixRule: Rule = {
    name: 'RoleSuffixRule',

    evaluate(analysis: FileAnalysis): Violation[] {
        const { file, exports, primaryExport, isReExportOnly } = analysis;
        const baseName = path.basename(file.absolutePath);
        const stem = path.parse(baseName).name;
        const dirName = path.basename(path.dirname(file.absolutePath));

        // --- Skip conditions ---

        // Skip .tsx files (components, not role files)
        if (file.extension === '.tsx') return [];

        // Skip index.ts files
        if (stem === 'index') return [];

        // Skip files with no exports or only re-exports
        if (exports.length === 0 || isReExportOnly) return [];

        // Skip hook files (primary export starts with "use")
        if (primaryExport && primaryExport.name.startsWith('use')) return [];

        const violations: Violation[] = [];

        // --- Check banned generic names first ---
        const lowerStem = stem.toLowerCase();
        if (BANNED_GENERIC_NAMES.has(lowerStem)) {
            const role = detectSingleRole(exports);
            const suggestedRename = role
                ? buildSuggestedRename(stem, role, dirName)
                : `${sanitiseDomain(dirName) || stem}Utils.ts`;

            violations.push({
                file,
                pattern: 2,
                severity: 'error',
                message: `Banned generic file name "${baseName}". Rename to "${suggestedRename}" or a more descriptive domain-specific name.`,
                suggestedRename,
            });
            return violations;
        }

        // --- Detect single role and validate suffix ---
        const role = detectSingleRole(exports);

        // Skip files with mixed roles or no detectable single role
        if (role === null) return [];

        // Skip files that already have the correct suffix
        if (hasCorrectSuffix(stem, role)) return [];

        const suggestedRename = buildSuggestedRename(stem, role, dirName);
        const { suffix, standalone } = ROLE_SUFFIX_MAP[role];

        violations.push({
            file,
            pattern: 2,
            severity: 'error',
            message: `File "${baseName}" contains only ${role} but does not use the "*${suffix}.ts" or "${standalone}.ts" suffix. Rename to "${suggestedRename}".`,
            suggestedRename,
        });

        return violations;
    },
};
