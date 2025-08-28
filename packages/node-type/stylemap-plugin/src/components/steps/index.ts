/**
 * @file steps/index.ts
 * @description Export all StyleMap step components
 * 【機能概要】: StyleMapステップコンポーネントのエクスポート
 * 【実装方針】: Spreadsheetプラグインの拡張ステップとして提供
 * 🟢 信頼性レベル: モジュールエクスポート
 */

// Step 5: Style Mapping Configuration
export { StyleMapStep5, StyleMapStep5Definition } from './StyleMapStep5';
export type { StyleMapStep5Props } from './StyleMapStep5';

// Step 6: Preview with Style Mapping
export { StyleMapStep6, StyleMapStep6Definition } from './StyleMapStep6';
export type { StyleMapStep6Props } from './StyleMapStep6';

// Re-export components for direct use
export { StyleMapConfiguration } from '../components/step5/StyleMapConfiguration';
export type { StyleMapConfigurationProps } from '../components/step5/StyleMapConfiguration';

export { StyleMapTablePreview } from '../components/step6/StyleMapTablePreview';
export type { StyleMapTablePreviewProps } from '../components/step6/StyleMapTablePreview';

// Re-export types
export type {
  StyleMapConfig,
  MapLibreStyleProperty,
  ColorAlgorithm,
  ColorSpace,
  StyleMapMapping,
  MapLibrePropertyMetadata,
  PropertyGroup,
  ColorCalculationResult,
} from '../types/styleMapTypes';

export {
  StyleMapConfigDefault,
  MAPLIBRE_PROPERTY_METADATA,
  MAPLIBRE_PROPERTY_GROUPS,
} from '../types/styleMapTypes';

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