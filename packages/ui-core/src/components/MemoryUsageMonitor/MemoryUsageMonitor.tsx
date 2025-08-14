import { Box, Tooltip } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MemoryUsageBar, MemoryUsageChart } from '@/components/ui/MemoryUsageBar';
import { DragIndicator } from '@mui/icons-material';

interface DevelopmentTimestampProps {
  className?: string;
}

type DisplayMode = 'bar' | 'chart';

interface ChartDimensions {
  width: number;
  height: number;
}

/**
 * 開発環境でメモリ使用量を表示するコンポーネント
 * ドラッグ操作により自由に位置を移動できます
 * ダブルクリックでバー表示とチャート表示を切り替えます
 */
export function MemoryUsageMonitor({ className }: DevelopmentTimestampProps) {
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

    // Set default position based on window size
    const defaultX = window.innerWidth - 184;
    const defaultY = window.innerHeight - 30;

    // Load saved position from localStorage
    const savedPosition = localStorage.getItem('memoryUsageBarPosition');
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        setPosition(parsed);
      } catch (e) {
        // Use default position if parsing fails
        setPosition({ x: defaultX, y: defaultY });
      }
    } else {
      setPosition({ x: defaultX, y: defaultY });
    }

    // Load saved display mode
    const savedMode = localStorage.getItem('memoryUsageDisplayMode');
    if (savedMode === 'bar' || savedMode === 'chart') {
      setDisplayMode(savedMode);
    }

    // Load saved visibility state
    const savedVisibility = localStorage.getItem('memoryMonitorVisible');
    if (savedVisibility === 'true') {
      setVisible(true);
    }

    // Load saved chart dimensions
    const savedDimensions = localStorage.getItem('memoryUsageChartDimensions');
    if (savedDimensions) {
      try {
        const parsed = JSON.parse(savedDimensions);
        setChartDimensions(parsed);
      } catch (e) {
        // Use default dimensions if parsing fails
      }
    }
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if clicking on resize handle
      if (target.closest('[data-resize-handle]')) {
        if (!dragRef.current) return;

        resizeStartSize.current = { ...chartDimensions };
        resizeStartPos.current = { x: e.clientX, y: e.clientY };

        setIsResizing(true);
        e.preventDefault();
        return;
      }

      // Only start dragging if clicking on the drag handle
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

      // Ensure the component stays within viewport bounds
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
      // Save position to localStorage
      localStorage.setItem('memoryUsageBarPosition', JSON.stringify(position));
    }

    if (isResizing) {
      setIsResizing(false);
      // Save dimensions to localStorage
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

  // Listen for visibility toggle events from UserAvatarMenu
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

  // Only show in development environment and after client-side mount and when visible
  if (import.meta.env.PROD || !mounted || !visible) {
    return null;
  }

  // Dynamic sizing based on display mode
  const dimensions = displayMode === 'chart' ? chartDimensions : { width: 180, height: 17 };

  // Larger drag handle width for chart mode for better usability
  const dragHandleWidth = displayMode === 'chart' ? 32 : 24;

  return (
    <Box
      ref={dragRef}
      className={className}
      onMouseDown={handleMouseDown}
      sx={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9999,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 1,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        minWidth: dimensions.width + dragHandleWidth,
        display: 'flex',
        alignItems: 'stretch', // Changed from 'center' to 'stretch' for full-height handle
        userSelect: 'none',
        transition: isDragging || isResizing ? 'none' : 'all 0.3s ease',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
        },
        resize: 'none', // Disable browser resize
      }}
    >
      {/* Drag Handle Area */}
      <Tooltip title="ドラッグして移動" placement="right" arrow>
        <Box
          data-drag-handle
          sx={{
            width: dragHandleWidth,
            minHeight: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isDragging ? 'grabbing' : 'grab',
            backgroundColor: isDragging ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.05)',
            borderRadius: '4px 0 0 4px',
            transition: 'all 0.2s',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.15)',
              '& .drag-indicator': {
                opacity: 1,
                transform: 'scale(1.1)',
              },
            },
            // Visual feedback for better affordance
            borderRight: '1px solid rgba(0, 0, 0, 0.08)',
          }}
        >
          <DragIndicator
            className="drag-indicator"
            sx={{
              fontSize: displayMode === 'chart' ? 20 : 16,
              color: 'text.secondary',
              opacity: isDragging ? 1 : 0.6,
              transition: 'all 0.2s',
            }}
          />
        </Box>
      </Tooltip>

      {/* Content Area */}
      <Tooltip title="ダブルクリックで表示切替" placement="top" arrow>
        <Box
          onDoubleClick={handleDoubleClick}
          sx={{
            flex: 1,
            padding: 0.5,
            cursor: 'pointer',
            minWidth: dimensions.width,
            position: 'relative',
          }}
        >
          {displayMode === 'bar' ? (
            <MemoryUsageBar
              width="100%"
              height={dimensions.height}
              compact={true}
              showValues={true}
              updateInterval={10000} // 10秒ごとに更新
              warningThreshold={0.7}
              criticalThreshold={0.9}
            />
          ) : (
            <>
              <MemoryUsageChart
                width="100%"
                height={dimensions.height}
                updateInterval={10000} // 10秒ごとに更新
                warningThreshold={0.7}
                criticalThreshold={0.9}
                maxDataPoints={30}
              />
              {/* Resize Handle - only show for chart mode */}
              <Box
                data-resize-handle
                sx={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 16,
                  height: 16,
                  cursor: isResizing ? 'nwse-resize' : 'nwse-resize',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    width: 0,
                    height: 0,
                    borderStyle: 'solid',
                    borderWidth: '0 0 8px 8px',
                    borderColor: 'transparent transparent #666 transparent',
                    opacity: 0.5,
                    transition: 'opacity 0.2s',
                  },
                  '&:hover::after': {
                    opacity: 0.8,
                  },
                }}
              />
            </>
          )}
        </Box>
      </Tooltip>
    </Box>
  );
}
