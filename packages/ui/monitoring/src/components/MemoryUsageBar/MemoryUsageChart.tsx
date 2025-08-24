import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Typography, Paper, IconButton, Tooltip, useTheme } from '@mui/material';
import { Pause, PlayArrow, Refresh, ZoomIn, ZoomOut } from '@mui/icons-material';

import { devWarn } from '../../utils/logger';
import { formatBytes } from '@hierarchidb/common-core';
interface MemoryDataPoint {
  timestamp: number;
  used: number;
  total: number;
  percentage: number;
  breakdown?: {
    [key: string]: number;
  };
}

interface MemoryUsageChartProps {
  /** チャートの幅 */
  width?: string | number;
  /** チャートの高さ */
  height?: number;
  /** データ収集間隔（ミリ秒） */
  updateInterval?: number;
  /** 表示する時間範囲（秒） */
  timeRange?: number;
  /** 最大データポイント数 */
  maxDataPoints?: number;
  /** カテゴリー別の色 */
  categoryColors?: { [key: string]: string };
  /** 警告しきい値（0-1） */
  warningThreshold?: number;
  /** 危険しきい値（0-1） */
  criticalThreshold?: number;
  /** グリッド線を表示するか */
  showGrid?: boolean;
  /** 凡例を表示するか */
  showLegend?: boolean;
  /** 最大メモリサイズ（バイト） */
  maxMemory?: number;
}

/**
 * メモリ使用量の時系列積み上げ面グラフコンポーネント
 */
