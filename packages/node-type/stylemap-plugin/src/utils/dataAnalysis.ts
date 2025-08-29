/**
 * @file dataAnalysis.ts
 * @description Data analysis utilities for algorithm recommendation
 * 【機能概要】: データ分析によるアルゴリズム推奨ユーティリティ
 * 【実装方針】: 統計分析に基づく適切なアルゴリズムの自動選択
 * 🟢 信頼性レベル: 統計的手法による推奨
 */

import type { ColorAlgorithm } from '../types/styleMapTypes';

/**
 * データ統計情報
 */
export interface DataStatistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  skewness: number;
  kurtosis: number;
  uniqueCount: number;
  totalCount: number;
  distribution: 'normal' | 'skewed' | 'bimodal' | 'uniform' | 'unknown';
  hasOutliers: boolean;
  outlierCount: number;
  quartiles: {
    q1: number;
    q2: number;
    q3: number;
  };
}

/**
 * アルゴリズム推奨結果
 */
export interface AlgorithmRecommendation {
  algorithm: ColorAlgorithm;
  confidence: number;
  reasoning: string;
  suitability: {
    linear: number;
    quantile: number;
    jenks: number;
    equal: number;
  };
}

/**
 * データ分析結果
 */
export interface DataAnalysisResult {
  statistics: DataStatistics;
  recommendation: AlgorithmRecommendation;
  hasNaturalBreaks: boolean;
  clusterCount?: number;
}

/**
 * 【機能概要】: データから統計情報を計算
 * 【実装方針】: 基本統計量と分布特性の計算
 * 🟢 信頼性レベル: 標準的な統計計算
 */
export function calculateStatistics(values: number[]): DataStatistics {
  if (values.length === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      skewness: 0,
      kurtosis: 0,
      uniqueCount: 0,
      totalCount: 0,
      distribution: 'unknown',
      hasOutliers: false,
      outlierCount: 0,
      quartiles: { q1: 0, q2: 0, q3: 0 },
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  
  // 基本統計量
  const min = sorted[0];
  const max = sorted[n - 1];
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / n;
  const median = n % 2 === 0 
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 
    : sorted[Math.floor(n / 2)];

  // 標準偏差
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // 四分位数
  const q1Index = Math.floor(n * 0.25);
  const q2Index = Math.floor(n * 0.5);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index];
  const q2 = sorted[q2Index];
  const q3 = sorted[q3Index];

  // 歪度（Skewness）
  const skewness = n > 2 && stdDev > 0
    ? values.reduce((acc, val) => acc + Math.pow((val - mean) / stdDev, 3), 0) / n
    : 0;

  // 尖度（Kurtosis）
  const kurtosis = n > 3 && stdDev > 0
    ? values.reduce((acc, val) => acc + Math.pow((val - mean) / stdDev, 4), 0) / n - 3
    : 0;

  // 外れ値検出（IQR法）
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  const outliers = values.filter(v => v < lowerBound || v > upperBound);
  
  // ユニーク値の数
  const uniqueCount = new Set(values).size;

  // 分布の判定
  let distribution: DataStatistics['distribution'] = 'unknown';
  if (Math.abs(skewness) < 0.5 && Math.abs(kurtosis) < 1) {
    distribution = 'normal';
  } else if (Math.abs(skewness) > 1.5) {
    distribution = 'skewed';
  } else if (kurtosis > 2) {
    distribution = 'bimodal';
  } else if (stdDev < mean * 0.1) {
    distribution = 'uniform';
  }

  return {
    min,
    max,
    mean,
    median,
    stdDev,
    skewness,
    kurtosis,
    uniqueCount,
    totalCount: n,
    distribution,
    hasOutliers: outliers.length > 0,
    outlierCount: outliers.length,
    quartiles: { q1, q2, q3 },
  };
}

/**
 * 【機能概要】: 自然な区切りの検出
 * 【実装方針】: ヒストグラムの谷間検出
 * 🟢 信頼性レベル: ヒューリスティック手法
 */
