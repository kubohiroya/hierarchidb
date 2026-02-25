import { describe, expect, it } from 'vitest';
import {
  buildShapeLayerEntryId,
  parseSourceLayerName,
  resolveLayerSetEntries,
  getLayerSetDefinition,
} from '../layerSetDefinitions';

describe('layerSetDefinitions sourceLayer parsing', () => {
  it('accepts canonical source layer names used by shape tiles', () => {
    expect(parseSourceLayerName('admin0')).toEqual({
      sourceLayerName: 'admin0',
      adminLevel: 0,
      layerBoundary: 'f',
    });
    expect(parseSourceLayerName('admin1-boundary')).toEqual({
      sourceLayerName: 'admin1-boundary',
      adminLevel: 1,
      layerBoundary: 'b',
    });
    expect(parseSourceLayerName('shape-adm0')).toEqual({
      sourceLayerName: 'admin0',
      adminLevel: 0,
      layerBoundary: 'f',
    });
    expect(parseSourceLayerName('Shape_Admin1-FILL')).toEqual({
      sourceLayerName: 'admin1',
      adminLevel: 1,
      layerBoundary: 'f',
    });
    expect(parseSourceLayerName('ADM2-Boundary')).toEqual({
      sourceLayerName: 'admin2-boundary',
      adminLevel: 2,
      layerBoundary: 'b',
    });
  });

  it('rejects unsupported source layer names', () => {
    expect(parseSourceLayerName('adm-2')).toBeUndefined();
    expect(parseSourceLayerName('adminx')).toBeUndefined();
    expect(parseSourceLayerName('admin0-buffer')).toBeUndefined();
    expect(parseSourceLayerName('shape-adm')).toBeUndefined();
  });

  it('resolves shape layer entries through parse normalization', () => {
    const shapeSet = getLayerSetDefinition('shape');
    expect(shapeSet).toBeTruthy();
    const resolved = resolveLayerSetEntries(
      ['admin0', 'admin0-boundary', 'admin1', 'admin2-boundary'],
      shapeSet!,
    );
    const byId = new Map(resolved.map((entry) => [entry.id, entry.sourceLayer ?? null]));
    expect(byId.get(buildShapeLayerEntryId(0, false))).toBe('admin0');
    expect(byId.get(buildShapeLayerEntryId(0, true))).toBe('admin0-boundary');
    expect(byId.get(buildShapeLayerEntryId(1, false))).toBe('admin1');
    expect(byId.get(buildShapeLayerEntryId(2, true))).toBe('admin2-boundary');
  });
});
