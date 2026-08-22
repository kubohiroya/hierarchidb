/**
 * @file index.ts
 * @description Barrel re-export for color utilities
 */

// Color calculation
export {
  calculateLinearColor,
  calculateQuantileColor,
  generateColorGradient,
  normalizeColorSchemeId,
  normalizeStylerConfig,
  valueToColor,
} from './colorCalculation.js';

// Color conversion
export {
  adjustBrightness,
  createColorVariations,
  getContrastRatio,
  hexToRgb,
  hsvToRgb,
  rgbToHex,
  rgbToHsv,
} from './colorConversion.js';
// Types
export type { ColorVariationOptions, ColorVariations } from './types.js';
