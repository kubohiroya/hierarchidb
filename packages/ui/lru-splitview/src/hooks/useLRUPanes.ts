/**
 * @fileoverview Hook for managing LRU (Least Recently Used) pane expansion
 * @module @hierarchidb/ui-lru-splitview/hooks
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import type { 
  PaneState, 
  LRUSplitViewConfig,
  UseLRUPanesResult 
} from '../types/LRUSplitView';

const DEFAULT_MAX_EXPANDED = 2;
const DEFAULT_COLLAPSED_SIZE = 60;

/**
 * Hook for managing LRU pane expansion with intelligent auto-expand behavior
 */
export function useLRUPanes({
  panes,
  maxExpandedPanes = DEFAULT_MAX_EXPANDED,
  defaultCollapsedSize = DEFAULT_COLLAPSED_SIZE,
  autoExpand,
  progress = [],
  onPaneToggle,
}: Pick<LRUSplitViewConfig, 'panes' | 'maxExpandedPanes' | 'defaultCollapsedSize' | 'autoExpand' | 'progress' | 'onPaneToggle'>): UseLRUPanesResult {
  const theme = useTheme();

  // Generate default colors based on theme
  const generateDefaultColor = useCallback((index: number) => {
    const colors = theme.palette.mode === 'dark' 
      ? [
          'rgba(245, 245, 245, 0.08)', // Light gray
          'rgba(63, 81, 181, 0.08)',   // Indigo
          'rgba(156, 39, 176, 0.08)',  // Purple
          'rgba(76, 175, 80, 0.08)',   // Green
          'rgba(255, 152, 0, 0.08)',   // Orange
          'rgba(244, 67, 54, 0.08)',   // Red
        ]
      : [
          '#f5f5f5', // Light gray
          '#efefff', // Light indigo
          '#fff0ff', // Light purple
          '#efffef', // Light green
          '#fff8e1', // Light orange
          '#ffebee', // Light red
        ];
    return colors[index % colors.length];
  }, [theme.palette.mode]);

  // Initialize pane states
  const initialPaneStates = useMemo<PaneState[]>(() => {
    return panes.map((pane, index) => ({
      id: pane.id,
      title: pane.title,
      icon: pane.icon,
      isExpanded: pane.defaultExpanded ?? false,
      lastAccessTime: pane.defaultExpanded ? Date.now() : 0,
      color: (pane.color || generateDefaultColor(index)) as string,
      collapsedSize: pane.collapsedSize ?? defaultCollapsedSize,
    }));
  }, [panes, generateDefaultColor, defaultCollapsedSize]);

  const [paneStates, setPaneStates] = useState<PaneState[]>(initialPaneStates);

  // Track previous progress for auto-expand detection
  const [prevProgress, setPrevProgress] = useState<Record<string, number>>({});

  // LRU management function
  const expandPaneLRU = useCallback((
    currentStates: PaneState[],
    paneId: string,
  ): PaneState[] => {
    const now = Date.now();
    const expandedPanes = currentStates.filter((p) => p.isExpanded);

    // If already at max capacity, close the oldest one
    if (expandedPanes.length >= maxExpandedPanes) {
      const oldestPane = expandedPanes.reduce((oldest, current) =>
        current.lastAccessTime < oldest.lastAccessTime ? current : oldest,
      );

      return currentStates.map((pane) => ({
        ...pane,
        isExpanded:
          pane.id === paneId
            ? true
            : pane.id === oldestPane.id
              ? false
              : pane.isExpanded,
        lastAccessTime: pane.id === paneId ? now : pane.lastAccessTime,
      }));
    }

    // Otherwise just expand the requested pane
    return currentStates.map((pane) => ({
      ...pane,
      isExpanded: pane.id === paneId ? true : pane.isExpanded,
      lastAccessTime: pane.id === paneId ? now : pane.lastAccessTime,
    }));
  }, [maxExpandedPanes]);

  // Toggle pane expansion
  const togglePane = useCallback((paneId: string) => {
    setPaneStates((prev) => {
      const pane = prev.find((p) => p.id === paneId);
      if (!pane) return prev;

      const newIsExpanded = !pane.isExpanded;
      let newStates: PaneState[];

      if (pane.isExpanded) {
        // Simply collapse the pane
        newStates = prev.map((p) => ({
          ...p,
          isExpanded: p.id === paneId ? false : p.isExpanded,
        }));
      } else {
        // Expand using LRU logic
        newStates = expandPaneLRU(prev, paneId);
      }

      // Notify callback
      onPaneToggle?.(paneId, newIsExpanded);
      
      return newStates;
    });
  }, [expandPaneLRU, onPaneToggle]);

  // Expand specific pane
  const expandPane = useCallback((paneId: string) => {
    setPaneStates((prev) => {
      const pane = prev.find((p) => p.id === paneId);
      if (!pane || pane.isExpanded) return prev;

      const newStates = expandPaneLRU(prev, paneId);
      onPaneToggle?.(paneId, true);
      return newStates;
    });
  }, [expandPaneLRU, onPaneToggle]);

  // Collapse specific pane
  const collapsePane = useCallback((paneId: string) => {
    setPaneStates((prev) => {
      const pane = prev.find((p) => p.id === paneId);
      if (!pane || !pane.isExpanded) return prev;

      const newStates = prev.map((p) => ({
        ...p,
        isExpanded: p.id === paneId ? false : p.isExpanded,
      }));
      
      onPaneToggle?.(paneId, false);
      return newStates;
    });
  }, [onPaneToggle]);

  // Expand multiple panes
  const expandPanes = useCallback((paneIds: string[]) => {
    setPaneStates((prev) => {
      let newStates = [...prev];
      
      paneIds.forEach(paneId => {
        const pane = newStates.find(p => p.id === paneId);
        if (pane && !pane.isExpanded) {
          newStates = expandPaneLRU(newStates, paneId);
        }
      });
      
      return newStates;
    });
  }, [expandPaneLRU]);

  // Collapse all panes
  const collapseAll = useCallback(() => {
    setPaneStates((prev) => 
      prev.map((pane) => ({
        ...pane,
        isExpanded: false,
      }))
    );
  }, []);

  // Get expanded pane IDs
  const getExpandedPanes = useCallback(() => {
    return paneStates.filter(p => p.isExpanded).map(p => p.id);
  }, [paneStates]);

  // Calculate sizes for Allotment
  const getSizes = useCallback(() => {
    const expandedPanes = paneStates.filter((p) => p.isExpanded);
    const expandedCount = expandedPanes.length;

    if (expandedCount === 0) {
      // All collapsed - equal distribution of available space
      const availableSpace = 1000;
      const sizePerPane = availableSpace / paneStates.length;
      return paneStates.map(() => sizePerPane);
    }

    // Calculate sizes based on expansion state
    if (expandedCount === 1) {
      // Single expanded pane gets most space
      return paneStates.map((pane) =>
        pane.isExpanded ? 1000 : pane.collapsedSize || DEFAULT_COLLAPSED_SIZE,
      );
    } else {
      // Multiple expanded panes share space equally
      const spacePerExpanded = 1000 / expandedCount;
      return paneStates.map((pane) => 
        pane.isExpanded 
          ? spacePerExpanded 
          : pane.collapsedSize || DEFAULT_COLLAPSED_SIZE
      );
    }
  }, [paneStates]);

  // Auto-expand based on progress changes
  useEffect(() => {
    if (!autoExpand || progress.length === 0) return;

    const autoExpandPane = (paneId: string) => {
      setPaneStates((prev) => {
        const pane = prev.find((p) => p.id === paneId);
        if (pane && !pane.isExpanded) {
          return expandPaneLRU(prev, paneId);
        }
        return prev;
      });
    };

    // Check for completion-based auto-expand
    if (autoExpand.onComplete) {
      progress.forEach(progressInfo => {
        const prevProgressValue = prevProgress[progressInfo.paneId] || 0;
        if (prevProgressValue < 100 && progressInfo.progress === 100) {
          // Find next pane to expand (simple sequential logic)
          const currentIndex = panes.findIndex(p => p.id === progressInfo.paneId);
          if (currentIndex >= 0 && currentIndex < panes.length - 1) {
            const nextPane = panes[currentIndex + 1];
            if (nextPane) {
              autoExpandPane(nextPane.id);
            }
          }
        }
      });
    }

    // Check for start-based auto-expand
    if (autoExpand.onStart) {
      progress.forEach(progressInfo => {
        if (progressInfo.progress > 0 && progressInfo.progress < 100) {
          autoExpandPane(progressInfo.paneId);
        }
      });
    }

    // Custom auto-expand logic
    if (autoExpand.custom) {
      const targetPaneId = autoExpand.custom(progress, paneStates);
      if (targetPaneId) {
        autoExpandPane(targetPaneId);
      }
    }

    // Update previous progress
    const newPrevProgress = progress.reduce((acc, p) => {
      acc[p.paneId] = p.progress;
      return acc;
    }, {} as Record<string, number>);
    setPrevProgress(newPrevProgress);
  }, [progress, prevProgress, autoExpand, panes, paneStates, expandPaneLRU]);

  return {
    paneStates,
    togglePane,
    expandPane,
    collapsePane,
    expandPanes,
    collapseAll,
    getExpandedPanes,
    getSizes,
  };
}