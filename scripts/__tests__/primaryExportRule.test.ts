import { describe, expect, it } from 'vitest';

import { primaryExportRule } from '../naming-audit/rules/primaryExportRule.js';
import type { FileAnalysis, FileEntry } from '../naming-audit/types.js';

/** Helper to build a minimal FileEntry. */
function makeFile(relativePath: string, ext: '.ts' | '.tsx'): FileEntry {
    return {
        absolutePath: `/repo/${relativePath}`,
        relativePath,
        subPackage: 'test-pkg',
        extension: ext,
    };
}

/** Helper to build a minimal FileAnalysis. */
function makeAnalysis(overrides: Partial<FileAnalysis> & { file: FileEntry }): FileAnalysis {
    return {
        primaryExport: null,
        exports: [],
        isReExportOnly: false,
        componentMetrics: null,
        ...overrides,
    };
}

describe('PrimaryExportRule', () => {
    // ---------------------------------------------------------------
    // Skip conditions
    // ---------------------------------------------------------------

    it('skips files with no exports', () => {
        const file = makeFile('src/Empty.ts', '.ts');
        const violations = primaryExportRule.evaluate(
            makeAnalysis({ file, exports: [], primaryExport: null }),
        );
        expect(violations).toEqual([]);
    });

    it('skips index.ts files', () => {
        const file = makeFile('src/index.ts', '.ts');
        const violations = primaryExportRule.evaluate(
            makeAnalysis({
                file,
                exports: [{ name: 'Foo', kind: 'const', isDefault: false }],
                primaryExport: { name: 'Foo', kind: 'const', isDefault: false },
            }),
        );
        expect(violations).toEqual([]);
    });

    it('skips re-export-only files', () => {
        const file = makeFile('src/Wrapper.tsx', '.tsx');
        const violations = primaryExportRule.evaluate(
            makeAnalysis({
                file,
                isReExportOnly: true,
                exports: [{ name: 'Actual', kind: 'reExport', isDefault: false }],
                primaryExport: { name: 'Actual', kind: 'reExport', isDefault: false },
            }),
        );
        expect(violations).toEqual([]);
    });

    it('skips wildcard re-exports', () => {
        const file = makeFile('src/barrel.ts', '.ts');
        const violations = primaryExportRule.evaluate(
            makeAnalysis({
                file,
                exports: [{ name: '*', kind: 'reExport', isDefault: false }],
                primaryExport: { name: '*', kind: 'reExport', isDefault: false },
            }),
        );
        expect(violations).toEqual([]);
    });

    // ---------------------------------------------------------------
    // .tsx — exact (PascalCase) match
    // ---------------------------------------------------------------

    it('no violation when .tsx file stem matches primary export exactly', () => {
        const file = makeFile('src/ShapePreviewStep.tsx', '.tsx');
        const violations = primaryExportRule.evaluate(
            makeAnalysis({
                file,
                exports: [{ name: 'ShapePreviewStep', kind: 'function', isDefault: false }],
                primaryExport: { name: 'ShapePreviewStep', kind: 'function', isDefault: false },
            }),
        );
        expect(violations).toEqual([]);
    });

    it('violation when .tsx file stem differs from primary export', () => {
        const file = makeFile('src/ShapePreviewStep.tsx', '.tsx');
        const violations = primaryExportRule.evaluate(
            makeAnalysis({
                file,
                exports: [{ name: 'ShapePreviewStepView', kind: 'function', isDefault: false }],
                primaryExport: { name: 'ShapePreviewStepView', kind: 'function', isDefault: false },
            }),
        );
        expect(violations).toHaveLength(1);
        expect(violations[0].pattern).toBe(1);
        expect(violations[0].severity).toBe('error');
        expect(violations[0].suggestedRename).toBe('ShapePreviewStepView.tsx');
    });

    it('.tsx is case-sensitive — different casing is a violation', () => {
        const file = makeFile('src/shapepreviewstep.tsx', '.tsx');
        const violations = primaryExportRule.evaluate(
            makeAnalysis({
                file,
                exports: [{ name: 'ShapePreviewStep', kind: 'function', isDefault: false }],
                primaryExport: { name: 'ShapePreviewStep', kind: 'function', isDefault: false },
            }),
        );
        expect(violations).toHaveLength(1);
        expect(violations[0].suggestedRename).toBe('ShapePreviewStep.tsx');
    });

    // ---------------------------------------------------------------
    // .ts — case-insensitive match (camelCase hooks)
    // ---------------------------------------------------------------

    it('no violation when .ts hook file matches primary export (same case)', () => {
        const file = makeFile('src/useShapePreviewStep.ts', '.ts');
        const violations = primaryExportRule.evaluate(
            makeAnalysis({
                file,
                exports: [{ name: 'useShapePreviewStep', kind: 'function', isDefault: false }],
                primaryExport: { name: 'useShapePreviewStep', kind: 'function', isDefault: false },
            }),
        );
        expect(violations).toEqual([]);
    });

    it('no violation when .ts file matches primary export case-insensitively', () => {
        const file = makeFile('src/MyModule.ts', '.ts');
        const violations = primaryExportRule.evaluate(
            makeAnalysis({
                file,
                exports: [{ name: 'myModule', kind: 'const', isDefault: false }],
                primaryExport: { name: 'myModule', kind: 'const', isDefault: false },
            }),
        );
        expect(violations).toEqual([]);
    });

    it('violation when .ts file does not match primary export even case-insensitively', () => {
        const file = makeFile('src/helpers.ts', '.ts');
        const violations = primaryExportRule.evaluate(
            makeAnalysis({
                file,
                exports: [{ name: 'formatDate', kind: 'function', isDefault: false }],
                primaryExport: { name: 'formatDate', kind: 'function', isDefault: false },
            }),
        );
        expect(violations).toHaveLength(1);
        expect(violations[0].pattern).toBe(1);
        expect(violations[0].severity).toBe('error');
        expect(violations[0].suggestedRename).toBe('formatDate.ts');
    });

    // ---------------------------------------------------------------
    // Violation shape
    // ---------------------------------------------------------------

    it('violation includes correct file, pattern, severity, message, and suggestedRename', () => {
        const file = makeFile('src/OldName.tsx', '.tsx');
        const violations = primaryExportRule.evaluate(
            makeAnalysis({
                file,
                exports: [{ name: 'NewName', kind: 'function', isDefault: false }],
                primaryExport: { name: 'NewName', kind: 'function', isDefault: false },
            }),
        );
        expect(violations).toHaveLength(1);
        const v = violations[0];
        expect(v.file).toBe(file);
        expect(v.pattern).toBe(1);
        expect(v.severity).toBe('error');
        expect(v.message).toContain('OldName.tsx');
        expect(v.message).toContain('NewName');
        expect(v.suggestedRename).toBe('NewName.tsx');
    });
});
