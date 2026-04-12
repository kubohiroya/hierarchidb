import { describe, expect, it } from 'vitest';
import type {
    SplitPlan,
    SplitTarget,
    FileEntry,
    FileStructure,
    FileAnalysis,
    DependencyGraph,
    ExportInfo,
} from '../types.js';
import {
    validatePlan,
    validateNaming,
    detectCircularImports,
    verifyApiPreservation,
} from '../planValidator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFileEntry(overrides: Partial<FileEntry> = {}): FileEntry {
    return {
        absolutePath: '/repo/src/BigFile.ts',
        relativePath: 'src/BigFile.ts',
        subPackage: 'app',
        extension: '.ts',
        ...overrides,
    };
}

function makeTarget(overrides: Partial<SplitTarget> = {}): SplitTarget {
    return {
        targetPath: 'src/bigFile/utils.ts',
        symbols: ['helperA', 'helperB'],
        estimatedLineCount: 100,
        role: 'utils',
        ...overrides,
    };
}

function makePlan(overrides: Partial<SplitPlan> = {}): SplitPlan {
    return {
        sourceFile: makeFileEntry(),
        sourceLineCount: 800,
        targets: [],
        importUpdates: [],
        pattern: 'multi-function',
        ...overrides,
    };
}

function makeFileStructure(exports: ExportInfo[]): FileStructure {
    const file = makeFileEntry();
    const analysis: FileAnalysis = {
        file,
        primaryExport: exports[0] ?? null,
        exports,
        isReExportOnly: false,
        componentMetrics: null,
    };
    const graph: DependencyGraph = {
        nodes: [],
        edges: new Map(),
    };
    return {
        file,
        lineCount: 800,
        analysis,
        graph,
        cohesionGroups: [],
    };
}

// ---------------------------------------------------------------------------
// validateNaming
// ---------------------------------------------------------------------------

