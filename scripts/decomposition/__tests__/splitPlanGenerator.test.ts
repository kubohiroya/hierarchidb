import { describe, expect, it } from 'vitest';
import {
  applyContainerPresentationalPattern,
  applyTsDecompositionPattern,
  generateSplitPlan,
} from '../splitPlanGenerator.js';
import type {
  CohesionGroup,
  FileEntry,
  FileStructure,
  GroupRole,
  SplitPlanOptions,
  SymbolNode,
} from '../types.js';

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

function makeSymbol(overrides: Partial<SymbolNode> = {}): SymbolNode {
  return {
    name: 'myFunc',
    kind: 'function',
    isExported: true,
    startLine: 1,
    endLine: 50,
    references: [],
    ...overrides,
  };
}

function makeGroup(id: string, symbols: SymbolNode[], role: GroupRole = 'other'): CohesionGroup {
  return {
    id,
    symbols,
    lineCount: symbols.reduce((s, sym) => s + (sym.endLine - sym.startLine + 1), 0),
    suggestedRole: role,
  };
}

function makeStructure(overrides: Partial<FileStructure> = {}): FileStructure {
  const file = overrides.file ?? makeFileEntry();
  return {
    file,
    lineCount: 700,
    analysis: {
      file,
      primaryExport: null,
      exports: [],
      isReExportOnly: false,
      componentMetrics: null,
    },
    graph: { nodes: [], edges: new Map() },
    cohesionGroups: [],
    ...overrides,
  };
}

const defaultOptions: SplitPlanOptions = {
  threshold: 600,
  namingGuideline: {
    hookPrefix: 'use',
    viewSuffix: 'View',
    typesFileName: 'types.ts',
    constantsFileName: 'constants.ts',
    utilsFileName: 'utils.ts',
    indexReExportOnly: true,
  },
};

// ---------------------------------------------------------------------------
// generateSplitPlan
// ---------------------------------------------------------------------------

