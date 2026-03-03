import { useEffect, useMemo, useRef, useState } from 'react';
import type { LRUSplitViewConfig } from '~/types/LRUSplitView';

interface UseLRUSplitViewLayoutArgs extends Pick<
  LRUSplitViewConfig,
  'panes' | 'maxExpandedPanes' | 'responsiveBreakpoints' | 'initialPaneSizesByBreakpoint' | 'autoCloseCountsByBreakpoint' | 'autoExpand' | 'progress'
> {}

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

export const useLRUSplitViewLayout = ({
  panes,
  maxExpandedPanes = 2,
  responsiveBreakpoints,
  initialPaneSizesByBreakpoint,
  autoCloseCountsByBreakpoint,
  autoExpand,
  progress = [],
}: UseLRUSplitViewLayoutArgs) => {
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
  const effectivePanes = useMemo(() => {
    if (autoCloseCount !== 0) return panes;
    return panes.map((pane) => ({
      ...pane,
      defaultExpanded: true,
    }));
  }, [autoCloseCount, panes]);

  const getProgressForPane = (paneId: string) => progress.find((p) => p.paneId === paneId);
  const getPaneConfig = (paneId: string) => effectivePanes.find((p) => p.id === paneId);

  return {
    containerRef,
    containerWidth,
    breakpointIndex,
    responsiveMaxExpandedPanes,
    responsiveInitialSizes,
    responsiveAutoExpand,
    equalizeOnAllExpanded,
    effectivePanes,
    getProgressForPane,
    getPaneConfig,
  };
};
