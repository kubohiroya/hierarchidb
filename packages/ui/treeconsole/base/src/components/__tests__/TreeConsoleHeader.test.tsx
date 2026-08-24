/**
 * TreeConsoleHeader
 * props
 */

import { type NodeId, type NodeType, toNodeId } from '@hierarchidb/core-types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TreeConsoleHeaderProps, TreeNodeWithChildren, TreeViewController } from '../../types/index.js';
import { TreeConsoleHeader } from '../TreeConsoleHeader';

const mockController: TreeViewController = {
  currentNode: null,
  selectedNodes: [],
  expandedNodes: [],
  isLoading: false,
  selectionMode: 'checkbox' as const,
  data: [],
  expandedRowIds: new Set(),
  selectNode: () => {},
  selectMultipleNodes: () => {},
  expandNode: () => {},
  collapseNode: () => {},
  moveNodes: async () => {},
  archiveNodes: async () => {},
  duplicateNodes: async () => {},
  startEdit: async () => {},
  startCreate: async () => {},
  undo: async () => ({ success: true }),
  redo: async () => ({ success: true }),
  canUndo: false,
  canRedo: false,
  undoHistory: [],
  redoHistory: [],
  clearHistory: async () => ({ success: true }),
};

const defaultProps: TreeConsoleHeaderProps = {
  title: 'Test TreeTypes Console',
  baseTitle: 'TreeTypes Console',
  baseTitleSingular: 'Node',
  isShowingBranch: true,
  isRootNode: false,
  currentNodeInfo: null,
  controller: mockController,
  previousNodePath: [],
  isArchivePage: false,
  isProjectsPage: false,
  isResourcesPage: true,
  currentNodeId: 'test-node',
  canPreviewNode: false,
  depthOffset: 0,
};

describe('TreeConsoleHeader', () => {
  it('should render title correctly', () => {
    render(<TreeConsoleHeader {...defaultProps} />);

    expect(screen.getByText('Test TreeTypes Console')).toBeDefined();
  });

  it('should show resources page type', () => {
    render(<TreeConsoleHeader {...defaultProps} />);

    // Text is rendered in lowercase and uppercased via CSS; match case-insensitively
    const items = screen.getAllByText(/resources/i);
    expect(items.length).toBeGreaterThan(0);
  });

  it('should show projects page type when isProjectsPage is true', () => {
    render(<TreeConsoleHeader {...defaultProps} isProjectsPage={true} isResourcesPage={false} />);

    expect(screen.getByText(/projects/i)).toBeDefined();
  });

  it('should show archive indicator when isArchivePage is true', () => {
    render(<TreeConsoleHeader {...defaultProps} isArchivePage={true} />);

    const items = screen.getAllByText(/archive/i);
    expect(items.length).toBeGreaterThan(0);
  });

  it('should show preview button when canPreviewNode is true', () => {
    render(<TreeConsoleHeader {...defaultProps} canPreviewNode={true} />);

    expect(screen.getByText('Preview')).toBeDefined();
  });

  it('should show close button when onClose is provided', () => {
    const mockOnClose = vi.fn();
    render(<TreeConsoleHeader {...defaultProps} onClose={mockOnClose} />);

    expect(screen.getByText('Close')).toBeDefined();
  });

  it('should show current node info when provided', () => {
    const currentNodeInfo = {
      id: 'test-node',
      name: 'Test Node',
      type: 'folder' as NodeType,
      hasChildren: true,
    };

    render(<TreeConsoleHeader {...defaultProps} currentNodeInfo={currentNodeInfo} />);

    expect(screen.getByText(/Test Node \(folder\)/)).toBeDefined();
    expect(screen.getByText(/Has Children/)).toBeDefined();
  });

  it('should not show breadcrumb path when not root node', () => {
    const previousNodePath = [
      {
        id: toNodeId('1') as NodeId,
        name: 'Root',
        nodeType: 'folder' as NodeType,
        parentId: toNodeId('__root__') as NodeId,
        depth: 0,
        createdAt: 0,
        updatedAt: 0,
        version: 1,
        metadata: {
          name: 'Root',
          description: '',
          tags: [],
        },
        draftMetadata: {
          name: 'Root',
          description: '',
          tags: [],
        },
        data: null,
        draftData: undefined,
        visible: true,
        hasChildren: true,
      } satisfies TreeNodeWithChildren,
      {
        id: toNodeId('2') as NodeId,
        name: 'Parent',
        nodeType: 'folder' as NodeType,
        parentId: toNodeId('1') as NodeId,
        depth: 0,
        createdAt: 0,
        updatedAt: 0,
        version: 1,
        metadata: {
          name: 'Parent',
          description: '',
          tags: [],
        },
        draftMetadata: {
          name: 'Parent',
          description: '',
          tags: [],
        },
        data: null,
        draftData: undefined,
        visible: true,
      } satisfies TreeNodeWithChildren,
    ];

    render(
      <TreeConsoleHeader {...defaultProps} previousNodePath={previousNodePath} isRootNode={false} />
    );

    expect(screen.queryByText(/Path: Root > Parent/)).toBeNull();
  });
});
