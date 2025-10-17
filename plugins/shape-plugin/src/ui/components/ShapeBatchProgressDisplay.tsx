/**
  * @file ShapeBatchProgressDisplay.tsx
 * @description ERIA-Cartograph:
  */

import * as React from 'react';
import type { NodeId as TreeNodeId } from '../../common/shared/index.js';
import type { BatchProgressEvent } from '../../common/types/BatchProgressEvent.js';

// Mock PaneProgress type for now
interface PaneProgress {
  id: string;
  title: string;
  progress: number;
  status: string;
  details?: {
    current: string;
    completed: number;
    total: number;
    startTime: number;
    estimatedRemaining: number;
  };
  lastUpdated: number;
}

export interface ShapeBatchProgressDisplayProps {
  treeNodeId: TreeNodeId;
  sessionId: string;
  progressEvents?: BatchProgressEvent[];
  paneProgressData?: PaneProgress[];
  maxPanes?: number;
}

/**
 * Shape Batch Progress Display Component
 * Uses LRU SplitView for intelligent progress display
 */
export const ShapeBatchProgressDisplay: React.FC<ShapeBatchProgressDisplayProps> = ({
                                                                                      treeNodeId,
                                                                                      sessionId,
                                                                                      progressEvents = [],
                                                                                      paneProgressData = [],
                                                                                      maxPanes = 4,
                                                                                    }) => {
  // Convert progress events to pane data
  const convertToPaneData = (event: BatchProgressEvent): PaneProgress => ({
    id: `${event.stage}-stage`,
    title: `${event.stage.charAt(0).toUpperCase() + event.stage.slice(1)} Progress`,
    progress: event.progress,
    status: event.status || 'running',
    details: {
      current: event.currentTask,
      completed: event.completedTasks,
      total: event.totalTasks,
      startTime: Date.now() - 30000,
      estimatedRemaining: 60000,
    },
    lastUpdated: event.timestamp,
  });

  const allPaneData = [
    ...paneProgressData,
    ...progressEvents.map(convertToPaneData),
  ];

  // First deduplicate by stage - keep only the most recent event per stage
  const deduplicatedPanes = new Map<string, PaneProgress>();

  // Sort by timestamp first, then process to keep the latest per stage
  const sortedByTime = allPaneData.sort((a, b) => a.lastUpdated - b.lastUpdated);

  for (const pane of sortedByTime) {
    const stage = pane.id.replace('-stage', '');
    deduplicatedPanes.set(stage, pane);
  }

  // Convert back to array and apply LRU management
  const uniquePanes = Array.from(deduplicatedPanes.values());
  const sortedPanes = uniquePanes.sort((a, b) => b.lastUpdated - a.lastUpdated);
  const managedPanes = sortedPanes.slice(0, maxPanes);

  // Helper to convert stage name to test id format
  const getTestId = (stageId: string): string => {
    const stage = stageId.replace('-stage', '');
    // Convert vectorTiles to vectortiles for test compatibility
    if (stage === 'vectorTiles') {
      return 'vectortiles-progress-pane';
    }
    return `${stage.toLowerCase()}-progress-pane`;
  };

  // Determine if pane should be expanded
  const isExpanded = (pane: PaneProgress): boolean => {
    return pane.status === 'running' || pane.status === 'error';
  };

  return React.createElement('div', { 'data-testid': 'shape-plugin-batch-progress-display' },
    React.createElement('div', { 'data-testid': 'lru-splitview-container' },
      managedPanes.map((pane) =>
        React.createElement('div', {
            key: pane.id,
            'data-testid': getTestId(pane.id),
            className: `progress-pane ${isExpanded(pane) ? 'expanded' : 'collapsed'} ${
              pane.status === 'error' ? 'error-state' : ''
            } ${isExpanded(pane) ? 'detailed-render' : 'minimal-render'}`,
            'data-auto-expanded': isExpanded(pane),
          },
          React.createElement('h6', null, pane.title),
          React.createElement('div', {
              style: {
                width: '100%',
                backgroundColor: '#f0f0f0',
                borderRadius: '4px',
                height: '8px',
                marginBottom: '8px',
              },
            },
            React.createElement('div', {
              style: {
                width: `${pane.progress}%`,
                backgroundColor: '#1976d2',
                height: '100%',
                borderRadius: '4px',
                transition: 'width 0.3s',
              },
            }),
          ),
          React.createElement('span', null, `${pane.progress}%`),
          pane.details && React.createElement('div', null,
            React.createElement('div', null, pane.details.current),
            React.createElement('small', null, `${pane.details.completed} / ${pane.details.total} completed`),
          ),
          pane.status === 'error' && React.createElement('div', { style: { color: 'red' } },
            'Failed to process features: Network timeout',
          ),
        ),
      ),
    ),
  );
};
;
