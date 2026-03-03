import { useCallback, useEffect, useRef, useState } from 'react';

type DisplayMode = 'bar' | 'chart';

interface ChartDimensions {
  width: number;
  height: number;
}

export const useMemoryUsageMonitor = () => {
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('bar');
  const [visible, setVisible] = useState(false);
  const [chartDimensions, setChartDimensions] = useState<ChartDimensions>({
    width: 240,
    height: 150,
  });
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });
  const resizeStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);

    const defaultX = window.innerWidth - 184;
    const defaultY = window.innerHeight - 30;

    const savedPosition = localStorage.getItem('memoryUsageBarPosition');
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        setPosition(parsed);
      } catch (_error) {
        setPosition({ x: defaultX, y: defaultY });
      }
    } else {
      setPosition({ x: defaultX, y: defaultY });
    }

    const savedMode = localStorage.getItem('memoryUsageDisplayMode');
    if (savedMode === 'bar' || savedMode === 'chart') {
      setDisplayMode(savedMode);
    }

    const savedVisibility = localStorage.getItem('memoryMonitorVisible');
    if (savedVisibility === 'true') {
      setVisible(true);
    }

    const savedDimensions = localStorage.getItem('memoryUsageChartDimensions');
    if (savedDimensions) {
      const parsed = JSON.parse(savedDimensions);
      setChartDimensions(parsed);
    }
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;

      if (target.closest('[data-resize-handle]')) {
        if (!dragRef.current) return;

        resizeStartSize.current = { ...chartDimensions };
        resizeStartPos.current = { x: e.clientX, y: e.clientY };

        setIsResizing(true);
        e.preventDefault();
        return;
      }

      if (!target.closest('[data-drag-handle]')) return;
      if (!dragRef.current) return;

      const rect = dragRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      setIsDragging(true);
      e.preventDefault();
    },
    [chartDimensions]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        const deltaX = e.clientX - resizeStartPos.current.x;
        const deltaY = e.clientY - resizeStartPos.current.y;

        const newWidth = Math.max(160, Math.min(600, resizeStartSize.current.width + deltaX));
        const newHeight = Math.max(60, Math.min(300, resizeStartSize.current.height + deltaY));

        setChartDimensions({ width: newWidth, height: newHeight });
        return;
      }

      if (!isDragging || !dragRef.current) return;

      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;

      const maxX = window.innerWidth - dragRef.current.offsetWidth;
      const maxY = window.innerHeight - dragRef.current.offsetHeight;

      const clampedX = Math.max(0, Math.min(newX, maxX));
      const clampedY = Math.max(0, Math.min(newY, maxY));

      setPosition({ x: clampedX, y: clampedY });
    },
    [isDragging, isResizing]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem('memoryUsageBarPosition', JSON.stringify(position));
    }

    if (isResizing) {
      setIsResizing(false);
      localStorage.setItem('memoryUsageChartDimensions', JSON.stringify(chartDimensions));
    }
  }, [isDragging, isResizing, position, chartDimensions]);

  const handleDoubleClick = useCallback(() => {
    const newMode = displayMode === 'bar' ? 'chart' : 'bar';
    setDisplayMode(newMode);
    localStorage.setItem('memoryUsageDisplayMode', newMode);
  }, [displayMode]);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleVisibilityToggle = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.visible === 'boolean') {
        setVisible(customEvent.detail.visible);
      }
    };

    window.addEventListener('memoryMonitorToggle', handleVisibilityToggle);

    return () => {
      window.removeEventListener('memoryMonitorToggle', handleVisibilityToggle);
    };
  }, []);

  const dimensions = displayMode === 'chart' ? chartDimensions : { width: 180, height: 17 };
  const dragHandleWidth = displayMode === 'chart' ? 32 : 24;

  return {
    mounted,
    position,
    isDragging,
    displayMode,
    visible,
    dimensions,
    dragHandleWidth,
    isResizing,
    dragRef,
    handleMouseDown,
    handleDoubleClick,
  };
};
