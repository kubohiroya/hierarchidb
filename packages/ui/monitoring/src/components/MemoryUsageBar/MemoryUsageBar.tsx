import { formatBytes } from '@hierarchidb/util';
import { Box, Paper, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import type React from 'react';
import { useMemoryUsageBarView } from './useMemoryUsageBarView.js';

export interface MemoryUsageBarProps {
  /**
   * (: '300px', '100%')
   */
  width?: string | number;
  /**
   * (: '40px')
   */
  height?: string | number;
  /**
   */
  updateInterval?: number;
  /**
   * 0-1
   */
  warningThreshold?: number;
  /**
   * 0-1
   */
  criticalThreshold?: number;
  /**
   */
  showLabel?: boolean;
  /**
   */
  showValues?: boolean;
  /**
   */
  compact?: boolean;
  /**
   * -
   */
  maxMemory?: number;
}

const BarContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  backgroundColor: theme.palette.grey[200],
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
}));

const BarFill = styled(Box)<{ percentage: number; severity: 'normal' | 'warning' | 'critical' }>(
  ({ theme, percentage, severity }) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: `${percentage}%`,
    transition: 'width 0.3s ease-in-out, background-color 0.3s ease-in-out',
    backgroundColor:
      severity === 'critical'
        ? theme.palette.error.main
        : severity === 'warning'
          ? theme.palette.warning.main
          : theme.palette.success.main,
  })
);

// formatBytes now imported from @hierarchidb/core

/**
 * performance.measureUserAgentSpecificMemory() API
 */
export const MemoryUsageBar: React.FC<MemoryUsageBarProps> = ({
  width = '100%',
  height = 32,
  updateInterval = 10000, //  measureUserAgentSpecificMemory 10
  warningThreshold = 0.7,
  criticalThreshold = 0.9,
  showLabel = true,
  showValues = true,
  compact = false,
  maxMemory = 4 * 1024 * 1024 * 1024, //  4GB
}) => {
  const {
    memoryInfo,
    isSupported,
    severity,
    valueColor,
    percentageTextColorCompact,
    percentageTextColorInline,
  } = useMemoryUsageBarView({
    maxMemory,
    updateInterval,
    warningThreshold,
    criticalThreshold,
  });

  if (!isSupported) {
    return (
      <Paper
        sx={{
          width,
          p: compact ? 1 : 2,
          textAlign: 'center',
          opacity: 0.6,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Memory monitoring not available in this browser
        </Typography>
      </Paper>
    );
  }

  const tooltipContent = (
    <Box>
      <Typography variant="body2" fontWeight="bold" gutterBottom>
        Memory Usage Details
      </Typography>
      <Typography variant="caption">Used: {formatBytes(memoryInfo.used)}</Typography>
      <br />
      <Typography variant="caption">Total: {formatBytes(memoryInfo.total)}</Typography>
      <br />
      <Typography variant="caption">Percentage: {memoryInfo.percentage.toFixed(1)}%</Typography>

      {memoryInfo.breakdown && memoryInfo.breakdown.length > 0 && (
        <>
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" fontWeight="bold">
              Breakdown by Origin:
            </Typography>
          </Box>
          {memoryInfo.breakdown.slice(0, 5).map((entry, index) => (
            <Box key={entry.url ?? index}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                • {entry.url || 'Unknown'}: {formatBytes(entry.bytes || 0)}
              </Typography>
            </Box>
          ))}
          {memoryInfo.breakdown.length > 5 && (
            <Typography variant="caption" sx={{ fontSize: '0.7rem', fontStyle: 'italic' }}>
              ...and {memoryInfo.breakdown.length - 5} more
            </Typography>
          )}
        </>
      )}
    </Box>
  );

  if (compact) {
    return (
      <Tooltip title={tooltipContent} placement="top">
        <BarContainer
          sx={{
            width,
            height,
            cursor: 'help',
          }}
        >
          <BarFill percentage={memoryInfo.percentage} severity={severity} />
          {showValues && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 'bold',
                  color: percentageTextColorCompact,
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}
              >
                {memoryInfo.percentage.toFixed(0)}%
              </Typography>
            </Box>
          )}
        </BarContainer>
      </Tooltip>
    );
  }

  return (
    <Box sx={{ width }}>
      {showLabel && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Memory Usage
          </Typography>
          {showValues && (
            <Typography variant="body2" color={valueColor} sx={{ fontFamily: 'monospace' }}>
              {formatBytes(memoryInfo.used)} / {formatBytes(memoryInfo.total)}
            </Typography>
          )}
        </Box>
      )}
      <Tooltip title={tooltipContent} placement="top">
        <BarContainer
          sx={{
            height,
            cursor: 'help',
          }}
        >
          <BarFill percentage={memoryInfo.percentage} severity={severity} />
          {showValues && !showLabel && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                right: 8,
                transform: 'translateY(-50%)',
                zIndex: 1,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 'medium',
                  color: percentageTextColorInline,
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}
              >
                {memoryInfo.percentage.toFixed(1)}%
              </Typography>
            </Box>
          )}
        </BarContainer>
      </Tooltip>
    </Box>
  );
};
