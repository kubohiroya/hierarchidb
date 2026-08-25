import { ROUTE_MODES } from '@hierarchidb/route-api';
import { buildFeatureCellEditRequest, findFeatureTableEditableColumn } from '@hierarchidb/ui-map';
import { describe, expect, it } from 'vitest';
import { createRouteFeatureTableEditAdapter } from '../../featureTableEditAdapters.js';

describe('route feature table edit adapter', () => {
  const adapter = createRouteFeatureTableEditAdapter({
    stagingRootNodeId: 'route-staging',
    featureNodeId: (row) => String(row.id),
    dependencyStatus: 'stale',
  });

  it('exposes route source fields and excludes derived geometry columns', () => {
    expect(adapter.editableColumns.map((column) => column.columnId)).toEqual([
      'routeName',
      'routeMode',
      'startName',
      'endName',
    ]);
    expect(adapter.getEditableColumn('distanceMeters')).toEqual({
      ok: false,
      error: {
        code: 'not-editable-column',
        columnId: 'distanceMeters',
        message: 'Column "distanceMeters" is not editable.',
      },
    });
    expect(
      findFeatureTableEditableColumn([...adapter.editableColumns], 'waypointCount')
    ).toBeUndefined();
  });

  it('builds source mapped requests for route mode', () => {
    const column = adapter.getEditableColumn('routeMode');
    expect(column.ok).toBe(true);
    if (!column.ok) return;

    const request = buildFeatureCellEditRequest(
      {
        row: { id: 'route-a', routeMode: ROUTE_MODES.ROAD },
        rowId: 'route-a',
        columnId: 'routeMode',
        previousValue: ROUTE_MODES.ROAD,
        value: ROUTE_MODES.RAILWAY,
      },
      'preview-table',
      column.value
    );

    expect(request).toEqual({
      stagingRootNodeId: 'route-staging',
      featureNodeId: 'route-a',
      entityType: 'route',
      entityId: 'route-a',
      fieldPath: 'data.routeMode',
      previousValue: ROUTE_MODES.ROAD,
      nextValue: ROUTE_MODES.RAILWAY,
      dependencyStatus: 'stale',
      editOrigin: 'preview-table',
    });
  });

  it('returns typed parser and validator failures for unsupported route modes', () => {
    expect(adapter.parseCellValue('routeMode', 'teleport')).toEqual({
      ok: false,
      error: {
        code: 'invalid-route-mode',
        columnId: 'routeMode',
        message: 'Route mode is not supported.',
      },
    });
    expect(adapter.validateCellValue('routeName', '   ')).toEqual({
      ok: false,
      error: {
        code: 'invalid-string-value',
        columnId: 'routeName',
        message: 'Route editable values must be non-empty.',
      },
    });
  });
});