export const MemoryUsageChart: React.FC<MemoryUsageChartProps> = ({
  width = '100%',
  height = 300,
  updateInterval = 10000,
  timeRange = 300, // 5分
  maxDataPoints = 100,
  categoryColors = {
    JavaScript: '#F7DF1E',
    DOM: '#E34C26',
    Images: '#00D8FF',
    Styles: '#1572B6',
    Other: '#9CA3AF',
  },
  warningThreshold = 0.7,
  criticalThreshold = 0.9,
  showGrid = true,
  showLegend = true,
  maxMemory = 4 * 1024 * 1024 * 1024, // 4GB
}) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [dataPoints, setDataPoints] = useState<MemoryDataPoint[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isSupported, setIsSupported] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    data: MemoryDataPoint;
  } | null>(null);

  // カテゴリー分類関数
  const categorizeMemory = useCallback(
    (
      breakdown?: Array<{ bytes?: number; types?: string[]; url?: string }>
    ): { [key: string]: number } => {
      const categories: { [key: string]: number } = {
        JavaScript: 0,
        DOM: 0,
        Images: 0,
        Styles: 0,
        Other: 0,
      };

      if (!breakdown) return categories;

      breakdown.forEach((entry) => {
        const bytes = entry.bytes || 0;
        const types = entry.types || [];

        if (types.includes('JavaScript')) {
          categories['JavaScript'] = (categories['JavaScript'] || 0) + bytes;
        } else if (types.includes('DOM')) {
          categories['DOM'] = (categories['DOM'] || 0) + bytes;
        } else if (
          entry.url &&
          (entry.url.includes('.jpg') || entry.url.includes('.png') || entry.url.includes('.gif'))
        ) {
          categories['Images'] = (categories['Images'] || 0) + bytes;
        } else if (entry.url && (entry.url.includes('.css') || types.includes('CSS'))) {
          categories['Styles'] = (categories['Styles'] || 0) + bytes;
        } else {
          categories['Other'] = (categories['Other'] || 0) + bytes;
        }
      });

      return categories;
    },
    []
  );

  // メモリデータ収集関数
  const collectMemoryData = useCallback(async () => {
    if (isPaused) return;

    try {
      let memoryData: MemoryDataPoint;

      if ('measureUserAgentSpecificMemory' in performance) {
        const result = await (
          performance as unknown as {
            measureUserAgentSpecificMemory: () => Promise<{
              breakdown: Array<{ bytes?: number; types?: string[]; url?: string }>;
            }>;
          }
        ).measureUserAgentSpecificMemory();
        const totalUsed = result.breakdown.reduce(
          (sum: number, entry: { bytes?: number }) => sum + (entry.bytes || 0),
          0
        );

        let totalMemory = maxMemory;
        if ('memory' in performance) {
          const memory = (
            performance as unknown as {
              memory: { jsHeapSizeLimit?: number; usedJSHeapSize?: number };
            }
          ).memory;
          if (memory.jsHeapSizeLimit) {
            totalMemory = memory.jsHeapSizeLimit;
          }
        }

        memoryData = {
          timestamp: Date.now(),
          used: totalUsed,
          total: totalMemory,
          percentage: (totalUsed / totalMemory) * 100,
          breakdown: categorizeMemory(result.breakdown),
        };
      } else if ('memory' in performance) {
        const memory = (
          performance as unknown as {
            memory: { jsHeapSizeLimit?: number; usedJSHeapSize?: number };
          }
        ).memory;
        const used = memory.usedJSHeapSize || 0;
        const total = memory.jsHeapSizeLimit || maxMemory;

        memoryData = {
          timestamp: Date.now(),
          used,
          total,
          percentage: total > 0 ? (used / total) * 100 : 0,
          breakdown: {
            JavaScript: used,
            DOM: 0,
            Images: 0,
            Styles: 0,
            Other: 0,
          },
        };
      } else {
        setIsSupported(false);
        return;
      }

      setDataPoints((prev) => {
        const newPoints = [...prev, memoryData];
        // 最大データポイント数を超えたら古いデータを削除
        if (newPoints.length > maxDataPoints) {
          return newPoints.slice(-maxDataPoints);
        }
        return newPoints;
      });
    } catch (error) {
      devWarn('Memory measurement failed:', error);
    }
  }, [isPaused, maxMemory, categorizeMemory, maxDataPoints]);

  // キャンバス描画関数
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || dataPoints.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Retinaディスプレイ対応
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // クリア
    ctx.clearRect(0, 0, rect.width, rect.height);

    const padding = { top: 20, right: 80, bottom: 40, left: 60 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    // 時間範囲の計算
    const now = Date.now();
    const startTime = now - (timeRange * 1000) / zoomLevel;
    const visiblePoints = dataPoints.filter((p) => p.timestamp >= startTime);

    if (visiblePoints.length < 2) return;

    // スケール関数
    const xScale = (timestamp: number) => {
      return padding.left + ((timestamp - startTime) / (now - startTime)) * chartWidth;
    };

    const yScale = (value: number) => {
      const maxValue = Math.max(...visiblePoints.map((p) => p.total));
      return padding.top + (1 - value / maxValue) * chartHeight;
    };

    // グリッド線の描画
    if (showGrid) {
      ctx.strokeStyle = theme.palette.divider;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 2]);

      // 横線
      for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
      }

      // 縦線
      for (let i = 0; i <= 5; i++) {
        const x = padding.left + (chartWidth / 5) * i;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }

    // しきい値ラインの描画
    const maxValue = Math.max(...visiblePoints.map((p) => p.total));

    // 警告ライン
    const warningY = yScale(maxValue * warningThreshold);
    ctx.strokeStyle = theme.palette.warning.main;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding.left, warningY);
    ctx.lineTo(padding.left + chartWidth, warningY);
    ctx.stroke();

    // 危険ライン
    const criticalY = yScale(maxValue * criticalThreshold);
    ctx.strokeStyle = theme.palette.error.main;
    ctx.beginPath();
    ctx.moveTo(padding.left, criticalY);
    ctx.lineTo(padding.left + chartWidth, criticalY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 積み上げエリアの描画
    const categories = Object.keys(categoryColors);
    const paths: { [key: string]: Path2D } = {};

    categories.forEach((category) => {
      paths[category] = new Path2D();
    });

    // 各カテゴリーの累積値を計算して描画
    visiblePoints.forEach((point, index) => {
      const x = xScale(point.timestamp);
      let cumulativeY = 0;

      categories.forEach((category) => {
        const value = point.breakdown?.[category] || 0;
        const y = yScale(cumulativeY + value);

        const path = paths[category];
        if (path) {
          if (index === 0) {
            path.moveTo(x, y);
          } else {
            path.lineTo(x, y);
          }
        }

        cumulativeY += value;
      });
    });

    // 各エリアを塗りつぶし
    categories.reverse().forEach((category, index) => {
      const color = categoryColors[category];
      if (!color) return;

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;

      const categoryPath = paths[category];
      if (!categoryPath) return;

      const path = new Path2D();
      path.addPath(categoryPath);

      // 下端まで線を引いて閉じる
      const lastPoint = visiblePoints[visiblePoints.length - 1];
      const firstPoint = visiblePoints[0];

      if (lastPoint && firstPoint) {
        if (index === 0) {
          path.lineTo(xScale(lastPoint.timestamp), padding.top + chartHeight);
          path.lineTo(xScale(firstPoint.timestamp), padding.top + chartHeight);
        } else {
          // 前のカテゴリーのパスを逆順で追加
          path.lineTo(xScale(lastPoint.timestamp), yScale(0));
          path.lineTo(xScale(firstPoint.timestamp), yScale(0));
        }
      }

      path.closePath();
      ctx.fill(path);
    });

    ctx.globalAlpha = 1;

    // 軸ラベルの描画
    ctx.fillStyle = theme.palette.text.primary;
    ctx.font = '12px sans-serif';

    // Y軸ラベル
    for (let i = 0; i <= 4; i++) {
      const value = (maxValue / 4) * (4 - i);
      const y = padding.top + (chartHeight / 4) * i;
      ctx.textAlign = 'right';
      ctx.fillText(formatBytes(value), padding.left - 10, y + 4);
    }

    // X軸ラベル
    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
      const time = startTime + ((now - startTime) / 5) * i;
      const x = padding.left + (chartWidth / 5) * i;
      const date = new Date(time);
      const label = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
      ctx.fillText(label, x, padding.top + chartHeight + 20);
    }

    // アニメーションループ
    animationRef.current = requestAnimationFrame(drawChart);
  }, [
    dataPoints,
    timeRange,
    zoomLevel,
    showGrid,
    theme,
    categoryColors,
    warningThreshold,
    criticalThreshold,
  ]);

  // マウスイベントハンドラー
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || dataPoints.length === 0) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const padding = { top: 20, right: 80, bottom: 40, left: 60 };
      const chartWidth = rect.width - padding.left - padding.right;

      if (x >= padding.left && x <= padding.left + chartWidth) {
        const now = Date.now();
        const startTime = now - (timeRange * 1000) / zoomLevel;
        const timestamp = startTime + ((x - padding.left) / chartWidth) * (now - startTime);

        // 最も近いデータポイントを見つける
        const closestPoint = dataPoints.reduce((prev, curr) => {
          return Math.abs(curr.timestamp - timestamp) < Math.abs(prev.timestamp - timestamp)
            ? curr
            : prev;
        });

        if (Math.abs(closestPoint.timestamp - timestamp) < 5000) {
          // 5秒以内
          setHoveredPoint({ x, y, data: closestPoint });
        } else {
          setHoveredPoint(null);
        }
      } else {
        setHoveredPoint(null);
      }
    },
    [dataPoints, timeRange, zoomLevel]
  );

  // 初期化とクリーンアップ
  useEffect(() => {
    collectMemoryData();
    const safeInterval = Math.max(updateInterval, 10000);
    intervalRef.current = setInterval(collectMemoryData, safeInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [updateInterval, collectMemoryData]);

  // 描画の開始
  useEffect(() => {
    drawChart();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawChart]);

  if (!isSupported) {
    return (
      <Paper
        sx={{
          width,
          height,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Memory monitoring not available in this browser
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ width, height, p: 2, position: 'relative' }}>
      {/* コントロールバー */}
      <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, display: 'flex', gap: 1 }}>
        <Tooltip title={isPaused ? 'Resume' : 'Pause'}>
          <IconButton size="small" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? <PlayArrow fontSize="small" /> : <Pause fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Clear data">
          <IconButton size="small" onClick={() => setDataPoints([])}>
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Zoom in">
          <IconButton size="small" onClick={() => setZoomLevel((z) => Math.min(z * 1.5, 10))}>
            <ZoomIn fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Zoom out">
          <IconButton size="small" onClick={() => setZoomLevel((z) => Math.max(z / 1.5, 1))}>
            <ZoomOut fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* タイトル */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Memory Usage Timeline
      </Typography>

      {/* チャートキャンバス */}
      <Box sx={{ position: 'relative', width: '100%', height: 'calc(100% - 80px)' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
        />

        {/* ツールチップ */}
        {hoveredPoint && (
          <Paper
            elevation={3}
            sx={{
              position: 'absolute',
              left: hoveredPoint.x + 10,
              top: hoveredPoint.y - 10,
              p: 1,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <Typography variant="caption" display="block">
              {new Date(hoveredPoint.data.timestamp).toLocaleTimeString()}
            </Typography>
            <Typography variant="caption" display="block" fontWeight="bold">
              Total: {formatBytes(hoveredPoint.data.used)} (
              {hoveredPoint.data.percentage.toFixed(1)}%)
            </Typography>
            {hoveredPoint.data.breakdown && (
              <Box sx={{ mt: 0.5 }}>
                {Object.entries(hoveredPoint.data.breakdown).map(([category, bytes]) => (
                  <Typography key={category} variant="caption" display="block">
                    {category}: {formatBytes(bytes)}
                  </Typography>
                ))}
              </Box>
            )}
          </Paper>
        )}
      </Box>

      {/* 凡例 */}
      {showLegend && (
        <Box sx={{ display: 'flex', gap: 2, mt: 1, justifyContent: 'center' }}>
          {Object.entries(categoryColors).map(([category, color]) => (
            <Box key={category} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, bgcolor: color, opacity: 0.7 }} />
              <Typography variant="caption">{category}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
};
