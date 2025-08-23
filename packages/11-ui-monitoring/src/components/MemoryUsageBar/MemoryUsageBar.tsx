import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Typography, Tooltip, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';
import { formatBytes } from '@hierarchidb/00-core';
import { devWarn } from '../../utils/logger';
export interface MemoryUsageBarProps {
  /** 幅 (例: '300px', '100%') */
  width?: string | number;
  /** 高さ (例: '40px') */
  height?: string | number;
  /** 更新間隔（ミリ秒） */
  updateInterval?: number;
  /** 使用量の警告しきい値（0-1） */
  warningThreshold?: number;
  /** 使用量の危険しきい値（0-1） */
  criticalThreshold?: number;
  /** ラベルを表示するか */
  showLabel?: boolean;
  /** 数値を表示するか */
  showValues?: boolean;
  /** コンパクトモード */
  compact?: boolean;
  /** 最大メモリサイズ（バイト）- 自動検出できない場合のフォールバック */
  maxMemory?: number;
}

interface MemoryInfo {
  used: number;
  total: number;
  percentage: number;
  breakdown?: Array<{
    url?: string;
    bytes?: number;
    types?: string[];
  }>;
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
 * メモリ使用量を帯グラフで表示するコンポーネント
 *
 * performance.measureUserAgentSpecificMemory() APIを使用して
 * より詳細なメモリ使用状況を監視し、視覚的に表示します。
 */
export const MemoryUsageBar: React.FC<MemoryUsageBarProps> = ({
  width = '100%',
  height = 32,
  updateInterval = 10000, // measureUserAgentSpecificMemory は頻繁に呼べないため最小10秒
  warningThreshold = 0.7,
  criticalThreshold = 0.9,
  showLabel = true,
  showValues = true,
  compact = false,
  maxMemory = 4 * 1024 * 1024 * 1024, // デフォルト4GB
}) => {
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo>({
    used: 0,
    total: maxMemory,
    percentage: 0,
  });
  const [isSupported, setIsSupported] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateMemoryInfo = useCallback(async () => {
    try {
      // 新しいAPIをチェック
      if ('measureUserAgentSpecificMemory' in performance) {
        const result = await (
          performance as unknown as {
            measureUserAgentSpecificMemory: () => Promise<{ breakdown: Array<{ bytes?: number }> }>;
          }
        ).measureUserAgentSpecificMemory();

        // 総使用量を計算
        const totalUsed = result.breakdown.reduce(
          (sum: number, entry: { bytes?: number }) => sum + (entry.bytes || 0),
          0
        );

        // performance.memory からヒープサイズ制限を取得（利用可能な場合）
        let totalMemory = maxMemory;
        if ('memory' in performance) {
          const memory = (performance as unknown as { memory: { jsHeapSizeLimit?: number } })
            .memory;
          if (memory.jsHeapSizeLimit) {
            totalMemory = memory.jsHeapSizeLimit;
          }
        }

        const percentage = totalMemory > 0 ? (totalUsed / totalMemory) * 100 : 0;

        setMemoryInfo({
          used: totalUsed,
          total: totalMemory,
          percentage: Math.min(percentage, 100),
          breakdown: result.breakdown,
        });
      } else if ('memory' in performance) {
        // フォールバック: 古いperformance.memory APIを使用
        const memory = (
          performance as unknown as { memory: { usedJSHeapSize: number; jsHeapSizeLimit?: number } }
        ).memory;
        const used = memory.usedJSHeapSize;
        const total = memory.jsHeapSizeLimit || maxMemory;
        const percentage = total > 0 ? (used / total) * 100 : 0;

        setMemoryInfo({
          used,
          total,
          percentage: Math.min(percentage, 100),
        });
      } else {
        setIsSupported(false);
      }
    } catch (error) {
      devWarn('Memory measurement failed:', String(error));

      // エラー時は古いAPIにフォールバック
      if ('memory' in performance) {
        const memory = (
          performance as unknown as { memory: { usedJSHeapSize: number; jsHeapSizeLimit?: number } }
        ).memory;
        const used = memory.usedJSHeapSize;
        const total = memory.jsHeapSizeLimit || maxMemory;
        const percentage = total > 0 ? (used / total) * 100 : 0;

        setMemoryInfo({
          used,
          total,
          percentage: Math.min(percentage, 100),
        });
      }
    }
  }, [maxMemory]);

  useEffect(() => {
    // 初回更新
    updateMemoryInfo();

    // 最小間隔を10秒に制限（measureUserAgentSpecificMemoryの制約）
    const safeInterval = Math.max(updateInterval, 10000);

    // 定期更新を開始
    intervalRef.current = setInterval(updateMemoryInfo, safeInterval);

    // クリーンアップ
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [updateInterval, updateMemoryInfo]);

  const getSeverity = (): 'normal' | 'warning' | 'critical' => {
    const ratio = memoryInfo.percentage / 100;
    if (ratio >= criticalThreshold) return 'critical';
    if (ratio >= warningThreshold) return 'warning';
    return 'normal';
  };

  const severity = getSeverity();

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
            <Box key={index}>
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
                  color: memoryInfo.percentage > 50 ? 'white' : 'text.primary',
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
            <Typography
              variant="body2"
              color={
                severity === 'critical'
                  ? 'error.main'
                  : severity === 'warning'
                    ? 'warning.main'
                    : 'text.secondary'
              }
              sx={{ fontFamily: 'monospace' }}
            >
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
                  color: memoryInfo.percentage > 70 ? 'white' : 'text.primary',
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
