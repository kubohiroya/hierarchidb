/**
  * TreeConsoleHeader
  * props
  */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TreeConsoleHeader } from '../TreeConsoleHeader.js';
import type { TreeConsoleHeaderProps, TreeViewController } from '~/types';

const mockController: TreeViewController = {
  currentNode: null,
  selectedNodes: [],
  expandedNodes: [],
  isLoading: false,
  selectionMode: 'checkbox' as const,
  data: [],
  expandedRowIds: new Set(),
  selectNode: () => {
  },
  selectMultipleNodes: () => {
  },
  expandNode: () => {
  },
  collapseNode: () => {
  },
  moveNodes: async () => {
  },
  deleteNodes: async () => {
  },
  duplicateNodes: async () => {
  },
  startEdit: async () => {
  },
  startCreate: async () => {
  },
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
  isTrashPage: false,
  isProjectsPage: false,
  isResourcesPage: true,
  currentNodeId: 'test-node',
  canPreviewNode: false,
  depthOffset: 0,
};

describe('TreeConsoleHeader', () => {
  it('should render title correctly', () => {
    render(<TreeConsoleHeader {...defaultProps} />);

    expect(screen.getByText('Test TreeTypes Console')).toBeInTheDocument();
  });

  it('should show resources page type', () => {
    render(<TreeConsoleHeader {...defaultProps} />);

    // Text is rendered in lowercase and uppercased via CSS; match case-insensitively
    const items = screen.getAllByText(/resources/i);
    expect(items.length).toBeGreaterThan(0);
  });

  it('should show projects page type when isProjectsPage is true', () => {
    render(<TreeConsoleHeader {...defaultProps} isProjectsPage={true} isResourcesPage={false} />);

    expect(screen.getByText(/projects/i)).toBeInTheDocument();
  });

  it('should show trash indicator when isTrashPage is true', () => {
    render(<TreeConsoleHeader {...defaultProps} isTrashPage={true} />);

    const items = screen.getAllByText(/trash/i);
    expect(items.length).toBeGreaterThan(0);
  });

  it('should show preview button when canPreviewNode is true', () => {
    render(<TreeConsoleHeader {...defaultProps} canPreviewNode={true} />);

    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('should show close button when onClose is provided', () => {
    const mockOnClose = vi.fn();
    render(<TreeConsoleHeader {...defaultProps} onClose={mockOnClose} />);

    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('should show current node info when provided', () => {
    const currentNodeInfo = {
      id: 'test-node',
      name: 'Test Node',
      type: 'folder' as any,
      hasChildren: true,
    };

    render(<TreeConsoleHeader {...defaultProps} currentNodeInfo={currentNodeInfo} />);

    expect(screen.getByText(/Test Node \(folder\)/)).toBeInTheDocument();
    expect(screen.getByText(/Has Children/)).toBeInTheDocument();
  });

  it.skip('should show breadcrumb path when not root node', () => {
    const previousNodePath = [
      { id: '1', name: 'Root', parentId: null },
      { id: '2', name: 'Parent', parentId: '1' },
    ] as any;

    render(
      <TreeConsoleHeader {...defaultProps} previousNodePath={previousNodePath} isRootNode={false} />,
    );

    expect(screen.getByText(/Path: Root > Parent/)).toBeInTheDocument();
  });
});
