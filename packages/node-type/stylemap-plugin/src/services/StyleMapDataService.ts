/**
 * @file StyleMapDataService.ts
 * @description StyleMap plugin data service integrating with Spreadsheet CSV API
 * 【機能概要】: StyleMapのデータ処理サービス
 * 【実装方針】: SpreadsheetCSVApiDriverを活用してCSVデータを管理
 * 🟢 信頼性レベル: Spreadsheetプラグインとの完全統合
 */

import type {
  ICSVDataApi,
  CSVTableMetadata,
  CSVDataResult,
  CSVFilterRule,
  CSVProcessingConfig,
} from '@hierarchidb/ui-csv-extract';

import type { StyleMapEntity } from '../entities/StyleMapEntity';
import type { StyleMapConfig } from '../types/styleMapTypes';
import { valueToColor } from '../utils/colorUtils';

/**
 * 【機能概要】: StyleMapデータ統合サービス
 * 【実装方針】: SpreadsheetのCSV機能を継承・拡張してスタイル機能を追加
 * 【テスト対応】: データ取得・色計算・プレビュー機能
 * 🟢 信頼性レベル: 完全なSpreadsheet統合
 */
export class StyleMapDataService {
  private csvApiDriver: ICSVDataApi;
  private pluginId: string = 'stylemap';

  constructor(csvApiDriver: ICSVDataApi) {
    this.csvApiDriver = csvApiDriver;
  }

  /**
   * 【機能概要】: CSVファイルのアップロードと初期設定
   * 【実装方針】: SpreadsheetのuploadCSVFileを活用
   * 【テスト対応】: ファイルアップロード→メタデータ生成→初期StyleMap設定
   * 🟢 信頼性レベル: Spreadsheet機能の完全活用
   */
  async uploadCSVFile(
    file: File,
    config: CSVProcessingConfig = {}
  ): Promise<{
    tableMetadata: CSVTableMetadata;
    suggestedConfig: Partial<StyleMapConfig>;
  }> {
    // SpreadsheetのCSVアップロード機能を使用
    const tableMetadata = await this.csvApiDriver.uploadCSVFile(file, config);

    // StyleMap用の初期設定を生成
    const suggestedConfig = this.generateInitialStyleMapConfig(tableMetadata);

    return {
      tableMetadata,
      suggestedConfig,
    };
  }

  /**
   * 【機能概要】: URLからのCSVダウンロードと設定
   * 【実装方針】: SpreadsheetのdownloadCSVFromUrlを活用
   * 🟢 信頼性レベル: Spreadsheet機能の完全活用
   */
  async downloadCSVFromUrl(
    url: string,
    config: CSVProcessingConfig = {}
  ): Promise<{
    tableMetadata: CSVTableMetadata;
    suggestedConfig: Partial<StyleMapConfig>;
  }> {
    const tableMetadata = await this.csvApiDriver.downloadCSVFromUrl(url, config);
    const suggestedConfig = this.generateInitialStyleMapConfig(tableMetadata);

    return {
      tableMetadata,
      suggestedConfig,
    };
  }

  /**
   * 【機能概要】: スタイル適用済みデータプレビューの取得
   * 【実装方針】: Spreadsheetのデータ取得＋StyleMapの色計算
   * 【テスト対応】: フィルタ適用→色計算→プレビューデータ生成
   * 🟢 信頼性レベル: 両プラグイン機能の統合
   */
  async getStyledPreview(
    tableId: string,
    styleMapConfig: StyleMapConfig,
    filters: CSVFilterRule[] = [],
    rowCount: number = 100
  ): Promise<{
    data: CSVDataResult;
    styledRows: Array<{
      row: Record<string, any>;
      styles: Record<string, any>;
    }>;
  }> {
    // Spreadsheetからフィルタ済みデータを取得
    const data = await this.csvApiDriver.getFilteredPreview(tableId, filters, rowCount);

    // 各行にスタイル情報を付加
    const styledRows = data.rows.map((row) => {
      const styles: Record<string, any> = {};

      if (styleMapConfig.valueColumn) {
        const value = row[styleMapConfig.valueColumn];
        if (typeof value === 'number') {
          const colorResult = valueToColor(value, styleMapConfig);
          styles[styleMapConfig.valueColumn] = {
            backgroundColor: colorResult.color,
            opacity: colorResult.opacity,
            metadata: colorResult.metadata,
          };
        }
      }

      return { row, styles };
    });

    return { data, styledRows };
  }

