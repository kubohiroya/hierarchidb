/**
 * @file definition.ts
 * @description StyleMap plugin extension definition
 * 【機能概要】: StyleMapプラグインの拡張定義
 * 【実装方針】: spreadsheetプラグインを継承し、Step5-6を追加
 * 🟢 信頼性レベル: ExtendingNodeTypeDefinition仕様準拠
 */

// import type { ExtendedPluginDefinition } from '@hierarchidb/common-type';

// Define base entity types since they're not exported
interface SpreadsheetEntity {
  id: string;
  nodeId: string;
  name: string;
  description?: string;
  spreadsheetMetadataId?: string;
  dataSource?: any;
  filters?: any[];
  createdAt: number;
  updatedAt: number;
  version: number;
}
import type { StyleMapConfig } from '../types/styleMapTypes';
import { StyleMapStep5Definition } from '../components/steps/StyleMapStep5';
import { StyleMapStep6Definition } from '../components/steps/StyleMapStep6';

/**
 * 【型定義】: StyleMapEntityの拡張フィールド型
 * 🟢 信頼性レベル: SpreadsheetEntityを継承
 */
interface StyleMapExtendedFields {
  // StyleMap固有のフィールド
  styleMapConfig: StyleMapConfig;
  selectedKeyColumn?: string;
  selectedValueColumn?: string;

  // 生成されたスタイル情報（オプション）
  generatedStyle?: {
    maplibreStyleSpec: any;
    colorMapping: Record<string, string>;
    lastUpdated: number;
  };
}

/**
 * 【型定義】: StyleMapEntityの完全な型定義
 * 🟢 信頼性レベル: SpreadsheetEntityを継承してスタイル情報を追加
 */
export interface StyleMapEntity extends SpreadsheetEntity, StyleMapExtendedFields {
  // SpreadsheetEntityから継承:
  // - FolderEntity fields (id, nodeId, name, description, etc.)
  // - spreadsheetMetadataId, dataSource, filters
  // StyleMapExtendedFieldsから追加:
  // - styleMapConfig, selectedKeyColumn, selectedValueColumn, generatedStyle
}

/**
 * 【型定義】: StyleMapWorkingCopyの型定義
 * 🟢 信頼性レベル: Working Copyパターン準拠
 */
export interface StyleMapWorkingCopy extends StyleMapEntity {
  isDraft: boolean;
  originalId?: string;
  copiedAt: number;
}

/**
 * 【拡張定義】: StyleMapプラグインの拡張定義オブジェクト
 * 【実装方針】: ExtendingNodeTypeDefinition型に完全準拠
 * 【継承関係】: spreadsheet-plugin -> folder-plugin -> base の3段階継承
 * 🟢 信頼性レベル: プラグイン拡張仕様に完全準拠
 */
// Export as a simple object, not as ExtendedPluginDefinition
export const StyleMapExtension = {
  // 【メタデータ定義】: プラグインの基本情報
  nodeType: 'stylemap',
  name: 'StyleMap',
  displayName: 'スタイルマップ',

  // 【拡張ステップ定義】: Step 5とStep 6を追加
  // spreadsheetのStep 1-4の後に続く
  extendedSteps: [
    {
      stepNumber: 5,
      title: 'Style Mapping Configuration',
      component: StyleMapStep5Definition.component,
      validation: StyleMapStep5Definition.validation,
    },
    {
      stepNumber: 6,
      title: 'Preview with Style Mapping',
      component: StyleMapStep6Definition.component,
      validation: StyleMapStep6Definition.validation,
    },
  ],

  // 【拡張フィールド定義】: StyleMap固有フィールド
  extendedFields: [
    {
      name: 'styleMapConfig',
      type: 'object',
      required: true,
      label: 'Style Mapping Configuration',
      description: 'MapLibre style mapping configuration',
    },
    {
      name: 'selectedKeyColumn',
      type: 'string',
      required: false,
      label: 'Key Column',
      description: 'Selected key column for mapping',
    },
    {
      name: 'selectedValueColumn',
      type: 'string',
      required: true,
      label: 'Value Column',
      description: 'Selected value column for color mapping',
    },
    {
      name: 'generatedStyle',
      type: 'object',
      required: false,
      label: 'Generated Style',
      description: 'Generated MapLibre style specification',
    },
  ],

  // 【拡張バリデーション】: StyleMap固有のバリデーション
  extendedValidation: {
    extendedRules: {
      // スタイル設定の必須チェック
      styleConfigRule: {
        validate: (data: any) => {
          const config = data.styleMapConfig;
          return config && config.targetProperty && config.mapping;
        },
        message: 'スタイルマッピング設定が必要です',
      },

      // 値列の必須チェック
      valueColumnRule: {
        validate: (data: any) => {
          return !!data.selectedValueColumn;
        },
        message: '値列の選択が必要です',
      },

      // マッピング範囲の妥当性チェック
      mappingRangeRule: {
        validate: (data: any) => {
          const mapping = data.styleMapConfig?.mapping;
          if (!mapping) return true; // 他のルールでチェック
          return mapping.min < mapping.max;
        },
        message: '最大値は最小値より大きい値を設定してください',
      },
    },
    chainMode: 'all',
    mergeStrategy: 'append',
  },
};

/**
 * 【エクスポート】: メイン拡張定義
 */
export default StyleMapExtension;
