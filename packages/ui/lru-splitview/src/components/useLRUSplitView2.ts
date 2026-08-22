import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLRUPanes } from '~/hooks/useLRUPanes';
import type { LRUSplitViewConfig, PaneProgress, PaneState } from '~/types/LRUSplitView';

type LRUSplitView2PaneLike = {
  id: string;
  defaultExpanded?: boolean;
  collapsedSize?: number;
};

const resolveBreakpointIndex = (width: number, breakpoints?: number[]) => {
  if (!breakpoints || breakpoints.length === 0) return 0;
  const foundIndex = breakpoints.findIndex((bp) => width <= bp);
  return foundIndex === -1 ? breakpoints.length : foundIndex;
};

const resolveByBreakpoint = <T>(values: T[] | undefined, index: number) => {
  if (!values || values.length === 0) return undefined;
  const safeIndex = Math.min(index, values.length - 1);
  return values[safeIndex];
};

type UseLRUSplitView2Params = {
  panes: LRUSplitView2PaneLike[];
  maxExpandedPanes: number;
  responsiveBreakpoints?: number[];
  initialPaneSizesByBreakpoint?: number[][];
  autoCloseCountsByBreakpoint?: number[];
  defaultCollapsedSize: number;
  autoExpand?: LRUSplitViewConfig['autoExpand'];
  progress: PaneProgress[];
  onPaneToggle?: (paneId: string, isExpanded: boolean) => void;
  onPaneReorder?: (paneIds: string[]) => void;
};

type UseLRUSplitView2Result = {
  containerRef: RefObject<HTMLDivElement | null>;
  paneStates: PaneState[];
  sizes: number[];
  layoutKey: string;
  handlePaneReorder: () => void;
  togglePane: (paneId: string) => void;
};

export const useLRUSplitView2 = ({
  panes,
  maxExpandedPanes,
  responsiveBreakpoints,
  initialPaneSizesByBreakpoint,
  autoCloseCountsByBreakpoint,
  defaultCollapsedSize,
  autoExpand,
  progress,
  onPaneToggle,
  onPaneReorder,
}: UseLRUSplitView2Params): UseLRUSplitView2Result => {
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
    [containerWidth, responsiveBreakpoints]
  );
  const autoCloseCount = useMemo(
    () => resolveByBreakpoint(autoCloseCountsByBreakpoint, breakpointIndex),
    [autoCloseCountsByBreakpoint, breakpointIndex]
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

  const paneConfigs = useMemo(
    () =>
      panes.map((pane) => ({
        id: pane.id,
        title: pane.id,
        defaultExpanded: pane.defaultExpanded,
        collapsedSize: pane.collapsedSize,
        content: null,
      })),
    [panes]
  );

  const { paneStates, togglePane, getSizes } = useLRUPanes({
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

  const handlePaneReorder = useCallback(() => {
    if (!onPaneReorder) return;
    const expandedPanes = paneStates.filter((pane) => pane.isExpanded);
    onPaneReorder(expandedPanes.map((pane) => pane.id));
  }, [onPaneReorder, paneStates]);

  return {
    containerRef,
    paneStates,
    sizes,
    layoutKey,
    handlePaneReorder,
    togglePane,
  };
};
