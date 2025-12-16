import type { SpreadsheetEntity } from '../../common/types/SpreadsheetEntity.js';

export interface TabularStatistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  uniqueCount: number;
  totalCount: number;
  quartiles: {
    q1: number;
    q2: number;
    q3: number;
  };
}

export type TabularRow = Record<string, unknown>;

export const calculateStatistics = (values: number[]): TabularStatistics => {
  if (!values.length) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      uniqueCount: 0,
      totalCount: 0,
      quartiles: { q1: 0, q2: 0, q3: 0 },
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const min = sorted[0] ?? 0;
  const max = sorted[n - 1] ?? min;
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / n;
  const median =
    n % 2 === 0
      ? ((sorted[n / 2 - 1] ?? min) + (sorted[n / 2] ?? max)) / 2
      : (sorted[Math.floor(n / 2)] ?? min);

  const variance = values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  const q1Index = Math.floor(n * 0.25);
  const q2Index = Math.floor(n * 0.5);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index] ?? min;
  const q2 = sorted[q2Index] ?? median;
  const q3 = sorted[q3Index] ?? max;

  const uniqueCount = new Set(values).size;

  return {
    min,
    max,
    mean,
    median,
    stdDev,
    uniqueCount,
    totalCount: n,
    quartiles: { q1, q2, q3 },
  };
};

export const coerceSpreadsheetEntity = (value: unknown): SpreadsheetEntity =>
  (typeof value === 'object' && value !== null ? (value as SpreadsheetEntity) : {});