describe('validateNaming', () => {
    describe('hook naming (rule 1)', () => {
        it('accepts valid hook names like useMyHook.ts', () => {
            const target = makeTarget({ targetPath: 'src/hooks/useMyHook.ts', role: 'hook' });
            const violations = validateNaming([target]);
            expect(violations).toHaveLength(0);
        });

        it('rejects hook with .tsx extension', () => {
            const target = makeTarget({ targetPath: 'src/hooks/useMyHook.tsx', role: 'hook' });
            const violations = validateNaming([target]);
            expect(violations).toHaveLength(1);
            expect(violations[0].rule).toBe('hook-naming');
        });

        it('rejects hook not starting with "use"', () => {
            const target = makeTarget({ targetPath: 'src/hooks/myHook.ts', role: 'hook' });
            const violations = validateNaming([target]);
            expect(violations).toHaveLength(1);
            expect(violations[0].rule).toBe('hook-naming');
        });

        it('rejects hook with lowercase after "use"', () => {
            const target = makeTarget({ targetPath: 'src/hooks/usemyhook.ts', role: 'hook' });
            const violations = validateNaming([target]);
            expect(violations).toHaveLength(1);
            expect(violations[0].rule).toBe('hook-naming');
        });

        it('validates stateHook role the same as hook', () => {
            const valid = makeTarget({ targetPath: 'src/hooks/useFormState.ts', role: 'stateHook' });
            expect(validateNaming([valid])).toHaveLength(0);

            const invalid = makeTarget({ targetPath: 'src/hooks/formState.ts', role: 'stateHook' });
            expect(validateNaming([invalid])).toHaveLength(1);
        });
    });

    describe('view naming (rule 2)', () => {
        it('accepts valid view names like MyComponentView.tsx', () => {
            const target = makeTarget({ targetPath: 'src/MyComponentView.tsx', role: 'view' });
            expect(validateNaming([target])).toHaveLength(0);
        });

        it('rejects view without View suffix', () => {
            const target = makeTarget({ targetPath: 'src/MyComponent.tsx', role: 'view' });
            const violations = validateNaming([target]);
            expect(violations).toHaveLength(1);
            expect(violations[0].rule).toBe('view-naming');
        });

        it('rejects view with .ts extension', () => {
            const target = makeTarget({ targetPath: 'src/MyComponentView.ts', role: 'view' });
            const violations = validateNaming([target]);
            expect(violations).toHaveLength(1);
            expect(violations[0].rule).toBe('view-naming');
        });
    });

    describe('types naming (rule 3)', () => {
        it('accepts types.ts', () => {
            const target = makeTarget({ targetPath: 'src/types.ts', role: 'types' });
            expect(validateNaming([target])).toHaveLength(0);
        });

        it('rejects non-standard type file names', () => {
            const target = makeTarget({ targetPath: 'src/myTypes.ts', role: 'types' });
            const violations = validateNaming([target]);
            expect(violations).toHaveLength(1);
            expect(violations[0].rule).toBe('types-naming');
        });
    });

    describe('constants naming (rule 4)', () => {
        it('accepts constants.ts', () => {
            const target = makeTarget({ targetPath: 'src/constants.ts', role: 'constants' });
            expect(validateNaming([target])).toHaveLength(0);
        });

        it('rejects non-standard constants file names', () => {
            const target = makeTarget({ targetPath: 'src/myConstants.ts', role: 'constants' });
            const violations = validateNaming([target]);
            expect(violations).toHaveLength(1);
            expect(violations[0].rule).toBe('constants-naming');
        });
    });

    describe('utils naming (rule 5)', () => {
        it('accepts utils.ts', () => {
            const target = makeTarget({ targetPath: 'src/utils.ts', role: 'utils' });
            expect(validateNaming([target])).toHaveLength(0);
        });

        it('rejects non-standard utils file names', () => {
            const target = makeTarget({ targetPath: 'src/myUtils.ts', role: 'utils' });
            const violations = validateNaming([target]);
            expect(violations).toHaveLength(1);
            expect(violations[0].rule).toBe('utils-naming');
        });
    });

    describe('component naming (rule 7)', () => {
        it('accepts PascalCase .tsx files', () => {
            const target = makeTarget({ targetPath: 'src/MyComponent.tsx', role: 'component' });
            expect(validateNaming([target])).toHaveLength(0);
        });

        it('rejects camelCase .tsx files', () => {
            const target = makeTarget({ targetPath: 'src/myComponent.tsx', role: 'component' });
            const violations = validateNaming([target]);
            expect(violations).toHaveLength(1);
            expect(violations[0].rule).toBe('component-naming');
        });

        it('rejects .ts extension for components', () => {
            const target = makeTarget({ targetPath: 'src/MyComponent.ts', role: 'component' });
            const violations = validateNaming([target]);
            expect(violations).toHaveLength(1);
            expect(violations[0].rule).toBe('component-naming');
        });

        it('validates container role the same as component', () => {
            const valid = makeTarget({ targetPath: 'src/MyContainer.tsx', role: 'container' });
            expect(validateNaming([valid])).toHaveLength(0);

            const invalid = makeTarget({ targetPath: 'src/myContainer.ts', role: 'container' });
            expect(validateNaming([invalid])).toHaveLength(1);
        });
    });

    describe('regular file naming (rule 8)', () => {
        it('accepts camelCase .ts files for main role', () => {
            const target = makeTarget({ targetPath: 'src/myFunction.ts', role: 'main' });
            expect(validateNaming([target])).toHaveLength(0);
        });

        it('accepts PascalCase .tsx files for other role', () => {
            const target = makeTarget({ targetPath: 'src/MyWidget.tsx', role: 'other' });
            expect(validateNaming([target])).toHaveLength(0);
        });

        it('rejects files with invalid naming for main/other roles', () => {
            const target = makeTarget({ targetPath: 'src/my-function.ts', role: 'main' });
            const violations = validateNaming([target]);
            expect(violations).toHaveLength(1);
            expect(violations[0].rule).toBe('file-naming');
        });

        it('accepts index.ts for main role', () => {
            const target = makeTarget({ targetPath: 'src/index.ts', role: 'main' });
            expect(validateNaming([target])).toHaveLength(0);
        });

        it('rejects index.tsx (should be index.ts)', () => {
            const target = makeTarget({ targetPath: 'src/index.tsx', role: 'main' });
            const violations = validateNaming([target]);
            expect(violations).toHaveLength(1);
            expect(violations[0].rule).toBe('index-naming');
        });
    });

    describe('forbidden names (rule 9)', () => {
        const forbiddenNames = ['helper.ts', 'common.ts', 'shared.ts', 'misc.ts', 'temp.ts', 'util.ts'];

        for (const name of forbiddenNames) {
            it(`rejects forbidden name: ${name}`, () => {
                const target = makeTarget({ targetPath: `src/${name}`, role: 'other' });
                const violations = validateNaming([target]);
                expect(violations).toHaveLength(1);
                expect(violations[0].rule).toBe('forbidden-name');
            });
        }
    });

    describe('empty targets', () => {
        it('returns no violations for empty array', () => {
            expect(validateNaming([])).toHaveLength(0);
        });
    });

    describe('suggested fixes', () => {
        it('suggests use* prefix for hooks', () => {
            const target = makeTarget({ targetPath: 'src/hooks/myHook.ts', role: 'hook' });
            const violations = validateNaming([target]);
            expect(violations[0].suggestedFix).toContain('use');
        });

        it('suggests View.tsx suffix for views', () => {
            const target = makeTarget({ targetPath: 'src/MyComponent.tsx', role: 'view' });
            const violations = validateNaming([target]);
            expect(violations[0].suggestedFix).toContain('View.tsx');
        });

        it('suggests types.ts for type files', () => {
            const target = makeTarget({ targetPath: 'src/myTypes.ts', role: 'types' });
            const violations = validateNaming([target]);
            expect(violations[0].suggestedFix).toContain('types.ts');
        });
    });
});

