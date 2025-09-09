/**
  * @file steps/index.ts
 * @description Export all Styler step components
 * : Styler
 * : Spreadsheet
 * :
  */

// Step 5: Style Mapping Configuration
export { StylerStep5, StylerStep5Definition } from './StylerStep5';
export type { StylerStep5Props } from './StylerStep5';

// Step 6: Preview with Style Mapping
export { StylerStep6, StylerStep6Definition } from './StylerStep6';
export type { StylerStep6Props } from './StylerStep6';

// Re-export components for direct use
export { StylerConfiguration } from '../components/step5/StylerConfiguration';
export type { StylerConfigurationProps } from '../components/step5/StylerConfiguration';

export { StylerTablePreview } from '../components/step6/StylerTablePreview';
export type { StylerTablePreviewProps } from '../components/step6/StylerTablePreview';

// Re-export types
export type {
  StylerConfig,
  MapLibreStyleProperty,
  ColorAlgorithm,
  ColorSpace,
  StylerMapping,
  MapLibrePropertyMetadata,
  PropertyGroup,
  ColorCalculationResult,
} from '../types/stylerTypes';

export {
  StylerConfigDefault,
  MAPLIBRE_PROPERTY_METADATA,
  MAPLIBRE_PROPERTY_GROUPS,
} from '../types/stylerTypes';

// Re-export utilities
export {
  hsvToRgb,
  rgbToHsv,
  rgbToHex,
  hexToRgb,
  calculateLinearColor,
  calculateQuantileColor,
  generateColorGradient,
  valueToColor,
  adjustBrightness,
  getContrastRatio,
} from '../utils/colorUtils';