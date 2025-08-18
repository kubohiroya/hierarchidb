import { useState, useEffect, useRef, useCallback } from 'react';
import { formatBytes } from '@hierarchidb/core';

/**
 * 【リファクタリング概要】: メモリデータ収集ロジックをカスタムフックとして抽出
 * 【改善理由】: コンポーネントから責任を分離し、再利用可能な形で提供
 * 【品質向上】: 単一責任原則、テスタビリティ向上、関心の分離
 * 🟢 信頼性レベル: React Hooksのベストプラクティスに基づく確実な実装
 */

export interface MemoryData {
  used: number;
  total: number;
  percentage: number;
  breakdown?: MemoryBreakdown;
}

export interface MemoryBreakdown {
  JavaScript: number;
  DOM: number;
  Images: number;
  Styles: number;
  Other: number;
}

export interface UseMemoryDataOptions {
  updateInterval?: number;
  maxMemory?: number;
  enabled?: boolean;
}

export interface UseMemoryDataResult {
  memoryData: MemoryData;
  isSupported: boolean;
  isPaused: boolean;
  togglePause: () => void;
  clearData: () => void;
  error: string | null;
}

/**
 * 【リファクタリング概要】: メモリデータ収集とライフサイクル管理のカスタムフック
 * 【改善理由】: コンポーネントからデータ収集ロジックを分離し、再利用性を向上
 * 【品質向上】: 単一責任原則、エラーハンドリング改善、パフォーマンス最適化
 * 🟢 信頼性レベル: 既存実装のパターンを基に、React Hooksベストプラクティスを適用
 */
