/**
 * @file colorUtils.ts
 * @description Color conversion and manipulation utilities
 */

import type {
  ColorCalculationResult,
  ColorScheme,
  StylerConfig,
  StylerMapping,
} from '../types/StylerEntity.js';
import { StylerConfigDefault } from '../types/StylerEntity.js';

/**
 * @param h - Hue (0-360)
 * @param s - Saturation (0-1)
 * @param v - Value/Brightness (0-1)
 * @returns [r, g, b] - RGB values (0-255)
 */
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = h % 360;
  if (h < 0) h += 360;

  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (h >= 300 && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/**
 * @param r - Red (0-255)
 * @param g - Green (0-255)
 * @param b - Blue (0-255)
 * @returns [h, s, v] - HSV values
 */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  const s = max === 0 ? 0 : diff / max;
  const v = max;

  if (diff !== 0) {
    if (max === r) {
      h = ((g - b) / diff + (g < b ? 6 : 0)) * 60;
    } else if (max === g) {
      h = ((b - r) / diff + 2) * 60;
    } else {
      h = ((r - g) / diff + 4) * 60;
    }
  }

  return [h, s, v];
}

/**
 * @param r - Red (0-255)
 * @param g - Green (0-255)
 * @param b - Blue (0-255)
 * @returns Hex color string (e.g., "#ff0000")
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * @param hex - Hex color string
 * @returns [r, g, b] - RGB values (0-255)
 */
export function hexToRgb(hex: string): [number, number, number] {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Handle 3-digit hex
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return [r, g, b];
}

/**
 * @param value - Input value
 * @param config - Styler configuration
 * @returns Calculated color result
 */
export function calculateLinearColor(value: number, config: StylerConfig): ColorCalculationResult {
  const colorSpace = config.colorSpace ?? StylerConfigDefault.colorSpace;
  const { min, max } = config;

  // Normalize value to 0-1 range
  const normalizedValue = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));

  if (colorSpace === 'hsv') {
    const { hueStart, hueEnd, saturation, brightness } = config;

    // Interpolate hue
    let hue = hueStart + (hueEnd - hueStart) * normalizedValue;

    // Handle hue wrapping
    if (hueEnd < hueStart) {
      hue = hueStart + (hueEnd + 360 - hueStart) * normalizedValue;
      if (hue >= 360) hue -= 360;
    }

    const [r, g, b] = hsvToRgb(hue, saturation, brightness);
    const color = rgbToHex(r, g, b);

    return {
      color,
      opacity: config.opacity,
      metadata: {
        hue,
        saturation,
        brightness,
        r,
        g,
        b,
      },
    };
  } else if (colorSpace === 'rgb') {
    // RGB interpolation
    const startColor = config.startColor || StylerConfigDefault.startColor || '#ff0000';
    const endColor = config.endColor || StylerConfigDefault.endColor || '#00ff00';

    const [r1, g1, b1] = hexToRgb(startColor);
    const [r2, g2, b2] = hexToRgb(endColor);

    const r = Math.round(r1 + (r2 - r1) * normalizedValue);
    const g = Math.round(g1 + (g2 - g1) * normalizedValue);
    const b = Math.round(b1 + (b2 - b1) * normalizedValue);

    const color = rgbToHex(r, g, b);

    return {
      color,
      opacity: config.opacity,
      metadata: {
        r,
        g,
        b,
      },
    };
  }

  // Fallback to grayscale
  const gray = Math.round(255 * normalizedValue);
  return {
    color: rgbToHex(gray, gray, gray),
    opacity: config.opacity,
  };
}

export const normalizeColorSchemeId = (scheme?: string): ColorScheme => {
  const raw: string = scheme ?? (StylerConfigDefault.colorScheme as ColorScheme);
  switch (raw) {
    case 'grayscale':
      return 'grayscale';
    case 'redgreen':
    case 'red-green':
    case 'green-red':
    case 'greenred':
      return 'redgreen';
    case 'blueorange':
    case 'blue-orange':
    case 'orange-blue':
    case 'blue-red':
    case 'red-blue':
      return 'blueorange';
    case 'viridis':
      return 'viridis';
    case 'magma':
      return 'magma';
    case 'custom':
      return 'custom';
    default:
      return (StylerConfigDefault.colorScheme ?? 'grayscale') as ColorScheme;
  }
};

export const normalizeStylerConfig = (base: StylerConfig): StylerConfig => {
  const scheme = normalizeColorSchemeId(base.colorScheme);
  const invert = base.invertColors ?? StylerConfigDefault.invertColors;

  // start with merged defaults
  let effective: StylerConfig = { ...StylerConfigDefault, ...base, colorScheme: scheme };

  const applyStops = (start: string, end: string) => {
    effective = {
      ...effective,
      colorSpace: 'rgb',
      startColor: invert ? end : start,
      endColor: invert ? start : end,
    };
  };

  switch (scheme) {
    case 'grayscale':
      applyStops('#000000', '#ffffff');
      effective = { ...effective, saturation: 0, brightness: 1, hueStart: 0, hueEnd: 0 };
      break;
    case 'redgreen':
      applyStops('#ff0000', '#00ff00');
      break;
    case 'blueorange':
      applyStops('#1a1c7c', '#ffa500');
      break;
    case 'viridis':
      applyStops('#440154', '#fde725');
      break;
    case 'magma':
      applyStops('#000004', '#fbfcbf');
      break;
    case 'custom':
    default:
      if (invert) {
        effective = {
          ...effective,
          hueStart: base.hueEnd,
          hueEnd: base.hueStart,
          startColor: base.endColor,
          endColor: base.startColor,
        };
      }
      break;
  }

  return effective;
};

