/**
 * TreeConsoleHeader テストファイル
 * 
 * 基本的なレンダリングと props の動作を確認
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TreeConsoleHeader } from '../TreeConsoleHeader';
import type { TreeConsoleHeaderProps } from '~/types';

// モックデータ
const mockController = {
  currentNode: null,
  selectedNodes: [],
  expandedNodes: [],
  isLoading: false,
  selectNode: () => {},
  selectMultipleNodes: () => {},
  expandNode: () => {},
  collapseNode: () => {},
  moveNodes: async () => {},
  deleteNodes: async () => {},
  duplicateNodes: async () => {},
  startEdit: async () => {},
  startCreate: async () => {},
};

const defaultProps: TreeConsoleHeaderProps = {
  title: 'Test Tree Console',
  baseTitle: 'Tree Console',
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
    
    expect(screen.getByText('Test Tree Console')).toBeInTheDocument();
  });

  it('should show resources page type', () => {
    render(<TreeConsoleHeader {...defaultProps} />);
    
    expect(screen.getByText('RESOURCES')).toBeInTheDocument();
  });

  it('should show projects page type when isProjectsPage is true', () => {
    render(
      <TreeConsoleHeader 
        {...defaultProps} 
        isProjectsPage={true} 
        isResourcesPage={false} 
      />
    );
    
    expect(screen.getByText('PROJECTS')).toBeInTheDocument();
  });

  it('should show trash indicator when isTrashPage is true', () => {
    render(
      <TreeConsoleHeader 
        {...defaultProps} 
        isTrashPage={true} 
      />
    );
    
    expect(screen.getByText('TRASH')).toBeInTheDocument();
  });

  it('should show preview button when canPreviewNode is true', () => {
    render(
      <TreeConsoleHeader 
        {...defaultProps} 
        canPreviewNode={true} 
      />
    );
    
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('should show close button when onClose is provided', () => {
    const mockOnClose = vi.fn();
    render(
      <TreeConsoleHeader 
        {...defaultProps} 
        onClose={mockOnClose} 
      />
    );
    
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('should show current node info when provided', () => {
    const currentNodeInfo = {
      id: 'test-node',
      name: 'Test Node',
      type: 'folder' as any,
      hasChildren: true,
    };

    render(
      <TreeConsoleHeader 
        {...defaultProps} 
        currentNodeInfo={currentNodeInfo} 
      />
    );
    
    expect(screen.getByText(/Test Node \(folder\)/)).toBeInTheDocument();
    expect(screen.getByText(/Has Children/)).toBeInTheDocument();
  });

  it('should show breadcrumb path when not root node', () => {
    const previousNodePath = [
      { treeNodeId: '1', name: 'Root', parentTreeNodeId: null },
      { treeNodeId: '2', name: 'Parent', parentTreeNodeId: '1' },
    ] as any;

    render(
      <TreeConsoleHeader 
        {...defaultProps} 
        previousNodePath={previousNodePath}
        isRootNode={false}
      />
    );
    
    expect(screen.getByText(/Path: Root > Parent/)).toBeInTheDocument();
  });
});