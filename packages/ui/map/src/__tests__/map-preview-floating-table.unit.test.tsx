// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { GridColumn } from '@hierarchidb/ui-grid';

const gridProps: Array<Record<string, unknown>> = [];
const savedGridState = new Map<string, unknown>();

vi.mock('@hierarchidb/ui-grid', () => ({
  TanstackDataGrid: (props: Record<string, unknown>) => {
    gridProps.push(props);
    return null;
  },
  buildGridStateKey: (base: string, suffix: string) => `${base}:${suffix}`,
  loadGridStateValue: (key: string) => savedGridState.get(key),
  saveGridStateValue: () => {},
}));

import { MapPreviewFloatingTable } from '../preview/MapPreviewFloatingTable.tsx';

type TestRow = { id: number; name: string };

const columns: GridColumn<TestRow>[] = [
  { id: 'name', label: 'Name' },
];

const rows: TestRow[] = [{ id: 1, name: 'Alpha' }];

describe('MapPreviewFloatingTable', () => {
  beforeEach(() => {
    gridProps.length = 0;
    savedGridState.clear();
  });

  it('passes maxHeight to TanstackDataGrid', () => {
    render(
      <MapPreviewFloatingTable
        title="Test"
        rows={rows}
        columns={columns}
        maxHeight={360}
      />
    );
    const props = gridProps[0] as { maxHeight?: number };
    expect(props.maxHeight).toBe(360);
  });

  it('forces status/error columns visible when error labels are provided', () => {
    savedGridState.set('shape-grid:visibility', {
      status: false,
      errorCount: false,
      repairCount: false,
      errorMessage: false,
      name: true,
    });
    render(
      <MapPreviewFloatingTable
        title="Errors"
        rows={rows}
        columns={columns}
        persistKeyBase="shape-grid"
        errorSummaryById={new Map([['1', { errorCount: 2, repairCount: 1, count: 2, messages: ['issue-a', 'issue-b'] }]])}
        errorColumnLabels={{
          status: 'Status',
          errorCount: 'Errors',
          repairCount: 'Repairs',
          errorMessage: 'Error Message',
        }}
        showRepairCountColumn
      />
    );
    const props = gridProps[gridProps.length - 1] as { columnVisibility?: Record<string, boolean> };
    expect(props.columnVisibility?.status).toBe(true);
    expect(props.columnVisibility?.errorCount).toBe(true);
    expect(props.columnVisibility?.repairCount).toBe(true);
    expect(props.columnVisibility?.errorMessage).toBe(true);
  });
});
