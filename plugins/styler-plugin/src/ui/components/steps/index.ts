/**
  * @file steps/index.ts
 * @description Export all Styler step components
 * : Styler
 * : Spreadsheet
 * :
  */

// Step 5: Style Mapping Configuration
export { StylerStep5, StylerStep5Definition } from './StylerStep5.js';
export type { StylerStep5Props } from './StylerStep5.js';

// Step 6: Preview with Style Mapping
export { StylerStep6, StylerStep6Definition } from './StylerStep6.js';
export type { StylerStep6Props } from './StylerStep6.js';

// Re-export components for direct use
export { StylerConfiguration } from './StylerConfiguration.js';
export type { StylerConfigurationProps } from './StylerConfiguration.js';

export { StylerTablePreview } from './StylerTablePreview.js';
export type { StylerTablePreviewProps } from './StylerTablePreview.js';

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
} from '../../../common/types/stylerTypes.js';

export {
  StylerConfigDefault,
  MAPLIBRE_PROPERTY_METADATA,
  MAPLIBRE_PROPERTY_GROUPS,
} from '../../../common/types/stylerTypes.js';

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
} from '../../../common/utils/colorUtils.js';
