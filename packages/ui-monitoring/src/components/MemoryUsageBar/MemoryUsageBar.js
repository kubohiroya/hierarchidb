import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Typography, Tooltip, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';
import { devWarn } from '../../utils/logger';
const BarContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  backgroundColor: theme.palette.grey[200],
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
}));
const BarFill = styled(Box)(({ theme, percentage, severity }) => ({
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
}));
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};
/**
 * メモリ使用量を帯グラフで表示するコンポーネント
 *
 * performance.measureUserAgentSpecificMemory() APIを使用して
 * より詳細なメモリ使用状況を監視し、視覚的に表示します。
 */
export const MemoryUsageBar = ({
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
  const [memoryInfo, setMemoryInfo] = useState({
    used: 0,
    total: maxMemory,
    percentage: 0,
  });
  const [isSupported, setIsSupported] = useState(true);
  const intervalRef = useRef(null);
  const updateMemoryInfo = useCallback(async () => {
    try {
      // 新しいAPIをチェック
      if ('measureUserAgentSpecificMemory' in performance) {
        const result = await performance.measureUserAgentSpecificMemory();
        // 総使用量を計算
        const totalUsed = result.breakdown.reduce((sum, entry) => sum + (entry.bytes || 0), 0);
        // performance.memory からヒープサイズ制限を取得（利用可能な場合）
        let totalMemory = maxMemory;
        if ('memory' in performance) {
          const memory = performance.memory;
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
        const memory = performance.memory;
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
      devWarn('Memory measurement failed:', error);
      // エラー時は古いAPIにフォールバック
      if ('memory' in performance) {
        const memory = performance.memory;
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
  const getSeverity = () => {
    const ratio = memoryInfo.percentage / 100;
    if (ratio >= criticalThreshold) return 'critical';
    if (ratio >= warningThreshold) return 'warning';
    return 'normal';
  };
  const severity = getSeverity();
  if (!isSupported) {
    return _jsx(Paper, {
      sx: {
        width,
        p: compact ? 1 : 2,
        textAlign: 'center',
        opacity: 0.6,
      },
      children: _jsx(Typography, {
        variant: 'caption',
        color: 'text.secondary',
        children: 'Memory monitoring not available in this browser',
      }),
    });
  }
  const tooltipContent = _jsxs(Box, {
    children: [
      _jsx(Typography, {
        variant: 'body2',
        fontWeight: 'bold',
        gutterBottom: true,
        children: 'Memory Usage Details',
      }),
      _jsxs(Typography, { variant: 'caption', children: ['Used: ', formatBytes(memoryInfo.used)] }),
      _jsx('br', {}),
      _jsxs(Typography, {
        variant: 'caption',
        children: ['Total: ', formatBytes(memoryInfo.total)],
      }),
      _jsx('br', {}),
      _jsxs(Typography, {
        variant: 'caption',
        children: ['Percentage: ', memoryInfo.percentage.toFixed(1), '%'],
      }),
      memoryInfo.breakdown &&
        memoryInfo.breakdown.length > 0 &&
        _jsxs(_Fragment, {
          children: [
            _jsx(Box, {
              sx: { mt: 1 },
              children: _jsx(Typography, {
                variant: 'caption',
                fontWeight: 'bold',
                children: 'Breakdown by Origin:',
              }),
            }),
            memoryInfo.breakdown.slice(0, 5).map((entry, index) =>
              _jsx(
                Box,
                {
                  children: _jsxs(Typography, {
                    variant: 'caption',
                    sx: { fontSize: '0.7rem' },
                    children: [
                      '\u2022 ',
                      entry.url || 'Unknown',
                      ': ',
                      formatBytes(entry.bytes || 0),
                    ],
                  }),
                },
                index
              )
            ),
            memoryInfo.breakdown.length > 5 &&
              _jsxs(Typography, {
                variant: 'caption',
                sx: { fontSize: '0.7rem', fontStyle: 'italic' },
                children: ['...and ', memoryInfo.breakdown.length - 5, ' more'],
              }),
          ],
        }),
    ],
  });
  if (compact) {
    return _jsx(Tooltip, {
      title: tooltipContent,
      placement: 'top',
      children: _jsxs(BarContainer, {
        sx: {
          width,
          height,
          cursor: 'help',
        },
        children: [
          _jsx(BarFill, { percentage: memoryInfo.percentage, severity: severity }),
          showValues &&
            _jsx(Box, {
              sx: {
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1,
              },
              children: _jsxs(Typography, {
                variant: 'caption',
                sx: {
                  fontWeight: 'bold',
                  color: memoryInfo.percentage > 50 ? 'white' : 'text.primary',
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                },
                children: [memoryInfo.percentage.toFixed(0), '%'],
              }),
            }),
        ],
      }),
    });
  }
  return _jsxs(Box, {
    sx: { width },
    children: [
      showLabel &&
        _jsxs(Box, {
          sx: { display: 'flex', justifyContent: 'space-between', mb: 0.5 },
          children: [
            _jsx(Typography, {
              variant: 'body2',
              color: 'text.secondary',
              children: 'Memory Usage',
            }),
            showValues &&
              _jsxs(Typography, {
                variant: 'body2',
                color:
                  severity === 'critical'
                    ? 'error.main'
                    : severity === 'warning'
                      ? 'warning.main'
                      : 'text.secondary',
                sx: { fontFamily: 'monospace' },
                children: [formatBytes(memoryInfo.used), ' / ', formatBytes(memoryInfo.total)],
              }),
          ],
        }),
      _jsx(Tooltip, {
        title: tooltipContent,
        placement: 'top',
        children: _jsxs(BarContainer, {
          sx: {
            height,
            cursor: 'help',
          },
          children: [
            _jsx(BarFill, { percentage: memoryInfo.percentage, severity: severity }),
            showValues &&
              !showLabel &&
              _jsx(Box, {
                sx: {
                  position: 'absolute',
                  top: '50%',
                  right: 8,
                  transform: 'translateY(-50%)',
                  zIndex: 1,
                },
                children: _jsxs(Typography, {
                  variant: 'body2',
                  sx: {
                    fontWeight: 'medium',
                    color: memoryInfo.percentage > 70 ? 'white' : 'text.primary',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  },
                  children: [memoryInfo.percentage.toFixed(1), '%'],
                }),
              }),
          ],
        }),
      }),
    ],
  });
};
//# sourceMappingURL=MemoryUsageBar.js.map
