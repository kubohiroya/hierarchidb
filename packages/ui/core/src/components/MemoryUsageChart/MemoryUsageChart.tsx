import React, { useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Paper, IconButton, Tooltip, useTheme } from '@mui/material';
import { Pause, PlayArrow, Refresh, ZoomIn, ZoomOut } from '@mui/icons-material';
import { formatBytes } from '@hierarchidb/util';

import { useMemoryData } from './hooks/useMemoryData';
import { CanvasRenderer } from './services/CanvasRenderer';

export interface MemoryUsageChartProps {
  /** チャートの表示バリエーション */
  variant?: 'simple' | 'detailed' | 'compact';
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
 * 【リファクタリング概要】: メモリ使用量チャートコンポーネントの完全リファクタリング
 * 【改善理由】: 責任分離、再利用性向上、保守性改善、パフォーマンス最適化
 * 【品質向上】: カスタムフック活用、サービス層分離、型安全性向上、エラーハンドリング強化
 * 🟢 信頼性レベル: React ベストプラクティスと既存実装の統合による確実な実装
 */
export const MemoryUsageChart: React.FC<MemoryUsageChartProps> = ({
  variant = 'detailed',
  width = '100%',
  height = 300,
  updateInterval = 5000,
  // timeRange = 300, // 5分 - 未使用のため一時的にコメントアウト
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
  const rendererRef = useRef<CanvasRenderer | null>(null);

  // 【カスタムフック活用】: メモリデータ収集ロジックを分離されたフックで管理 🟢
  const {
    memoryData,
    isSupported,
    isPaused,
    togglePause,
    clearData: clearMemoryData,
    error,
  } = useMemoryData({
    updateInterval,
    maxMemory,
    enabled: true,
  });

  /**
   * 【レンダラー初期化】: Canvas描画サービスの初期化とライフサイクル管理
   * 【改善理由】: 描画ロジックをサービス層に分離し、再利用性を向上
   * 【品質向上】: 責任分離、エラーハンドリング、リソース管理改善
   * 🟢 信頼性レベル: React useEffect パターンとCanvas APIのベストプラクティス
   */
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      // 【レンダラー作成】: Canvas描画サービスのインスタンス生成 🟢
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    } catch (error) {
      // 【初期化エラー処理】: Canvas初期化失敗時の適切なエラーハンドリング 🟢
      console.error('Failed to initialize canvas renderer:', error);
      return;
    }

    // 【クリーンアップ】: コンポーネントアンマウント時のリソース解放 🟢
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, []);

  /**
   * 【データ同期とレンダリング】: メモリデータの変更に応じたチャート更新
   * 【改善理由】: データとビューの同期を効率的に管理
   * 【品質向上】: パフォーマンス最適化、リアルタイム描画改善
   * 🟢 信頼性レベル: React の依存配列パターンとCanvas描画の最適化
   */
  useEffect(() => {
    if (!rendererRef.current || !memoryData || memoryData.used === 0) return;

    try {
      // 【データポイント追加】: 新しいメモリデータをレンダラーに追加 🟢
      rendererRef.current.addDataPoint(memoryData, maxDataPoints);

      // 【チャート描画】: 最新データでチャートを再描画 🟢
      rendererRef.current.render({
        width: canvasRef.current?.getBoundingClientRect().width || 800,
        height: canvasRef.current?.getBoundingClientRect().height || 300,
        theme,
        categoryColors,
        warningThreshold,
        criticalThreshold,
        showGrid,
        showAxes: true,
      });
    } catch (error) {
      // 【描画エラー処理】: 描画中のエラーを適切に処理 🟢
      console.warn('Chart rendering failed:', error);
    }
  }, [
    memoryData,
    theme,
    categoryColors,
    warningThreshold,
    criticalThreshold,
    showGrid,
    maxDataPoints,
  ]);

  /**
   * 【データクリア改善】: チャートとメモリデータの同時クリア
   * 【改善理由】: データクリア操作の一貫性を確保
   * 【品質向上】: ユーザビリティ改善、状態管理の明確化
   * 🟢 信頼性レベル: 一貫したデータクリア処理の実装
   */
  const handleClearData = useCallback(() => {
    clearMemoryData();
    if (rendererRef.current) {
      rendererRef.current.clearData();
    }
  }, [clearMemoryData]);