  /**
   * 【機能概要】: MapLibreスタイル仕様の生成
   * 【実装方針】: StyleMapConfigからMapLibre GL JS用のスタイルを生成
   * 【テスト対応】: 設定値→MapLibreスタイル変換
   * 🟢 信頼性レベル: MapLibre仕様準拠
   */
  async generateMapLibreStyle(
    tableId: string,
    entity: StyleMapEntity
  ): Promise<{
    styleSpec: any;
    colorMapping: Record<string, string>;
  }> {
    const { styleMapConfig, selectedKeyColumn, selectedValueColumn } = entity;

    if (!selectedKeyColumn || !selectedValueColumn || !styleMapConfig.targetProperty) {
      throw new Error('Key column, value column, and target property are required');
    }

    // データを取得して値の範囲を確認
    const data = await this.csvApiDriver.getFilteredPreview(tableId, [], 1000);
    const values = data.rows
      .map((row) => row[selectedValueColumn])
      .filter((val) => typeof val === 'number') as number[];

    if (values.length === 0) {
      throw new Error('No numeric values found in selected column');
    }

    // 色マッピングテーブルを生成
    const colorMapping: Record<string, string> = {};
    const styleSpec: any = {
      version: 8,
      sources: {},
      layers: [
        {
          id: `stylemap-layer-${entity.id}`,
          type: 'fill', // 基本レイヤータイプ
          paint: {},
        },
      ],
    };

    // 値に基づく色マッピング
    values.forEach((value) => {
      const colorResult = valueToColor(value, styleMapConfig, values);
      colorMapping[value.toString()] = colorResult.color;
    });

    // MapLibre paint プロパティを設定
    if (styleMapConfig.targetProperty) {
      // データ駆動型スタイリングの設定
      const colorStops = Object.entries(colorMapping).map(([value, color]) => [
        parseFloat(value),
        color,
      ]);

      styleSpec.layers[0].paint[styleMapConfig.targetProperty] = [
        'interpolate',
        ['linear'],
        ['get', selectedValueColumn],
        ...colorStops.flat(),
      ];
    }

    return { styleSpec, colorMapping };
  }

  /**
   * 【機能概要】: テーブル参照の管理
   * 【実装方針】: SpreadsheetのaddTableReference機能を活用
   * 🟢 信頼性レベル: 参照カウント管理
   */
  async addTableReference(tableId: string): Promise<void> {
    await this.csvApiDriver.addTableReference(tableId, this.pluginId);
  }

  /**
   * 【機能概要】: テーブル参照の削除
   * 【実装方針】: SpreadsheetのremoveTableReference機能を活用
   * 🟢 信頼性レベル: 自動削除対応
   */
  async removeTableReference(tableId: string): Promise<void> {
    await this.csvApiDriver.removeTableReference(tableId, this.pluginId);
  }

  /**
   * 【機能概要】: テーブル一覧の取得
   * 【実装方針】: StyleMapプラグインが参照しているテーブルのみ取得
   * 🟢 信頼性レベル: フィルタ済みリスト
   */
  async listStyleMapTables(): Promise<CSVTableMetadata[]> {
    const allTables = await this.csvApiDriver.listTables();
    // StyleMapプラグインが参照しているテーブルのみフィルタ
    return allTables.tables.filter((table) => table.referencingPlugins?.includes(this.pluginId));
  }

  /**
   * 【機能概要】: 初期StyleMap設定の生成
   * 【実装方針】: テーブルメタデータから推奨設定を生成
   * 🟡 信頼性レベル: ヒューリスティック推定
   */
  private generateInitialStyleMapConfig(tableMetadata: CSVTableMetadata): Partial<StyleMapConfig> {
    // 数値列を検出
    const numericColumns = tableMetadata.columns.filter((col) => col.type === 'number');
    // 最初の数値列を値列として推奨
    const selectedValueColumn = numericColumns[0]?.name;
    if (selectedValueColumn === undefined) {
      throw new Error('No numeric columns found in the table');
    }

    return {
      algorithm: 'linear',
      colorSpace: 'hsv',
      targetProperty: 'fill-color', // デフォルト
      mapping: {
        min: 0,
        max: 100,
        hueStart: 0,
        hueEnd: 120,
        saturation: 0.8,
        brightness: 0.9,
      },
      enabled: true,
    };
  }
}
