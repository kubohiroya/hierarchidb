/**
  * @file dataAnalysis.ts
 * @description Data analysis utilities for algorithm recommendation
 * :
 * :
 * :
  */

import type { ColorAlgorithm } from '../types/stylerTypes.js';

/**
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
    */
export interface DataAnalysisResult {
  statistics: DataStatistics;
  recommendation: AlgorithmRecommendation;
  hasNaturalBreaks: boolean;
  clusterCount?: number;
}

/**
  * :
 * :
 * :
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

  const min = sorted[0] ?? 0;
  const max = sorted[n - 1] ?? min;
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / n;
  const median = n % 2 === 0
    ? (((sorted[n / 2 - 1] ?? min) + (sorted[n / 2] ?? max)) / 2)
    : (sorted[Math.floor(n / 2)] ?? min);

  const variance = values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  const q1Index = Math.floor(n * 0.25);
  const q2Index = Math.floor(n * 0.5);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index] ?? min;
  const q2 = sorted[q2Index] ?? median;
  const q3 = sorted[q3Index] ?? max;

  //  Skewness
  const skewness = n > 2 && stdDev > 0
    ? values.reduce((acc, val) => acc + ((val - mean) / stdDev) ** 3, 0) / n
    : 0;

  //  Kurtosis
  const kurtosis = n > 3 && stdDev > 0
    ? values.reduce((acc, val) => acc + ((val - mean) / stdDev) ** 4, 0) / n - 3
    : 0;

  //  IQR
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  const outliers = values.filter(v => v < lowerBound || v > upperBound);

  const uniqueCount = new Set(values).size;

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
  * :
 * :
 * :
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
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? min;
  const range = max - min;

  if (range === 0) {
    return { hasBreaks: false };
  }

  const binWidth = range / binCount;
  const histogram = new Array(binCount).fill(0);

  for (const value of values) {
    const binIndex = Math.min(Math.floor((value - min) / binWidth), binCount - 1);
    histogram[binIndex]++;
  }

  const valleys: number[] = [];
  for (let i = 1; i < histogram.length - 1; i++) {
    if (histogram[i] < histogram[i - 1] && histogram[i] < histogram[i + 1]) {
      valleys.push(min + (i + 0.5) * binWidth);
    }
  }

  const hasBreaks = valleys.length > 0 && valleys.length <= 5;

  return {
    hasBreaks,
    breakPoints: hasBreaks ? valleys : undefined,
    clusterCount: hasBreaks ? valleys.length + 1 : undefined,
  };
}

/**
  * :
 * :
 * :
  */
export function calculateAlgorithmSuitability(stats: DataStatistics, hasNaturalBreaks: boolean): {
  linear: number;
  quantile: number;
  jenks: number;
  equal: number;
} {
  const scores = {
    linear: 50, quantile: 50,
    jenks: 50,
    equal: 50,
  };

  if (stats.distribution === 'normal') {
    scores.equal += 35;
    scores.linear += 25;
    scores.quantile += 10;
    scores.jenks += 15;      //  Jenks
  }

  if (stats.distribution === 'skewed' || Math.abs(stats.skewness) > 1) {
    scores.quantile += 35;
    scores.jenks += 25;      //  Jenks
    scores.equal -= 20;
    scores.linear -= 10;
  }

  if (stats.hasOutliers) {
    scores.quantile += 20;
    scores.jenks += 15;      //  Jenks
    scores.equal -= 15;
    scores.linear -= 10;
  }

  if (hasNaturalBreaks) {
    scores.jenks += 40;      //  Jenks
    scores.quantile += 10;
    scores.equal -= 5;
    scores.linear -= 5;
  }

  if (stats.uniqueCount < 10) {
    scores.jenks += 20;      //  Jenks
    scores.quantile += 15;
    scores.linear -= 10;
    scores.equal -= 10;
  }

  if (stats.distribution === 'uniform') {
    scores.equal += 30;
    scores.linear += 20;
    scores.quantile -= 10;
    scores.jenks -= 5;       //  Jenks
  }

  //  0-100
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
  * :
 * :
 * :
  */
export function recommendAlgorithm(
  data: number[],
  dataType?: 'population' | 'ratio' | 'continuous' | 'categorical',
): AlgorithmRecommendation {
  const stats = calculateStatistics(data);
  const naturalBreaks = detectNaturalBreaks(data);
  const suitability = calculateAlgorithmSuitability(stats, naturalBreaks.hasBreaks);

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
  * :
 * :
 * :
  */
export function analyzeData(
  values: number[],
  _column?: string,
  dataType?: 'population' | 'ratio' | 'continuous' | 'categorical',
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
  * : CSV
 * :
 * :
  */
export function extractNumericValues(
  csvData: Array<Record<string, any>>,
  column: string,
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
