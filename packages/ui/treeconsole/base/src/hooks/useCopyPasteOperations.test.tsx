/**
 * @file useCopyPasteOperations.test.tsx
 * @description Regression tests for clipboard compatibility with target-aware guards.
 */

import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { NodeId } from '@hierarchidb/common-types';
import { useCopyPasteOperations } from './useCopyPasteOperations.js';

describe('useCopyPasteOperations', () => {
  it('should delegate canPasteToTarget to stateManager when provided', () => {
    const canPasteToTarget = vi.fn((targetId: NodeId) => targetId === 'allowed-target');
    const { result } = renderHook(() =>
      useCopyPasteOperations({
        stateManager: {
          canPasteToTarget,
        },
      }),
    );

    expect(result.current.canPasteToTarget('allowed-target' as NodeId)).toBe(true);
    expect(result.current.canPasteToTarget('denied-target' as NodeId)).toBe(false);
    expect(canPasteToTarget).toHaveBeenCalledWith('denied-target');
  });

  it('should fallback to stateManager.canPaste with target argument when canPasteToTarget is missing', () => {
    const canPaste = vi.fn((targetId?: NodeId) => targetId === 'allowed-target');
    const { result } = renderHook(() =>
      useCopyPasteOperations({
        stateManager: {
          canPaste,
        },
      }),
    );

    expect(result.current.canPasteToTarget('allowed-target' as NodeId)).toBe(true);
    expect(result.current.canPasteToTarget('denied-target' as NodeId)).toBe(false);
    expect(canPaste).toHaveBeenCalledWith('denied-target');
  });

  it('should rely on clipboard fallback when no state manager guard is provided', async () => {
    const { result } = renderHook(() => useCopyPasteOperations());

    await act(async () => {
      await result.current.copyNodes(['node-1' as NodeId]);
    });

    expect(result.current.canPasteToTarget('any-target' as NodeId)).toBe(true);

    await act(async () => {
      await result.current.copyNodes([] as NodeId[]);
    });

    expect(result.current.canPasteToTarget('any-target' as NodeId)).toBe(false);
  });

  it('should honor stateManager.canPaste guard with target argument before paste', async () => {
    const canPaste = vi.fn((targetId?: NodeId) => targetId === 'allowed-target');
    const pasteNodes = vi.fn().mockResolvedValue({ success: true, pastedNodes: [] });
    const clearClipboard = vi.fn().mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useCopyPasteOperations({
        stateManager: {
          canPaste,
          pasteNodes,
          clearClipboard,
        },
      }),
    );

    await act(async () => {
      const outcome = await result.current.pasteNodes('allowed-target' as NodeId);
      expect(outcome.success).toBe(true);
    });

    expect(canPaste).toHaveBeenCalledWith('allowed-target');
    expect(pasteNodes).toHaveBeenCalledWith('allowed-target');

    await act(async () => {
      const outcome = await result.current.pasteNodes('blocked-target' as NodeId);
      expect(outcome.success).toBe(false);
    });

    expect(canPaste).toHaveBeenCalledWith('blocked-target');
    expect(pasteNodes).toHaveBeenCalledTimes(1);
  });

  it('should deny paste when stateManager.canPasteToTarget returns false', async () => {
    const canPasteToTarget = vi.fn((targetId: NodeId) => targetId === 'allowed-target');
    const pasteNodes = vi.fn().mockResolvedValue({ success: true, pastedNodes: [] });

    const { result } = renderHook(() =>
      useCopyPasteOperations({
        stateManager: {
          canPasteToTarget,
          canPaste: vi.fn(() => true),
          pasteNodes,
        },
      }),
    );

    await act(async () => {
      const outcome = await result.current.pasteNodes('blocked-target' as NodeId);
      expect(outcome.success).toBe(false);
    });

    expect(canPasteToTarget).toHaveBeenCalledWith('blocked-target');
    expect(pasteNodes).not.toHaveBeenCalledWith('blocked-target');
    expect(pasteNodes).not.toHaveBeenCalled();
  });
});
