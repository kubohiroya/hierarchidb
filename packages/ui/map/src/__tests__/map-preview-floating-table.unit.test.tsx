import type { GridCellEditParams, GridCellEditStateChange, GridColumn } from '@hierarchidb/ui-grid';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureTableEditConfig } from '../preview/featureTableEditContract.js';

const gridProps: Array<Record<string, unknown>> = [];

vi.mock('@hierarchidb/ui-grid', () => ({
  TanstackDataGrid: (props: Record<string, unknown>) => {
    gridProps.push(props);
    return null;
  },
  buildGridStateKey: (base: string, suffix: string) => `${base}:${suffix}`,
  loadGridStateValue: () => undefined,
  saveGridStateValue: () => {},
}));

import { MapPreviewFloatingTable } from '../preview/MapPreviewFloatingTable';

type TestRow = { id: number; name: string; derivedLabel: string };

const columns: GridColumn<TestRow>[] = [
  { id: 'name', label: 'Name' },
  { id: 'derivedLabel', label: 'Derived Label' },
];

const rows: TestRow[] = [{ id: 1, name: 'Alpha', derivedLabel: 'Display only' }];

const editableConfig = (onCellEditRequest = vi.fn()): FeatureTableEditConfig<TestRow> => ({
  editOrigin: 'preview-table',
  editableColumns: [
    {
      columnId: 'name',
      source: {
        stagingRootNodeId: 'root-1',
        featureNodeId: (row) => `feature-${row.id}`,
        entityType: 'location',
        entityId: (row) => `location-${row.id}`,
        fieldPath: 'name',
      },
      valueKind: 'string',
      dependencyRole: 'reference-source',
      dependencyStatus: 'active',
      parse: 'builtin',
      validate: 'builtin',
    },
  ],
  onCellEditRequest,
});

describe('MapPreviewFloatingTable', () => {
  beforeEach(() => {
    gridProps.length = 0;
  });

  it('passes maxHeight to TanstackDataGrid', () => {
    render(<MapPreviewFloatingTable title="Test" rows={rows} columns={columns} maxHeight={360} />);
    const props = gridProps[0] as { maxHeight?: number };
    expect(props.maxHeight).toBe(360);
  });

  it('marks only explicitly mapped source columns editable', () => {
    render(
      <MapPreviewFloatingTable
        title="Test"
        rows={rows}
        columns={columns}
        featureTableEdit={editableConfig()}
      />
    );

    const props = gridProps[0] as { columns: GridColumn<TestRow>[] };
    expect(props.columns.find((column) => column.id === 'name')?.editable).toBe(true);
    expect(props.columns.find((column) => column.id === 'derivedLabel')?.editable).toBeUndefined();
  });

  it('emits a FeatureCellEditRequest without mutating row data', async () => {
    const onCellEditRequest = vi.fn(async () => ({
      ok: true as const,
      refreshHint: {
        entityId: 'location-1',
        fieldPath: 'name',
        dependencyEdgeIds: ['edge-1'],
      },
    }));
    render(
      <MapPreviewFloatingTable
        title="Test"
        rows={rows}
        columns={columns}
        featureTableEdit={editableConfig(onCellEditRequest)}
      />
    );

    const props = gridProps[0] as {
      onCellEdit: (params: GridCellEditParams<TestRow>) => Promise<unknown>;
    };
    const result = await props.onCellEdit({
      row: rows[0],
      rowId: 1,
      columnId: 'name',
      previousValue: 'Alpha',
      value: 'Beta',
    });

    expect(result).toEqual({
      ok: true,
      refreshHint: {
        entityId: 'location-1',
        fieldPath: 'name',
        dependencyEdgeIds: ['edge-1'],
      },
    });
    expect(onCellEditRequest).toHaveBeenCalledWith({
      stagingRootNodeId: 'root-1',
      featureNodeId: 'feature-1',
      entityType: 'location',
      entityId: 'location-1',
      fieldPath: 'name',
      previousValue: 'Alpha',
      nextValue: 'Beta',
      dependencyStatus: 'active',
      editOrigin: 'preview-table',
    });
    expect(rows[0].name).toBe('Alpha');
  });

  it('passes edit lifecycle events through to the table host', () => {
    const onCellEditStateChange = vi.fn<(state: GridCellEditStateChange<TestRow>) => void>();
    render(
      <MapPreviewFloatingTable
        title="Test"
        rows={rows}
        columns={columns}
        featureTableEdit={editableConfig()}
        onCellEditStateChange={onCellEditStateChange}
      />
    );

    const props = gridProps[0] as {
      onCellEditStateChange?: (state: GridCellEditStateChange<TestRow>) => void;
    };
    props.onCellEditStateChange?.({
      row: rows[0],
      rowId: 1,
      columnId: 'name',
      previousValue: 'Alpha',
      value: 'Rejected',
      phase: 'rollback',
      error: 'typed failure',
    });

    expect(onCellEditStateChange).toHaveBeenCalledWith({
      row: rows[0],
      rowId: 1,
      columnId: 'name',
      previousValue: 'Alpha',
      value: 'Rejected',
      phase: 'rollback',
      error: 'typed failure',
    });
  });

  it('returns typed failures so the grid keeps the displayed source value authoritative', async () => {
    const onCellEditRequest = vi.fn(async () => ({
      ok: false as const,
      error: 'dependency-status-mismatch',
    }));
    render(
      <MapPreviewFloatingTable
        title="Map UI"
        rows={rows}
        columns={columns}
        featureTableEdit={editableConfig(onCellEditRequest)}
      />
    );

    const props = gridProps[0] as {
      onCellEdit: (params: GridCellEditParams<TestRow>) => Promise<unknown>;
    };
    const result = await props.onCellEdit({
      row: rows[0],
      rowId: 1,
      columnId: 'name',
      previousValue: 'Alpha',
      value: 'Rejected',
    });

    expect(result).toEqual({
      ok: false,
      error: 'dependency-status-mismatch',
    });
    expect(rows[0].name).toBe('Alpha');
  });

  it('refuses to emit requests for columns without explicit source mapping', async () => {
    const onCellEditRequest = vi.fn();
    render(
      <MapPreviewFloatingTable
        title="Test"
        rows={rows}
        columns={columns}
        featureTableEdit={editableConfig(onCellEditRequest)}
      />
    );

    const props = gridProps[0] as {
      onCellEdit: (params: GridCellEditParams<TestRow>) => Promise<unknown>;
    };
    const result = await props.onCellEdit({
      row: rows[0],
      rowId: 1,
      columnId: 'derivedLabel',
      previousValue: 'Display only',
      value: 'Edited',
    });

    expect(result).toEqual({
      ok: false,
      error: 'Column "derivedLabel" does not define a feature source mapping.',
    });
    expect(onCellEditRequest).not.toHaveBeenCalled();
    expect(rows[0].derivedLabel).toBe('Display only');
  });

  it('keeps read-only behavior when editable metadata is absent', () => {
    render(<MapPreviewFloatingTable title="Test" rows={rows} columns={columns} />);

    const props = gridProps[0] as {
      columns: GridColumn<TestRow>[];
      onCellEdit?: unknown;
    };
    expect(props.columns.some((column) => column.editable)).toBe(false);
    expect(props.onCellEdit).toBeUndefined();
  });
});