export function detectNaturalBreaks(values: number[], binCount: number = 20): {
  hasBreaks: boolean;
  breakPoints?: number[];
  clusterCount?: number;
} {
  if (values.length < 10) {
    return { hasBreaks: false };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min;
  
  if (range === 0) {
    return { hasBreaks: false };
  }

  // ヒストグラムの作成
  const binWidth = range / binCount;
  const histogram = new Array(binCount).fill(0);
  
  for (const value of values) {
    const binIndex = Math.min(Math.floor((value - min) / binWidth), binCount - 1);
    histogram[binIndex]++;
  }

  // 谷間の検出
  const valleys: number[] = [];
  for (let i = 1; i < histogram.length - 1; i++) {
    if (histogram[i] < histogram[i - 1] && histogram[i] < histogram[i + 1]) {
      valleys.push(min + (i + 0.5) * binWidth);
    }
  }

  // 明確な谷間がある場合は自然な区切りが存在
  const hasBreaks = valleys.length > 0 && valleys.length <= 5;
  
  return {
    hasBreaks,
    breakPoints: hasBreaks ? valleys : undefined,
    clusterCount: hasBreaks ? valleys.length + 1 : undefined,
  };
}

/**
 * 【機能概要】: アルゴリズムの適合度計算
 * 【実装方針】: データ特性に基づく各アルゴリズムのスコアリング
 * 🟢 信頼性レベル: ヒューリスティックスコアリング
 */
export function calculateAlgorithmSuitability(stats: DataStatistics, hasNaturalBreaks: boolean): {
  linear: number;
  quantile: number;
  jenks: number;
  equal: number;
} {
  const scores = {
    linear: 50,    // 基本スコア
    quantile: 50,
    jenks: 50,
    equal: 50,
  };

  // 正規分布の場合
  if (stats.distribution === 'normal') {
    scores.equal += 35;      // 等間隔が最適
    scores.linear += 25;     // 線形も良い
    scores.quantile += 10;   // 分位数は普通
    scores.jenks += 15;      // Jenksも可
  }

  // 歪んだ分布の場合
  if (stats.distribution === 'skewed' || Math.abs(stats.skewness) > 1) {
    scores.quantile += 35;   // 分位数が最適
    scores.jenks += 25;      // Jenksも良い
    scores.equal -= 20;      // 等間隔は不適
    scores.linear -= 10;     // 線形も不適
  }

  // 外れ値がある場合
  if (stats.hasOutliers) {
    scores.quantile += 20;   // 分位数が外れ値に強い
    scores.jenks += 15;      // Jenksも対応可
    scores.equal -= 15;      // 等間隔は影響受ける
    scores.linear -= 10;     // 線形も影響受ける
  }

  // 自然な区切りがある場合
  if (hasNaturalBreaks) {
    scores.jenks += 40;      // Jenksが最適
    scores.quantile += 10;   // 分位数も可
    scores.equal -= 5;       // 等間隔は不適
    scores.linear -= 5;      // 線形も不適
  }

  // ユニーク値が少ない場合
  if (stats.uniqueCount < 10) {
    scores.jenks += 20;      // Jenksが離散値に適する
    scores.quantile += 15;   // 分位数も可
    scores.linear -= 10;     // 線形は不適
    scores.equal -= 10;      // 等間隔も不適
  }

  // 一様分布の場合
  if (stats.distribution === 'uniform') {
    scores.equal += 30;      // 等間隔が最適
    scores.linear += 20;     // 線形も良い
    scores.quantile -= 10;   // 分位数は不要
    scores.jenks -= 5;       // Jenksも不要
  }

  // スコアを0-100に正規化
  const maxScore = Math.max(...Object.values(scores));
  const minScore = Math.min(...Object.values(scores));
  const range = maxScore - minScore || 1;

  return {
    linear: Math.round(((scores.linear - minScore) / range) * 100),
    quantile: Math.round(((scores.quantile - minScore) / range) * 100),
    jenks: Math.round(((scores.jenks - minScore) / range) * 100),
    equal: Math.round(((scores.equal - minScore) / range) * 100),
  };
}

/**
 * 【機能概要】: 推奨アルゴリズムの決定
 * 【実装方針】: スコアと理由付けによる最適アルゴリズム選択
 * 🟢 信頼性レベル: 統計的根拠に基づく推奨
 */
export function recommendAlgorithm(
  data: number[],
  dataType?: 'population' | 'ratio' | 'continuous' | 'categorical'
): AlgorithmRecommendation {
  const stats = calculateStatistics(data);
  const naturalBreaks = detectNaturalBreaks(data);
  const suitability = calculateAlgorithmSuitability(stats, naturalBreaks.hasBreaks);

  // 最高スコアのアルゴリズムを選択
  let bestAlgorithm: ColorAlgorithm = 'linear';
  let bestScore = suitability.linear;
  let reasoning = '';

  if (suitability.quantile > bestScore) {
    bestAlgorithm = 'quantile';
    bestScore = suitability.quantile;
  }
  if (suitability.jenks > bestScore) {
    bestAlgorithm = 'jenks';
    bestScore = suitability.jenks;
  }
  if (suitability.equal > bestScore) {
    bestAlgorithm = 'equal';
    bestScore = suitability.equal;
  }

  // 推奨理由の生成
  switch (bestAlgorithm) {
    case 'equal':
      reasoning = stats.distribution === 'normal' 
        ? 'データが正規分布に従っているため、等間隔分類が視覚的にバランスの良い表現を提供します'
        : 'データが比較的均等に分布しているため、等間隔分類が適切です';
      break;
    
    case 'quantile':
      reasoning = stats.hasOutliers 
        ? 'データに外れ値が含まれているため、分位数分類により外れ値の影響を抑えた表現が可能です'
        : stats.distribution === 'skewed'
        ? 'データに偏りがあるため、分位数分類で各クラスの要素数を均等にすることで、バランスの取れた可視化が実現できます'
        : 'データの分布を均等に分割することで、地域間の相対的な差異を明確に表現できます';
      break;
    
    case 'jenks':
      reasoning = naturalBreaks.hasBreaks
        ? `データに${naturalBreaks.clusterCount}個の自然なグループが検出されました。自然分類（Jenks）により、これらのグループを最適に表現できます`
        : stats.uniqueCount < 10
        ? 'データの値が離散的であるため、自然分類により意味のあるグループ分けが可能です'
        : 'データ内の自然な境界を見つけることで、最も意味のある分類を実現できます';
      break;
    
    case 'linear':
      reasoning = '連続的な変化を表現するのに適した線形補間を推奨します';
      break;
  }

  // データタイプによる調整
  if (dataType) {
    switch (dataType) {
      case 'population':
        if (bestAlgorithm !== 'quantile' && stats.skewness > 1) {
          reasoning += '（注：人口データは通常偏りがあるため、分位数分類も検討してください）';
        }
        break;
      case 'ratio':
        if (bestAlgorithm !== 'equal' && stats.distribution === 'normal') {
          reasoning += '（注：割合データには等間隔分類も適している場合があります）';
        }
        break;
      case 'continuous':
        if (bestAlgorithm !== 'linear') {
          reasoning += '（注：連続データには線形補間も自然な表現となる場合があります）';
        }
        break;
      case 'categorical':
        if (bestAlgorithm !== 'jenks') {
          reasoning += '（注：カテゴリカルな数値には自然分類が最適な場合が多いです）';
        }
        break;
    }
  }

  return {
    algorithm: bestAlgorithm,
    confidence: bestScore / 100,
    reasoning,
    suitability,
  };
}

/**
 * 【機能概要】: データ分析の実行
 * 【実装方針】: 統計分析と推奨の統合
 * 🟢 信頼性レベル: 包括的分析
 */
export function analyzeData(
  values: number[],
  column?: string,
  dataType?: 'population' | 'ratio' | 'continuous' | 'categorical'
): DataAnalysisResult {
  const statistics = calculateStatistics(values);
  const naturalBreaks = detectNaturalBreaks(values);
  const recommendation = recommendAlgorithm(values, dataType);

  return {
    statistics,
    recommendation,
    hasNaturalBreaks: naturalBreaks.hasBreaks,
    clusterCount: naturalBreaks.clusterCount,
  };
}

/**
 * 【機能概要】: CSVデータから数値列を抽出
 * 【実装方針】: 指定列から数値データを抽出
 * 🟢 信頼性レベル: 型安全な抽出
 */
export function extractNumericValues(
  csvData: Array<Record<string, any>>,
  column: string
): number[] {
  const values: number[] = [];
  
  for (const row of csvData) {
    const value = row[column];
    const numeric = typeof value === 'number' 
      ? value 
      : typeof value === 'string' 
      ? parseFloat(value) 
      : NaN;
    
    if (!isNaN(numeric) && isFinite(numeric)) {
      values.push(numeric);
    }
  }
  
  return values;
}