describe('generateSplitPlan', () => {
  it('detects container-presentational pattern for .tsx with high JSX count', () => {
    const file = makeFileEntry({
      relativePath: 'src/ui/MyComponent.tsx',
      extension: '.tsx',
    });
    const structure = makeStructure({
      file,
      analysis: {
        file,
        primaryExport: { name: 'MyComponent', kind: 'function', isDefault: true },
        exports: [{ name: 'MyComponent', kind: 'function', isDefault: true }],
        isReExportOnly: false,
        componentMetrics: {
          jsxLineCount: 80,
          hookCallCount: 1,
          usesReactMemo: false,
          hookNames: ['useState'],
        },
      },
    });

    const groups = [
      makeGroup(
        'g0',
        [
          makeSymbol({
            name: 'useMyState',
            kind: 'function',
            isExported: false,
            startLine: 1,
            endLine: 30,
          }),
        ],
        'hook'
      ),
      makeGroup(
        'g1',
        [
          makeSymbol({
            name: 'MyComponent',
            kind: 'function',
            isExported: true,
            startLine: 31,
            endLine: 200,
          }),
        ],
        'component'
      ),
    ];

    const plan = generateSplitPlan(structure, groups, defaultOptions);

    expect(plan.pattern).toBe('container-presentational');
    expect(plan.sourceFile).toBe(file);
    // Should have container, stateHook, and index targets at minimum
    expect(plan.targets.length).toBeGreaterThanOrEqual(2);
  });

  it('detects hook-decomposition pattern for use*.ts files', () => {
    const file = makeFileEntry({
      relativePath: 'src/hooks/useMyHook.ts',
      extension: '.ts',
    });
    const structure = makeStructure({ file });

    const groups = [
      makeGroup(
        'g0',
        [
          makeSymbol({
            name: 'useMyHook',
            kind: 'function',
            isExported: true,
            startLine: 1,
            endLine: 100,
          }),
          makeSymbol({
            name: 'useHelper',
            kind: 'function',
            isExported: false,
            startLine: 101,
            endLine: 150,
          }),
        ],
        'hook'
      ),
    ];

    const plan = generateSplitPlan(structure, groups, defaultOptions);
    expect(plan.pattern).toBe('hook-decomposition');
  });

  it('detects single-main-with-helpers pattern', () => {
    const file = makeFileEntry({ relativePath: 'src/utils/processData.ts' });
    const structure = makeStructure({ file });

    const groups = [
      makeGroup(
        'g0',
        [
          makeSymbol({
            name: 'processData',
            kind: 'function',
            isExported: true,
            startLine: 1,
            endLine: 200,
          }),
          makeSymbol({
            name: 'helperA',
            kind: 'function',
            isExported: false,
            startLine: 201,
            endLine: 300,
          }),
          makeSymbol({
            name: 'helperB',
            kind: 'function',
            isExported: false,
            startLine: 301,
            endLine: 400,
          }),
        ],
        'other'
      ),
    ];

    const plan = generateSplitPlan(structure, groups, defaultOptions);
    expect(plan.pattern).toBe('single-main-with-helpers');
  });

  it('detects multi-function pattern for multiple independent exports', () => {
    const file = makeFileEntry({ relativePath: 'src/utils/formatters.ts' });
    const structure = makeStructure({ file });

    const groups = [
      makeGroup(
        'g0',
        [
          makeSymbol({
            name: 'formatDate',
            kind: 'function',
            isExported: true,
            startLine: 1,
            endLine: 100,
          }),
        ],
        'other'
      ),
      makeGroup(
        'g1',
        [
          makeSymbol({
            name: 'formatNumber',
            kind: 'function',
            isExported: true,
            startLine: 101,
            endLine: 200,
          }),
        ],
        'other'
      ),
    ];

    const plan = generateSplitPlan(structure, groups, defaultOptions);
    expect(plan.pattern).toBe('multi-function');
  });

  it('detects type-extraction pattern when mostly types', () => {
    const file = makeFileEntry({ relativePath: 'src/types/models.ts' });
    const structure = makeStructure({ file });

    const groups = [
      makeGroup(
        'g0',
        [
          makeSymbol({
            name: 'UserType',
            kind: 'type',
            isExported: true,
            startLine: 1,
            endLine: 20,
          }),
          makeSymbol({
            name: 'OrderType',
            kind: 'type',
            isExported: true,
            startLine: 21,
            endLine: 40,
          }),
          makeSymbol({
            name: 'ProductType',
            kind: 'type',
            isExported: true,
            startLine: 41,
            endLine: 60,
          }),
          makeSymbol({
            name: 'IService',
            kind: 'interface',
            isExported: true,
            startLine: 61,
            endLine: 80,
          }),
        ],
        'types'
      ),
    ];

    const plan = generateSplitPlan(structure, groups, defaultOptions);
    expect(plan.pattern).toBe('type-extraction');
  });

  it('returns empty importUpdates (to be enriched by CLI)', () => {
    const structure = makeStructure();
    const groups = [makeGroup('g0', [makeSymbol()], 'other')];

    const plan = generateSplitPlan(structure, groups, defaultOptions);
    expect(plan.importUpdates).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// applyContainerPresentationalPattern
// ---------------------------------------------------------------------------

describe('applyContainerPresentationalPattern', () => {
  it('generates container, view, stateHook, and index targets', () => {
    const file = makeFileEntry({
      relativePath: 'src/ui/Dashboard.tsx',
      extension: '.tsx',
    });
    const structure = makeStructure({
      file,
      analysis: {
        file,
        primaryExport: { name: 'Dashboard', kind: 'function', isDefault: true },
        exports: [],
        isReExportOnly: false,
        componentMetrics: {
          jsxLineCount: 100,
          hookCallCount: 3,
          usesReactMemo: false,
          hookNames: [],
        },
      },
    });

    const groups = [
      makeGroup(
        'g0',
        [
          makeSymbol({
            name: 'useDashboardState',
            kind: 'function',
            isExported: false,
            startLine: 1,
            endLine: 50,
          }),
        ],
        'stateHook'
      ),
      makeGroup(
        'g1',
        [
          makeSymbol({
            name: 'renderHeader',
            kind: 'function',
            isExported: false,
            startLine: 51,
            endLine: 100,
          }),
        ],
        'view'
      ),
      makeGroup(
        'g2',
        [
          makeSymbol({
            name: 'Dashboard',
            kind: 'function',
            isExported: true,
            startLine: 101,
            endLine: 300,
          }),
        ],
        'component'
      ),
    ];

    const targets = applyContainerPresentationalPattern(structure, groups);

    const paths = targets.map((t) => t.targetPath);
    expect(paths).toContain('src/ui/Dashboard/useDashboardState.ts');
    expect(paths).toContain('src/ui/Dashboard/DashboardView.tsx');
    expect(paths).toContain('src/ui/Dashboard/Dashboard.tsx');
    expect(paths).toContain('src/ui/Dashboard/index.ts');
  });

  it('extracts types.ts when 3+ type symbols exist', () => {
    const file = makeFileEntry({
      relativePath: 'src/ui/Panel.tsx',
      extension: '.tsx',
    });
    const structure = makeStructure({ file });

    const groups = [
      makeGroup(
        'g0',
        [
          makeSymbol({
            name: 'PanelProps',
            kind: 'type',
            isExported: true,
            startLine: 1,
            endLine: 10,
          }),
          makeSymbol({
            name: 'PanelState',
            kind: 'interface',
            isExported: true,
            startLine: 11,
            endLine: 20,
          }),
          makeSymbol({
            name: 'PanelConfig',
            kind: 'type',
            isExported: true,
            startLine: 21,
            endLine: 30,
          }),
        ],
        'types'
      ),
      makeGroup(
        'g1',
        [
          makeSymbol({
            name: 'Panel',
            kind: 'function',
            isExported: true,
            startLine: 31,
            endLine: 200,
          }),
        ],
        'component'
      ),
    ];

    const targets = applyContainerPresentationalPattern(structure, groups);
    const typesTarget = targets.find((t) => t.role === 'types');
    expect(typesTarget).toBeDefined();
    expect(typesTarget?.targetPath).toBe('src/ui/Panel/types.ts');
    expect(typesTarget?.symbols).toEqual(['PanelProps', 'PanelState', 'PanelConfig']);
  });

  it('does not extract types.ts when fewer than 3 type symbols', () => {
    const file = makeFileEntry({
      relativePath: 'src/ui/Small.tsx',
      extension: '.tsx',
    });
    const structure = makeStructure({ file });

    const groups = [
      makeGroup(
        'g0',
        [
          makeSymbol({
            name: 'SmallProps',
            kind: 'type',
            isExported: true,
            startLine: 1,
            endLine: 5,
          }),
          makeSymbol({
            name: 'Small',
            kind: 'function',
            isExported: true,
            startLine: 6,
            endLine: 100,
          }),
        ],
        'component'
      ),
    ];

    const targets = applyContainerPresentationalPattern(structure, groups);
    const typesTarget = targets.find((t) => t.role === 'types');
    expect(typesTarget).toBeUndefined();
  });

  it('index.ts target has no symbols (re-export only)', () => {
    const file = makeFileEntry({
      relativePath: 'src/ui/Widget.tsx',
      extension: '.tsx',
    });
    const structure = makeStructure({ file });

    const groups = [
      makeGroup(
        'g0',
        [
          makeSymbol({
            name: 'useWidgetState',
            kind: 'function',
            isExported: false,
            startLine: 1,
            endLine: 30,
          }),
        ],
        'hook'
      ),
      makeGroup(
        'g1',
        [
          makeSymbol({
            name: 'Widget',
            kind: 'function',
            isExported: true,
            startLine: 31,
            endLine: 200,
          }),
        ],
        'component'
      ),
    ];

    const targets = applyContainerPresentationalPattern(structure, groups);
    const indexTarget = targets.find((t) => t.targetPath.endsWith('index.ts'));
    expect(indexTarget).toBeDefined();
    expect(indexTarget?.symbols).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// applyTsDecompositionPattern
// ---------------------------------------------------------------------------

describe('applyTsDecompositionPattern', () => {
  it('applies hook decomposition: parent stays, children split', () => {
    const file = makeFileEntry({
      relativePath: 'src/hooks/useDataFetch.ts',
      extension: '.ts',
    });
    const structure = makeStructure({ file });

    const groups = [
      makeGroup(
        'g0',
        [
          makeSymbol({
            name: 'useDataFetch',
            kind: 'function',
            isExported: true,
            startLine: 1,
            endLine: 100,
          }),
          makeSymbol({
            name: 'useRetry',
            kind: 'function',
            isExported: false,
            startLine: 101,
            endLine: 150,
          }),
          makeSymbol({
            name: 'useCache',
            kind: 'function',
            isExported: false,
            startLine: 151,
            endLine: 200,
          }),
        ],
        'hook'
      ),
    ];

    const targets = applyTsDecompositionPattern(structure, groups);
    const paths = targets.map((t) => t.targetPath);

    // Parent hook in its own file
    expect(paths).toContain('src/hooks/useDataFetch/useDataFetch.ts');
    // Child hooks each get their own file
    expect(paths).toContain('src/hooks/useDataFetch/useRetry.ts');
    expect(paths).toContain('src/hooks/useDataFetch/useCache.ts');
  });

  it('applies multi-function: each group gets its own file', () => {
    const file = makeFileEntry({ relativePath: 'src/utils/formatters.ts' });
    const structure = makeStructure({ file });

    const groups = [
      makeGroup(
        'g0',
        [
          makeSymbol({
            name: 'formatDate',
            kind: 'function',
            isExported: true,
            startLine: 1,
            endLine: 100,
          }),
        ],
        'other'
      ),
      makeGroup(
        'g1',
        [
          makeSymbol({
            name: 'formatNumber',
            kind: 'function',
            isExported: true,
            startLine: 101,
            endLine: 200,
          }),
        ],
        'other'
      ),
    ];

    const targets = applyTsDecompositionPattern(structure, groups);
    const paths = targets.map((t) => t.targetPath);

    expect(paths).toContain('src/utils/formatters/formatDate.ts');
    expect(paths).toContain('src/utils/formatters/formatNumber.ts');
    expect(paths).toContain('src/utils/formatters/index.ts');
  });

  it('applies type-extraction when mostly types', () => {
    const file = makeFileEntry({ relativePath: 'src/types/models.ts' });
    const structure = makeStructure({ file });

    const groups = [
      makeGroup(
        'g0',
        [
          makeSymbol({ name: 'User', kind: 'type', isExported: true, startLine: 1, endLine: 20 }),
          makeSymbol({ name: 'Order', kind: 'type', isExported: true, startLine: 21, endLine: 40 }),
          makeSymbol({
            name: 'Product',
            kind: 'interface',
            isExported: true,
            startLine: 41,
            endLine: 60,
          }),
          makeSymbol({
            name: 'formatUser',
            kind: 'function',
            isExported: true,
            startLine: 61,
            endLine: 80,
          }),
        ],
        'types'
      ),
    ];

    const targets = applyTsDecompositionPattern(structure, groups);
    const typesTarget = targets.find((t) => t.role === 'types');
    expect(typesTarget).toBeDefined();
    expect(typesTarget?.targetPath).toBe('src/types/models/types.ts');
    expect(typesTarget?.symbols).toContain('User');
    expect(typesTarget?.symbols).toContain('Order');
    expect(typesTarget?.symbols).toContain('Product');
  });

  it('applies single-main-with-helpers pattern', () => {
    const file = makeFileEntry({ relativePath: 'src/services/processData.ts' });
    const structure = makeStructure({ file });

    const groups = [
      makeGroup(
        'g0',
        [
          makeSymbol({
            name: 'processData',
            kind: 'function',
            isExported: true,
            startLine: 1,
            endLine: 200,
          }),
          makeSymbol({
            name: 'validateInput',
            kind: 'function',
            isExported: false,
            startLine: 201,
            endLine: 300,
          }),
          makeSymbol({
            name: 'transformOutput',
            kind: 'function',
            isExported: false,
            startLine: 301,
            endLine: 400,
          }),
        ],
        'other'
      ),
    ];

    const targets = applyTsDecompositionPattern(structure, groups);
    const mainTarget = targets.find((t) => t.role === 'main');
    expect(mainTarget).toBeDefined();
    expect(mainTarget?.symbols).toContain('processData');

    const helperTarget = targets.find((t) => t.symbols.includes('validateInput'));
    expect(helperTarget).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Threshold enforcement
// ---------------------------------------------------------------------------

describe('threshold enforcement', () => {
  it('keeps targets within threshold', () => {
    const structure = makeStructure();
    const groups = [
      makeGroup(
        'g0',
        [
          makeSymbol({
            name: 'funcA',
            kind: 'function',
            isExported: true,
            startLine: 1,
            endLine: 100,
          }),
        ],
        'other'
      ),
    ];

    const plan = generateSplitPlan(structure, groups, defaultOptions);
    // Single small target should not be split
    for (const target of plan.targets) {
      if (target.symbols.length <= 1) continue;
      // Multi-symbol targets should respect threshold
      expect(target.estimatedLineCount).toBeLessThanOrEqual(defaultOptions.threshold);
    }
  });

  it('preserves all symbols across targets', () => {
    const file = makeFileEntry({ relativePath: 'src/utils/big.ts' });
    const structure = makeStructure({ file });

    const symbols = [
      makeSymbol({ name: 'funcA', kind: 'function', isExported: true, startLine: 1, endLine: 100 }),
      makeSymbol({
        name: 'funcB',
        kind: 'function',
        isExported: true,
        startLine: 101,
        endLine: 200,
      }),
    ];

    const groups = [makeGroup('g0', [symbols[0]], 'other'), makeGroup('g1', [symbols[1]], 'other')];

    const plan = generateSplitPlan(structure, groups, defaultOptions);

    // Collect all symbols from all targets (excluding index re-export)
    const allTargetSymbols = plan.targets.flatMap((t) => t.symbols);
    expect(allTargetSymbols).toContain('funcA');
    expect(allTargetSymbols).toContain('funcB');
  });
});

// ---------------------------------------------------------------------------
// Line count estimation
// ---------------------------------------------------------------------------

describe('line count estimation', () => {
  it('includes overhead in estimated line counts', () => {
    const file = makeFileEntry({ relativePath: 'src/ui/Comp.tsx', extension: '.tsx' });
    const structure = makeStructure({
      file,
      analysis: {
        file,
        primaryExport: null,
        exports: [],
        isReExportOnly: false,
        componentMetrics: {
          jsxLineCount: 80,
          hookCallCount: 3,
          usesReactMemo: false,
          hookNames: [],
        },
      },
    });

    const groups = [
      makeGroup(
        'g0',
        [
          makeSymbol({
            name: 'Comp',
            kind: 'function',
            isExported: true,
            startLine: 1,
            endLine: 100,
          }),
        ],
        'component'
      ),
    ];

    const targets = applyContainerPresentationalPattern(structure, groups);
    const compTarget = targets.find((t) => t.symbols.includes('Comp'));
    expect(compTarget).toBeDefined();
    // 100 lines raw + overhead (max(5, ceil(100*0.1)) = 10) = 110
    expect(compTarget?.estimatedLineCount).toBe(110);
  });
});
