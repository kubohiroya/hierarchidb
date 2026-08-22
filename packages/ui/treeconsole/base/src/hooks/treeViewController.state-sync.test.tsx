/**
 * @file useTreeViewController.atoms-sync.test.tsx
 * @description TDD tests for TreeViewController atoms synchronization
 */

import { type NodeId } from '@hierarchidb/core-types';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreeViewControllerProps } from './useTreeViewController.js';
import { useTreeViewController } from './useTreeViewController.js';

type MockStateManager = {
  [name: string]: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  getNode: ReturnType<typeof vi.fn>;
  getChildren: ReturnType<typeof vi.fn>;
  updateNode: ReturnType<typeof vi.fn>;
  moveNode: ReturnType<typeof vi.fn>;
  archiveNode: ReturnType<typeof vi.fn>;
  duplicateNode: ReturnType<typeof vi.fn>;
};

vi.mock('comlink', () => ({
  proxy: <T,>(value: T) => value,
}));

// Mock dependencies
vi.mock('@hierarchidb/provider', () => ({
  useTreeOperations: vi.fn(() => ({
    updateNode: vi.fn(),
    moveNode: vi.fn(),
    archiveNode: vi.fn(),
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
  let mockStateManager: MockStateManager;
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
      archiveNode: vi.fn(),
      duplicateNode: vi.fn(),
    };

    mockProps = {
      treeId: 'test-console-id',
      stateManager: mockStateManager,
      onStateChange: mockOnStateChange,
    };
  });

  describe('atoms synchronization', () => {
    it('should notify all atoms changes through onStateChange callback', () => {
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

    it('should maintain consistent atoms object structure', () => {
      const { result } = renderHook(() => useTreeViewController(mockProps));

      act(() => {
        result.current.selectNode('$1' as NodeId);
      });

      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedNodeIds: expect.any(Array),
          expandedNodeIds: expect.any(Array),
        })
      );
    });
  });
});
