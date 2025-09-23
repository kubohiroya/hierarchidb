import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useHeadlessDialogFrame } from '../hooks.js';

describe('useHeadlessDialogFrame', () => {
  it('updates display mode state and notifies listeners', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useHeadlessDialogFrame({
      initialDisplayMode: 'normal',
      onDisplayModeChange: onChange,
    }));

    expect(result.current.displayMode).toBe('normal');
    expect(result.current.frameProps.displayMode).toBe('normal');

    act(() => {
      result.current.setDisplayMode('maximize');
    });

    expect(result.current.displayMode).toBe('maximize');
    expect(result.current.frameProps.displayMode).toBe('maximize');
    expect(onChange).toHaveBeenLastCalledWith('maximize');

    act(() => {
      result.current.frameProps.onDisplayModeChange?.('full-screen');
    });

    expect(result.current.displayMode).toBe('full-screen');
    expect(result.current.frameProps.displayMode).toBe('full-screen');
    expect(onChange).toHaveBeenLastCalledWith('full-screen');
  });

  it('tracks header and footer visibility via frame props', () => {
    const { result } = renderHook(() => useHeadlessDialogFrame());

    expect(result.current.frameProps.headerDisplayMode).toBe('visible');
    expect(result.current.frameProps.footerDisplayMode).toBe('visible');

    act(() => {
      result.current.frameProps.onHeaderVisibilityChange?.(false);
      result.current.frameProps.onFooterVisibilityChange?.(false);
    });

    expect(result.current.frameProps.headerDisplayMode).toBe('hidden');
    expect(result.current.frameProps.footerDisplayMode).toBe('hidden');
  });
});
