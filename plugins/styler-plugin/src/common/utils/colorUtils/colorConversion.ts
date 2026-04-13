/**
 * @file colorConversion.ts
 * @description Color format conversion and manipulation utilities (HSV, RGB, Hex)
 */

import { clamp01 } from './colorNormalization.js';
import type { ColorVariationOptions, ColorVariations } from './types.js';

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
