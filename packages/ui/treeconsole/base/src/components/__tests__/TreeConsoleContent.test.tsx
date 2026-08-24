/**
 * TreeConsoleContent.test.tsx
 * TreeConsoleContent
 */

import { createTheme, ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { vi } from 'vitest';

vi.mock('@hierarchidb/ui-treeconsole-breadcrumb', () => ({
  TreeConsoleBreadcrumb: () => null,
  NodeTypeIcon: () => null,
  NodeContextMenu: () => null,
  buildTreeConsoleLinkHref: () => '#',
  formatBuildAvailabilityView: () => undefined,
  getPluginIconColor: () => undefined,
  isFolderNodeType: () => true,
}));

import { type NodeId, type NodeType, toNodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { DualKeyMap } from '@hierarchidb/util';
import type { TreeConsoleContentProps, TreeViewController } from '../../types/index.js';
import { TreeConsoleContent } from '../TreeConsoleContent';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = createTheme();
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

const createMockController = (overrides?: Partial<TreeViewController>): TreeViewController => ({
  currentNode: null,
  selectedNodes: [],
  expandedNodes: [],
  isLoading: false,
  selectionMode: 'checkbox' as const,
  data: [],
  nodeIndex: new DualKeyMap<NodeId, NodeId, TreeNode>(),
  expandedRowIds: new Set(),
  selectNode: vi.fn(),
  selectMultipleNodes: vi.fn(),
  expandNode: vi.fn(),
  collapseNode: vi.fn(),
  moveNodes: vi.fn(),
  deleteNodes: vi.fn(),
  duplicateNodes: vi.fn(),
  startEdit: vi.fn(),
  startCreate: vi.fn(),
  undo: vi.fn().mockResolvedValue({ success: true }),
  redo: vi.fn().mockResolvedValue({ success: true }),
  canUndo: false,
  canRedo: false,
  undoHistory: [],
  redoHistory: [],
  clearHistory: vi.fn().mockResolvedValue({ success: true }),
  ...overrides,
});

const defaultProps: TreeConsoleContentProps = {
  controller: createMockController(),
  isProjectsPage: false,
  isResourcesPage: true,
  viewHeight: 600,
  viewWidth: 800,
  useArchiveColumns: false,
  depthOffset: 0,
  rootNodeId: 'test-root-node-id' as NodeId,
  currentNodeInfo: null,
  mode: undefined,
};

describe('TreeConsoleContent', () => {
  it('ローディング状態を正しく表示する', () => {
    const loadingController = createMockController({ isLoading: true });

    render(
      <TestWrapper>
        <TreeConsoleContent {...defaultProps} controller={loadingController} />
      </TestWrapper>
    );

    const loadingTexts = screen.getAllByText('Loading...');
    expect(loadingTexts.length).toBeGreaterThan(0);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('空状態（デフォルト）を正しく表示する', () => {
    const emptyController = createMockController({
      isLoading: false,
      selectedNodes: [],
    });

    render(
      <TestWrapper>
        <TreeConsoleContent {...defaultProps} controller={emptyController} />
      </TestWrapper>
    );

    expect(
      screen.getByText('No resources yet. Create a new resource to get started.')
    ).toBeInTheDocument();
  });

  it('プロジェクトページでの空状態を正しく表示する', () => {
    const emptyController = createMockController({
      isLoading: false,
      selectedNodes: [],
    });

    render(
      <TestWrapper>
        <TreeConsoleContent
          {...defaultProps}
          controller={emptyController}
          isProjectsPage={true}
          isResourcesPage={false}
        />
      </TestWrapper>
    );

    expect(
      screen.getByText('No projects yet. Create a new project to get started.')
    ).toBeInTheDocument();
  });

  it('復元モードでの空状態を正しく表示する', () => {
    const emptyController = createMockController({
      isLoading: false,
      selectedNodes: [],
    });

    render(
      <TestWrapper>
        <TreeConsoleContent {...defaultProps} controller={emptyController} mode="restore" />
      </TestWrapper>
    );

    expect(screen.getByText('No items can be restored from the archive.')).toBeInTheDocument();
  });

  it('完全削除モードでの空状態を正しく表示する', () => {
    const emptyController = createMockController({
      isLoading: false,
      selectedNodes: [],
    });

    render(
      <TestWrapper>
        <TreeConsoleContent {...defaultProps} controller={emptyController} mode="dispose" />
      </TestWrapper>
    );

    expect(screen.getByText('No items can be permanently deleted.')).toBeInTheDocument();
  });

  it('データがある場合にテーブル表示する', () => {
    const dataController = createMockController({
      isLoading: false,
      selectedNodes: ['node1', 'node2'] as NodeId[],
      expandedNodes: ['node1'] as NodeId[],
      data: [
        {
          id: toNodeId('node1'),
          name: 'Node 1',
          nodeType: 'folder' as NodeType,
          parentId: toNodeId('root'),
          depth: 0,
          createdAt: 0,
          updatedAt: 0,
          version: 1,
          metadata: {
            name: 'Node 1',
            description: '',
            tags: [],
          },
          draftMetadata: {
            name: 'Node 1',
            description: '',
            tags: [],
          },
          data: null,
          draftData: undefined,
          visible: true,
        },
      ],
    });

    render(
      <TestWrapper>
        <TreeConsoleContent {...defaultProps} controller={dataController} />
      </TestWrapper>
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('デバッグ情報を正しく表示する', () => {
    document.body.innerHTML = '';
    document.querySelector('[data-testid="treeconsole-debug-info"]')?.remove();

    const emptyController = createMockController({
      isLoading: false,
      selectedNodes: [],
    });

    render(
      <TestWrapper>
        <TreeConsoleContent
          {...defaultProps}
          controller={emptyController}
          rootNodeId={'test-root' as NodeId}
          mode="restore"
        />
      </TestWrapper>
    );

    const debugPanel = screen.queryByTestId('treeconsole-debug-info');
    if (debugPanel) {
      expect(debugPanel).toHaveTextContent('TreeTypes Root: test-root');
      expect(screen.getByText('Mode: restore')).toBeInTheDocument();
      expect(screen.getByText('Controller: Available')).toBeInTheDocument();
    } else {
      expect(screen.getByText('No items can be restored from the archive.')).toBeInTheDocument();
    }
  });

  it('コントローラーがない場合にローディング状態を表示する', () => {
    render(
      <TestWrapper>
        <TreeConsoleContent {...defaultProps} controller={null} />
      </TestWrapper>
    );

    const loadingTexts = screen.getAllByText('Loading...');
    expect(loadingTexts.length).toBeGreaterThan(0);
    const bars = screen.getAllByRole('progressbar');
    expect(bars.length).toBeGreaterThan(0);
  });
});
