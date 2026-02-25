import { describe, expect, it } from 'vitest';
import {
  buildShapeLayerEntryId,
  buildShapeLayerShortId,
  buildSourceLayerName,
  buildShapeSourceLayerName,
  parseShapeSourceLayerName,
  resolveLayerSetEntries,
  getLayerSetDefinition,
} from '../layerSetDefinitions';

describe('layerSetDefinitions sourceLayer parsing', () => {
  it('resolves canonical source layer names used by shape tiles', () => {
    const shapeSet = getLayerSetDefinition('shape');
    expect(shapeSet).toBeTruthy();
    const resolved = resolveLayerSetEntries(
      ['0', '1-b', '2'],
      shapeSet!,
    );
    const byId = new Map(resolved.map((entry) => [entry.id, entry.sourceLayer ?? null]));
    expect(byId.get(buildShapeLayerEntryId(0, false))).toBe('0');
    expect(byId.get(buildShapeLayerEntryId(1, true))).toBe('1-b');
    expect(byId.get(buildShapeLayerEntryId(2, false))).toBe('2');
    expect(buildSourceLayerName(1, false)).toBe('1');
    expect(buildShapeSourceLayerName(1, 'boundary')).toBe('1-b');
  });

  it('resolves shape layer entries by canonical name match', () => {
    const shapeSet = getLayerSetDefinition('shape');
    expect(shapeSet).toBeTruthy();
    const resolved = resolveLayerSetEntries(
      ['0', '0-b', '1', '2-b'],
      shapeSet!,
    );
    const byId = new Map(resolved.map((entry) => [entry.id, entry.sourceLayer ?? null]));
    expect(byId.get(buildShapeLayerEntryId(0, false))).toBe('0');
    expect(byId.get(buildShapeLayerEntryId(0, true))).toBe('0-b');
    expect(byId.get(buildShapeLayerEntryId(1, false))).toBe('1');
    expect(byId.get(buildShapeLayerEntryId(2, true))).toBe('2-b');
  });

  it('does not cross-match between fill and boundary modes', () => {
    const shapeSet = getLayerSetDefinition('shape');
    expect(shapeSet).toBeTruthy();

    const resolvedFillOnly = resolveLayerSetEntries(
      ['0', '1', '2'],
      shapeSet!,
    );
    const fillById = new Map(resolvedFillOnly.map((entry) => [entry.id, entry.sourceLayer ?? null]));
    expect(fillById.get(buildShapeLayerEntryId(0, false))).toBe('0');
    expect(fillById.get(buildShapeLayerEntryId(0, true))).toBeNull();
    expect(fillById.get(buildShapeLayerEntryId(1, false))).toBe('1');
    expect(fillById.get(buildShapeLayerEntryId(2, false))).toBe('2');

    const resolvedBoundaryOnly = resolveLayerSetEntries(
      ['0-b', '1-b', '2-b'],
      shapeSet!,
    );
    const boundaryById = new Map(resolvedBoundaryOnly.map((entry) => [entry.id, entry.sourceLayer ?? null]));
    expect(boundaryById.get(buildShapeLayerEntryId(0, true))).toBe('0-b');
    expect(boundaryById.get(buildShapeLayerEntryId(1, true))).toBe('1-b');
    expect(boundaryById.get(buildShapeLayerEntryId(2, true))).toBe('2-b');
  });

  it('filters shape layers by allowed admin levels', () => {
    const shapeSet = getLayerSetDefinition('shape');
    expect(shapeSet).toBeTruthy();
    const resolved = resolveLayerSetEntries(
      ['0', '0-b', '1', '1-b', '2', '2-b'],
      shapeSet!,
      { allowedAdminLevels: [0, 1] },
    );
    const byId = new Map(resolved.map((entry) => [entry.id, entry.sourceLayer ?? null]));
    expect(byId.get(buildShapeLayerEntryId(0, false))).toBe('0');
    expect(byId.get(buildShapeLayerEntryId(0, true))).toBe('0-b');
    expect(byId.get(buildShapeLayerEntryId(1, false))).toBe('1');
    expect(byId.get(buildShapeLayerEntryId(1, true))).toBe('1-b');
    expect(byId.get(buildShapeLayerEntryId(2, false))).toBeNull();
    expect(byId.get(buildShapeLayerEntryId(2, true))).toBeNull();
  });

  it('ignores malformed admin/outline tokens as source layer names', () => {
    const shapeSet = getLayerSetDefinition('shape');
    expect(shapeSet).toBeTruthy();

    const resolved = resolveLayerSetEntries(
      ['shape-adm', 'admin-level-1', 'admin0-buffer', 'shape-admX'],
      shapeSet!,
    );
    const byId = new Map(resolved.map((entry) => [entry.id, entry.sourceLayer ?? null]));
    expect(byId.get(buildShapeLayerEntryId(0, false))).toBeNull();
    expect(byId.get(buildShapeLayerEntryId(1, false))).toBeNull();
    expect(byId.get(buildShapeLayerEntryId(2, true))).toBeNull();
  });

  it('treats an explicitly empty allowedAdminLevels list as filtering everything out', () => {
    const shapeSet = getLayerSetDefinition('shape');
    expect(shapeSet).toBeTruthy();

    const resolved = resolveLayerSetEntries(
      ['0', '0-b', '1', '1-b'],
      shapeSet!,
      { allowedAdminLevels: [] },
    );
    const byId = new Map(resolved.map((entry) => [entry.id, entry.sourceLayer ?? null]));
    expect(byId.get(buildShapeLayerEntryId(0, false))).toBeNull();
    expect(byId.get(buildShapeLayerEntryId(0, true))).toBeNull();
    expect(byId.get(buildShapeLayerEntryId(1, false))).toBeNull();
    expect(byId.get(buildShapeLayerEntryId(1, true))).toBeNull();
  });

  it('parses only canonical shape source layer names', () => {
    expect(parseShapeSourceLayerName('2')).toEqual({ adminLevel: 2, boundary: 'f' });
    expect(parseShapeSourceLayerName('2-b')).toEqual({ adminLevel: 2, boundary: 'b' });
    expect(parseShapeSourceLayerName('02-b')).toBeUndefined();
    expect(parseShapeSourceLayerName('s-2-b')).toBeUndefined();
    expect(parseShapeSourceLayerName('s-2-f')).toBeUndefined();
    expect(parseShapeSourceLayerName('shape-adm-2')).toBeUndefined();
    expect(parseShapeSourceLayerName('2-b-extra')).toBeUndefined();
  });

  it('builds a short layer identifier by admin level and boundary symbol', () => {
    expect(buildShapeLayerShortId(0, true)).toBe('0-b');
    expect(buildShapeLayerShortId(2, false)).toBe('2-f');
  });

  it('matches source names after canonical normalization', () => {
    const shapeSet = getLayerSetDefinition('shape');
    expect(shapeSet).toBeTruthy();
    const resolved = resolveLayerSetEntries(
      ['1-b', '2'],
      shapeSet!,
    );
    const byId = new Map(resolved.map((entry) => [entry.id, entry.sourceLayer ?? null]));
    expect(byId.get(buildShapeLayerEntryId(1, true))).toBe('1-b');
    expect(byId.get(buildShapeLayerEntryId(2, false))).toBe('2');
    expect(byId.get(buildShapeLayerEntryId(1, false))).toBeNull();
  });
}); 
