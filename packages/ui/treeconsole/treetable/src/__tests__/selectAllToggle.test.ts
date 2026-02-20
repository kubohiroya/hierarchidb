import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTreeTableSelectionOverlay } from '~/components/hooks/useTreeTableSelectionOverlay';
import type { TreeTableController } from '~/types';

describe('useTreeTableSelectionOverlay', () => {
  it('invokes controller to clear selections when selectAll is toggled off', () => {
    const onNodeSelect = vi.fn();
    const controller = { onNodeSelect } as unknown as TreeTableController;

    const data = [
      { id: 'alpha' },
      { id: 'beta' },
    ] as any[];

    const initialRowSelection: Record<string, boolean> = {
      alpha: true,
      beta: true,
    };

    const { rerender } = renderHook(
      ({ selectAll, rowSelection }) =>
        useTreeTableSelectionOverlay({
          data,
          rowSelection,
          selectAll,
          selectAllHydrated: true,
          setSelectAll: vi.fn(),
          controller,
          visibleData: data,
          getDescendants: () => new Set(),
        }),
      {
        initialProps: {
          selectAll: true,
          rowSelection: initialRowSelection,
        },
      },
    );

    onNodeSelect.mockClear();

    rerender({
      selectAll: false,
      rowSelection: initialRowSelection,
    });

    expect(onNodeSelect).toHaveBeenCalledWith(['alpha', 'beta'], false);
  });
});
