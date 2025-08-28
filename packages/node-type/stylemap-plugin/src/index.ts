/**
 * @file index.ts
 * @description StyleMap plugin main entry point
 * 【機能概要】: StyleMapプラグインのメインエクスポート
 * 【実装方針】: プラグイン拡張パターンに準拠したエクスポート構造
 * 🟢 信頼性レベル: HierarchiDBプラグインアーキテクチャ準拠
 */

// Import classes and services for internal use
import { StyleMapDataService } from './services/StyleMapDataService';
import { StyleMapEntityHandler } from './handlers/StyleMapEntityHandler';
import { StyleMapExtension } from './extension/definition';

// Types exports
export type {
  StyleMapEntity,
  StyleMapWorkingCopy,
  StyleMapStyle,
  StyleMapColorRule,
} from './entities/StyleMapEntity';

export type {
  StyleMapConfig,
  MapLibreStyleProperty,
  ColorAlgorithm,
  ColorSpace,
  StyleMapMapping,
  MapLibrePropertyMetadata,
  PropertyGroup,
  ColorCalculationResult,
  TablePreviewProps,
} from './types/styleMapTypes';

// Constants and defaults
export {
  StyleMapConfigDefault,
  MAPLIBRE_PROPERTY_METADATA,
  MAPLIBRE_PROPERTY_GROUPS,
} from './types/styleMapTypes';

// Extension definition (main plugin definition)
export { StyleMapExtension as default } from './extension/definition';
export { StyleMapExtension } from './extension/definition';

// Entity handler
export { StyleMapEntityHandler } from './handlers/StyleMapEntityHandler';

// Services
export { StyleMapDataService } from './services/StyleMapDataService';

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

// Legacy components (for backward compatibility)
export { StyleMapSimpleDialog } from './components/StyleMapSimpleDialog';
export type {
  StyleMapSimpleDialogProps,
  StyleMapCreateConfig,
} from './components/StyleMapSimpleDialog';

/**
 * 【プラグイン情報】: HierarchiDBプラグインシステム用の情報
 * 【実装方針】: package.jsonのhierarchidb.plugin設定と連携
 * 🟢 信頼性レベル: プラグインシステム準拠
 */
export const PLUGIN_INFO = {
  nodeType: 'stylemap',
  name: 'StyleMap Plugin',
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
export async function initializeStyleMapPlugin(context: {
  spreadsheetPlugin: any;
  csvApiDriver: any;
  nodeTypeRegistry: any;
}) {
  try {
    const { spreadsheetPlugin, csvApiDriver, nodeTypeRegistry } = context;

    // StyleMapDataServiceを初期化
    const dataService = new StyleMapDataService(csvApiDriver);

    // StyleMapEntityHandlerを初期化
    const entityHandler = new StyleMapEntityHandler(spreadsheetPlugin.entityHandler, dataService);

    // プラグインをレジストリに登録
    nodeTypeRegistry.registerExtension({
      definition: StyleMapExtension,
      handler: entityHandler,
      dataService,
    });

    console.log('[StyleMap] Plugin initialized successfully');

    return {
      definition: StyleMapExtension,
      handler: entityHandler,
      dataService,
    };
  } catch (error) {
    console.error('[StyleMap] Plugin initialization failed:', error);
    throw error;
  }
}
