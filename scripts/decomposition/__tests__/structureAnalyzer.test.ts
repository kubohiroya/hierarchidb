import { describe, expect, it } from 'vitest';
import { Project } from 'ts-morph';

import { buildDependencyGraph, analyzeStructure } from '../structureAnalyzer.js';
import type { FileEntry } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create an in-memory ts-morph Project with a virtual source file. */
function createProjectWithSource(
    fileName: string,
    content: string,
): { project: Project; filePath: string } {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(fileName, content);
    return { project, filePath: sourceFile.getFilePath() };
}

function makeFileEntry(filePath: string, ext: '.ts' | '.tsx' = '.ts'): FileEntry {
    return {
        absolutePath: filePath,
        relativePath: filePath,
        subPackage: 'app',
        extension: ext,
    };
}

// ---------------------------------------------------------------------------
// buildDependencyGraph
// ---------------------------------------------------------------------------

describe('buildDependencyGraph', () => {
    it('extracts function declarations', () => {
        const { project } = createProjectWithSource(
            'test.ts',
            `export function foo() { return 1; }\nfunction bar() { return 2; }`,
        );
        const sf = project.getSourceFileOrThrow('test.ts');
        const graph = buildDependencyGraph(sf);

        expect(graph.nodes).toHaveLength(2);

        const foo = graph.nodes.find((n) => n.name === 'foo');
        expect(foo).toBeDefined();
        expect(foo?.kind).toBe('function');
        expect(foo?.isExported).toBe(true);

        const bar = graph.nodes.find((n) => n.name === 'bar');
        expect(bar).toBeDefined();
        expect(bar?.kind).toBe('local');
        expect(bar?.isExported).toBe(false);
    });

    it('extracts class declarations', () => {
        const { project } = createProjectWithSource(
            'test.ts',
            `export class MyClass {}\nclass Internal {}`,
        );
        const sf = project.getSourceFileOrThrow('test.ts');
        const graph = buildDependencyGraph(sf);

        expect(graph.nodes).toHaveLength(2);
        expect(graph.nodes.find((n) => n.name === 'MyClass')?.kind).toBe('class');
        expect(graph.nodes.find((n) => n.name === 'Internal')?.kind).toBe('local');
    });

    it('extracts type aliases and interfaces', () => {
        const { project } = createProjectWithSource(
            'test.ts',
            `export type Foo = string;\nexport interface Bar { x: number; }`,
        );
        const sf = project.getSourceFileOrThrow('test.ts');
        const graph = buildDependencyGraph(sf);

        expect(graph.nodes).toHaveLength(2);
        expect(graph.nodes.find((n) => n.name === 'Foo')?.kind).toBe('type');
        expect(graph.nodes.find((n) => n.name === 'Bar')?.kind).toBe('interface');
    });

    it('extracts enum declarations', () => {
        const { project } = createProjectWithSource(
            'test.ts',
            `export enum Status { Active, Inactive }`,
        );
        const sf = project.getSourceFileOrThrow('test.ts');
        const graph = buildDependencyGraph(sf);

        expect(graph.nodes).toHaveLength(1);
        expect(graph.nodes[0].kind).toBe('enum');
        expect(graph.nodes[0].name).toBe('Status');
    });

    it('extracts arrow function variables as function kind', () => {
        const { project } = createProjectWithSource(
            'test.ts',
            `export const greet = (name: string) => \`Hello \${name}\`;`,
        );
        const sf = project.getSourceFileOrThrow('test.ts');
        const graph = buildDependencyGraph(sf);

        expect(graph.nodes).toHaveLength(1);
        expect(graph.nodes[0].name).toBe('greet');
        expect(graph.nodes[0].kind).toBe('function');
        expect(graph.nodes[0].isExported).toBe(true);
    });

    it('extracts const variables as const kind', () => {
        const { project } = createProjectWithSource(
            'test.ts',
            `export const MAX_SIZE = 100;`,
        );
        const sf = project.getSourceFileOrThrow('test.ts');
        const graph = buildDependencyGraph(sf);

        expect(graph.nodes).toHaveLength(1);
        expect(graph.nodes[0].name).toBe('MAX_SIZE');
        expect(graph.nodes[0].kind).toBe('const');
    });

    it('detects intra-file references between symbols', () => {
        const { project } = createProjectWithSource(
            'test.ts',
            [
                'function helper() { return 42; }',
                'export function main() { return helper(); }',
            ].join('\n'),
        );
        const sf = project.getSourceFileOrThrow('test.ts');
        const graph = buildDependencyGraph(sf);

        const main = graph.nodes.find((n) => n.name === 'main');
        expect(main?.references).toContain('helper');

        // helper does not reference main
        const helper = graph.nodes.find((n) => n.name === 'helper');
        expect(helper?.references).not.toContain('main');
    });

    it('builds correct edges map', () => {
        const { project } = createProjectWithSource(
            'test.ts',
            [
                'type Config = { x: number };',
                'function validate(c: Config) { return c.x > 0; }',
                'export function process(c: Config) { return validate(c); }',
            ].join('\n'),
        );
        const sf = project.getSourceFileOrThrow('test.ts');
        const graph = buildDependencyGraph(sf);

        expect(graph.edges.get('process')).toContain('validate');
        expect(graph.edges.get('process')).toContain('Config');
        expect(graph.edges.get('validate')).toContain('Config');
        expect(graph.edges.get('Config')).toEqual([]);
    });

    it('handles empty files', () => {
        const { project } = createProjectWithSource('test.ts', '');
        const sf = project.getSourceFileOrThrow('test.ts');
        const graph = buildDependencyGraph(sf);

        expect(graph.nodes).toHaveLength(0);
        expect(graph.edges.size).toBe(0);
    });

    it('handles files with only imports (no top-level symbols)', () => {
        const { project } = createProjectWithSource(
            'test.ts',
            `import { something } from 'somewhere';`,
        );
        const sf = project.getSourceFileOrThrow('test.ts');
        const graph = buildDependencyGraph(sf);

        expect(graph.nodes).toHaveLength(0);
    });

    it('does not include self-references', () => {
        const { project } = createProjectWithSource(
            'test.ts',
            `export function factorial(n: number): number { return n <= 1 ? 1 : n * factorial(n - 1); }`,
        );
        const sf = project.getSourceFileOrThrow('test.ts');
        const graph = buildDependencyGraph(sf);

        const factorial = graph.nodes.find((n) => n.name === 'factorial');
        expect(factorial?.references).not.toContain('factorial');
    });

    it('records correct line ranges', () => {
        const { project } = createProjectWithSource(
            'test.ts',
            [
                '// line 1',
                'function foo() {',
                '  return 1;',
                '}',
                '',
                'function bar() {',
                '  return 2;',
                '}',
            ].join('\n'),
        );
        const sf = project.getSourceFileOrThrow('test.ts');
        const graph = buildDependencyGraph(sf);

        const foo = graph.nodes.find((n) => n.name === 'foo');
        expect(foo?.startLine).toBe(2);
        expect(foo?.endLine).toBe(4);

        const bar = graph.nodes.find((n) => n.name === 'bar');
        expect(bar?.startLine).toBe(6);
        expect(bar?.endLine).toBe(8);
    });

    it('skips anonymous function declarations', () => {
        const { project } = createProjectWithSource(
            'test.ts',
            `export default function() { return 1; }`,
        );
        const sf = project.getSourceFileOrThrow('test.ts');
        const graph = buildDependencyGraph(sf);

        // Anonymous default export function should be skipped
        expect(graph.nodes).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// analyzeStructure
// ---------------------------------------------------------------------------

describe('analyzeStructure', () => {
    it('returns full FileStructure for a valid file', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const content = [
            'export function foo() { return 1; }',
            'export function bar() { return foo(); }',
            'export type Config = { x: number };',
        ].join('\n');
        const sf = project.createSourceFile('src/example.ts', content);
        const filePath = sf.getFilePath();

        const file = makeFileEntry(filePath);
        const result = analyzeStructure(file, project);

        expect(result.file).toBe(file);
        expect(result.lineCount).toBe(3);
        expect(result.graph.nodes).toHaveLength(3);
        expect(result.analysis.exports.length).toBeGreaterThan(0);
        expect(result.cohesionGroups).toEqual([]);
    });

    it('returns minimal structure for unparseable files', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const file = makeFileEntry('/nonexistent/file.ts');

        const result = analyzeStructure(file, project);

        expect(result.lineCount).toBe(0);
        expect(result.graph.nodes).toHaveLength(0);
        expect(result.analysis.exports).toEqual([]);
        expect(result.cohesionGroups).toEqual([]);
    });

    it('reuses existing source file from project', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const content = 'export const X = 1;';
        const sf = project.createSourceFile('src/reuse.ts', content);
        const filePath = sf.getFilePath();

        const file = makeFileEntry(filePath);

        // Call twice - second call should reuse the source file
        const result1 = analyzeStructure(file, project);
        const result2 = analyzeStructure(file, project);

        expect(result1.lineCount).toBe(result2.lineCount);
        expect(result1.graph.nodes).toHaveLength(result2.graph.nodes.length);
    });

    it('handles files with no exports', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const content = [
            'function internal() { return 1; }',
            'const SECRET = 42;',
        ].join('\n');
        const sf = project.createSourceFile('src/noexports.ts', content);
        const filePath = sf.getFilePath();

        const file = makeFileEntry(filePath);
        const result = analyzeStructure(file, project);

        expect(result.graph.nodes).toHaveLength(2);
        expect(result.graph.nodes.every((n) => n.kind === 'local')).toBe(true);
        expect(result.analysis.exports).toHaveLength(0);
    });
});