const DEFAULT_CLASS_COUNT = 5;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

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

const normalizeQuantile = (value: number, allValues: number[]): number => {
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
    if (breaks[i] !== undefined && value <= breaks[i]!) {
      classIndex = i - 1;
      break;
    }
    if (i === breaks.length - 1) {
      classIndex = classes - 1;
    }
  }
  return classes <= 1 ? 0 : classIndex / (classes - 1);
};

const resolveClassCount = (config: StylerConfig, fallback: number = DEFAULT_CLASS_COUNT): number => {
  const candidate = config.binCount;
  if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
    return Math.round(candidate);
  }
  return fallback;
};

const normalizeByAlgorithm = (
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
    case 'linear':
    default:
      return normalizeLinear(value, min, max);
  }
};

const calculateColorFromNormalized = (
  normalizedValue: number,
  config: StylerConfig
): ColorCalculationResult => {
  const normalizedConfig = { ...config, min: 0, max: 1 };
  return calculateLinearColor(clamp01(normalizedValue), normalizedConfig);
};

/**
 * :
 * :
 * :
 * @param value - Input value
 * @param allValues - All values for quantile calculation
 * @param config - Styler configuration
 * @returns Calculated color result
 */
export function calculateQuantileColor(
  value: number,
  allValues: number[],
  _mapping: StylerMapping,
  config: StylerConfig
): ColorCalculationResult {
  const effectiveConfig = normalizeStylerConfig(config);
  const quantile = normalizeQuantile(value, allValues);
  return calculateColorFromNormalized(quantile, effectiveConfig);
}

/**
 * @param config - Styler configuration
 * @param steps - Number of gradient steps
 * @returns CSS gradient string
 */
export function generateColorGradient(
  config: StylerConfig,
  steps: number = 20,
  allValues?: number[],
  classCount?: number
): string {
  const effective = normalizeStylerConfig(config);
  const colors: string[] = [];
  const { min, max } = effective;
  const safeSteps = Math.max(2, steps);
  const resolvedClassCount = classCount ?? resolveClassCount(effective);

  for (let i = 0; i < safeSteps; i++) {
    const value = min + (max - min) * (i / (safeSteps - 1));
    const normalized = normalizeByAlgorithm(value, effective, allValues, resolvedClassCount);
    const result = calculateColorFromNormalized(normalized, effective);
    colors.push(result.color);
  }

  return `linear-gradient(to right, ${colors.join(', ')})`;
}

export function valueToColor(
  value: number | null | undefined,
  mappingOrConfig: StylerMapping | StylerConfig,
  maybeConfig?: StylerConfig,
  allValues?: number[]
): ColorCalculationResult {
  // Handle null/undefined values
  if (value === null || value === undefined) {
    return {
      color: '#cccccc',
      opacity: 0.5,
    };
  }

  //const _mapping = maybeConfig ? (mappingOrConfig as StylerMapping) : undefined;
  const config = maybeConfig ?? (mappingOrConfig as StylerConfig);
  const effectiveConfig = normalizeStylerConfig(config);

  // Apply algorithm
  const normalized = normalizeByAlgorithm(
    value,
    effectiveConfig,
    allValues,
    resolveClassCount(effectiveConfig)
  );
  return calculateColorFromNormalized(normalized, effectiveConfig);
}

/**
 * @param color - Input color (hex)
 * @param factor - Brightness factor (0-2, 1 = no change)
 * @returns Adjusted color (hex)
 */
export function adjustBrightness(color: string, factor: number): string {
  const [r, g, b] = hexToRgb(color);
  const [h, s, v] = rgbToHsv(r, g, b);

  const newV = Math.max(0, Math.min(1, v * factor));
  const [newR, newG, newB] = hsvToRgb(h, s, newV);

  return rgbToHex(newR, newG, newB);
}

export interface ColorVariationOptions {
  /** Saturation delta (added to current saturation). Defaults to +0.12. */
  saturationDelta?: number;
  /** Value/Brightness delta (added to current value). Defaults to -0.1 (slightly darker). */
  valueDelta?: number;
}

export interface ColorVariations {
  /** Normalized base color (hex). */
  base: string;
  /** Darkened variant (hex). */
  darker: string;
  /** Saturated variant (hex). */
  saturated: string;
}

/**
 * Generate simple color variations (darker / more saturated) using existing HSV utilities.
 *
 * @param color - Base color (hex form; 3 or 6 digits allowed)
 * @param options - Adjustment deltas for saturation/value
 * @returns Variations containing the normalized base plus adjusted variants
 */
export function createColorVariations(
  color: string,
  options: ColorVariationOptions = {}
): ColorVariations {
  const { saturationDelta = 0.12, valueDelta = -0.1 } = options;

  const [r, g, b] = hexToRgb(color);
  const baseHex = rgbToHex(r, g, b);
  const [h, s, v] = rgbToHsv(r, g, b);

  const darkerV = clamp01(v + valueDelta);
  const [darkR, darkG, darkB] = hsvToRgb(h, s, darkerV);
  const darkerHex = rgbToHex(darkR, darkG, darkB);

  const saturatedS = clamp01(s + saturationDelta);
  const [satR, satG, satB] = hsvToRgb(h, saturatedS, v);
  const saturatedHex = rgbToHex(satR, satG, satB);

  return {
    base: baseHex,
    darker: darkerHex,
    saturated: saturatedHex,
  };
}

/**
 * @param color1 - First color (hex)
 * @param color2 - Second color (hex)
 * @returns Contrast ratio
 */
export function getContrastRatio(color1: string, color2: string): number {
  const getLuminance = (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map((c): number => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);

  const l1 = getLuminance(r1, g1, b1);
  const l2 = getLuminance(r2, g2, b2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}
