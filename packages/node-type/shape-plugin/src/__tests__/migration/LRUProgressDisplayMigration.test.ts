/**
  * @file LRUProgressDisplayMigration.test.ts
 * @description ERIA-CartographLRU SplitView (TDD Red Phase)
   * - @hierarchidb/ui-lru-splitview
 * - 4
 * - LRU
   * - ShapeBatchProgressDisplayLRU SplitView
 * -
 * - PaneProgress interface
  */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ShapeBatchProgressDisplay } from '../../ui/components/ShapeBatchProgressDisplay';
import type { BatchProgressEvent } from '../../types/BatchProgressEvent';
import type { NodeId } from '@hierarchidb/common-type';
type TreeNodeId = NodeId;
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
    timestamp: baseTimestamp - 3000, // Oldest
  },
  {
    sessionId: 'session-123',
    treeNodeId: mockTreeNodeId,
    stage: 'simplify1',
    progress: 50,
    completedTasks: 10,
    totalTasks: 20,
    currentTask: 'Processing features for USA admin level 1',
    timestamp: baseTimestamp - 2000,
  },
  {
    sessionId: 'session-123',
    treeNodeId: mockTreeNodeId,
    stage: 'simplify2',
    progress: 75,
    completedTasks: 15,
    totalTasks: 20,
    currentTask: 'Simplifying tiles for CAN admin level 2',
    timestamp: baseTimestamp - 1000,
  },
  {
    sessionId: 'session-123',
    treeNodeId: mockTreeNodeId,
    stage: 'vectortile',
    progress: 100,
    completedTasks: 20,
    totalTasks: 20,
    currentTask: 'Generating vector tiles complete',
    timestamp: baseTimestamp, // Most recent from original batch
  },
];