  /**
   * 【バリアント別レンダリング】: 表示モードに応じた適応的レンダリング
   * 【改善理由】: 様々な使用場面に対応する柔軟な表示オプション
   * 【品質向上】: ユーザビリティ向上、レスポンシブデザイン対応
   * 🟡 信頼性レベル: 設計意図を基にした適切な機能分離
   */
  const getComponentHeight = () => {
    switch (variant) {
      case 'compact':
        return typeof height === 'number' ? height * 0.6 : 180;
      case 'simple':
        return typeof height === 'number' ? height * 0.8 : 240;
      default:
        return height;
    }
  };

  // 【エラー状態表示】: API未対応またはエラー時の適切なフォールバック表示 🟢
  if (!isSupported || error) {
    return (
      <Paper
        sx={{
          width,
          height: getComponentHeight(),
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {error || 'Memory monitoring not available in this browser'}
        </Typography>
        {error && (
          <Typography variant="caption" color="error" textAlign="center">
            Please check browser compatibility or try refreshing the page
          </Typography>
        )}
      </Paper>
    );
  }

  // 【メインコンポーネント描画】: リファクタリング済みの統合されたUI 🟢
  return (
    <Paper sx={{ width, height: getComponentHeight(), p: 2, position: 'relative' }}>
      {/* 【コントロールバー改善】: より整理されたコントロールインターフェース 🟢 */}
      <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, display: 'flex', gap: 1 }}>
        <Tooltip title={isPaused ? 'Resume monitoring' : 'Pause monitoring'}>
          <IconButton size="small" onClick={togglePause} color={isPaused ? 'warning' : 'default'}>
            {isPaused ? <PlayArrow fontSize="small" /> : <Pause fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Clear all chart data">
          <IconButton size="small" onClick={handleClearData}>
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Zoom in (coming soon)">
          <IconButton size="small" disabled>
            <ZoomIn fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Zoom out (coming soon)">
          <IconButton size="small" disabled>
            <ZoomOut fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 【タイトル改善】: より情報豊富なタイトル表示 🟢 */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Memory Usage Timeline
        {isPaused && (
          <Typography component="span" variant="caption" color="warning.main" sx={{ ml: 1 }}>
            (Paused)
          </Typography>
        )}
      </Typography>

      {/* 【メモリ情報表示改善】: より詳細で読みやすい情報表示 🟢 */}
      <Box sx={{ mb: variant === 'compact' ? 1 : 2 }}>
        <Typography
          variant="body2"
          sx={{
            color:
              memoryData.percentage > criticalThreshold * 100
                ? 'error.main'
                : memoryData.percentage > warningThreshold * 100
                  ? 'warning.main'
                  : 'text.primary',
          }}
        >
          Current Usage: {memoryData.percentage.toFixed(1)}%
        </Typography>
        {variant !== 'compact' && (
          <Typography variant="caption" color="text.secondary">
            {formatBytes(memoryData.used)} / {formatBytes(memoryData.total)}
            {memoryData.breakdown && (
              <Typography component="span" sx={{ ml: 1 }}>
                • JavaScript: {formatBytes(memoryData.breakdown.JavaScript)}
              </Typography>
            )}
          </Typography>
        )}
      </Box>

      {/* 【チャート表示エリア改善】: より適切なサイズ計算とエラーハンドリング 🟢 */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: variant === 'compact' ? 'calc(100% - 80px)' : 'calc(100% - 120px)',
          minHeight: '120px',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            borderRadius: '4px',
          }}
          aria-label={`Memory usage chart showing ${memoryData.percentage.toFixed(1)}% usage`}
        />
      </Box>

      {/* 【凡例表示改善】: バリアントに応じた適応的な凡例表示 🟢 */}
      {showLegend && variant !== 'compact' && (
        <Box sx={{ display: 'flex', gap: 2, mt: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          {Object.entries(categoryColors).map(([category, color]) => (
            <Box key={category} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  bgcolor: color,
                  opacity: 0.8,
                  borderRadius: '2px',
                }}
              />
              <Typography variant="caption">{category}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* 【ステータスインジケーター】: エラー状態や接続状況の表示 🟢 */}
      {error && (
        <Box sx={{ position: 'absolute', bottom: 8, left: 8 }}>
          <Typography variant="caption" color="error">
            ⚠️ Data collection error
          </Typography>
        </Box>
      )}
    </Paper>
  );
};
