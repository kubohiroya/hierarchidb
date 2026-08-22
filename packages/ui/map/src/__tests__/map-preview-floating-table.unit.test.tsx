import type { GridColumn } from '@hierarchidb/ui-grid';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

type TestRow = { id: number; name: string };

const columns: GridColumn<TestRow>[] = [{ id: 'name', label: 'Name' }];

const rows: TestRow[] = [{ id: 1, name: 'Alpha' }];

describe('MapPreviewFloatingTable', () => {
  beforeEach(() => {
    gridProps.length = 0;
  });

  it('passes maxHeight to TanstackDataGrid', () => {
    render(<MapPreviewFloatingTable title="Test" rows={rows} columns={columns} maxHeight={360} />);
    const props = gridProps[0] as { maxHeight?: number };
    expect(props.maxHeight).toBe(360);
  });
});
