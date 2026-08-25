import { buildFeatureCellEditRequest, findFeatureTableEditableColumn } from '@hierarchidb/ui-map';
import { describe, expect, it } from 'vitest';
import { createShapeFeatureTableEditAdapter } from '../../featureTableEditAdapters.js';

describe('shape feature table edit adapter', () => {
  const adapter = createShapeFeatureTableEditAdapter({
    stagingRootNodeId: 'shape-staging',
    featureNodeId: 'shape-node',
    dependencyStatus: 'active',
  });

  it('exposes only approved source fields and never maps derived artifact columns', () => {
    expect(adapter.editableColumns.map((column) => column.columnId)).toEqual([
      'countryName',
      'adminName',
      'adminCode',
      'dataSource',
    ]);
    expect(adapter.getEditableColumn('bbox')).toEqual({
      ok: false,
      error: {
        code: 'not-editable-column',
        columnId: 'bbox',
        message: 'Column "bbox" is not editable.',
      },
    });
    expect(findFeatureTableEditableColumn([...adapter.editableColumns], 'area')).toBeUndefined();
    expect(
      findFeatureTableEditableColumn([...adapter.editableColumns], 'vertexCount')
    ).toBeUndefined();
    expect(
      findFeatureTableEditableColumn([...adapter.editableColumns], 'polygonCount')
    ).toBeUndefined();
  });

  it('builds source mapped requests for editable columns', () => {
    const column = adapter.getEditableColumn('adminName');
    expect(column.ok).toBe(true);
    if (!column.ok) return;

    const request = buildFeatureCellEditRequest(
      {
        row: { id: 10, featureId: 'feature-10', adminName: 'Old' },
        rowId: 'feature-10',
        columnId: 'adminName',
        previousValue: 'Old',
        value: 'New',
      },
      'preview-table',
      column.value
    );

    expect(request).toEqual({
      stagingRootNodeId: 'shape-staging',
      featureNodeId: 'shape-node',
      entityType: 'shape',
      entityId: 'feature-10',
      fieldPath: 'data.adminName',
      previousValue: 'Old',
      nextValue: 'New',
      dependencyStatus: 'active',
      editOrigin: 'preview-table',
    });
  });

  it('returns typed parser and validator failures without coercion', () => {
    expect(adapter.parseCellValue('adminCode', 123)).toEqual({
      ok: false,
      error: {
        code: 'invalid-string-value',
        columnId: 'adminCode',
        message: 'Shape editable values must be strings.',
      },
    });
    expect(adapter.validateCellValue('adminName', '   ')).toEqual({
      ok: false,
      error: {
        code: 'invalid-string-value',
        columnId: 'adminName',
        message: 'Shape editable values must be non-empty strings.',
      },
    });
  });
});
