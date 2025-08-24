import { formatBytes } from '@hierarchidb/common-core';
import type { MemoryData } from '../hooks/useMemoryData';

/**
 * 【リファクタリング概要】: Canvas描画ロジックを専用サービスクラスとして抽出
 * 【改善理由】: コンポーネントから描画ロジックを分離し、再利用性と保守性を向上
 * 【品質向上】: 単一責任原則、オブジェクト指向設計、型安全性向上
 * 🟢 信頼性レベル: Canvas APIのベストプラクティスと既存実装を統合
 */

export interface CanvasRenderOptions {
  width: number;
  height: number;
  theme: {
    palette: {
      divider: string;
      warning: { main: string };
      error: { main: string };
      text: { primary: string };
    };
  };
  categoryColors: { [key: string]: string };
  warningThreshold: number;
  criticalThreshold: number;
  showGrid: boolean;
  showAxes: boolean;
}

export interface ChartDataPoint {
  timestamp: number;
  memoryData: MemoryData;
}

/**
 * 【リファクタリング概要】: Canvas描画を管理する専用サービスクラス
 * 【改善理由】: 描画ロジックの複雑性をカプセル化し、再利用可能な形で提供
 * 【品質向上】: オブジェクト指向設計、責任分離、エラーハンドリング改善
 * 🟢 信頼性レベル: Canvas APIの標準的な使用パターンに基づく実装
 */