// ---------------------------------------------------------------------------
// detectCircularImports
// ---------------------------------------------------------------------------

describe('detectCircularImports', () => {
    it('returns empty array for a plan with no targets', () => {
        const plan = makePlan({ targets: [] });
        expect(detectCircularImports(plan)).toHaveLength(0);
    });

    it('returns empty array for a plan with a single target', () => {
        const plan = makePlan({
            targets: [makeTarget({ targetPath: 'src/a.ts', symbols: ['foo'] })],
        });
        expect(detectCircularImports(plan)).toHaveLength(0);
    });

    it('returns empty array when no graph is provided', () => {
        const plan = makePlan({
            targets: [
                makeTarget({ targetPath: 'src/a.ts', symbols: ['foo'] }),
                makeTarget({ targetPath: 'src/b.ts', symbols: ['bar'] }),
            ],
        });
        expect(detectCircularImports(plan)).toHaveLength(0);
    });

    it('returns empty array for acyclic inter-target references', () => {
        const plan = makePlan({
            targets: [
                makeTarget({ targetPath: 'src/a.ts', symbols: ['foo'] }),
                makeTarget({ targetPath: 'src/b.ts', symbols: ['bar'] }),
            ],
        });
        const graph: DependencyGraph = {
            nodes: [
                { name: 'foo', kind: 'function', isExported: true, startLine: 1, endLine: 10, references: ['bar'] },
                { name: 'bar', kind: 'function', isExported: true, startLine: 11, endLine: 20, references: [] },
            ],
            edges: new Map([['foo', ['bar']], ['bar', []]]),
        };
        expect(detectCircularImports(plan, graph)).toHaveLength(0);
    });

    it('detects a two-target circular import', () => {
        const plan = makePlan({
            targets: [
                makeTarget({ targetPath: 'src/a.ts', symbols: ['foo'] }),
                makeTarget({ targetPath: 'src/b.ts', symbols: ['bar'] }),
            ],
        });
        const graph: DependencyGraph = {
            nodes: [
                { name: 'foo', kind: 'function', isExported: true, startLine: 1, endLine: 10, references: ['bar'] },
                { name: 'bar', kind: 'function', isExported: true, startLine: 11, endLine: 20, references: ['foo'] },
            ],
            edges: new Map([['foo', ['bar']], ['bar', ['foo']]]),
        };
        const warnings = detectCircularImports(plan, graph);
        expect(warnings.length).toBeGreaterThanOrEqual(1);
        expect(warnings[0].message).toContain('Circular');
    });

    it('detects a three-target circular import', () => {
        const plan = makePlan({
            targets: [
                makeTarget({ targetPath: 'src/a.ts', symbols: ['foo'] }),
                makeTarget({ targetPath: 'src/b.ts', symbols: ['bar'] }),
                makeTarget({ targetPath: 'src/c.ts', symbols: ['baz'] }),
            ],
        });
        const graph: DependencyGraph = {
            nodes: [
                { name: 'foo', kind: 'function', isExported: true, startLine: 1, endLine: 10, references: ['bar'] },
                { name: 'bar', kind: 'function', isExported: true, startLine: 11, endLine: 20, references: ['baz'] },
                { name: 'baz', kind: 'function', isExported: true, startLine: 21, endLine: 30, references: ['foo'] },
            ],
            edges: new Map([['foo', ['bar']], ['bar', ['baz']], ['baz', ['foo']]]),
        };
        const warnings = detectCircularImports(plan, graph);
        expect(warnings.length).toBeGreaterThanOrEqual(1);
    });
});

// ---------------------------------------------------------------------------
// verifyApiPreservation
// ---------------------------------------------------------------------------

