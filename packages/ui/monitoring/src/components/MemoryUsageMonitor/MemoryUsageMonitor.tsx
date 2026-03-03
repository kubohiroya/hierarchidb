import { DragIndicator } from '@mui/icons-material';
import { Box, Tooltip } from '@mui/material';
import { isProdEnv } from '~/utils/env';
import { MemoryUsageChart } from '~/components/MemoryUsageBar/index';
import { MemoryUsageBar } from '~/components/MemoryUsageBar/MemoryUsageBar';
import { useMemoryUsageMonitor } from './useMemoryUsageMonitor';

interface DevelopmentTimestampProps {
  className?: string;
}

export function MemoryUsageMonitor({ className }: DevelopmentTimestampProps) {
  const {
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
  } = useMemoryUsageMonitor();

  if (isProdEnv() || !mounted || !visible) {
    return null;
  }

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
        alignItems: 'stretch',
        userSelect: 'none',
        transition: isDragging || isResizing ? 'none' : 'all 0.3s ease',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
        },
        resize: 'none',
      }}
    >
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
              updateInterval={10000}
              warningThreshold={0.7}
              criticalThreshold={0.9}
            />
          ) : (
            <>
              <MemoryUsageChart
                width="100%"
                height={dimensions.height}
                updateInterval={10000}
                warningThreshold={0.7}
                criticalThreshold={0.9}
                maxDataPoints={30}
              />
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
