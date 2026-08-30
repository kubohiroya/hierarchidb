import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  VirtualizedTextLogDialog,
  type VirtualizedTextLogRow,
} from '../VirtualizedTextLogDialog.js';

const createLogRow = (index: number, text = `line ${index}`): VirtualizedTextLogRow => ({
  kind: 'log',
  rowId: `task:0:${index}`,
  taskId: 'task',
  connectionEpoch: 0,
  ordinal: index,
  sequence: index,
  timestamp: '2026-08-30T00:00:00Z',
  stream: index % 2 === 0 ? 'stdout' : 'stderr',
  text,
});

const createRows = (count: number): VirtualizedTextLogRow[] =>
  Array.from({ length: count }, (_, index) =>
    createLogRow(index, index === 1500 ? 'needle target line' : `line ${index}`)
  );

const renderDialog = (rows: readonly VirtualizedTextLogRow[]) =>
  render(
    <VirtualizedTextLogDialog
      open={true}
      rows={rows}
      onClose={() => {}}
      viewportHeight={112}
      rowHeight={28}
    />
  );

describe('VirtualizedTextLogDialog', () => {
  it('keeps mounted log rows bounded for large runtime buffers', async () => {
    renderDialog(createRows(5_000));

    await waitFor(() => {
      const mountedRows = screen.getAllByTestId('log-row');
      expect(mountedRows.length).toBeGreaterThan(0);
      expect(mountedRows.length).toBeLessThan(32);
    });
  });

  it('renders reconnect gaps and limit markers distinctly from server text', () => {
    renderDialog([
      createLogRow(0, 'server output'),
      {
        kind: 'gap',
        rowId: 'task:1:1',
        taskId: 'task',
        connectionEpoch: 1,
        ordinal: 1,
        reason: 'reconnected',
      },
      {
        kind: 'limit',
        rowId: 'task:1:2',
        taskId: 'task',
        connectionEpoch: 1,
        ordinal: 2,
        reason: 'LOG_BUFFER_LIMIT_REACHED',
      },
    ]);

    expect(screen.getByText('server output')).toBeInTheDocument();
    expect(
      screen.getByText('Connection resumed. Logs emitted while disconnected are unavailable.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Log buffer limit reached. Additional output is not captured.')
    ).toBeInTheDocument();
    expect(screen.getByText('GAP')).toBeInTheDocument();
    expect(screen.getByText('LIMIT')).toBeInTheDocument();
  });

  it('shows the tail action when the user leaves the final row and resumes following on click', async () => {
    const user = userEvent.setup();
    renderDialog(createRows(120));
    const list = screen.getByRole('list', { name: 'Task log rows' });
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 120 * 28 });
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 112 });
    Object.defineProperty(list, 'scrollTop', { configurable: true, value: 0, writable: true });

    fireEvent.scroll(list);

    const tailButton = await screen.findByRole('button', { name: 'Tail' });
    await user.click(tailButton);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Tail' })).not.toBeInTheDocument()
    );
  });

  it('searches case-insensitively and navigates off-screen matches cyclically', async () => {
    const user = userEvent.setup();
    renderDialog(createRows(2_000));

    await user.type(screen.getByRole('textbox', { name: 'Search log' }), 'NEEDLE');
    await waitFor(() => expect(screen.getByText('1/1')).toBeInTheDocument());
    expect(await screen.findByText('needle')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next match' }));
    expect(screen.getByText('1/1')).toBeInTheDocument();
    const current = document.querySelector('mark[data-current-match="true"]');
    expect(current).toHaveTextContent('needle');
  });

  it('preserves selected runtime row across appends while the viewport is suspended', async () => {
    const user = userEvent.setup();
    const onSelectedRowChange = vi.fn();
    const rows = createRows(80);
    const { rerender } = render(
      <VirtualizedTextLogDialog
        open={true}
        rows={rows}
        onClose={() => {}}
        onSelectedRowChange={onSelectedRowChange}
        viewportHeight={112}
        rowHeight={28}
      />
    );
    const list = screen.getByRole('list', { name: 'Task log rows' });
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 80 * 28 });
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 112 });
    Object.defineProperty(list, 'scrollTop', { configurable: true, value: 0, writable: true });
    fireEvent.scroll(list);
    await screen.findByRole('button', { name: 'Tail' });

    await waitFor(() => expect(within(list).getByText('line 79')).toBeInTheDocument());
    const firstVisibleOrdinal = screen
      .getAllByTestId('log-row')[0]
      ?.getAttribute('data-row-ordinal');
    if (firstVisibleOrdinal === undefined || firstVisibleOrdinal === null) {
      throw new Error('expected an initial mounted log row ordinal');
    }
    await user.click(within(list).getByText('line 79'));
    expect(onSelectedRowChange).toHaveBeenLastCalledWith(expect.objectContaining({ ordinal: 79 }));

    rerender(
      <VirtualizedTextLogDialog
        open={true}
        rows={[...rows, createLogRow(80, 'appended')]}
        onClose={() => {}}
        onSelectedRowChange={onSelectedRowChange}
        viewportHeight={112}
        rowHeight={28}
      />
    );

    await waitFor(() =>
      expect(screen.getByText('line 79').closest('[data-row-ordinal="79"]')).toHaveAttribute(
        'data-selected',
        'true'
      )
    );
    expect(screen.getByRole('button', { name: 'Tail' })).toBeInTheDocument();
    expect(screen.getAllByTestId('log-row')[0]).toHaveAttribute(
      'data-row-ordinal',
      firstVisibleOrdinal
    );
  });

  it('closing only calls onClose and leaves the provider buffer untouched', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const rows = createRows(3);
    render(
      <VirtualizedTextLogDialog
        open={true}
        rows={rows}
        onClose={onClose}
        viewportHeight={112}
        rowHeight={28}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Close log' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(rows).toHaveLength(3);
  });
});
