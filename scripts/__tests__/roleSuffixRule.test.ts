import { describe, expect, it } from 'vitest';

import {
  buildSuggestedRename,
  detectSingleRole,
  hasCorrectSuffix,
  roleSuffixRule,
} from '../naming-audit/rules/roleSuffixRule.js';
import type { ExportInfo, FileAnalysis, FileEntry } from '../naming-audit/types.js';

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

// ---------------------------------------------------------------
// Helper: type-only exports
// ---------------------------------------------------------------
const typeExports: ExportInfo[] = [
  { name: 'Foo', kind: 'type', isDefault: false },
  { name: 'Bar', kind: 'interface', isDefault: false },
];

// ---------------------------------------------------------------
// Helper: const-only exports
// ---------------------------------------------------------------
const constExports: ExportInfo[] = [
  { name: 'MAX_SIZE', kind: 'const', isDefault: false },
  { name: 'DEFAULT_COLOR', kind: 'const', isDefault: false },
];

// ---------------------------------------------------------------
// Helper: function-only exports (utils)
// ---------------------------------------------------------------
const funcExports: ExportInfo[] = [
  { name: 'formatDate', kind: 'function', isDefault: false },
  { name: 'parseUrl', kind: 'function', isDefault: false },
];

describe('RoleSuffixRule', () => {
  // ---------------------------------------------------------------
  // Types-only: wrong suffix → violation
  // ---------------------------------------------------------------
  it('types-only file with wrong suffix → violation', () => {
    const file = makeFile('src/ui/components/ShapeDialogStepProps.ts', '.ts');
    const violations = roleSuffixRule.evaluate(
      makeAnalysis({
        file,
        exports: typeExports,
        primaryExport: typeExports[0],
      })
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].pattern).toBe(2);
    expect(violations[0].severity).toBe('error');
    expect(violations[0].suggestedRename).toMatch(/Types\.ts$/);
  });

  // ---------------------------------------------------------------
  // Types-only: correct suffix → no violation
  // ---------------------------------------------------------------
  it('types-only file with *Types.ts suffix → no violation', () => {
    const file = makeFile('src/ui/components/shapeDialogStepTypes.ts', '.ts');
    const violations = roleSuffixRule.evaluate(
      makeAnalysis({
        file,
        exports: typeExports,
        primaryExport: typeExports[0],
      })
    );
    expect(violations).toEqual([]);
  });

  it('types-only file named types.ts → no violation', () => {
    const file = makeFile('src/ui/components/steps/types.ts', '.ts');
    const violations = roleSuffixRule.evaluate(
      makeAnalysis({
        file,
        exports: typeExports,
        primaryExport: typeExports[0],
      })
    );
    expect(violations).toEqual([]);
  });

  // ---------------------------------------------------------------
  // Constants-only: wrong suffix → violation
  // ---------------------------------------------------------------
  it('constants-only file with wrong suffix → violation', () => {
    const file = makeFile('src/ui/components/shapeConsts.ts', '.ts');
    const violations = roleSuffixRule.evaluate(
      makeAnalysis({
        file,
        exports: constExports,
        primaryExport: constExports[0],
      })
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].pattern).toBe(2);
    expect(violations[0].severity).toBe('error');
    expect(violations[0].suggestedRename).toMatch(/Constants\.ts$/);
  });

  // ---------------------------------------------------------------
  // Utils-only: wrong suffix → violation
  // ---------------------------------------------------------------
  it('utils-only file with wrong suffix → violation', () => {
    const file = makeFile('src/ui/components/shapeHelpers.ts', '.ts');
    const violations = roleSuffixRule.evaluate(
      makeAnalysis({
        file,
        exports: funcExports,
        primaryExport: funcExports[0],
      })
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].pattern).toBe(2);
    expect(violations[0].severity).toBe('error');
    expect(violations[0].suggestedRename).toMatch(/Utils\.ts$/);
  });

  // ---------------------------------------------------------------
  // Mixed-role file → no violation (skip)
  // ---------------------------------------------------------------
  it('mixed-role file (types + functions) → no violation', () => {
    const file = makeFile('src/ui/components/shapeMixed.ts', '.ts');
    const mixedExports: ExportInfo[] = [
      { name: 'Foo', kind: 'type', isDefault: false },
      { name: 'doSomething', kind: 'function', isDefault: false },
    ];
    const violations = roleSuffixRule.evaluate(
      makeAnalysis({
        file,
        exports: mixedExports,
        primaryExport: mixedExports[0],
      })
    );
    expect(violations).toEqual([]);
  });

  // ---------------------------------------------------------------
  // .tsx file → skip
  // ---------------------------------------------------------------
  it('.tsx file → skip', () => {
    const file = makeFile('src/ui/components/ShapePreview.tsx', '.tsx');
    const violations = roleSuffixRule.evaluate(
      makeAnalysis({
        file,
        exports: typeExports,
        primaryExport: typeExports[0],
      })
    );
    expect(violations).toEqual([]);
  });

  // ---------------------------------------------------------------
  // index.ts → skip
  // ---------------------------------------------------------------
  it('index.ts → skip', () => {
    const file = makeFile('src/ui/components/index.ts', '.ts');
    const violations = roleSuffixRule.evaluate(
      makeAnalysis({
        file,
        exports: typeExports,
        primaryExport: typeExports[0],
      })
    );
    expect(violations).toEqual([]);
  });

  // ---------------------------------------------------------------
  // Hook file → skip
  // ---------------------------------------------------------------
  it('hook file (primary export starts with "use") → skip', () => {
    const file = makeFile('src/ui/hooks/useShapeState.ts', '.ts');
    const hookExports: ExportInfo[] = [
      { name: 'useShapeState', kind: 'function', isDefault: false },
    ];
    const violations = roleSuffixRule.evaluate(
      makeAnalysis({
        file,
        exports: hookExports,
        primaryExport: hookExports[0],
      })
    );
    expect(violations).toEqual([]);
  });

  // ---------------------------------------------------------------
  // Re-export-only → skip
  // ---------------------------------------------------------------
  it('re-export-only file → skip', () => {
    const file = makeFile('src/ui/components/shapeTypes.ts', '.ts');
    const reExports: ExportInfo[] = [{ name: 'Foo', kind: 'reExport', isDefault: false }];
    const violations = roleSuffixRule.evaluate(
      makeAnalysis({
        file,
        exports: reExports,
        isReExportOnly: true,
        primaryExport: reExports[0],
      })
    );
    expect(violations).toEqual([]);
  });

  // ---------------------------------------------------------------
  // No exports → skip
  // ---------------------------------------------------------------
  it('file with no exports → skip', () => {
    const file = makeFile('src/ui/components/empty.ts', '.ts');
    const violations = roleSuffixRule.evaluate(
      makeAnalysis({
        file,
        exports: [],
        primaryExport: null,
      })
    );
    expect(violations).toEqual([]);
  });
});

