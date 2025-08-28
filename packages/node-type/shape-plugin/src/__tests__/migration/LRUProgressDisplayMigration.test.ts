/**
 * @file LRUProgressDisplayMigration.test.ts
 * @description ERIA-Cartograph移植に向けたLRU SplitView進捗表示テスト (TDD Red Phase)
 * 
 * テスト目的：
 * - @hierarchidb/ui-lru-splitviewを使用したバッチ処理進捗表示の実装検証
 * - 4段階バッチ処理パイプラインに対応した進捗パネル管理の確認
 * - LRU機能による自動的なパネル管理とメモリ効率の検証
 * 
 * 前提条件：
 * - ShapeBatchProgressDisplayコンポーネントがLRU SplitViewを使用して実装済み
 * - 各バッチ段階に対応した進捗パネルが実装済み
 * - PaneProgress interfaceに準拠した進捗データ構造が実装済み
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ShapeBatchProgressDisplay } from '../../ui/components/ShapeBatchProgressDisplay';
import type { BatchProgressEvent } from '../../types/BatchProgressEvent';
import type { TreeNodeId } from '@hierarchidb/core';

// テスト用のモックデータ
const mockTreeNodeId = 'tree-node-123' as TreeNodeId;

const baseTimestamp = Date.now();

const mockBatchProgressEvents: BatchProgressEvent[] = [
  {
    sessionId: 'session-123',
    treeNodeId: mockTreeNodeId,
    stage: 'download',
    progress: 25,
    completedTasks: 5,
    totalTasks: 20,
    currentTask: 'Downloading JPN admin level 0',
    timestamp: baseTimestamp - 3000 // Oldest
  },
  {
    sessionId: 'session-123',
    treeNodeId: mockTreeNodeId,
    stage: 'simplify1',
    progress: 50,
    completedTasks: 10,
    totalTasks: 20,
    currentTask: 'Processing features for USA admin level 1',
    timestamp: baseTimestamp - 2000
  },
  {
    sessionId: 'session-123',
    treeNodeId: mockTreeNodeId,
    stage: 'simplify2',
    progress: 75,
    completedTasks: 15,
    totalTasks: 20,
    currentTask: 'Simplifying tiles for CAN admin level 2',
    timestamp: baseTimestamp - 1000
  },
  {
    sessionId: 'session-123',
    treeNodeId: mockTreeNodeId,
    stage: 'vectorTiles',
    progress: 100,
    completedTasks: 20,
    totalTasks: 20,
    currentTask: 'Generating vector tiles complete',
    timestamp: baseTimestamp // Most recent from original batch
  }
];

describe('LRU Progress Display Migration Tests', () => {
  beforeEach(() => {
    // Given: テスト環境をリセット
    vi.clearAllMocks();
  });

  describe('LRU SplitView基本機能テスト', () => {
    it('バッチ処理進捗表示コンポーネントが正常にレンダリングされる', async () => {
      // Given: バッチ処理進捗データ
      const progressData = mockBatchProgressEvents[0];
      
      // When: 進捗表示コンポーネントをレンダリング
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: "session-123",
          progressEvents: [progressData]
        })
      );
      
      // Then: LRU SplitViewが正常にレンダリングされる
      expect(screen.getByTestId('shape-plugin-batch-progress-display')).toBeInTheDocument();
      expect(screen.getByTestId('lru-splitview-container')).toBeInTheDocument();
      
      // Download段階の進捗が表示される
      expect(screen.getByText('Download Progress')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
      expect(screen.getByText('Downloading JPN admin level 0')).toBeInTheDocument();
    });

    it('4段階の進捗パネルが適切に管理される', async () => {
      // Given: 全段階の進捗データ
      const allProgressData = mockBatchProgressEvents;
      
      // When: 全段階の進捗表示をレンダリング
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: "session-123",
          progressEvents: allProgressData
        })
      );
      
      // Then: 4段階すべてのパネルが表示される
      expect(screen.getByTestId('download-progress-pane')).toBeInTheDocument();
      expect(screen.getByTestId('simplify1-progress-pane')).toBeInTheDocument();
      expect(screen.getByTestId('simplify2-progress-pane')).toBeInTheDocument();
      expect(screen.getByTestId('vectortiles-progress-pane')).toBeInTheDocument();
      
      // 各段階の進捗値が正しく表示される
      expect(screen.getByText('25%')).toBeInTheDocument(); // Download
      expect(screen.getByText('50%')).toBeInTheDocument(); // Simplify1
      expect(screen.getByText('75%')).toBeInTheDocument(); // Simplify2
      expect(screen.getByText('100%')).toBeInTheDocument(); // VectorTiles
    });

    it('PaneProgress interfaceに準拠した進捗データが正常に処理される', async () => {
      // Given: PaneProgress形式の進捗データ
      const paneProgressData = {
        id: 'download-stage',
        title: 'Download Progress',
        progress: 35,
        status: 'running',
        details: {
          current: 'Downloading DEU admin level 1',
          completed: 7,
          total: 20,
          startTime: Date.now() - 30000,
          estimatedRemaining: 60000
        },
        lastUpdated: Date.now()
      };
      
      // When: PaneProgress形式データでコンポーネントをレンダリング
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: "session-123",
          paneProgressData: [paneProgressData]
        })
      );
      
      // Then: PaneProgress形式のデータが正しく表示される
      expect(screen.getByText('Download Progress')).toBeInTheDocument();
      expect(screen.getByText('35%')).toBeInTheDocument();
      expect(screen.getByText('Downloading DEU admin level 1')).toBeInTheDocument();
      expect(screen.getByText('7 / 20 completed')).toBeInTheDocument();
    });
  });

  describe('自動展開・収束機能テスト', () => {
    it('アクティブな段階のパネルが自動的に展開される', async () => {
      // Given: Simplify1段階が実行中の進捗データ
      const activeStageProgress = {
        ...mockBatchProgressEvents[1],
        status: 'running' as const
      };
      
      // When: アクティブ段階でコンポーネントをレンダリング
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: "session-123",
          progressEvents: [activeStageProgress]
        })
      );
      
      // Then: Simplify1段階のパネルが展開される
      const simplify1Pane = screen.getByTestId('simplify1-progress-pane');
      expect(simplify1Pane).toHaveClass('expanded');
      expect(simplify1Pane).toHaveAttribute('data-auto-expanded', 'true');
      
      // 進捗詳細が表示される
      expect(screen.getByText('Processing features for USA admin level 1')).toBeInTheDocument();
    });

    it('完了した段階のパネルが自動的に収束される', async () => {
      // Given: Download段階完了、Simplify1段階実行中の状態
      const completedAndActiveProgress = [
        { ...mockBatchProgressEvents[0], status: 'completed' as const, progress: 100 },
        { ...mockBatchProgressEvents[1], status: 'running' as const }
      ];
      
      // When: 完了と実行中の混在状態でレンダリング
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: "session-123",
          progressEvents: completedAndActiveProgress
        })
      );
      
      // Then: 完了した段階のパネルが収束される
      const downloadPane = screen.getByTestId('download-progress-pane');
      expect(downloadPane).toHaveClass('collapsed');
      
      // アクティブな段階のパネルが展開される
      const simplify1Pane = screen.getByTestId('simplify1-progress-pane');
      expect(simplify1Pane).toHaveClass('expanded');
    });

    it('エラー状態のパネルが適切に強調表示される', async () => {
      // Given: エラーが発生した段階の進捗データ
      const errorProgress = {
        ...mockBatchProgressEvents[1],
        status: 'error' as const,
        error: 'Failed to process features: Network timeout'
      };
      
      // When: エラー状態でコンポーネントをレンダリング
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: "session-123",
          progressEvents: [errorProgress]
        })
      );
      
      // Then: エラー状態のパネルが強調表示される
      const errorPane = screen.getByTestId('simplify1-progress-pane');
      expect(errorPane).toHaveClass('error-state');
      expect(errorPane).toHaveClass('expanded'); // エラー時は自動展開
      
      // エラーメッセージが表示される
      expect(screen.getByText('Failed to process features: Network timeout')).toBeInTheDocument();
    });
  });

  describe('LRU管理機能テスト', () => {
    it('最大パネル数を超えた場合にLRU管理が動作する', async () => {
      // Given: LRU最大数（例：3）を超える進捗パネル数
      const manyProgressEvents = [
        ...mockBatchProgressEvents,
        {
          sessionId: 'session-456',
          treeNodeId: 'tree-node-456' as TreeNodeId,
          stage: 'download' as const,
          progress: 10,
          completedTasks: 1,
          totalTasks: 10,
          currentTask: 'Downloading FRA admin level 0',
          timestamp: baseTimestamp + 1000 // Most recent of all
        }
      ];
      
      // When: 最大数を超える進捗データでレンダリング
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: "session-123",
          progressEvents: manyProgressEvents,
          maxPanes: 3
        })
      );
      
      // Then: LRU管理により古いパネルが非表示になる
      const visiblePanes = screen.getAllByTestId(/progress-pane$/);
      expect(visiblePanes).toHaveLength(3);
      
      // 最新の3つのパネルが表示される
      expect(screen.getByTestId('simplify2-progress-pane')).toBeInTheDocument();
      expect(screen.getByTestId('vectortiles-progress-pane')).toBeInTheDocument();
      expect(screen.getByTestId('download-progress-pane')).toBeInTheDocument(); // 新しいセッション
    });

    it('パネルのアクセス順序がLRU管理に反映される', async () => {
      // Given: 進捗データが時系列順で提供される
      const progressEventsInOrder = [
        ...mockBatchProgressEvents,
        {
          sessionId: 'session-123',
          treeNodeId: mockTreeNodeId,
          stage: 'download' as const,
          progress: 30,
          completedTasks: 6,
          totalTasks: 20,
          currentTask: 'Downloading updated data',
          timestamp: baseTimestamp + 2000 // More recent than vectorTiles
        }
      ];
      
      // When: 最大パネル数制限でLRU管理
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: "session-123",
          progressEvents: progressEventsInOrder,
          maxPanes: 3
        })
      );
      
      // Then: 最新の3つのパネルが表示される（timestamp順）
      expect(screen.getByTestId('download-progress-pane')).toBeInTheDocument(); // Most recent
      expect(screen.getByTestId('vectortiles-progress-pane')).toBeInTheDocument();
      expect(screen.getByTestId('simplify2-progress-pane')).toBeInTheDocument();
      expect(screen.queryByTestId('simplify1-progress-pane')).not.toBeInTheDocument(); // Oldest, excluded by LRU
    });
  });

  describe('リアルタイム更新テスト', () => {
    it('進捗データの更新がリアルタイムに反映される', async () => {
      // Given: 初期の進捗データ
      const initialProgress = { ...mockBatchProgressEvents[0], progress: 10 };
      const { rerender } = render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: "session-123",
          progressEvents: [initialProgress]
        })
      );
      
      // When: 進捗データを更新
      const updatedProgress = { ...initialProgress, progress: 45, currentTask: 'Updated task' };
      rerender(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: "session-123",
          progressEvents: [updatedProgress]
        })
      );
      
      // Then: 更新された進捗が即座に反映される
      await waitFor(() => {
        expect(screen.getByText('45%')).toBeInTheDocument();
        expect(screen.getByText('Updated task')).toBeInTheDocument();
      });
    });

    it('新しい段階への移行が適切に表示される', async () => {
      // Given: Download段階完了の状態
      const downloadCompleted = { ...mockBatchProgressEvents[0], progress: 100, status: 'completed' as const };
      const { rerender } = render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: "session-123",
          progressEvents: [downloadCompleted]
        })
      );
      
      // When: Simplify1段階が開始される
      const simplify1Started = { ...mockBatchProgressEvents[1], progress: 5, status: 'running' as const };
      rerender(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: "session-123",
          progressEvents: [downloadCompleted, simplify1Started]
        })
      );
      
      // Then: 段階移行が適切に表示される
      await waitFor(() => {
        const downloadPane = screen.getByTestId('download-progress-pane');
        const simplify1Pane = screen.getByTestId('simplify1-progress-pane');
        
        expect(downloadPane).toHaveClass('collapsed'); // 完了段階は収束
        expect(simplify1Pane).toHaveClass('expanded'); // 新しい段階は展開
      });
    });
  });

  describe('パフォーマンス最適化テスト', () => {
    it('大量の進捗更新に対してメモリ効率が保たれる', async () => {
      // Given: 大量の進捗更新シミュレーション
      const massiveProgressUpdates = Array.from({ length: 1000 }, (_, i) => ({
        ...mockBatchProgressEvents[0],
        progress: i / 10,
        currentTask: `Task ${i}`,
        timestamp: Date.now() + i
      }));
      
      // When: 大量更新でコンポーネントをレンダリング
      const { rerender } = render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: "session-123",
          progressEvents: massiveProgressUpdates.slice(0, 1)
        })
      );
      
      // 段階的に更新を適用
      for (let i = 1; i < 100; i += 10) {
        rerender(
          React.createElement(ShapeBatchProgressDisplay, {
            treeNodeId: mockTreeNodeId,
            sessionId: "session-123",
            progressEvents: massiveProgressUpdates.slice(i, i + 1)
          })
        );
      }
      
      // Then: コンポーネントが安定して動作する
      expect(screen.getByTestId('shape-plugin-batch-progress-display')).toBeInTheDocument();
      expect(screen.getByText(/Task \d+/)).toBeInTheDocument();
    });

    it('非アクティブなパネルのレンダリングが最適化される', async () => {
      // Given: 複数段階の進捗データ（1つだけアクティブ）
      const mixedProgressData = [
        { ...mockBatchProgressEvents[0], status: 'completed' as const },
        { ...mockBatchProgressEvents[1], status: 'running' as const },
        { ...mockBatchProgressEvents[2], status: 'pending' as const },
        { ...mockBatchProgressEvents[3], status: 'pending' as const }
      ];
      
      // When: 混在状態でコンポーネントをレンダリング
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: "session-123",
          progressEvents: mixedProgressData
        })
      );
      
      // Then: アクティブなパネルのみが詳細レンダリングされる
      const runningPane = screen.getByTestId('simplify1-progress-pane');
      const completedPane = screen.getByTestId('download-progress-pane');
      
      expect(runningPane).toHaveClass('detailed-render');
      expect(completedPane).toHaveClass('minimal-render');
    });
  });
});