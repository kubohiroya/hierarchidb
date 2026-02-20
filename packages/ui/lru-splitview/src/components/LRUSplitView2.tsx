/**
 * @fileoverview LRUSplitView2 - Split view with LRU pane management and render slots
 * @module @hierarchidb/ui-lru-splitview/components
 */

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';

import { useLRUPanes } from '~/hooks/useLRUPanes';
import type { LRUSplitViewConfig, PaneProgress, PaneState } from '~/types/LRUSplitView';

export type LRUSplitView2Pane = {
  id: string;
  defaultExpanded?: boolean;
  collapsedSize?: number;
};

export type LRUSplitView2RenderContext = {
  id: string;
  isExpanded: boolean;
  collapsedSize: number;
  toggle: () => void;
  state: PaneState;
};

export interface LRUSplitView2Props {
  panes: LRUSplitView2Pane[];
  renderPane: (ctx: LRUSplitView2RenderContext) => React.ReactNode;
  maxExpandedPanes?: number;
  responsiveBreakpoints?: number[];
  initialPaneSizesByBreakpoint?: number[][];
  autoCloseCountsByBreakpoint?: number[];
  defaultCollapsedSize?: number;
  vertical?: boolean;
  autoExpand?: LRUSplitViewConfig['autoExpand'];
  progress?: PaneProgress[];
  onPaneToggle?: (paneId: string, isExpanded: boolean) => void;
  onPaneReorder?: (paneIds: string[]) => void;
  height?: string | number;
  width?: string | number;
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

export const LRUSplitView2: React.FC<LRUSplitView2Props> = ({
  panes,
  renderPane,
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const breakpointIndex = useMemo(
    () => resolveBreakpointIndex(containerWidth, responsiveBreakpoints),
    [containerWidth, responsiveBreakpoints],
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

  const paneConfigs = useMemo(() => panes.map((pane) => ({
    id: pane.id,
    title: pane.id,
    defaultExpanded: pane.defaultExpanded,
    collapsedSize: pane.collapsedSize,
    content: null,
  })), [panes]);

  const {
    paneStates,
    togglePane,
    getSizes,
  } = useLRUPanes({
    panes: paneConfigs,
    maxExpandedPanes: responsiveMaxExpandedPanes,
    initialSizes: responsiveInitialSizes,
    equalizeOnAllExpanded,
    defaultCollapsedSize,
    autoExpand: responsiveAutoExpand,
    progress,
    onPaneToggle,
  });

  const sizes = getSizes(containerWidth > 0 ? containerWidth : undefined);

  const expandedKey = paneStates
    .filter((pane) => pane.isExpanded)
    .map((pane) => pane.id)
    .join('-');
  const layoutKey = `${expandedKey}-${breakpointIndex}`;

  return (
    <Box ref={containerRef} sx={[{ height, width }, sx] as SxProps<Theme>}>
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
        {paneStates.map((state, index) => (
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
              {renderPane({
                id: state.id,
                isExpanded: state.isExpanded,
                collapsedSize: state.collapsedSize ?? defaultCollapsedSize,
                toggle: () => togglePane(state.id),
                state,
              })}
            </Box>
          </Allotment.Pane>
        ))}
      </Allotment>
    </Box>
  );
};
