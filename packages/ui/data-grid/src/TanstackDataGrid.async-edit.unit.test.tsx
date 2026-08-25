import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { GridColumn } from './GenericDataGrid.js';
import type { GridCellEditStateChange } from './TanstackDataGrid.js';
import { TanstackDataGrid } from './TanstackDataGrid.js';

type TestRow = {
  id: string;
  name: string;
  status: string;
};

const columns: GridColumn<TestRow>[] = [
  { id: 'name', label: 'Name', editable: true },
  { id: 'status', label: 'Status', editable: true },
];

const rows: TestRow[] = [{ id: 'row-1', name: 'Alpha', status: 'Ready' }];

const openEditor = (text: string) => {
  fireEvent.doubleClick(screen.getByText(text));
  return screen.getByRole('textbox');
};

describe('TanstackDataGrid async editable cells', () => {
  it('emits start, dirty, pending, and success states for async commits', async () => {
    const onCellEdit = vi.fn(async () => ({ ok: true as const }));
    const onCellEditStateChange = vi.fn<(state: GridCellEditStateChange<TestRow>) => void>();
    const user = userEvent.setup();

    const { container } = render(
      <TanstackDataGrid
        columns={columns}
        rows={rows}
        onCellEdit={onCellEdit}
        onCellEditStateChange={onCellEditStateChange}
      />
    );

    const editor = openEditor('Alpha');
    fireEvent.change(editor, { target: { value: 'Beta' } });
    await user.keyboard('{Enter}');
    fireEvent.blur(editor);

    await waitFor(() => expect(onCellEdit).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(onCellEditStateChange.mock.calls.map(([state]) => state.phase)).toEqual([
        'start',
        'dirty',
        'pending',
        'success',
      ])
    );

    expect(onCellEdit).toHaveBeenCalledWith({
      row: rows[0],
      rowId: 'row-1',
      columnId: 'name',
      previousValue: 'Alpha',
      value: 'Beta',
    });
    expect(container.querySelector('[data-edit-state="pending"]')).toBeNull();
  });

  it('keeps the source value authoritative and emits failure plus rollback states', async () => {
    const onCellEdit = vi.fn(async () => ({ ok: false as const, error: 'rejected' }));
    const onCellEditStateChange = vi.fn<(state: GridCellEditStateChange<TestRow>) => void>();
    const user = userEvent.setup();

    const { container } = render(
      <TanstackDataGrid
        columns={columns}
        rows={rows}
        onCellEdit={onCellEdit}
        onCellEditStateChange={onCellEditStateChange}
      />
    );

    const editor = openEditor('Alpha');
    fireEvent.change(editor, { target: { value: 'Rejected' } });
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onCellEdit).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(onCellEditStateChange.mock.calls.map(([state]) => state.phase)).toContain('rollback')
    );

    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(container.querySelector('[data-edit-state="failure"]')).toBeTruthy();
    expect(onCellEditStateChange.mock.calls.map(([state]) => state.phase)).toEqual([
      'start',
      'dirty',
      'pending',
      'failure',
      'rollback',
    ]);
  });

  it('cancels edits without emitting a commit request', async () => {
    const onCellEdit = vi.fn();
    const onCellEditStateChange = vi.fn<(state: GridCellEditStateChange<TestRow>) => void>();
    const user = userEvent.setup();

    render(
      <TanstackDataGrid
        columns={columns}
        rows={rows}
        onCellEdit={onCellEdit}
        onCellEditStateChange={onCellEditStateChange}
      />
    );

    const editor = openEditor('Alpha');
    fireEvent.change(editor, { target: { value: 'Draft' } });
    await user.keyboard('{Escape}');
    fireEvent.blur(editor);

    expect(onCellEdit).not.toHaveBeenCalled();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(onCellEditStateChange.mock.calls.map(([state]) => state.phase)).toEqual([
      'start',
      'dirty',
      'cancel',
    ]);
  });

  it('prevents overlapping edits while a commit is pending', async () => {
    let resolveCommit: ((value: { ok: true }) => void) | undefined;
    const user = userEvent.setup();
    const onCellEdit = vi.fn(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          resolveCommit = resolve;
        })
    );

    const { container } = render(
      <TanstackDataGrid columns={columns} rows={rows} onCellEdit={onCellEdit} />
    );

    const editor = openEditor('Alpha');
    fireEvent.change(editor, { target: { value: 'Pending' } });
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(container.querySelector('[data-edit-state="pending"]')).toBeTruthy()
    );

    fireEvent.doubleClick(screen.getByText('Ready'));
    expect(screen.queryByDisplayValue('Ready')).toBeNull();

    resolveCommit?.({ ok: true });
    await waitFor(() => expect(container.querySelector('[data-edit-state="pending"]')).toBeNull());
  });
});
