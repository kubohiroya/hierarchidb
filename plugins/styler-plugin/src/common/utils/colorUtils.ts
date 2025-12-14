/**
 * @file colorUtils.ts
 * @description Color conversion and manipulation utilities
 */

import type { ColorCalculationResult, StylerConfig, StylerMapping } from '../types/StylerEntity.js';
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
 * : RGBHSV
 * : RGBHSV
 * :
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
 * : RGBHex
 * : RGB16
 * :
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
 * : HexRGB
 * : 16RGB
 * :
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
 * :
 * :
 * :
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
  mapping: StylerMapping,
  config: StylerConfig
): ColorCalculationResult {
  // Sort values
  const sorted = [...allValues].sort((a, b) => a - b);
  const position = sorted.findIndex((v) => v >= value);

  // Calculate quantile (0-1)
  const quantile = position === -1 ? 1 : position / sorted.length;

  // Use linear interpolation with quantile
  const mockConfig = {
    ...config,
    mapping,
  };
  /*
  ...config.mapping,
      min: 0,
      max: 1,
  }
   */
  return calculateLinearColor(quantile, mockConfig);
}

/**
 * :
 * :
 * : UI
 * @param config - Styler configuration
 * @param steps - Number of gradient steps
 * @returns CSS gradient string
 */
export function generateColorGradient(config: StylerConfig, steps: number = 20): string {
  const colors: string[] = [];
  const { min, max } = config;

  for (let i = 0; i < steps; i++) {
    const value = min + (max - min) * (i / (steps - 1));
    const result = calculateLinearColor(value, config);
    colors.push(result.color);
  }

  return `linear-gradient(to right, ${colors.join(', ')})`;
}

/**
 * :
 * :
 * :
 * @param value - Input value
 * @param config - Styler configuration
 * @param allValues - All values (for quantile/jenks)
 * @returns Calculated color result
 */
export function valueToColor(
  value: number | null | undefined,
  mapping: StylerMapping,
  config: StylerConfig,
  allValues?: number[]
): ColorCalculationResult {
  // Handle null/undefined values
  if (value === null || value === undefined) {
    return {
      color: '#cccccc',
      opacity: 0.5,
    };
  }

  // normalize colorScheme/invertColors into effective config
  const normalizeConfig = (base: StylerConfig): StylerConfig => {
    const scheme = base.colorScheme ?? StylerConfigDefault.colorScheme;
    const invert = base.invertColors ?? StylerConfigDefault.invertColors;
    // start with hsv defaults
    let effective: StylerConfig = { ...StylerConfigDefault, ...base };
    if (scheme === 'grayscale') {
      effective = {
        ...effective,
        colorSpace: 'rgb',
        startColor: invert ? '#ffffff' : '#000000',
        endColor: invert ? '#000000' : '#ffffff',
        saturation: 0,
        brightness: 1,
        hueStart: 0,
        hueEnd: 0,
      };
    } else if (scheme === 'redgreen') {
      effective = {
        ...effective,
        colorSpace: 'rgb',
        startColor: invert ? '#00ff00' : '#ff0000',
        endColor: invert ? '#ff0000' : '#00ff00',
      };
    } else if (scheme === 'blueorange') {
      effective = {
        ...effective,
        colorSpace: 'rgb',
        startColor: invert ? '#ffa500' : '#0000ff',
        endColor: invert ? '#0000ff' : '#ffa500',
      };
    } else if (invert) {
      // generic invert for hsv
      effective = {
        ...effective,
        hueStart: base.hueEnd,
        hueEnd: base.hueStart,
        startColor: base.endColor,
        endColor: base.startColor,
      };
    }
    return effective;
  };

  const effectiveConfig = normalizeConfig(config);

  // Apply algorithm
  switch (effectiveConfig.algorithm) {
    case 'linear':
      return calculateLinearColor(value, effectiveConfig);

    case 'quantile':
      if (allValues) {
        return calculateQuantileColor(value, allValues, mapping, effectiveConfig);
      }
      return calculateLinearColor(value, effectiveConfig);

    case 'jenks':
    case 'equal':
      // TODO: Implement Jenks natural breaks and equal interval
      // For now, fallback to linear
      return calculateLinearColor(value, effectiveConfig);

    default:
      return calculateLinearColor(value, effectiveConfig);
  }
}

/**
 * :
 * : HSV
 * :
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

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

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
 * :
 * : WCAG
 * :
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
