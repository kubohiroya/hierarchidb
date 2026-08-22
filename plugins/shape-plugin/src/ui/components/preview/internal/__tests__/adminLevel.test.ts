import { describe, expect, it, vi } from 'vitest';
import { parseAdminLevelValue } from '../parseAdminLevelValue';
import { collectShapeLayerAdminLevels, parseSourceKey } from '../useShapePreviewStepUtils';

vi.mock('@hierarchidb/ui-map', () => ({
  formatAdminLevelLabel: (value?: number) =>
    typeof value === 'number' && Number.isFinite(value) ? `ADM${value}` : 'Base',
}));

describe('parseAdminLevelValue', () => {
  it('normalizes numeric and ADM-level values', () => {
    expect(parseAdminLevelValue(0)).toBe(0);
    expect(parseAdminLevelValue('0')).toBe(0);
    expect(parseAdminLevelValue('ADM0')).toBe(0);
    expect(parseAdminLevelValue('admin 1')).toBe(1);
    expect(parseAdminLevelValue('Admin2')).toBe(2);
  });

  it('returns undefined for malformed values', () => {
    expect(parseAdminLevelValue(undefined)).toBeUndefined();
    expect(parseAdminLevelValue(null)).toBeUndefined();
    expect(parseAdminLevelValue('ADM0-B')).toBeUndefined();
    expect(parseAdminLevelValue('shape-adm0')).toBeUndefined();
  });
});

describe('parseSourceKey', () => {
  it('parses country and ADM-prefixed levels', () => {
    expect(parseSourceKey('jp:ADM0')).toEqual({ countryCode: 'JP', adminLevel: 0 });
  });

  it('keeps numeric levels unchanged', () => {
    expect(parseSourceKey('JP:1')).toEqual({ countryCode: 'JP', adminLevel: 1 });
  });
});

describe('collectShapeLayerAdminLevels', () => {
  it('filters feature levels by selected data source levels when available', () => {
    const dataSourceMetadataRows = [{ adminLevel: 0 }, { adminLevel: 1 }];
    const featureMetadataRows = [{ adminLevel: 0 }, { adminLevel: 1 }, { adminLevel: 2 }];
    const transformErrorRows = [{ adminLevel: 'ADM2' }, { adminLevel: '2' }];
    expect(
      collectShapeLayerAdminLevels(dataSourceMetadataRows, featureMetadataRows, transformErrorRows)
    ).toEqual([0, 1]);
  });

  it('returns all valid levels when no data source levels are available', () => {
    const dataSourceMetadataRows = [];
    const featureMetadataRows = [
      { adminLevel: 'ADM0' },
      { adminLevel: '1' },
      { adminLevel: '2' },
      { adminLevel: 'ADM1' },
    ];
    expect(collectShapeLayerAdminLevels(dataSourceMetadataRows, featureMetadataRows, [])).toEqual([
      0, 1, 2,
    ]);
  });

  it('removes invalid values and sorts numerically', () => {
    const dataSourceMetadataRows = [{ adminLevel: 'ADM1' }];
    const featureMetadataRows = [
      { adminLevel: 'ADM2' },
      { adminLevel: 'invalid' },
      { adminLevel: '1' },
      { adminLevel: 0 },
    ];
    expect(
      collectShapeLayerAdminLevels(dataSourceMetadataRows, featureMetadataRows, [
        { adminLevel: 'admin0' },
      ])
    ).toEqual([1]);
  });

  it('prefers selection levels over feature metadata when data source levels are absent', () => {
    const dataSourceMetadataRows = [];
    const featureMetadataRows = [{ adminLevel: 0 }, { adminLevel: 1 }, { adminLevel: 2 }];
    const selectionMetadataRows = [{ adminLevel: 'ADM0' }, { adminLevel: '1' }];

    expect(
      collectShapeLayerAdminLevels(
        dataSourceMetadataRows,
        featureMetadataRows,
        [],
        selectionMetadataRows
      )
    ).toEqual([0, 1]);
  });

  it('uses transform errors only for levels requested by data source/selection', () => {
    const dataSourceMetadataRows = [{ adminLevel: 'ADM1' }];
    const featureMetadataRows = [{ adminLevel: 0 }, { adminLevel: 1 }];
    const transformErrorRows = [{ adminLevel: 'ADM2' }, { adminLevel: '1' }];

    expect(
      collectShapeLayerAdminLevels(dataSourceMetadataRows, featureMetadataRows, transformErrorRows)
    ).toEqual([1]);
  });
});
