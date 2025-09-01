/**
 * @file index.ts
 * @description Styler plugin main entry point
 * 【機能概要】: Stylerプラグインのメインエクスポート
 * 【実装方針】: プラグイン拡張パターンに準拠したエクスポート構造
 * 🟢 信頼性レベル: HierarchiDBプラグインアーキテクチャ準拠
 */

// Import classes and services for internal use
import { StylerDataService } from './services/StylerDataService';
import { StylerEntityHandler } from './handlers/StylerEntityHandler';
import { StylerExtension } from './extension/definition';

// Types exports
export type {
  StylerEntity,
  StylerWorkingCopy,
  StylerStyle,
  StylerColorRule,
} from './entities/StylerEntity';

export type {
  StylemapCategory,
  StylemapCategoryConfig,
} from './types/category-types';

export type {
  StylemapBasicInfoData,
} from './steps/BasicInfoStep';

export type {
  StylerConfig,
  MapLibreStyleProperty,
  ColorAlgorithm,
  ColorSpace,
  StylerMapping,
  MapLibrePropertyMetadata,
  PropertyGroup,
  ColorCalculationResult,
  TablePreviewProps,
} from './types/stylerTypes';

// Constants and defaults
export {
  StylerConfigDefault,
  MAPLIBRE_PROPERTY_METADATA,
  MAPLIBRE_PROPERTY_GROUPS,
} from './types/stylerTypes';

// Extension definition (main plugin definition)
export { StylerExtension as default } from './extension/definition';
export { StylerExtension } from './extension/definition';

// Entity handler
export { StylerEntityHandler } from './handlers/StylerEntityHandler';

// Services
export { StylerDataService } from './services/StylerDataService';

// Utilities
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
} from './utils/colorUtils';

// Step components
export { BasicInfoStep } from './steps/BasicInfoStep';

// Legacy components (for backward compatibility)
export { StylerSimpleDialog } from './components/StylerSimpleDialog';
export type {
  StylerSimpleDialogProps,
  StylerCreateConfig,
} from './components/StylerSimpleDialog';

/**
 * 【プラグイン情報】: HierarchiDBプラグインシステム用の情報
 * 【実装方針】: package.jsonのhierarchidb.plugin設定と連携
 * 🟢 信頼性レベル: プラグインシステム準拠
 */
export const PLUGIN_INFO = {
  nodeType: 'styler',
  name: 'Styler Plugin',
  displayName: 'スタイルマップ',
  extends: 'spreadsheet',
  version: '1.0.0',
  category: 'visualization',
  priority: 700,
  capabilities: {
    canHaveChildren: false,
    canBeRoot: false,
    canBeDeleted: true,
    canBeRenamed: true,
    canBeMoved: true,
    canBeCopied: true,
  },
} as const;

/**
 * 【プラグイン初期化】: プラグインの初期化関数
 * 【実装方針】: HierarchiDBのプラグインローダーから呼び出される
 * 🟡 信頼性レベル: プラグインシステム仕様に依存
 */
export async function initializeStylerPlugin(context: {
  spreadsheetPlugin: any;
  csvApiDriver: any;
  nodeTypeRegistry: any;
}) {
  try {
    const { spreadsheetPlugin, csvApiDriver, nodeTypeRegistry } = context;

    // StylerDataServiceを初期化
    const dataService = new StylerDataService(csvApiDriver);

    // StylerEntityHandlerを初期化
    const entityHandler = new StylerEntityHandler(spreadsheetPlugin.entityHandler, dataService);

    // プラグインをレジストリに登録
    nodeTypeRegistry.registerExtension({
      definition: StylerExtension,
      handler: entityHandler,
      dataService,
    });

    console.log('[Styler] Plugin initialized successfully');

    return {
      definition: StylerExtension,
      handler: entityHandler,
      dataService,
    };
  } catch (error) {
    console.error('[Styler] Plugin initialization failed:', error);
    throw error;
  }
}
