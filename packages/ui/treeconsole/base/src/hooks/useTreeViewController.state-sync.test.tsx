/**
 * @file useTreeViewController.state-sync.test.tsx
 * @description TDD tests for TreeViewController state synchronization
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { TreeViewControllerProps } from './useTreeViewController.js';
import { useTreeViewController } from './useTreeViewController.js';
import { type NodeId } from '@hierarchidb/common-types';

vi.mock('comlink', () => ({
  proxy: <T,>(value: T) => value,
}));

// Mock dependencies
vi.mock('@hierarchidb/provider', () => ({
  useTreeOperations: vi.fn(() => ({
    updateNode: vi.fn(),
    moveNode: vi.fn(),
    trashNode: vi.fn(),
    duplicateNode: vi.fn(),
  })),
  useTreeState: vi.fn(() => ({
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getNode: vi.fn(),
    getChildren: vi.fn(),
  })),
}));

describe('useTreeViewController', () => {
  let mockProps: TreeViewControllerProps;
  let mockStateManager: any;
  let mockOnStateChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnStateChange = vi.fn();
    mockStateManager = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      getNode: vi.fn(),
      getChildren: vi.fn(),
      updateNode: vi.fn(),
      moveNode: vi.fn(),
      trashNode: vi.fn(),
      duplicateNode: vi.fn(),
    } as any;

    mockProps = {
      treeId: 'test-console-id',
      stateManager: mockStateManager,
      onStateChange: mockOnStateChange,
    };
  });

  describe('state synchronization', () => {
    it('should notify all state changes through onStateChange callback', () => {
      const { result } = renderHook(() => useTreeViewController(mockProps));

      act(() => {
        result.current.selectNode('$1' as NodeId);
      });

      expect(mockOnStateChange).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.expandNode('$1' as NodeId);
      });

      expect(mockOnStateChange).toHaveBeenCalledTimes(2);

      act(() => {
        result.current.collapseNode('$1' as NodeId);
      });

      expect(mockOnStateChange).toHaveBeenCalledTimes(3);
    });

    it('should maintain consistent state object structure', () => {
      const { result } = renderHook(() => useTreeViewController(mockProps));

      act(() => {
        result.current.selectNode('$1' as NodeId);
      });

      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedNodeIds: expect.any(Array),
          expandedNodeIds: expect.any(Array),
        }),
      );
    });
  });
});