describe('LRU Progress Display Migration Tests', () => {
  beforeEach(() => {
    //  Given:
    vi.clearAllMocks();
  });

  describe('LRU SplitView基本機能テスト', () => {
    it('バッチ処理進捗表示コンポーネントが正常にレンダリングされる', async () => {
      //  Given:
      const progressData = mockBatchProgressEvents[0];

      //  When:
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: 'session-123',
          progressEvents: [progressData],
        }),
      );

      //  Then: LRU SplitView
      expect(screen.getByTestId('shape-plugin-batch-progress-display')).toBeInTheDocument();
      expect(screen.getByTestId('lru-splitview-container')).toBeInTheDocument();

      //  Download
      expect(screen.getByText('Download Progress')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
      expect(screen.getByText('Downloading JPN admin level 0')).toBeInTheDocument();
    });

    it('4段階の進捗パネルが適切に管理される', async () => {
      //  Given:
      const allProgressData = mockBatchProgressEvents;

      //  When:
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: 'session-123',
          progressEvents: allProgressData,
        }),
      );

      //  Then: 4
      expect(screen.getByTestId('download-progress-pane')).toBeInTheDocument();
      expect(screen.getByTestId('simplify1-progress-pane')).toBeInTheDocument();
      expect(screen.getByTestId('simplify2-progress-pane')).toBeInTheDocument();
      // Component uses singular 'vectortile' for test id
      expect(screen.getByTestId('vectortile-progress-pane')).toBeInTheDocument();

      expect(screen.getByText('25%')).toBeInTheDocument(); // Download
      expect(screen.getByText('50%')).toBeInTheDocument(); // Simplify1
      expect(screen.getByText('75%')).toBeInTheDocument(); // Simplify2
      expect(screen.getByText('100%')).toBeInTheDocument(); // VectorTiles
    });

    it('PaneProgress interfaceに準拠した進捗データが正常に処理される', async () => {
      //  Given: PaneProgress
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
          estimatedRemaining: 60000,
        },
        lastUpdated: Date.now(),
      };

      //  When: PaneProgress
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: 'session-123',
          paneProgressData: [paneProgressData],
        }),
      );

      //  Then: PaneProgress
      expect(screen.getByText('Download Progress')).toBeInTheDocument();
      expect(screen.getByText('35%')).toBeInTheDocument();
      expect(screen.getByText('Downloading DEU admin level 1')).toBeInTheDocument();
      expect(screen.getByText('7 / 20 completed')).toBeInTheDocument();
    });
  });

  describe('自動展開・収束機能テスト', () => {
    it('アクティブな段階のパネルが自動的に展開される', async () => {
      //  Given: Simplify1
      const activeStageProgress = {
        ...mockBatchProgressEvents[1],
        status: 'running' as const,
      };

      //  When:
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: 'session-123',
          progressEvents: [activeStageProgress],
        }),
      );

      //  Then: Simplify1
      const simplify1Pane = screen.getByTestId('simplify1-progress-pane');
      expect(simplify1Pane).toHaveClass('expanded');
      expect(simplify1Pane).toHaveAttribute('data-auto-expanded', 'true');

      expect(screen.getByText('Processing features for USA admin level 1')).toBeInTheDocument();
    });

    it('完了した段階のパネルが自動的に収束される', async () => {
      //  Given: DownloadSimplify1
      const completedAndActiveProgress = [
        { ...mockBatchProgressEvents[0], status: 'completed' as const, progress: 100 },
        { ...mockBatchProgressEvents[1], status: 'running' as const },
      ];

      //  When:
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: 'session-123',
          progressEvents: completedAndActiveProgress,
        }),
      );

      //  Then:
      const downloadPane = screen.getByTestId('download-progress-pane');
      expect(downloadPane).toHaveClass('collapsed');

      const simplify1Pane = screen.getByTestId('simplify1-progress-pane');
      expect(simplify1Pane).toHaveClass('expanded');
    });

    it('エラー状態のパネルが適切に強調表示される', async () => {
      //  Given:
      const errorProgress = {
        ...mockBatchProgressEvents[1],
        status: 'error' as const,
        error: 'Failed to process features: Network timeout',
      };

      //  When:
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: 'session-123',
          progressEvents: [errorProgress],
        }),
      );

      //  Then:
      const errorPane = screen.getByTestId('simplify1-progress-pane');
      expect(errorPane).toHaveClass('error-state');
      expect(errorPane).toHaveClass('expanded');
      expect(screen.getByText('Failed to process features: Network timeout')).toBeInTheDocument();
    });
  });

  describe('LRU管理機能テスト', () => {
    it('最大パネル数を超えた場合にLRU管理が動作する', async () => {
      //  Given: LRU3
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
          timestamp: baseTimestamp + 1000, // Most recent of all
        },
      ];

      //  When:
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: 'session-123',
          progressEvents: manyProgressEvents,
          maxPanes: 3,
        }),
      );

      //  Then: LRU
      const visiblePanes = screen.getAllByTestId(/progress-pane$/);
      expect(visiblePanes).toHaveLength(3);

      //  3
      expect(screen.getByTestId('simplify2-progress-pane')).toBeInTheDocument();
      expect(screen.getByTestId('vectortile-progress-pane')).toBeInTheDocument();
      expect(screen.getByTestId('download-progress-pane')).toBeInTheDocument();
    });

    it('パネルのアクセス順序がLRU管理に反映される', async () => {
      //  Given:
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
          timestamp: baseTimestamp + 2000, // More recent than vectorTiles
        },
      ];

      //  When: LRU
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: 'session-123',
          progressEvents: progressEventsInOrder,
          maxPanes: 3,
        }),
      );

      //  Then: 3timestamp
      expect(screen.getByTestId('download-progress-pane')).toBeInTheDocument(); // Most recent
      expect(screen.getByTestId('vectortile-progress-pane')).toBeInTheDocument();
      expect(screen.getByTestId('simplify2-progress-pane')).toBeInTheDocument();
      expect(screen.queryByTestId('simplify1-progress-pane')).not.toBeInTheDocument(); // Oldest, excluded by LRU
    });
  });

  describe('リアルタイム更新テスト', () => {
    it('進捗データの更新がリアルタイムに反映される', async () => {
      //  Given:
      const initialProgress = { ...mockBatchProgressEvents[0], progress: 10 };
      const { rerender } = render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: 'session-123',
          progressEvents: [initialProgress],
        }),
      );

      //  When:
      const updatedProgress = { ...initialProgress, progress: 45, currentTask: 'Updated task' };
      rerender(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: 'session-123',
          progressEvents: [updatedProgress],
        }),
      );

      //  Then:
      await waitFor(() => {
        expect(screen.getByText('45%')).toBeInTheDocument();
        expect(screen.getByText('Updated task')).toBeInTheDocument();
      });
    });

    it('新しい段階への移行が適切に表示される', async () => {
      //  Given: Download
      const downloadCompleted = { ...mockBatchProgressEvents[0], progress: 100, status: 'completed' as const };
      const { rerender } = render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: 'session-123',
          progressEvents: [downloadCompleted],
        }),
      );

      //  When: Simplify1
      const simplify1Started = { ...mockBatchProgressEvents[1], progress: 5, status: 'running' as const };
      rerender(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: 'session-123',
          progressEvents: [downloadCompleted, simplify1Started],
        }),
      );

      //  Then:
      await waitFor(() => {
        const downloadPane = screen.getByTestId('download-progress-pane');
        const simplify1Pane = screen.getByTestId('simplify1-progress-pane');

        expect(downloadPane).toHaveClass('collapsed');
        expect(simplify1Pane).toHaveClass('expanded');
      });
    });
  });

  describe('パフォーマンス最適化テスト', () => {
    it('大量の進捗更新に対してメモリ効率が保たれる', async () => {
      //  Given:
      const massiveProgressUpdates = Array.from({ length: 1000 }, (_, i) => ({
        ...mockBatchProgressEvents[0],
        progress: i / 10,
        currentTask: `Task ${i}`,
        timestamp: Date.now() + i,
      }));

      //  When:
      const { rerender } = render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: 'session-123',
          progressEvents: massiveProgressUpdates.slice(0, 1),
        }),
      );

      for (let i = 1; i < 100; i += 10) {
        rerender(
          React.createElement(ShapeBatchProgressDisplay, {
            treeNodeId: mockTreeNodeId,
            sessionId: 'session-123',
            progressEvents: massiveProgressUpdates.slice(i, i + 1),
          }),
        );
      }

      //  Then:
      expect(screen.getByTestId('shape-plugin-batch-progress-display')).toBeInTheDocument();
      expect(screen.getByText(/Task \d+/)).toBeInTheDocument();
    });

    it('非アクティブなパネルのレンダリングが最適化される', async () => {
      //  Given: 1
      const mixedProgressData = [
        { ...mockBatchProgressEvents[0], status: 'completed' as const },
        { ...mockBatchProgressEvents[1], status: 'running' as const },
        { ...mockBatchProgressEvents[2], status: 'pending' as const },
        { ...mockBatchProgressEvents[3], status: 'pending' as const },
      ];

      //  When:
      render(
        React.createElement(ShapeBatchProgressDisplay, {
          treeNodeId: mockTreeNodeId,
          sessionId: 'session-123',
          progressEvents: mixedProgressData,
        }),
      );

      //  Then:
      const runningPane = screen.getByTestId('simplify1-progress-pane');
      const completedPane = screen.getByTestId('download-progress-pane');

      expect(runningPane).toHaveClass('detailed-render');
      expect(completedPane).toHaveClass('minimal-render');
    });
  });
});
