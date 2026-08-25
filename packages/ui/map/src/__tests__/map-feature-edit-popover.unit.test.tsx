import type { GridColumn } from '@hierarchidb/ui-grid';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FeatureTableEditConfig } from '../preview/featureTableEditContract.js';
import {
  commitMapFeaturePopoverEdit,
  MapFeatureEditPopover,
} from '../preview/MapFeatureEditPopover.js';

type TestRow = {
  id: number;
  name: string;
  derivedLabel: string;
};

const row: TestRow = {
  id: 1,
  name: 'Alpha',
  derivedLabel: 'Display only',
};

const columns: GridColumn<TestRow>[] = [
  { id: 'name', label: 'Name' },
  { id: 'derivedLabel', label: 'Derived Label' },
];

const editableConfig = (onCellEditRequest = vi.fn()): FeatureTableEditConfig<TestRow> => ({
  editOrigin: 'preview-table',
  editableColumns: [
    {
      columnId: 'name',
      source: {
        stagingRootNodeId: 'root-1',
        featureNodeId: (sourceRow) => `feature-${sourceRow.id}`,
        entityType: 'location',
        entityId: (sourceRow) => `location-${sourceRow.id}`,
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

describe('MapFeatureEditPopover', () => {
  it('commits popover edits through the shared FeatureCellEditRequest flow', async () => {
    const onCellEditRequest = vi.fn(async () => ({ ok: true as const }));
    const onCellEditStateChange = vi.fn();

    render(
      <MapFeatureEditPopover
        open
        row={row}
        columns={columns}
        featureTableEdit={editableConfig(onCellEditRequest)}
        onCellEditStateChange={onCellEditStateChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Beta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onCellEditRequest).toHaveBeenCalledTimes(1));
    expect(onCellEditRequest).toHaveBeenCalledWith({
      stagingRootNodeId: 'root-1',
      featureNodeId: 'feature-1',
      entityType: 'location',
      entityId: 'location-1',
      fieldPath: 'name',
      previousValue: 'Alpha',
      nextValue: 'Beta',
      dependencyStatus: 'active',
      editOrigin: 'map-feature-popover',
    });
    expect(onCellEditStateChange.mock.calls.map(([state]) => state.phase)).toEqual([
      'start',
      'dirty',
      'pending',
      'success',
    ]);
    expect(row.name).toBe('Alpha');
  });

  it('rolls back displayed values and emits typed failure context when commit fails', async () => {
    const onCellEditRequest = vi.fn(async () => ({ ok: false as const, error: 'typed failure' }));
    const onCellEditStateChange = vi.fn();

    render(
      <MapFeatureEditPopover
        open
        row={row}
        columns={columns}
        featureTableEdit={editableConfig(onCellEditRequest)}
        onCellEditStateChange={onCellEditStateChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rejected' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('typed failure');
    expect(screen.getByLabelText('Name')).toHaveValue('Alpha');
    expect(onCellEditStateChange.mock.calls.map(([state]) => state.phase)).toEqual([
      'start',
      'dirty',
      'pending',
      'failure',
      'rollback',
    ]);
    expect(onCellEditStateChange.mock.calls.at(-1)?.[0]).toMatchObject({
      phase: 'rollback',
      value: 'Alpha',
      error: 'typed failure',
    });
  });

  it('cancels popover edits without emitting commit requests', () => {
    const onCellEditRequest = vi.fn();
    const onCellEditStateChange = vi.fn();

    render(
      <MapFeatureEditPopover
        open
        row={row}
        columns={columns}
        featureTableEdit={editableConfig(onCellEditRequest)}
        onCellEditStateChange={onCellEditStateChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCellEditRequest).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name')).toHaveValue('Alpha');
    expect(onCellEditStateChange.mock.calls.map(([state]) => state.phase)).toEqual([
      'start',
      'dirty',
      'cancel',
    ]);
  });

  it('does not emit edit requests for columns without source mapping', async () => {
    const onCellEditRequest = vi.fn();

    const result = await commitMapFeaturePopoverEdit(
      {
        row,
        rowId: row.id,
        columnId: 'derivedLabel',
        previousValue: 'Display only',
        value: 'Edited',
      },
      editableConfig(onCellEditRequest)
    );

    expect(result).toEqual({
      ok: false,
      error: 'Column "derivedLabel" does not define a feature source mapping.',
    });
    expect(onCellEditRequest).not.toHaveBeenCalled();
  });

  it('keeps read-only popover behavior when editable metadata is absent', () => {
    const onClose = vi.fn();

    render(<MapFeatureEditPopover open row={row} columns={columns} onClose={onClose} />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Display only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
