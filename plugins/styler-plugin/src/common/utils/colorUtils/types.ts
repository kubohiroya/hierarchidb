/**
 * @file types.ts
 * @description Type definitions for color utilities
 */

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
