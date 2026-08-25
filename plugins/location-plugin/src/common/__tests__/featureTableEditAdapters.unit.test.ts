import { buildFeatureCellEditRequest, findFeatureTableEditableColumn } from '@hierarchidb/ui-map';
import { describe, expect, it } from 'vitest';
import { createLocationFeatureTableEditAdapter } from '../featureTableEditAdapters.js';

describe('location feature table edit adapter', () => {
  const adapter = createLocationFeatureTableEditAdapter({
    stagingRootNodeId: (row) => String(row.id),
    featureNodeId: 'location-node',
    dependencyStatus: 'none',
  });

  it('exposes editable source fields with write targets and excludes derived columns', () => {
    expect(adapter.editableColumns.map((column) => column.columnId)).toEqual([
      'name',
      'longitude',
      'latitude',
      'admin0Name',
      'admin1Name',
      'admin2Name',
    ]);
    expect(adapter.getEditableColumn('centroid')).toEqual({
      ok: false,
      error: {
        code: 'not-editable-column',
        columnId: 'centroid',
        message: 'Column "centroid" is not editable.',
      },
    });
    expect(
      findFeatureTableEditableColumn([...adapter.editableColumns], 'routeEndpointLabel')
    ).toBeUndefined();
  });

  it('builds source mapped requests for location coordinates', () => {
    const column = adapter.getEditableColumn('longitude');
    expect(column.ok).toBe(true);
    if (!column.ok) return;

    const request = buildFeatureCellEditRequest(
      {
        row: { id: 'staging-a', pointId: 'point-a', longitude: 139.7 },
        rowId: 'point-a',
        columnId: 'longitude',
        previousValue: 139.7,
        value: 140,
      },
      'preview-table',
      column.value
    );

    expect(request).toEqual({
      stagingRootNodeId: 'staging-a',
      featureNodeId: 'location-node',
      entityType: 'location',
      entityId: 'point-a',
      fieldPath: 'data.longitude',
      previousValue: 139.7,
      nextValue: 140,
      dependencyStatus: 'none',
      editOrigin: 'preview-table',
    });
  });

  it('returns typed parser and validator failures for invalid numeric values', () => {
    expect(adapter.parseCellValue('latitude', 'not-a-number')).toEqual({
      ok: false,
      error: {
        code: 'invalid-number-value',
        columnId: 'latitude',
        message: 'Location numeric values must be finite.',
      },
    });
    expect(adapter.validateCellValue('name', '')).toEqual({
      ok: false,
      error: {
        code: 'invalid-string-value',
        columnId: 'name',
        message: 'Location text values must be non-empty.',
      },
    });
  });
});
