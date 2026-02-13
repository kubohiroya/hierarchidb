import { describe, expect, it } from 'vitest';
import {
  buildShapePresetDraftDataPatch,
  getShapePresetMenuEntries,
  parseCreateAction,
  resolveShapePresetNodeDefaults,
} from '../shapeCreatePresets.ts';

describe('shapeCreatePresets', () => {
  it('parses create action with shape preset id', () => {
    const parsed = parseCreateAction('create:shape::preset:world-level0');
    expect(parsed).toEqual({
      nodeType: 'shape',
      shapePresetId: 'world-level0',
    });
  });

  it('builds world level1 + CN/IN level2 selection matrix', () => {
    const patch = buildShapePresetDraftDataPatch('world-level1-cn-in-level12');
    const selection = patch.selectedArrayByCountries as Record<string, boolean[]> | undefined;

    expect(selection?.US).toEqual([false, true, false]);
    expect(selection?.CN).toEqual([false, true, true]);
    expect(selection?.IN).toEqual([false, true, true]);
  });

  it('resolves node defaults with template replacement', () => {
    const defaults = resolveShapePresetNodeDefaults('japan-level0-1', (_key, fallback) => fallback);

    expect(defaults.name).toMatch(/^Japan L0\+1 \d{4}-\d{2}-\d{2}$/);
    expect(defaults.description).toContain('Preset:');
  });

  it('includes default shape submenu item as the first entry', () => {
    const entries = getShapePresetMenuEntries();
    expect(entries[0]).toMatchObject({
      key: 'shape-preset-default',
      createType: 'shape::preset:default',
    });
  });
});