export class CanvasRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private dataPoints: ChartDataPoint[] = [];
  private animationId: number | null = null;

  /**
   * 【初期化改善】: Canvas要素とコンテキストの安全な初期化
   * 【品質向上】: エラーハンドリング、型安全性確保
   * 🟢 信頼性レベル: Canvas APIの標準的な初期化パターン
   */
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    if (!this.ctx) {
      throw new Error('Unable to get 2D rendering context from canvas');
    }

    // 【Retina対応】: 高DPIディスプレイでの描画品質確保 🟢
    this.setupHighDPI();
  }

  /**
   * 【パフォーマンス改善】: Retina/高DPIディスプレイでの最適な描画設定
   * 【改善理由】: ぼやけた描画を防ぎ、クリスプな表示を実現
   * 【品質向上】: 視覚品質の向上、デバイス対応の改善
   * 🟢 信頼性レベル: Canvas高DPI対応の標準的な実装パターン
   */
  private setupHighDPI(): void {
    if (!this.canvas || !this.ctx) return;

    // 【DPR取得】: デバイスピクセル比を取得して高解像度対応 🟢
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    // 【Canvas内部サイズ設定】: 実際の描画解像度を設定 🟢
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    // 【スケール調整】: 描画コンテキストのスケールを調整 🟢
    this.ctx.scale(dpr, dpr);

    // 【CSS表示サイズ維持】: 表示サイズは元のまま維持 🟢
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  /**
   * 【データ管理改善】: チャートデータの効率的な管理
   * 【改善理由】: データの蓄積と制限を適切に管理
   * 【品質向上】: メモリ効率の改善、パフォーマンス最適化
   * 🟢 信頼性レベル: 配列操作のベストプラクティスに基づく実装
   */
  addDataPoint(memoryData: MemoryData, maxDataPoints: number = 100): void {
    // 【データポイント追加】: タイムスタンプ付きでデータを記録 🟢
    this.dataPoints.push({
      timestamp: Date.now(),
      memoryData,
    });

    // 【データ制限管理】: 最大データ数を超えた場合の古いデータ削除 🟢
    if (this.dataPoints.length > maxDataPoints) {
      this.dataPoints = this.dataPoints.slice(-maxDataPoints);
    }
  }

  /**
   * 【データクリア機能】: チャートデータの完全リセット
   * 【品質向上】: 明示的なデータクリア機能の提供
   * 🟢 信頼性レベル: シンプルで確実なデータリセット
   */
  clearData(): void {
    this.dataPoints = [];
  }

  /**
   * 【リファクタリング概要】: メモリ使用状況のリアルタイムチャート描画
   * 【改善理由】: 複雑な描画ロジックを構造化し、保守性を向上
   * 【品質向上】: 段階的な描画処理、エラーハンドリング、パフォーマンス最適化
   * 🟡 信頼性レベル: 既存実装を参考に、より構造化された形で実装
   */
  render(options: CanvasRenderOptions): void {
    if (!this.canvas || !this.ctx || this.dataPoints.length === 0) return;

    try {
      // 【描画前準備】: Canvas状態のクリアとサイズ取得 🟢
      const rect = this.canvas.getBoundingClientRect();
      this.ctx.clearRect(0, 0, rect.width, rect.height);

      // 【マージン設定】: チャート描画エリアのマージン定義 🟢
      const padding = { top: 20, right: 80, bottom: 40, left: 60 };
      const chartWidth = rect.width - padding.left - padding.right;
      const chartHeight = rect.height - padding.top - padding.bottom;

      // 【描画手順の構造化】: 段階的に描画を実行 🟢
      if (options.showGrid) {
        this.drawGrid(padding, chartWidth, chartHeight, options);
      }

      this.drawThresholdLines(padding, chartWidth, chartHeight, options);
      this.drawChart(padding, chartWidth, chartHeight, options);

      if (options.showAxes) {
        this.drawAxes(padding, chartWidth, chartHeight, options);
      }
    } catch (error) {
      // 【描画エラーハンドリング】: 描画中のエラーを適切に処理 🟢
      console.warn('Canvas rendering failed:', error);
    }
  }

  /**
   * 【グリッド描画改善】: グリッド線の描画を専用メソッドに分離
   * 【改善理由】: 描画処理の責任を分離し、可読性を向上
   * 【品質向上】: 単一責任原則、保守性の向上
   * 🟢 信頼性レベル: Canvas描画の標準的なグリッドパターン
   */
  private drawGrid(
    padding: { top: number; right: number; bottom: number; left: number },
    chartWidth: number,
    chartHeight: number,
    options: CanvasRenderOptions
  ): void {
    if (!this.ctx) return;

    // 【グリッドスタイル設定】: 視認性の良いグリッド線スタイル 🟢
    this.ctx.strokeStyle = options.theme.palette.divider;
    this.ctx.lineWidth = 0.5;
    this.ctx.setLineDash([2, 2]);

    // 【水平線描画】: Y軸方向のグリッド線 🟢
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(padding.left, y);
      this.ctx.lineTo(padding.left + chartWidth, y);
      this.ctx.stroke();
    }

    // 【垂直線描画】: X軸方向のグリッド線 🟢
    for (let i = 0; i <= 5; i++) {
      const x = padding.left + (chartWidth / 5) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(x, padding.top);
      this.ctx.lineTo(x, padding.top + chartHeight);
      this.ctx.stroke();
    }

    // 【スタイルリセット】: 後続の描画に影響しないようリセット 🟢
    this.ctx.setLineDash([]);
  }

  /**
   * 【閾値線描画】: 警告・危険閾値の視覚的表示
   * 【改善理由】: ユーザーが一目でメモリ状況を把握できるよう改善
   * 【品質向上】: ユーザビリティ向上、視覚的フィードバック改善
   * 🟢 信頼性レベル: 一般的なチャート表示パターンに基づく実装
   */
  private drawThresholdLines(
    padding: { top: number; right: number; bottom: number; left: number },
    chartWidth: number,
    chartHeight: number,
    options: CanvasRenderOptions
  ): void {
    if (!this.ctx || this.dataPoints.length === 0) return;

    // 【最大値計算】: 現在のデータセットから最大値を取得 🟢
    const maxValue = Math.max(...this.dataPoints.map((p) => p.memoryData.total));
    if (maxValue === 0) return;

    // 【警告線描画】: 警告閾値ラインの描画 🟢
    const warningY = padding.top + (1 - options.warningThreshold) * chartHeight;
    this.ctx.strokeStyle = options.theme.palette.warning.main;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.moveTo(padding.left, warningY);
    this.ctx.lineTo(padding.left + chartWidth, warningY);
    this.ctx.stroke();

    // 【危険線描画】: 危険閾値ラインの描画 🟢
    const criticalY = padding.top + (1 - options.criticalThreshold) * chartHeight;
    this.ctx.strokeStyle = options.theme.palette.error.main;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(padding.left, criticalY);
    this.ctx.lineTo(padding.left + chartWidth, criticalY);
    this.ctx.stroke();

    // 【スタイルリセット】: 後続描画のためのリセット 🟢
    this.ctx.setLineDash([]);
  }

  /**
   * 【メインチャート描画】: メモリ使用量の時系列チャート描画
   * 【改善理由】: チャートの核となる描画処理を最適化
   * 【品質向上】: パフォーマンス改善、視覚品質向上
   * 🟡 信頼性レベル: 既存実装のパターンを改良した実装
   */
  private drawChart(
    padding: { top: number; right: number; bottom: number; left: number },
    chartWidth: number,
    chartHeight: number,
    options: CanvasRenderOptions
  ): void {
    if (!this.ctx || this.dataPoints.length < 2) return;

    // 【時間軸計算】: X軸の時間範囲を計算 🟢
    const now = Date.now();
    const timeRange = 5 * 60 * 1000; // 5分
    const startTime = now - timeRange;

    // 【データフィルタリング】: 表示範囲内のデータのみを取得 🟢
    const visiblePoints = this.dataPoints.filter((p) => p.timestamp >= startTime);
    if (visiblePoints.length < 2) return;

    // 【スケール関数】: データ座標を画面座標に変換 🟢
    const xScale = (timestamp: number) => {
      return padding.left + ((timestamp - startTime) / timeRange) * chartWidth;
    };

    const yScale = (percentage: number) => {
      return padding.top + (1 - percentage / 100) * chartHeight;
    };

    // 【メモリ使用量ライン描画】: 時系列でのメモリ使用量変化 🟢
    this.ctx.strokeStyle = options.categoryColors.JavaScript || '#F7DF1E';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    visiblePoints.forEach((point, index) => {
      const x = xScale(point.timestamp);
      const y = yScale(point.memoryData.percentage);

      if (index === 0) {
        this.ctx!.moveTo(x, y);
      } else {
        this.ctx!.lineTo(x, y);
      }
    });

    this.ctx.stroke();

    // 【データポイントマーカー】: 各データポイントに小さなマーカーを配置 🟢
    this.ctx.fillStyle = options.categoryColors.JavaScript || '#F7DF1E';
    visiblePoints.forEach((point) => {
      const x = xScale(point.timestamp);
      const y = yScale(point.memoryData.percentage);

      this.ctx!.beginPath();
      this.ctx!.arc(x, y, 3, 0, 2 * Math.PI);
      this.ctx!.fill();
    });
  }

  /**
   * 【軸ラベル描画】: X軸・Y軸のラベルとスケール表示
   * 【改善理由】: チャートの可読性向上とユーザビリティ改善
   * 【品質向上】: 情報の明確化、アクセシビリティ向上
   * 🟢 信頼性レベル: チャート表示の標準的なパターンに基づく実装
   */
  private drawAxes(
    padding: { top: number; right: number; bottom: number; left: number },
    chartWidth: number,
    chartHeight: number,
    options: CanvasRenderOptions
  ): void {
    if (!this.ctx || this.dataPoints.length === 0) return;

    // 【フォント設定】: 読みやすいフォントサイズと色の設定 🟢
    this.ctx.fillStyle = options.theme.palette.text.primary;
    this.ctx.font = '12px sans-serif';

    // 【Y軸ラベル】: メモリ使用量のスケールラベル 🟢
    const maxValue = Math.max(...this.dataPoints.map((p) => p.memoryData.total));
    for (let i = 0; i <= 4; i++) {
      const value = (maxValue / 4) * (4 - i);
      const y = padding.top + (chartHeight / 4) * i;
      this.ctx.textAlign = 'right';
      this.ctx.fillText(formatBytes(value), padding.left - 10, y + 4);
    }

    // 【X軸ラベル】: 時間軸のラベル表示 🟢
    const now = Date.now();
    const timeRange = 5 * 60 * 1000; // 5分
    const startTime = now - timeRange;

    this.ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
      const time = startTime + (timeRange / 5) * i;
      const x = padding.left + (chartWidth / 5) * i;
      const date = new Date(time);
      const label = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      this.ctx.fillText(label, x, padding.top + chartHeight + 20);
    }
  }

  /**
   * 【リソース解放】: Canvas リソースの適切な解放
   * 【改善理由】: メモリリークの防止とリソース管理の改善
   * 【品質向上】: ライフサイクル管理、メモリ効率の向上
   * 🟢 信頼性レベル: リソース管理のベストプラクティスに基づく実装
   */
  dispose(): void {
    // 【アニメーション停止】: 進行中のアニメーションを停止 🟢
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // 【参照解放】: Canvas要素とコンテキストの参照をクリア 🟢
    this.canvas = null;
    this.ctx = null;
    this.dataPoints = [];
  }
}
