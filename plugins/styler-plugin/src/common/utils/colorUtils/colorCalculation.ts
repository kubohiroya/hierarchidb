/**
 * @file colorCalculation.ts
 * @description High-level color calculation functions using normalization and conversion utilities
 */

import type {
  ColorCalculationResult,
  ColorScheme,
  StylerConfig,
  StylerMapping,
} from '~/common/types/StylerEntity';
import { StylerConfigDefault } from '~/common/types/StylerEntity';
import { hexToRgb, hsvToRgb, rgbToHex } from './colorConversion.js';
import {
  clamp01,
  normalizeByAlgorithm,
  normalizeQuantile,
  resolveClassCount,
} from './colorNormalization.js';

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
