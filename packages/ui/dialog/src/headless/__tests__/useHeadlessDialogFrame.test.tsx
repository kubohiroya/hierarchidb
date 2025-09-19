import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useHeadlessDialogFrame } from '../hooks.js';

describe('useHeadlessDialogFrame', () => {
  it('updates display mode state and notifies listeners', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useHeadlessDialogFrame({
      initialDisplayMode: 'standard',
      onDisplayModeChange: onChange,
    }));

    expect(result.current.displayMode).toBe('standard');
    expect(result.current.frameProps.displayMode).toBe('standard');

    act(() => {
      result.current.setDisplayMode('maximized');
    });

    expect(result.current.displayMode).toBe('maximized');
    expect(result.current.frameProps.displayMode).toBe('maximized');
    expect(onChange).toHaveBeenLastCalledWith('maximized');

    act(() => {
      result.current.frameProps.onDisplayModeChange?.('fullscreen');
    });

    expect(result.current.displayMode).toBe('fullscreen');
    expect(result.current.frameProps.displayMode).toBe('fullscreen');
    expect(onChange).toHaveBeenLastCalledWith('fullscreen');
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