describe('detectSingleRole', () => {
  it('returns "types" for type/interface-only exports', () => {
    expect(detectSingleRole(typeExports)).toBe('types');
  });

  it('returns "constants" for const-only exports', () => {
    expect(detectSingleRole(constExports)).toBe('constants');
  });

  it('returns "utils" for function-only exports', () => {
    expect(detectSingleRole(funcExports)).toBe('utils');
  });

  it('returns null for mixed exports', () => {
    const mixed: ExportInfo[] = [
      { name: 'Foo', kind: 'type', isDefault: false },
      { name: 'bar', kind: 'const', isDefault: false },
    ];
    expect(detectSingleRole(mixed)).toBeNull();
  });

  it('ignores reExport entries when detecting role', () => {
    const withReExport: ExportInfo[] = [
      { name: 'Foo', kind: 'type', isDefault: false },
      { name: 'Bar', kind: 'reExport', isDefault: false },
    ];
    expect(detectSingleRole(withReExport)).toBe('types');
  });

  it('returns null for empty exports', () => {
    expect(detectSingleRole([])).toBeNull();
  });
});

describe('hasCorrectSuffix', () => {
  it('recognises *Types suffix', () => {
    expect(hasCorrectSuffix('shapeDialogStepTypes', 'types')).toBe(true);
  });

  it('recognises standalone "types"', () => {
    expect(hasCorrectSuffix('types', 'types')).toBe(true);
  });

  it('rejects wrong suffix for types', () => {
    expect(hasCorrectSuffix('shapeDialogStepProps', 'types')).toBe(false);
  });

  it('recognises *Constants suffix', () => {
    expect(hasCorrectSuffix('locationMapPreviewConstants', 'constants')).toBe(true);
  });

  it('recognises standalone "constants"', () => {
    expect(hasCorrectSuffix('constants', 'constants')).toBe(true);
  });

  it('recognises *Utils suffix', () => {
    expect(hasCorrectSuffix('shapeUtils', 'utils')).toBe(true);
  });

  it('recognises standalone "utils"', () => {
    expect(hasCorrectSuffix('utils', 'utils')).toBe(true);
  });
});

describe('buildSuggestedRename', () => {
  it('strips Props suffix and appends Types', () => {
    const result = buildSuggestedRename('ShapeDialogStepProps', 'types', 'components');
    expect(result).toBe('shapeDialogStepTypes.ts');
  });

  it('strips Helpers suffix and appends Utils', () => {
    const result = buildSuggestedRename('ShapeHelpers', 'utils', 'components');
    expect(result).toBe('shapeUtils.ts');
  });

  it('strips Consts suffix and appends Constants', () => {
    const result = buildSuggestedRename('ShapeConsts', 'constants', 'components');
    expect(result).toBe('shapeConstants.ts');
  });

  it('uses standalone form for banned generic name "helper"', () => {
    const result = buildSuggestedRename('helper', 'utils', 'components');
    expect(result).toBe('utils.ts');
  });
});
