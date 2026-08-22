import { describe, expect, it } from 'vitest';
import { assertDependencyGraph, isDependencyGraph } from '../dependencyGraphJsonSchema.js';

const validGraph = {
  treeId: 'plugins',
  nodes: [
    {
      nodeType: 'shape',
      label: 'Shape',
      metrics: { imports: 2 },
    },
  ],
  edges: [
    {
      from: 'shape',
      to: 'folder',
      type: 'depends-on',
    },
  ],
  metadata: {
    totalPlugins: 2,
    hasCycles: false,
  },
};

describe('dependency graph JSON Schema', () => {
  it('accepts valid dependency graph artifacts', () => {
    expect(isDependencyGraph(validGraph)).toBe(true);
    expect(() => assertDependencyGraph(validGraph)).not.toThrow();
  });

  it('rejects missing required graph fields', () => {
    expect(isDependencyGraph({ ...validGraph, metadata: undefined })).toBe(false);
    expect(() => assertDependencyGraph({ ...validGraph, metadata: undefined })).toThrow(
      'plugin-dependency-graph-schema-invalid'
    );
  });

  it('rejects invalid metric values without coercion', () => {
    const invalid = {
      ...validGraph,
      nodes: [{ nodeType: 'shape', label: 'Shape', metrics: { imports: { nested: 2 } } }],
    };
    expect(isDependencyGraph(invalid)).toBe(false);
  });

  it('keeps extension properties because the graph schema is intentionally permissive', () => {
    const extended = {
      ...validGraph,
      extra: { renderedBy: 'audit-test' },
      nodes: [{ ...validGraph.nodes[0], extraNodeField: true }],
    };
    expect(isDependencyGraph(extended)).toBe(true);
  });
});
