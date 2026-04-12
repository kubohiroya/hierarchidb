import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { FileEntry, FileAnalysis, ExportInfo } from '../types.js';

// Mock fs.readFileSync so we don't need real files on disk.
vi.mock('node:fs', () => ({
    default: {
        readFileSync: vi.fn(),
    },
}));

import fs from 'node:fs';
import { filterByThreshold, computePriorityScore } from '../thresholdFilter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFileEntry(overrides: Partial<FileEntry> = {}): FileEntry {
    return {
        absolutePath: '/repo/src/Foo.ts',
        relativePath: 'src/Foo.ts',
        subPackage: 'app',
        extension: '.ts',
        ...overrides,
    };
}

function fakeFileContent(lineCount: number): string {
    return Array.from({ length: lineCount }, (_, i) => `// line ${i + 1}`).join('\n');
}

function makeAnalysis(file: FileEntry, exportCount: number): FileAnalysis {
    const exports: ExportInfo[] = Array.from({ length: exportCount }, (_, i) => ({
        name: `export${i}`,
        kind: 'function' as const,
        isDefault: i === 0,
    }));
    return {
        file,
        primaryExport: exports[0] ?? null,
        exports,
        isReExportOnly: false,
        componentMetrics: null,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computePriorityScore', () => {
    it('returns lineCount × exportCount', () => {
        expect(computePriorityScore(700, 5)).toBe(3500);
    });

    it('returns 0 when exportCount is 0', () => {
        expect(computePriorityScore(1000, 0)).toBe(0);
    });

    it('returns 0 when lineCount is 0', () => {
        expect(computePriorityScore(0, 10)).toBe(0);
    });
});

describe('filterByThreshold', () => {
    const mockedReadFileSync = vi.mocked(fs.readFileSync);

    beforeEach(() => {
        mockedReadFileSync.mockReset();
    });

    it('includes files with lineCount >= threshold', () => {
        const file = makeFileEntry({ absolutePath: '/repo/src/Big.ts' });
        mockedReadFileSync.mockReturnValue(fakeFileContent(700));

        const results = filterByThreshold([file], 600);

        expect(results).toHaveLength(1);
        expect(results[0].lineCount).toBe(700);
        expect(results[0].file).toBe(file);
    });

    it('excludes files with lineCount < threshold', () => {
        const file = makeFileEntry({ absolutePath: '/repo/src/Small.ts' });
        mockedReadFileSync.mockReturnValue(fakeFileContent(100));

        const results = filterByThreshold([file], 600);

        expect(results).toHaveLength(0);
    });

    it('excludes test files in __tests__/ directory', () => {
        const file = makeFileEntry({
            absolutePath: '/repo/src/__tests__/Big.ts',
            relativePath: 'src/__tests__/Big.ts',
        });
        mockedReadFileSync.mockReturnValue(fakeFileContent(1000));

        const results = filterByThreshold([file], 600);

        expect(results).toHaveLength(0);
    });

    it('excludes .test.ts files', () => {
        const file = makeFileEntry({
            absolutePath: '/repo/src/Foo.test.ts',
            relativePath: 'src/Foo.test.ts',
        });
        mockedReadFileSync.mockReturnValue(fakeFileContent(1000));

        const results = filterByThreshold([file], 600);

        expect(results).toHaveLength(0);
    });

    it('excludes .test.tsx files', () => {
        const file = makeFileEntry({
            absolutePath: '/repo/src/Foo.test.tsx',
            relativePath: 'src/Foo.test.tsx',
            extension: '.tsx',
        });
        mockedReadFileSync.mockReturnValue(fakeFileContent(1000));

        const results = filterByThreshold([file], 600);

        expect(results).toHaveLength(0);
    });

    it('excludes .spec.ts files', () => {
        const file = makeFileEntry({
            absolutePath: '/repo/src/Foo.spec.ts',
            relativePath: 'src/Foo.spec.ts',
        });
        mockedReadFileSync.mockReturnValue(fakeFileContent(1000));

        const results = filterByThreshold([file], 600);

        expect(results).toHaveLength(0);
    });

    it('excludes .spec.tsx files', () => {
        const file = makeFileEntry({
            absolutePath: '/repo/src/Foo.spec.tsx',
            relativePath: 'src/Foo.spec.tsx',
            extension: '.tsx',
        });
        mockedReadFileSync.mockReturnValue(fakeFileContent(1000));

        const results = filterByThreshold([file], 600);

        expect(results).toHaveLength(0);
    });

    it('sorts results by lineCount descending', () => {
        const fileA = makeFileEntry({ absolutePath: '/repo/src/A.ts', relativePath: 'src/A.ts' });
        const fileB = makeFileEntry({ absolutePath: '/repo/src/B.ts', relativePath: 'src/B.ts' });
        const fileC = makeFileEntry({ absolutePath: '/repo/src/C.ts', relativePath: 'src/C.ts' });

        mockedReadFileSync.mockImplementation((filePath: unknown) => {
            if (filePath === '/repo/src/A.ts') return fakeFileContent(800);
            if (filePath === '/repo/src/B.ts') return fakeFileContent(1200);
            if (filePath === '/repo/src/C.ts') return fakeFileContent(650);
            return '';
        });

        const results = filterByThreshold([fileA, fileB, fileC], 600);

        expect(results).toHaveLength(3);
        expect(results[0].lineCount).toBe(1200);
        expect(results[1].lineCount).toBe(800);
        expect(results[2].lineCount).toBe(650);
    });

    it('uses analyses map for exportCount when provided', () => {
        const file = makeFileEntry({ absolutePath: '/repo/src/Big.ts' });
        mockedReadFileSync.mockReturnValue(fakeFileContent(700));

        const analyses = new Map<string, FileAnalysis>();
        analyses.set('/repo/src/Big.ts', makeAnalysis(file, 5));

        const results = filterByThreshold([file], 600, analyses);

        expect(results).toHaveLength(1);
        expect(results[0].exportCount).toBe(5);
        expect(results[0].priorityScore).toBe(700 * 5);
    });

    it('defaults exportCount to 0 when no analyses provided', () => {
        const file = makeFileEntry({ absolutePath: '/repo/src/Big.ts' });
        mockedReadFileSync.mockReturnValue(fakeFileContent(700));

        const results = filterByThreshold([file], 600);

        expect(results).toHaveLength(1);
        expect(results[0].exportCount).toBe(0);
        expect(results[0].priorityScore).toBe(0);
    });

    it('handles empty file array', () => {
        const results = filterByThreshold([], 600);
        expect(results).toHaveLength(0);
    });

    it('handles unreadable files gracefully (lineCount = 0)', () => {
        const file = makeFileEntry({ absolutePath: '/repo/src/Missing.ts' });
        mockedReadFileSync.mockImplementation(() => {
            throw new Error('ENOENT');
        });

        const results = filterByThreshold([file], 600);

        expect(results).toHaveLength(0);
    });
});
