/**
 * @fileoverview Utility functions for LRU split view management
 * @module @hierarchidb/ui-lru-splitview/utils
 */

import type { PaneConfig, PaneState, PaneProgress } from '../types/LRUSplitView';

/**
 * Create a simple pane configuration
 */
export function createPane(
  id: string,
  title: string,
  content: React.ReactNode,
  options: Partial<PaneConfig> = {}
): PaneConfig {
  return {
    id,
    title,
    content,
    ...options,
  };
}

/**
 * Create progress information for a pane
 */
export function createProgress(
  paneId: string,
  progress: number,
  options: Partial<Omit<PaneProgress, 'paneId' | 'progress'>> = {}
): PaneProgress {
  return {
    paneId,
    progress: Math.max(0, Math.min(100, progress)),
    ...options,
  };
}

/**
 * Calculate progress based on completed vs total tasks
 */
export function calculateProgress(completed: number, total: number): number {
  if (total === 0) return 0;
  return (completed / total) * 100;
}

/**
 * Find the least recently used pane among expanded panes
 */
export function findLRUPane(paneStates: PaneState[]): PaneState | null {
  const expandedPanes = paneStates.filter(p => p.isExpanded);
  if (expandedPanes.length === 0) return null;
  
  return expandedPanes.reduce((lru, current) => 
    current.lastAccessTime < lru.lastAccessTime ? current : lru
  );
}

/**
 * Find the most recently used pane among expanded panes
 */
export function findMRUPane(paneStates: PaneState[]): PaneState | null {
  const expandedPanes = paneStates.filter(p => p.isExpanded);
  if (expandedPanes.length === 0) return null;
  
  return expandedPanes.reduce((mru, current) => 
    current.lastAccessTime > mru.lastAccessTime ? current : mru
  );
}

/**
 * Sort panes by last access time (most recent first)
 */
export function sortByAccessTime(paneStates: PaneState[]): PaneState[] {
  return [...paneStates].sort((a, b) => b.lastAccessTime - a.lastAccessTime);
}

/**
 * Get panes that can be collapsed (expanded panes that aren't the only expanded one)
 */
export function getCollapsiblePanes(paneStates: PaneState[]): PaneState[] {
  const expandedPanes = paneStates.filter(p => p.isExpanded);
  return expandedPanes.length > 1 ? expandedPanes : [];
}

/**
 * Calculate optimal sizes for Allotment based on expansion states
 */
export function calculateOptimalSizes(
  paneStates: PaneState[],
  totalSpace: number = 1000,
  defaultCollapsedSize: number = 60
): number[] {
  const expandedPanes = paneStates.filter(p => p.isExpanded);
  const collapsedPanes = paneStates.filter(p => !p.isExpanded);
  
  if (expandedPanes.length === 0) {
    // All collapsed - equal distribution
    const sizePerPane = totalSpace / paneStates.length;
    return paneStates.map(() => sizePerPane);
  }
  
  // Calculate space for collapsed panes
  const collapsedSpace = collapsedPanes.reduce((sum, pane) => 
    sum + (pane.collapsedSize || defaultCollapsedSize), 0
  );
  
  // Remaining space for expanded panes
  const expandedSpace = Math.max(0, totalSpace - collapsedSpace);
  const sizePerExpanded = expandedSpace / expandedPanes.length;
  
  return paneStates.map(pane => 
    pane.isExpanded 
      ? sizePerExpanded 
      : pane.collapsedSize || defaultCollapsedSize
  );
}

/**
 * Create auto-expand configuration for common scenarios
 */
export const AutoExpandPresets = {
  /** No auto-expand */
  none: undefined,
  
  /** Auto-expand on task completion (sequential workflow) */
  sequential: {
    onComplete: true,
    onStart: false,
  },
  
  /** Auto-expand when tasks start processing */
  onStart: {
    onComplete: false,
    onStart: true,
  },
  
  /** Auto-expand on both start and completion */
  full: {
    onComplete: true,
    onStart: true,
  },
  
  /** Custom auto-expand that focuses on active panes */
  activeFirst: {
    onComplete: false,
    onStart: true,
    custom: (progress: PaneProgress[], _currentStates: PaneState[]) => {
      // Find pane with highest activity (progress > 0 but < 100)
      const activePanes = progress.filter(p => p.progress > 0 && p.progress < 100);
      if (activePanes.length === 0) return null;
      
      // Prioritize by highest progress
      const mostActive = activePanes.reduce((max, current) =>
        current.progress > max.progress ? current : max
      );
      
      return mostActive.paneId;
    },
  },
  
  /** Custom auto-expand that prioritizes completed panes */
  completedFirst: {
    onComplete: true,
    onStart: false,
    custom: (progress: PaneProgress[], _currentStates: PaneState[]) => {
      // Find recently completed panes and expand the next logical one
      const completedPanes = progress.filter(p => p.progress === 100);
      const incompletePanes = progress.filter(p => p.progress < 100 && p.progress > 0);
      
      if (completedPanes.length > 0 && incompletePanes.length > 0) {
        // Return first incomplete pane
        return incompletePanes[0]?.paneId || null;
      }
      
      return null;
    },
  },
} as const;

/**
 * Batch update multiple pane progress values
 */
export function batchUpdateProgress(
  currentProgress: PaneProgress[],
  updates: Array<{
    paneId: string;
    progress?: number;
    taskCount?: number;
    completedCount?: number;
    status?: string;
  }>
): PaneProgress[] {
  const progressMap = new Map(currentProgress.map(p => [p.paneId, p]));
  
  updates.forEach(update => {
    const existing = progressMap.get(update.paneId);
    if (existing) {
      progressMap.set(update.paneId, {
        ...existing,
        ...update,
        progress: update.progress !== undefined 
          ? Math.max(0, Math.min(100, update.progress))
          : existing.progress,
      });
    } else {
      progressMap.set(update.paneId, {
        paneId: update.paneId,
        progress: Math.max(0, Math.min(100, update.progress || 0)),
        taskCount: update.taskCount,
        completedCount: update.completedCount,
        status: update.status,
      });
    }
  });
  
  return Array.from(progressMap.values());
}