export function useMemoryData({
  updateInterval = 5000,
  maxMemory = 4 * 1024 * 1024 * 1024, // 4GB
  enabled = true,
}: UseMemoryDataOptions = {}): UseMemoryDataResult {
  // 【状態管理改善】: より詳細な状態を分離して管理 🟢
  const [memoryData, setMemoryData] = useState<MemoryData>({
    used: 0,
    total: 0,
    percentage: 0,
  });
  const [isSupported, setIsSupported] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 【リファクタリング概要】: メモリ分類ロジックを型安全な形で実装
   * 【改善理由】: 既存の複雑な分類ロジックを整理し、型安全性を確保
   * 【品質向上】: TypeScript活用、エラー処理改善、可読性向上
   * 🟡 信頼性レベル: 既存実装を参考に、より安全な形で再実装
   */
  const categorizeMemory = useCallback(
    (breakdown?: Array<{ bytes?: number; types?: string[]; url?: string }>): MemoryBreakdown => {
      // 【初期化改善】: 各カテゴリーを明示的に初期化 🟢
      const categories: MemoryBreakdown = {
        JavaScript: 0,
        DOM: 0,
        Images: 0,
        Styles: 0,
        Other: 0,
      };

      // 【早期リターン】: 不正な入力に対する早期リターンで処理を軽量化 🟢
      if (!Array.isArray(breakdown)) return categories;

      // 【ループ最適化】: forEach を使用して可読性と性能のバランスを取る 🟢
      breakdown.forEach((entry) => {
        const bytes = entry.bytes || 0;
        const types = entry.types || [];
        const url = entry.url || '';

        // 【分類ロジック改善】: より明確な条件分岐で分類を実行 🟢
        if (types.includes('JavaScript')) {
          categories.JavaScript += bytes;
        } else if (types.includes('DOM')) {
          categories.DOM += bytes;
        } else if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
          // 【正規表現改善】: より包括的な画像ファイル形式に対応
          categories.Images += bytes;
        } else if (url.includes('.css') || types.includes('CSS')) {
          categories.Styles += bytes;
        } else {
          categories.Other += bytes;
        }
      });

      return categories;
    },
    []
  );

  /**
   * 【リファクタリング概要】: メモリデータ収集ロジックをエラーハンドリング強化
   * 【改善理由】: より堅牢なエラー処理と詳細なフォールバック機能
   * 【品質向上】: エラー状態管理、型安全性向上、API互換性改善
   * 🟢 信頼性レベル: 既存の両実装からベストプラクティスを抽出
   */
  const collectMemoryData = useCallback(async () => {
    // 【一時停止チェック】: 実行前の状態確認で不要な処理をスキップ 🟢
    if (isPaused || !enabled) return;

    try {
      // 【エラー状態リセット】: 成功時にエラー状態をクリア 🟢
      setError(null);

      // 【高度API優先】: measureUserAgentSpecificMemoryを優先的に使用 🟢
      if ('measureUserAgentSpecificMemory' in performance) {
        try {
          const result = await (performance as any).measureUserAgentSpecificMemory();
          const totalUsed = result.breakdown.reduce(
            (sum: number, entry: { bytes?: number }) => sum + (entry.bytes || 0),
            0
          );

          let totalMemory = maxMemory;
          if ('memory' in performance) {
            const memory = (performance as any).memory;
            if (memory?.jsHeapSizeLimit) {
              totalMemory = memory.jsHeapSizeLimit;
            }
          }

          // 【データ構造改善】: より詳細な情報を含む構造化データ 🟢
          const memoryInfo: MemoryData = {
            used: totalUsed,
            total: totalMemory,
            percentage: totalMemory > 0 ? (totalUsed / totalMemory) * 100 : 0,
            breakdown: categorizeMemory(result.breakdown),
          };

          setMemoryData(memoryInfo);
          return;
        } catch (advancedApiError) {
          // 【フォールバック処理】: 高度APIが失敗した場合の基本API使用 🟢
          console.warn('Advanced memory API failed, falling back to basic API:', advancedApiError);
        }
      }

      // 【基本API使用】: performance.memory APIでの基本的なメモリ情報取得 🟢
      if ('memory' in performance && (performance as any).memory) {
        const memory = (performance as any).memory;
        const used = memory?.usedJSHeapSize || 0;
        const total = memory?.jsHeapSizeLimit || maxMemory;

        // 【シンプルなデータ構造】: 基本APIでは分解情報なしのシンプル構造 🟢
        const memoryInfo: MemoryData = {
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

        setMemoryData(memoryInfo);
      } else {
        // 【API未対応処理】: サポートされていない環境での適切な状態設定 🟢
        setIsSupported(false);
        setError('Memory monitoring APIs are not available in this browser');
      }
    } catch (error) {
      // 【エラーハンドリング改善】: 詳細なエラー情報を保存し、ログ出力 🟢
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Memory data collection failed: ${errorMessage}`);
      console.warn('Memory data collection error:', error);
    }
  }, [isPaused, enabled, maxMemory, categorizeMemory]);

  // 【制御関数群】: コンポーネントから使用するための制御インターフェース 🟢
  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  const clearData = useCallback(() => {
    // 【データリセット】: 初期状態に戻すためのクリア処理 🟢
    setMemoryData({ used: 0, total: 0, percentage: 0 });
    setError(null);
  }, []);

  // 【ライフサイクル管理改善】: より堅牢なライフサイクル管理とクリーンアップ 🟢
  useEffect(() => {
    // 【有効性チェック】: フックが有効な場合のみ処理を実行 🟢
    if (!enabled) return;

    // 【初回実行】: マウント時の即座のデータ取得 🟢
    collectMemoryData();
    
    // 【インターバル設定改善】: より安全な最小間隔制限 🟢
    const safeInterval = Math.max(updateInterval, 1000);
    intervalRef.current = setInterval(collectMemoryData, safeInterval);

    // 【クリーンアップ改善】: より確実なリソース解放 🟢
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [updateInterval, collectMemoryData, enabled]);

  // 【戻り値インターフェース】: コンポーネントが必要とする全ての機能を提供 🟢
  return {
    memoryData,
    isSupported,
    isPaused,
    togglePause,
    clearData,
    error,
  };
}