describe('verifyApiPreservation', () => {
    it('returns preserved=true when all exports are covered', () => {
        const exports: ExportInfo[] = [
            { name: 'foo', kind: 'function', isDefault: false },
            { name: 'bar', kind: 'function', isDefault: false },
        ];
        const structure = makeFileStructure(exports);
        const plan = makePlan({
            targets: [
                makeTarget({ symbols: ['foo'], targetPath: 'src/a.ts' }),
                makeTarget({ symbols: ['bar'], targetPath: 'src/b.ts' }),
            ],
        });

        const result = verifyApiPreservation(structure, plan);

        expect(result.preserved).toBe(true);
        expect(result.missingExports).toHaveLength(0);
        expect(result.message).toContain('2');
    });

    it('returns preserved=false when exports are missing', () => {
        const exports: ExportInfo[] = [
            { name: 'foo', kind: 'function', isDefault: false },
            { name: 'bar', kind: 'function', isDefault: false },
            { name: 'baz', kind: 'type', isDefault: false },
        ];
        const structure = makeFileStructure(exports);
        const plan = makePlan({
            targets: [makeTarget({ symbols: ['foo'], targetPath: 'src/a.ts' })],
        });

        const result = verifyApiPreservation(structure, plan);

        expect(result.preserved).toBe(false);
        expect(result.missingExports).toContain('bar');
        expect(result.missingExports).toContain('baz');
        expect(result.missingExports).toHaveLength(2);
    });

    it('handles empty exports', () => {
        const structure = makeFileStructure([]);
        const plan = makePlan({ targets: [] });

        const result = verifyApiPreservation(structure, plan);

        expect(result.preserved).toBe(true);
        expect(result.missingExports).toHaveLength(0);
    });

    it('handles duplicate symbols across targets', () => {
        const exports: ExportInfo[] = [
            { name: 'foo', kind: 'function', isDefault: false },
        ];
        const structure = makeFileStructure(exports);
        const plan = makePlan({
            targets: [
                makeTarget({ symbols: ['foo'], targetPath: 'src/a.ts' }),
                makeTarget({ symbols: ['foo'], targetPath: 'src/b.ts' }),
            ],
        });

        const result = verifyApiPreservation(structure, plan);
        expect(result.preserved).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// validatePlan
// ---------------------------------------------------------------------------

describe('validatePlan', () => {
    it('returns valid=true for a well-formed plan', () => {
        const plan = makePlan({
            targets: [
                makeTarget({ targetPath: 'src/bigFile/utils.ts', role: 'utils', estimatedLineCount: 100 }),
                makeTarget({ targetPath: 'src/bigFile/types.ts', role: 'types', estimatedLineCount: 50 }),
                makeTarget({ targetPath: 'src/bigFile/useMyHook.ts', role: 'hook', estimatedLineCount: 200 }),
            ],
        });

        const result = validatePlan(plan);

        expect(result.valid).toBe(true);
        expect(result.namingViolations).toHaveLength(0);
        expect(result.circularImports).toHaveLength(0);
        expect(result.thresholdViolations).toHaveLength(0);
    });

    it('detects naming violations', () => {
        const plan = makePlan({
            targets: [
                makeTarget({ targetPath: 'src/bigFile/helper.ts', role: 'other', estimatedLineCount: 100 }),
            ],
        });

        const result = validatePlan(plan);

        expect(result.valid).toBe(false);
        expect(result.namingViolations).toHaveLength(1);
    });

    it('detects threshold violations (targets > 600 lines)', () => {
        const plan = makePlan({
            targets: [
                makeTarget({ targetPath: 'src/bigFile/utils.ts', role: 'utils', estimatedLineCount: 700 }),
            ],
        });

        const result = validatePlan(plan);

        expect(result.valid).toBe(false);
        expect(result.thresholdViolations).toHaveLength(1);
        expect(result.thresholdViolations[0]).toBe('src/bigFile/utils.ts');
    });

    it('allows targets at exactly 600 lines', () => {
        const plan = makePlan({
            targets: [
                makeTarget({ targetPath: 'src/bigFile/utils.ts', role: 'utils', estimatedLineCount: 600 }),
            ],
        });

        const result = validatePlan(plan);

        expect(result.thresholdViolations).toHaveLength(0);
    });

    it('combines multiple violation types', () => {
        const plan = makePlan({
            targets: [
                makeTarget({ targetPath: 'src/bigFile/helper.ts', role: 'other', estimatedLineCount: 700 }),
            ],
        });

        const result = validatePlan(plan);

        expect(result.valid).toBe(false);
        expect(result.namingViolations.length).toBeGreaterThan(0);
        expect(result.thresholdViolations.length).toBeGreaterThan(0);
    });

    it('returns valid=true for empty plan', () => {
        const plan = makePlan({ targets: [] });

        const result = validatePlan(plan);

        expect(result.valid).toBe(true);
        expect(result.namingViolations).toHaveLength(0);
        expect(result.circularImports).toHaveLength(0);
        expect(result.thresholdViolations).toHaveLength(0);
    });

    it('includes API preservation placeholder', () => {
        const plan = makePlan({ targets: [] });

        const result = validatePlan(plan);

        expect(result.apiPreservation.preserved).toBe(true);
        expect(result.apiPreservation.missingExports).toHaveLength(0);
    });
});
