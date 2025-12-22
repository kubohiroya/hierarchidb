import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  cacheColumnWidths,
  columnWidthsEqual,
  loadCachedColumnWidths,
  mergeWithDefaults,
  resolveInitialColumnWidths,
} from '../../utils/column-width-cache.js';
import type { ColumnWidthMap } from '../../utils/column-width-cache.js';

const MIN_COLUMN_WIDTH = 50;
const FIXED_COLUMNS = new Set(['selection']);

export interface UseTreeTableColumnWidthsOptions {
  pageNodeId?: string;
}

export interface UseTreeTableColumnWidthsResult {
  columnWidths: Record<string, number>;
  columnWidthsHydrated: boolean;
  resizingColumn: string | null;
  containerRef: RefObject<HTMLDivElement | null>;
  setContainerElement: (element: HTMLDivElement | null) => void;
  setObserverTarget: (element: HTMLElement | null) => void;
  handleResizeStart: (leftColumnId: string, rightColumnId: string, event: ReactMouseEvent) => void;
}

const applyColumnMap = (
  source: ColumnWidthMap | null | undefined,
  setter: React.Dispatch<React.SetStateAction<Record<string, number>>>,
) => {
  setter((prev) => {
    const next = mergeWithDefaults(source);
    return columnWidthsEqual(prev, next) ? prev : next;
  });
};

export function useTreeTableColumnWidths({ pageNodeId }: UseTreeTableColumnWidthsOptions): UseTreeTableColumnWidthsResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const observerTargetRef = useRef<HTMLElement | null>(null);
  const resizeRef = useRef<{
    startX: number;
    leftStart: number;
    rightStart: number;
    leftId: string;
    rightId: string;
  }>({ startX: 0, leftStart: 0, rightStart: 0, leftId: '', rightId: '' });

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => resolveInitialColumnWidths(pageNodeId));
  const [columnWidthsHydrated, setColumnWidthsHydrated] = useState<boolean>(!pageNodeId);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);

  // Hydrate widths from cache/IndexedDB
  useEffect(() => {
    setColumnWidthsHydrated(false);

    const hydrate = (source: ColumnWidthMap | null | undefined, markHydrated = false) => {
      applyColumnMap(source, setColumnWidths);
      if (markHydrated) {
        setColumnWidthsHydrated(true);
      }
    };

    if (!pageNodeId) {
      hydrate(null, true);
      return;
    }

    const cached = loadCachedColumnWidths(pageNodeId);
    hydrate(cached, !!cached);

    let cancelled = false;
    (async () => {
      const { getColumnWidths } = await import('../../state/column-widths-db.js');
      const saved = await getColumnWidths(pageNodeId);
      if (cancelled) return;
      if (saved) {
        cacheColumnWidths(pageNodeId, saved);
        hydrate(saved, true);
      } else {
        setColumnWidthsHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pageNodeId]);

  // Persist column widths when hydrated and changed
  useEffect(() => {
    if (!pageNodeId || !columnWidthsHydrated) return;
    cacheColumnWidths(pageNodeId, columnWidths);
    (async () => {
      const { saveColumnWidths } = await import('../../state/column-widths-db.js');
      await saveColumnWidths(pageNodeId, columnWidths);
    })();
  }, [columnWidths, columnWidthsHydrated, pageNodeId]);

  // Adjust column widths when container is resized
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observerTarget = observerTargetRef.current ?? container;
    if (!observerTarget) return;

    let raf = 0;
    let ro: ResizeObserver | null = null;

    const measure = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.floor(container.clientWidth || rect.width);
      if (Number.isNaN(width) || width <= 0) return;

      setColumnWidths((prev) => {
        const fixedSum = Object.entries(prev)
          .filter(([key]) => FIXED_COLUMNS.has(key))
          .reduce((sum, [, value]) => sum + (value || 0), 0);
        const adjustableEntries = Object.entries(prev).filter(([key]) => !FIXED_COLUMNS.has(key));
        if (adjustableEntries.length === 0) return prev;

        const currentAdjustableSum = adjustableEntries.reduce((sum, [, value]) => sum + (value || 0), 0);
        const targetAdjustableSum = Math.max(MIN_COLUMN_WIDTH * adjustableEntries.length, width - fixedSum);
        if (targetAdjustableSum <= 0 || currentAdjustableSum <= 0) return prev;
        if (Math.abs(targetAdjustableSum - currentAdjustableSum) < 1) return prev;

        const scale = targetAdjustableSum / currentAdjustableSum;
        const next = { ...prev };
        adjustableEntries.forEach(([key], index) => {
          const current = prev[key] || MIN_COLUMN_WIDTH;
          let resized = Math.max(MIN_COLUMN_WIDTH, Math.round(current * scale));
          if (index === adjustableEntries.length - 1) {
            const sumSoFar = adjustableEntries
              .slice(0, -1)
              .reduce((sum, [k]) => sum + (next[k] || 0), 0);
            resized = Math.max(MIN_COLUMN_WIDTH, targetAdjustableSum - sumSoFar);
          }
          next[key] = resized;
        });
        return columnWidthsEqual(prev as ColumnWidthMap, next as ColumnWidthMap) ? prev : next;
      });
    };

    measure();

    try {
      ro = new ResizeObserver(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(measure);
      });
      ro.observe(observerTarget);
    } catch {
      const onWindowResize = () => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(measure);
      };
      window.addEventListener('resize', onWindowResize);
      return () => {
        window.removeEventListener('resize', onWindowResize);
        if (raf) cancelAnimationFrame(raf);
      };
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);

  const handleResizeStart = useCallback((leftColumnId: string, rightColumnId: string, event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const handleRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const startX = handleRect.left + handleRect.width / 2;
    const leftStart = columnWidths[leftColumnId] || 100;
    const rightStart = columnWidths[rightColumnId] || 100;

    resizeRef.current = { startX, leftStart, rightStart, leftId: leftColumnId, rightId: rightColumnId };
    setResizingColumn(leftColumnId);

    const handleMouseMove = (nativeEvent: MouseEvent) => {
      const { startX: originX, leftStart: initialLeft, rightStart: initialRight, leftId, rightId } = resizeRef.current;
      const deltaX = nativeEvent.clientX - originX;
      const maxPositive = initialRight - MIN_COLUMN_WIDTH;
      const maxNegative = initialLeft - MIN_COLUMN_WIDTH;
      const clamped = Math.max(-maxNegative, Math.min(deltaX, maxPositive));
      const leftNew = Math.max(MIN_COLUMN_WIDTH, initialLeft + clamped);
      const rightNew = Math.max(MIN_COLUMN_WIDTH, initialRight - clamped);
      setColumnWidths((prev) => ({ ...prev, [leftId]: leftNew, [rightId]: rightNew }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths]);

  const setContainerElement = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element;
  }, []);

  const setObserverTarget = useCallback((element: HTMLElement | null) => {
    observerTargetRef.current = element;
  }, []);

  return {
    columnWidths,
    columnWidthsHydrated,
    resizingColumn,
    containerRef,
    setContainerElement,
    setObserverTarget,
    handleResizeStart,
  };
}
