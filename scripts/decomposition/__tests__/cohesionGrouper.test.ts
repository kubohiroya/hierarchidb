import { describe, expect, it } from 'vitest';
import { detectInterGroupCycles, groupByCohesion } from '../cohesionGrouper.js';
import type { CohesionGroup, DependencyGraph, SymbolNode } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<SymbolNode> & { name: string }): SymbolNode {
  return {
    kind: 'function',
    isExported: true,
    startLine: 1,
    endLine: 10,
    references: [],
    ...overrides,
  };
}

function makeGraph(nodes: SymbolNode[], edgeEntries?: [string, string[]][]): DependencyGraph {
  const edges = new Map<string, readonly string[]>();
  if (edgeEntries) {
    for (const [from, to] of edgeEntries) {
      edges.set(from, to);
    }
  } else {
    // Derive edges from node references
    for (const node of nodes) {
      edges.set(node.name, node.references as string[]);
    }
  }
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// groupByCohesion
// ---------------------------------------------------------------------------

describe('groupByCohesion', () => {
  it('returns empty array for empty graph', () => {
    const graph = makeGraph([]);
    const groups = groupByCohesion(graph);
    expect(groups).toHaveLength(0);
  });

  it('creates singleton groups for nodes with no cycles', () => {
    const a = makeNode({ name: 'alpha', startLine: 1, endLine: 10 });
    const b = makeNode({ name: 'beta', startLine: 11, endLine: 20 });
    const c = makeNode({ name: 'gamma', startLine: 21, endLine: 30 });

    const graph = makeGraph(
      [a, b, c],
      [
        ['alpha', ['beta']],
        ['beta', ['gamma']],
        ['gamma', []],
      ]
    );

    const groups = groupByCohesion(graph);

    // Each node should be in its own group (no cycles)
    expect(groups).toHaveLength(3);

    // Every symbol appears exactly once across all groups
    const allSymbols = groups.flatMap((g) => g.symbols.map((s) => s.name));
    expect(allSymbols.sort()).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('groups nodes in a single SCC together', () => {
    const a = makeNode({ name: 'foo', startLine: 1, endLine: 10, references: ['bar'] });
    const b = makeNode({ name: 'bar', startLine: 11, endLine: 20, references: ['baz'] });
    const c = makeNode({ name: 'baz', startLine: 21, endLine: 30, references: ['foo'] });

    const graph = makeGraph([a, b, c]);

    const groups = groupByCohesion(graph);

    // All three form a single SCC
    expect(groups).toHaveLength(1);
    const names = groups[0].symbols.map((s) => s.name).sort();
    expect(names).toEqual(['bar', 'baz', 'foo']);
  });

  it('handles multiple SCCs correctly', () => {
    // SCC1: a <-> b, SCC2: c <-> d, e is standalone
    const a = makeNode({ name: 'a', startLine: 1, endLine: 5, references: ['b'] });
    const b = makeNode({ name: 'b', startLine: 6, endLine: 10, references: ['a'] });
    const c = makeNode({ name: 'c', startLine: 11, endLine: 15, references: ['d'] });
    const d = makeNode({ name: 'd', startLine: 16, endLine: 20, references: ['c'] });
    const e = makeNode({ name: 'e', startLine: 21, endLine: 25, references: [] });

    const graph = makeGraph([a, b, c, d, e]);

    const groups = groupByCohesion(graph);

    // 3 groups: {a,b}, {c,d}, {e}
    expect(groups).toHaveLength(3);

    const groupSets = groups.map((g) =>
      g.symbols
        .map((s) => s.name)
        .sort()
        .join(',')
    );
    expect(groupSets).toContain('a,b');
    expect(groupSets).toContain('c,d');
    expect(groupSets).toContain('e');
  });

  it('calculates lineCount as sum of (endLine - startLine + 1)', () => {
    const a = makeNode({ name: 'x', startLine: 1, endLine: 10, references: ['y'] });
    const b = makeNode({ name: 'y', startLine: 11, endLine: 30, references: ['x'] });

    const graph = makeGraph([a, b]);
    const groups = groupByCohesion(graph);

    expect(groups).toHaveLength(1);
    // (10 - 1 + 1) + (30 - 11 + 1) = 10 + 20 = 30
    expect(groups[0].lineCount).toBe(30);
  });

  it('assigns unique group ids', () => {
    const nodes = Array.from({ length: 5 }, (_, i) =>
      makeNode({ name: `sym${i}`, startLine: i * 10 + 1, endLine: i * 10 + 10 })
    );
    const graph = makeGraph(nodes);
    const groups = groupByCohesion(graph);

    const ids = groups.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    // All ids follow the group-N pattern
    for (const id of ids) {
      expect(id).toMatch(/^group-\d+$/);
    }
  });

  // -----------------------------------------------------------------------
  // Role inference
  // -----------------------------------------------------------------------

  it('infers "types" role when all symbols are type/interface', () => {
    const nodes = [
      makeNode({ name: 'FooType', kind: 'type', isExported: true }),
      makeNode({ name: 'BarInterface', kind: 'interface', isExported: true }),
    ];
    const graph = makeGraph(nodes);
    const groups = groupByCohesion(graph);

    expect(groups.every((g) => g.suggestedRole === 'types')).toBe(true);
  });

  it('infers "hook" role when all symbols start with use + uppercase', () => {
    const nodes = [
      makeNode({ name: 'useAuth', kind: 'function' }),
      makeNode({ name: 'usePermissions', kind: 'function' }),
    ];
    const graph = makeGraph(nodes);
    const groups = groupByCohesion(graph);

    for (const g of groups) {
      expect(g.suggestedRole).toBe('hook');
    }
  });

  it('infers "stateHook" role when a symbol matches use*State', () => {
    const nodes = [
      makeNode({ name: 'useFormState', kind: 'function' }),
      makeNode({ name: 'validateForm', kind: 'function' }),
    ];
    const graph = makeGraph(nodes);
    const groups = groupByCohesion(graph);

    const stateGroup = groups.find((g) => g.symbols.some((s) => s.name === 'useFormState'));
    expect(stateGroup?.suggestedRole).toBe('stateHook');
  });

  it('infers "constants" role when all symbols are UPPER_SNAKE_CASE const', () => {
    const nodes = [
      makeNode({ name: 'MAX_SIZE', kind: 'const', isExported: true }),
      makeNode({ name: 'DEFAULT_VALUE', kind: 'const', isExported: true }),
    ];
    const graph = makeGraph(nodes);
    const groups = groupByCohesion(graph);

    for (const g of groups) {
      expect(g.suggestedRole).toBe('constants');
    }
  });

  it('infers "utils" role when all symbols are non-exported functions', () => {
    const nodes = [
      makeNode({ name: 'helperA', kind: 'function', isExported: false }),
      makeNode({ name: 'helperB', kind: 'function', isExported: false }),
    ];
    const graph = makeGraph(nodes);
    const groups = groupByCohesion(graph);

    for (const g of groups) {
      expect(g.suggestedRole).toBe('utils');
    }
  });

  it('infers "view" role when any symbol name ends with View', () => {
    const nodes = [
      makeNode({ name: 'HeaderView', kind: 'function', isExported: true }),
      makeNode({ name: 'formatDate', kind: 'function', isExported: true }),
    ];
    const graph = makeGraph(nodes);
    const groups = groupByCohesion(graph);

    const viewGroup = groups.find((g) => g.symbols.some((s) => s.name === 'HeaderView'));
    expect(viewGroup?.suggestedRole).toBe('view');
  });

  it('infers "component" role for PascalCase function symbols', () => {
    const nodes = [makeNode({ name: 'UserProfile', kind: 'function', isExported: true })];
    const graph = makeGraph(nodes);
    const groups = groupByCohesion(graph);

    expect(groups[0].suggestedRole).toBe('component');
  });

  it('infers "other" role when no pattern matches', () => {
    const nodes = [
      makeNode({ name: 'doSomething', kind: 'function', isExported: true }),
      makeNode({ name: 'SOME_CONST', kind: 'const', isExported: true }),
    ];
    const graph = makeGraph(nodes);
    const groups = groupByCohesion(graph);

    // Mixed kinds → 'other' for groups that don't match specific patterns
    const mixedGroup = groups.find(
      (g) => g.symbols.length === 1 && g.symbols[0].name === 'doSomething'
    );
    // doSomething is exported + PascalCase doesn't match → 'component' won't match (lowercase start)
    // It's exported so not 'utils'. It's a function but not PascalCase → 'other'
    expect(mixedGroup?.suggestedRole).toBe('other');
  });

  it('partitions all symbols exactly once (union = all nodes)', () => {
    const nodes = [
      makeNode({ name: 'a', references: ['b'] }),
      makeNode({ name: 'b', references: ['c'] }),
      makeNode({ name: 'c', references: ['a'] }),
      makeNode({ name: 'd', references: [] }),
    ];
    const graph = makeGraph(nodes);
    const groups = groupByCohesion(graph);

    const allNames = groups.flatMap((g) => g.symbols.map((s) => s.name)).sort();
    expect(allNames).toEqual(['a', 'b', 'c', 'd']);

    // No duplicates
    expect(new Set(allNames).size).toBe(allNames.length);
  });
});

// ---------------------------------------------------------------------------
// detectInterGroupCycles
// ---------------------------------------------------------------------------

describe('detectInterGroupCycles', () => {
  it('returns empty array when there are no groups', () => {
    const graph = makeGraph([]);
    const warnings = detectInterGroupCycles([], graph);
    expect(warnings).toHaveLength(0);
  });

  it('returns empty array when there are no inter-group edges', () => {
    const a = makeNode({ name: 'a', references: [] });
    const b = makeNode({ name: 'b', references: [] });
    const graph = makeGraph([a, b]);

    const groups: CohesionGroup[] = [
      { id: 'group-0', symbols: [a], lineCount: 10, suggestedRole: 'other' },
      { id: 'group-1', symbols: [b], lineCount: 10, suggestedRole: 'other' },
    ];

    const warnings = detectInterGroupCycles(groups, graph);
    expect(warnings).toHaveLength(0);
  });

  it('returns empty array for acyclic inter-group edges', () => {
    const a = makeNode({ name: 'a', references: ['b'] });
    const b = makeNode({ name: 'b', references: [] });
    const graph = makeGraph([a, b]);

    const groups: CohesionGroup[] = [
      { id: 'group-0', symbols: [a], lineCount: 10, suggestedRole: 'other' },
      { id: 'group-1', symbols: [b], lineCount: 10, suggestedRole: 'other' },
    ];

    const warnings = detectInterGroupCycles(groups, graph);
    expect(warnings).toHaveLength(0);
  });

  it('detects a simple two-group cycle', () => {
    const a = makeNode({ name: 'a', references: ['b'] });
    const b = makeNode({ name: 'b', references: ['a'] });
    const graph = makeGraph([a, b]);

    const groups: CohesionGroup[] = [
      { id: 'group-0', symbols: [a], lineCount: 10, suggestedRole: 'other' },
      { id: 'group-1', symbols: [b], lineCount: 10, suggestedRole: 'other' },
    ];

    const warnings = detectInterGroupCycles(groups, graph);

    expect(warnings.length).toBeGreaterThanOrEqual(1);
    // At least one warning should involve both groups
    const allGroupIds = warnings.flatMap((w) => w.groupIds);
    expect(allGroupIds).toContain('group-0');
    expect(allGroupIds).toContain('group-1');

    // Involved symbols should include a and b
    const allSymbols = warnings.flatMap((w) => w.involvedSymbols);
    expect(allSymbols).toContain('a');
    expect(allSymbols).toContain('b');

    // Each warning has a human-readable message
    for (const w of warnings) {
      expect(w.message).toBeTruthy();
      expect(w.message.length).toBeGreaterThan(0);
    }
  });

  it('detects a three-group cycle', () => {
    const a = makeNode({ name: 'a', references: ['b'] });
    const b = makeNode({ name: 'b', references: ['c'] });
    const c = makeNode({ name: 'c', references: ['a'] });
    const graph = makeGraph([a, b, c]);

    const groups: CohesionGroup[] = [
      { id: 'group-0', symbols: [a], lineCount: 10, suggestedRole: 'other' },
      { id: 'group-1', symbols: [b], lineCount: 10, suggestedRole: 'other' },
      { id: 'group-2', symbols: [c], lineCount: 10, suggestedRole: 'other' },
    ];

    const warnings = detectInterGroupCycles(groups, graph);

    expect(warnings.length).toBeGreaterThanOrEqual(1);
    // The cycle should involve all three groups
    const cycleGroupIds = new Set(warnings.flatMap((w) => w.groupIds));
    expect(cycleGroupIds.has('group-0')).toBe(true);
    expect(cycleGroupIds.has('group-1')).toBe(true);
    expect(cycleGroupIds.has('group-2')).toBe(true);
  });

  it('does not report intra-group references as cycles', () => {
    // a and b are in the same group and reference each other
    const a = makeNode({ name: 'a', references: ['b'] });
    const b = makeNode({ name: 'b', references: ['a'] });
    const c = makeNode({ name: 'c', references: [] });
    const graph = makeGraph([a, b, c]);

    const groups: CohesionGroup[] = [
      { id: 'group-0', symbols: [a, b], lineCount: 20, suggestedRole: 'other' },
      { id: 'group-1', symbols: [c], lineCount: 10, suggestedRole: 'other' },
    ];

    const warnings = detectInterGroupCycles(groups, graph);
    expect(warnings).toHaveLength(0);
  });
});
