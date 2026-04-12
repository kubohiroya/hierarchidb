/**
 * @file colorNormalization.ts
 * @description Value normalization algorithms for color mapping (linear, log, quantile, jenks, equal)
 */

import type { StylerConfig } from '~/common/types/StylerEntity';

export const DEFAULT_CLASS_COUNT = 5;

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const normalizeLinear = (value: number, min: number, max: number): number => {
  if (max === min) return 0;
  return clamp01((value - min) / (max - min));
};

const normalizeLog = (value: number, min: number, max: number): number => {
  if (max === min) return 0;
  const shift = min <= 0 ? 1 - min : 0;
  const safeMin = min + shift;
  const safeMax = max + shift;
  if (safeMin <= 0 || safeMax <= 0) {
    return normalizeLinear(value, min, max);
  }
  const safeValue = Math.max(safeMin, value + shift);
  const numerator = Math.log(safeValue) - Math.log(safeMin);
  const denominator = Math.log(safeMax) - Math.log(safeMin);
  if (denominator === 0) return 0;
  return clamp01(numerator / denominator);
};

const normalizeEqual = (normalized: number, classCount: number): number => {
  const classes = Math.max(1, Math.round(classCount));
  if (classes <= 1) return 0;
  const clamped = clamp01(normalized);
  const index = Math.min(classes - 1, Math.max(0, Math.floor(clamped * classes)));
  return index / (classes - 1);
};

const upperBound = (sorted: number[], value: number): number => {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (sorted[mid] && sorted[mid] <= value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
};

export const normalizeQuantile = (value: number, allValues: number[]): number => {
  if (!allValues.length) return 0;
  const sorted = [...allValues].sort((a, b) => a - b);
  if (sorted.length === 1) return 0;
  const idx = upperBound(sorted, value);
  const rank = Math.max(0, Math.min(sorted.length - 1, idx - 1));
  return clamp01(rank / (sorted.length - 1));
};

const calculateJenksBreaks = (values: number[], classCount: number): number[] => {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return [];
  const classes = Math.max(1, Math.min(classCount, n));
  const minValue = sorted[0] ?? 0;
  const maxValue = sorted[n - 1] ?? minValue;
  if (classes === 1) {
    return [minValue, maxValue];
  }

  const lower = Array.from({ length: n + 1 }, () => Array(classes + 1).fill(0));
  const variance = Array.from({ length: n + 1 }, () => Array(classes + 1).fill(0));

  for (let i = 1; i <= classes; i += 1) {
    const lowerRow = lower[1];
    const varianceRow = variance[1];
    if (!lowerRow || !varianceRow) continue;
    lowerRow[i] = 1;
    varianceRow[i] = 0;
    for (let j = 2; j <= n; j += 1) {
      const varianceRowJ = variance[j];
      if (varianceRowJ) {
        varianceRowJ[i] = Number.POSITIVE_INFINITY;
      }
    }
  }

  for (let l = 2; l <= n; l += 1) {
    let sum = 0;
    let sumSquares = 0;
    let w = 0;
    let varianceVal = 0;

    const varianceRowL = variance[l];
    const lowerRowL = lower[l];
    if (!varianceRowL || !lowerRowL) continue;

    for (let m = 1; m <= l; m += 1) {
      const i3 = l - m + 1;
      const val = sorted[i3 - 1];

      if (val === undefined) continue;

      w += 1;
      sum += val;
      sumSquares += val * val;
      varianceVal = sumSquares - (sum * sum) / w;
      const i4 = i3 - 1;

      const varianceRowI4 = i4 !== 0 ? variance[i4] : undefined;
      if (varianceRowI4) {
        for (let j = 2; j <= classes; j += 1) {
          const test = varianceVal + varianceRowI4[j - 1];
          if (varianceRowL[j] >= test) {
            lowerRowL[j] = i3;
            varianceRowL[j] = test;
          }
        }
      }
    }

    lowerRowL[1] = 1;
    varianceRowL[1] = varianceVal;
  }

  const breaks: number[] = Array(classes + 1).fill(minValue);
  breaks[classes] = maxValue;
  breaks[0] = minValue;

  let k = n;
  const lowerRowKInitial = lower[k];
  if (!lowerRowKInitial) return breaks;
  for (let j = classes; j >= 2; j -= 1) {
    const lowerRowK = lower[k];
    if (!lowerRowK) break;
    const lowerValue = lowerRowK[j] ?? 1;
    const idx = lowerValue - 1;
    const boundIndex = Math.max(0, idx - 1);
    breaks[j - 1] = sorted[boundIndex] ?? minValue;
    k = idx;
  }

  return breaks;
};

const normalizeJenks = (value: number, allValues: number[], classCount: number): number => {
  if (!allValues.length) return 0;
  const classes = Math.max(1, Math.min(classCount, allValues.length));
  const breaks = calculateJenksBreaks(allValues, classes);
  let classIndex = 0;
  for (let i = 1; i < breaks.length; i += 1) {
    const threshold = breaks[i];
    if (threshold !== undefined && value <= threshold) {
      classIndex = i - 1;
      break;
    }
    if (i === breaks.length - 1) {
      classIndex = classes - 1;
    }
  }
  return classes <= 1 ? 0 : classIndex / (classes - 1);
};

export const resolveClassCount = (
  config: StylerConfig,
  fallback: number = DEFAULT_CLASS_COUNT
): number => {
  const candidate = config.binCount;
  if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
    return Math.round(candidate);
  }
  return fallback;
};

export const normalizeByAlgorithm = (
  value: number,
  config: StylerConfig,
  allValues?: number[],
  classCount?: number
): number => {
  const { min, max, algorithm } = config;
  const resolvedClassCount = classCount ?? resolveClassCount(config);
  switch (algorithm) {
    case 'log':
      return normalizeLog(value, min, max);
    case 'quantile':
      return allValues && allValues.length > 0
        ? normalizeQuantile(value, allValues)
        : normalizeEqual(normalizeLinear(value, min, max), resolvedClassCount);
    case 'jenks':
      return allValues && allValues.length > 0
        ? normalizeJenks(value, allValues, resolvedClassCount)
        : normalizeEqual(normalizeLinear(value, min, max), resolvedClassCount);
    case 'equal':
      return normalizeEqual(normalizeLinear(value, min, max), resolvedClassCount);
    default:
      return normalizeLinear(value, min, max);
  }
};
