/**
 * 【機能概要】: Spreadsheetプラグインの拡張定義
 * 【実装方針】: folderプラグインを継承し、データソース選択とフィルタリング機能を追加
 * 【テスト対応】: TC-101-001から TC-101-010までの全テストケースを通すための実装
 * 🟢 信頼性レベル: EXTENDING_FOLDER_PLUGIN.mdの仕様に基づく
 */

// Avoid cross-package type dependency to keep d.ts bundling simple
type BaseFolderFields = {
  id: string;
  nodeId: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  version: number;
};

// Step コンポーネントのインポート（将来の拡張用）
// import { DataSourceStep } from '../steps/DataSourceStep';
// import { FilteringStep } from '../steps/FilteringStep';

/**
 * 【型定義】: SpreadsheetEntityの拡張フィールド型
 * 🟢 信頼性レベル: 設計文書に基づく
 */
interface SpreadsheetExtendedFields {
  spreadsheetMetadataId?: string;
  dataSource: {
    type: 'file' | 'url' | 'manual';
    source?: string;
    delimiter?: string;
    hasHeader?: boolean;
  };
  filters?: {
    rows: any[];
    columns: any[];
  };
}

/**
 * 【型定義】: SpreadsheetEntityの完全な型定義
 * 🟢 信頼性レベル: FolderEntityを継承
 */
export interface SpreadsheetEntity extends BaseFolderFields, SpreadsheetExtendedFields {
  // FolderEntityから継承: id, nodeId, name, description, createdAt, updatedAt, version
  // SpreadsheetExtendedFieldsから追加: spreadsheetMetadataId, dataSource, filters
}

/**
 * 【型定義】: SpreadsheetWorkingCopyの型定義
 * 🟢 信頼性レベル: Working Copyパターンに基づく
 */
export interface SpreadsheetWorkingCopy extends SpreadsheetEntity {
  isDraft: boolean;
  originalId?: string;
  copiedAt: number;
}

/**
 * 【拡張定義】: Spreadsheetプラグインの拡張定義オブジェクト
 * 【実装方針】: ExtendableNodeTypeDefinition型に準拠した定義
 * 【テスト対応】: TC-101-001〜TC-101-010の全要件を満たす
 * 🟢 信頼性レベル: EXTENDING_FOLDER_PLUGIN.mdの仕様に完全準拠
 */
export const SpreadsheetExtension = {
  // 【拡張定義】: folderプラグインを拡張
  extends: 'folder',
  
  // 【メタデータ定義】: プラグインの基本情報 🟢
  nodeType: 'spreadsheet',
  name: 'Spreadsheet',
  displayName: 'スプレッドシート',
  icon: 'table_chart', // 【アイコン】: Material Iconのテーブルアイコン 🟡
  color: '#2196F3', // 【カラー】: Material Designのblue[500] 🟡
  
  // 【拡張ステップ定義】: Step 2とStep 3を追加
  extendedSteps: [
    {
      stepNumber: 2,
      title: 'データソース選択', // 【日本語タイトル】: テスト期待値に合わせた日本語表記 🟢
      component: null, // DataSourceStep,
      validation: {
        validate: async (_data: any) => {
          // 【データソース必須チェック】: データソース未選択エラー 🟢
          if (!_data.dataSource) {
            return { isValid: false, errors: ['データソースを選択してください'] };
          }
          // 【ファイル選択チェック】: fileタイプ時のファイル未選択エラー 🟢
          if (_data.dataSource.type === 'file' && !_data.file?.name && !_data.dataSource.source) {
            return { isValid: false, errors: ['ファイルを選択してください'] };
          }
          return { isValid: true, errors: [] };
        }
      }
    },
    {
      stepNumber: 3,
      title: 'フィルタリング',
      component: null, // FilteringStep,
      validation: {
        validate: async (_data: any) => {
          // フィルタリングはオプションなので常にtrue
          return { isValid: true, errors: [] };
        }
      }
    }
  ],

  // 【拡張フィールド定義】: SpreadSheet固有フィールド
  extendedFields: [
    {
      name: 'spreadsheetMetadataId',
      type: 'string',
      required: false,
      label: 'Spreadsheet Metadata ID',
      description: 'Internal metadata identifier'
    },
    {
      name: 'dataSource',
      type: 'object',
      required: true,
      label: 'Data Source',
      description: 'Data source configuration'
    },
    {
      name: 'filters',
      type: 'object',
      required: false,
      label: 'Filters',
      description: 'Row and column filtering configuration'
    }
  ],

  // 【拡張バリデーション】: SpreadSheet固有のバリデーション
  extendedValidation: {
    extendedRules: {
      fileFormatRule: {
        validate: (data: any) => {
          // データソースまたはファイルのいずれかからファイル名を取得
          const fileName = data.dataSource?.source || data.file?.name;
          if (!fileName) return true;
          const lowerFileName = fileName.toLowerCase();
          const supportedExtensions = ['.csv', '.tsv', '.xlsx', '.xls'];
          return supportedExtensions.some(ext => lowerFileName.endsWith(ext));
        },
        message: 'CSV、TSV、またはExcelファイルを選択してください'
      }
    },
    chainMode: 'all',
    mergeStrategy: 'append'
  }

};
