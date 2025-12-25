/**
 * @fileoverview LRUSplitView - Main split view component with LRU pane management
 * @module @hierarchidb/ui-lru-splitview/components
 */

import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';

import { useLRUPanes } from '../hooks/useLRUPanes.js';
import { PaneHeader } from './PaneHeader.js';
import type { LRUSplitViewConfig } from '../types/LRUSplitView.js';

export interface LRUSplitViewProps extends LRUSplitViewConfig {
  /** Component height */
  height?: string | number;
  /** Component width */
  width?: string | number;
  /** Additional CSS styles */
  sx?: SxProps<Theme>;
}

const resolveBreakpointIndex = (width: number, breakpoints?: number[]) => {
  if (!breakpoints || breakpoints.length === 0) return 0;
  const foundIndex = breakpoints.findIndex((bp) => width <= bp);
  return foundIndex === -1 ? breakpoints.length : foundIndex;
};

const resolveByBreakpoint = <T,>(values: T[] | undefined, index: number) => {
  if (!values || values.length === 0) return undefined;
  const safeIndex = Math.min(index, values.length - 1);
  return values[safeIndex];
};

/**
 * LRUSplitView - Intelligent split view with LRU pane management
 *
 * Features:
 * - LRU (Least Recently Used) pane expansion management
 * - Configurable maximum expanded panes
 * - Auto-expand on progress completion or task start
 * - Customizable pane headers and content
 * - Vertical or horizontal orientation
 * - Smooth animations and transitions
 */
export const LRUSplitView: React.FC<LRUSplitViewProps> = ({
                                                            panes,
                                                            maxExpandedPanes = 2,
                                                            responsiveBreakpoints,
                                                            initialPaneSizesByBreakpoint,
                                                            autoCloseCountsByBreakpoint,
                                                            defaultCollapsedSize = 60,
                                                            vertical = false,
                                                            autoExpand,
                                                            progress = [],
                                                            onPaneToggle,
                                                            onPaneReorder,
                                                            height = '100%',
                                                            width = '100%',
                                                            sx,
                                                          }) => {
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === 'undefined' ? 0 : window.innerWidth,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const breakpointIndex = useMemo(
    () => resolveBreakpointIndex(viewportWidth, responsiveBreakpoints),
    [viewportWidth, responsiveBreakpoints],
  );
  const autoCloseCount = useMemo(
    () => resolveByBreakpoint(autoCloseCountsByBreakpoint, breakpointIndex),
    [autoCloseCountsByBreakpoint, breakpointIndex],
  );
  const responsiveMaxExpandedPanes = useMemo(() => {
    if (autoCloseCount === undefined) return maxExpandedPanes;
    const maxClosable = Math.max(0, panes.length - 1);
    const effectiveCloseCount = Math.min(autoCloseCount, maxClosable);
    return Math.max(1, panes.length - effectiveCloseCount);
  }, [autoCloseCount, maxExpandedPanes, panes.length]);
  const responsiveInitialSizes = useMemo(() => {
    const sizes = resolveByBreakpoint(initialPaneSizesByBreakpoint, breakpointIndex);
    if (!sizes || sizes.length !== panes.length) return undefined;
    return sizes;
  }, [initialPaneSizesByBreakpoint, breakpointIndex, panes.length]);
  const responsiveAutoExpand = useMemo(() => {
    if (autoCloseCount === undefined) return autoExpand;
    return autoCloseCount === 0 ? undefined : autoExpand;
  }, [autoCloseCount, autoExpand]);
  const equalizeOnAllExpanded = autoCloseCount === 0;
  const effectivePanes = useMemo(() => {
    if (autoCloseCount !== 0) return panes;
    return panes.map((pane) => ({
      ...pane,
      defaultExpanded: true,
    }));
  }, [autoCloseCount, panes]);

  const {
    paneStates,
    togglePane,
    getSizes,
  } = useLRUPanes({
    panes: effectivePanes,
    maxExpandedPanes: responsiveMaxExpandedPanes,
    initialSizes: responsiveInitialSizes,
    equalizeOnAllExpanded,
    defaultCollapsedSize,
    autoExpand: responsiveAutoExpand,
    progress,
    onPaneToggle,
  });

  const sizes = getSizes();

  // Find progress info for each pane
  const getProgressForPane = (paneId: string) => {
    return progress.find(p => p.paneId === paneId);
  };

  // Get pane config by ID
  const getPaneConfig = (paneId: string) => {
    return effectivePanes.find(p => p.id === paneId);
  };

  const expandedKey = paneStates
    .filter((pane) => pane.isExpanded)
    .map((pane) => pane.id)
    .join('-');
  const layoutKey = `${expandedKey}-${breakpointIndex}`;

  return (
    <Box sx={[{ height, width }, sx] as SxProps<Theme>}>
      <Allotment
        key={layoutKey}
        vertical={vertical}
        proportionalLayout={false}
        defaultSizes={sizes}
        onDragEnd={() => {
          if (!onPaneReorder) return;
          const expandedPanes = paneStates.filter((pane) => pane.isExpanded);
          onPaneReorder(expandedPanes.map((pane) => pane.id));
        }}
      >
        {paneStates.map((state, index) => {
          const config = getPaneConfig(state.id);
          if (!config) return null;
          const progressInfo = getProgressForPane(state.id);

          return (
            <Allotment.Pane
              key={state.id}
              minSize={state.collapsedSize || defaultCollapsedSize}
              preferredSize={sizes[index]}
            >
              <Box
                sx={{
                  height: '100%',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {config.customHeader || (
                  <PaneHeader
                    pane={config}
                    state={state}
                    progress={progressInfo}
                    onToggle={togglePane}
                  />
                )}

                {(state.isExpanded || !config.content) && (
                  <Box
                    sx={{
                      flex: 1,
                      overflow: 'auto',
                      display: state.isExpanded ? 'block' : 'none',
                    }}
                  >
                    {config.content}
                  </Box>
                )}
              </Box>
            </Allotment.Pane>
          );
        })}
      </Allotment>
    </Box>
  );
};
