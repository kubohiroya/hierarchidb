/**
 * TreeConsoleContent.test.tsx
 * 
 * TreeConsoleContentコンポーネントの基本テスト
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { TreeConsoleContent } from '../TreeConsoleContent';
import type { TreeConsoleContentProps, TreeViewController } from '~/types';

// テーマプロバイダーでラップ
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = createTheme();
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

// モックコントローラー
const createMockController = (overrides?: Partial<TreeViewController>): TreeViewController => ({
  currentNode: null,
  selectedNodes: [],
  expandedNodes: [],
  isLoading: false,
  selectNode: jest.fn(),
  selectMultipleNodes: jest.fn(),
  expandNode: jest.fn(),
  collapseNode: jest.fn(),
  moveNodes: jest.fn(),
  deleteNodes: jest.fn(),
  duplicateNodes: jest.fn(),
  startEdit: jest.fn(),
  startCreate: jest.fn(),
  ...overrides,
});

// デフォルトプロパティ
const defaultProps: TreeConsoleContentProps = {
  controller: createMockController(),
  isProjectsPage: false,
  isResourcesPage: true,
  viewHeight: 600,
  viewWidth: 800,
  useTrashColumns: false,
  depthOffset: 0,
  treeRootNodeId: 'test-root-node-id',
  currentNodeInfo: null,
  mode: undefined,
};

describe('TreeConsoleContent', () => {
  it('ローディング状態を正しく表示する', () => {
    const loadingController = createMockController({ isLoading: true });
    
    render(
      <TestWrapper>
        <TreeConsoleContent 
          {...defaultProps} 
          controller={loadingController} 
        />
      </TestWrapper>
    );

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('空状態（デフォルト）を正しく表示する', () => {
    const emptyController = createMockController({
      isLoading: false,
      selectedNodes: [],
    });
    
    render(
      <TestWrapper>
        <TreeConsoleContent 
          {...defaultProps} 
          controller={emptyController} 
        />
      </TestWrapper>
    );

    expect(screen.getByText('リソースがありません。新しいリソースを作成してください。')).toBeInTheDocument();
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

    expect(screen.getByText('プロジェクトがありません。新しいプロジェクトを作成してください。')).toBeInTheDocument();
  });

  it('復元モードでの空状態を正しく表示する', () => {
    const emptyController = createMockController({
      isLoading: false,
      selectedNodes: [],
    });
    
    render(
      <TestWrapper>
        <TreeConsoleContent 
          {...defaultProps} 
          controller={emptyController}
          mode="restore"
        />
      </TestWrapper>
    );

    expect(screen.getByText('ゴミ箱に復元可能なアイテムはありません。')).toBeInTheDocument();
  });

  it('完全削除モードでの空状態を正しく表示する', () => {
    const emptyController = createMockController({
      isLoading: false,
      selectedNodes: [],
    });
    
    render(
      <TestWrapper>
        <TreeConsoleContent 
          {...defaultProps} 
          controller={emptyController}
          mode="dispose"
        />
      </TestWrapper>
    );

    expect(screen.getByText('完全削除可能なアイテムはありません。')).toBeInTheDocument();
  });

  it('データがある場合にテーブル表示する', () => {
    const dataController = createMockController({
      isLoading: false,
      selectedNodes: ['node1', 'node2'],
      expandedNodes: ['node1'],
    });
    
    render(
      <TestWrapper>
        <TreeConsoleContent 
          {...defaultProps} 
          controller={dataController} 
        />
      </TestWrapper>
    );

    expect(screen.getByText('TreeTable (placeholder)')).toBeInTheDocument();
    expect(screen.getByText('選択中: 2 / 1 expanded')).toBeInTheDocument();
    expect(screen.getByText('Selected IDs: node1, node2')).toBeInTheDocument();
  });

  it('デバッグ情報を正しく表示する', () => {
    const emptyController = createMockController({
      isLoading: false,
      selectedNodes: [],
    });
    
    render(
      <TestWrapper>
        <TreeConsoleContent 
          {...defaultProps} 
          controller={emptyController}
          treeRootNodeId="test-root"
          mode="restore"
        />
      </TestWrapper>
    );

    expect(screen.getByText('Tree Root: test-root')).toBeInTheDocument();
    expect(screen.getByText('Mode: restore')).toBeInTheDocument();
    expect(screen.getByText('Controller: Available')).toBeInTheDocument();
  });

  it('コントローラーがない場合にローディング状態を表示する', () => {
    render(
      <TestWrapper>
        <TreeConsoleContent 
          {...defaultProps} 
          controller={null}
        />
      </TestWrapper>
    );

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});