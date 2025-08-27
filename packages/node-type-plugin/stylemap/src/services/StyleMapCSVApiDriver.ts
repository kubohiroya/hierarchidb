/**
 * @file StyleMapCSVApiDriver.ts  
 * @description StyleMap専用CSVデータAPI実装
 * 【機能概要】: ICSVDataApiインターフェースの完全実装、CSV処理の統合的な管理
 * 【実装方針】: 段階的な機能実装、テストを通すための最小限実装から開始
 * 【テスト対応】: StyleMapCSVApiDriver.test.ts の全テストケース対応
 * 🟢 信頼性レベル: 確立されたパターンとライブラリを組み合わせた実装
 */

import type { 
  ICSVDataApi, 
  CSVTableMetadata, 
  CSVProcessingConfig, 
  CSVDataResult, 
  CSVSelectionConfig, 
  CSVFilterRule, 
  CSVTableListResult,
  PaginationOptions 
} from '../../../../ui/csv-extract/src/types/index';

import { SimpleTableMetadataManager } from './SimpleTableMetadataManager';
import { hashUtils } from '../utils/hashUtils';
import { parseCSV, applyCsvFilters } from '../utils/csvParser';
import { validateDownloadUrl, validateCsvCellValue } from '../utils/securityUtils';
import { 
  detectFileType, 
  parseExcelFile, 
  extractCSVFilesFromZip, 
  convertWorksheetToCSV,
  type SupportedFileType,
  type ExcelWorksheetInfo,
  type ZipFileInfo
} from '../utils/fileProcessingUtils';

/**
 * 【機能概要】: StyleMap専用のCSVデータ処理API
 * 【実装方針】: ICSVDataApiの完全実装、依存性注入による柔軟な設計
 * 【テスト対応】: 全テストケースを順次通すための段階的実装
 * 🟢 信頼性レベル: インターフェース契約に基づく確実な実装
 */
export class StyleMapCSVApiDriver implements ICSVDataApi {
  private tableManager: SimpleTableMetadataManager;

  /**
   * 【コンストラクタ】: 依存関係の注入とインスタンス初期化
   * 【実装方針】: テスタビリティを考慮した依存性注入パターン
   * 【テスト対応】: beforeEach でのインスタンス作成に対応
   * 🟢 信頼性レベル: 標準的なDIパターン
   * @param tableManager - テーブルメタデータ管理インスタンス
   */
  constructor(tableManager: SimpleTableMetadataManager) {
    this.tableManager = tableManager;
  }

  /**
   * 【機能概要】: 多形式ファイルのアップロードと処理（CSV/Excel/ZIP対応）
   * 【実装方針】: ファイル形式判定→適切なパーサー選択→統一されたCSV処理
   * 【対応形式】: CSV、TSV、Excel(.xlsx/.xls)、ZIP圧縮ファイル
   * 【テスト対応】: uploadCSVFile の全テストケース対応
   * 🟢 信頼性レベル: 多形式対応の確立されたパターン
   * @param file - アップロード対象のファイル
   * @param config - パース設定（オプション）
   * @returns Promise<CSVTableMetadata> - 生成されたテーブルメタデータ
   */
  async uploadCSVFile(file: File, config: CSVProcessingConfig = {}): Promise<CSVTableMetadata> {
    // 【ファイル形式判定】: 拡張子ベースでの形式識別
    const fileType = detectFileType(file);
    
    // 【サポート外ファイル】: 対応していない形式のエラー
    if (fileType === 'unsupported') {
      throw new Error('Unsupported file format. Supported formats: CSV, TSV, Excel (.xlsx/.xls), ZIP');
    }

    // 【ファイルサイズ検証】: 形式別サイズ制限
    const maxSizeMap = {
      csv: 10 * 1024 * 1024,   // CSV: 10MB
      tsv: 10 * 1024 * 1024,   // TSV: 10MB
      excel: 50 * 1024 * 1024, // Excel: 50MB
      zip: 100 * 1024 * 1024   // ZIP: 100MB
    };
    
    const maxSize = maxSizeMap[fileType];
    if (file.size > maxSize) {
      throw new Error(`File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit for ${fileType.toUpperCase()} files`);
    }

    try {
      // 【多形式処理】: ファイル形式に応じた処理の分岐
      let csvContent: string;
      let processingInfo: string = fileType.toUpperCase();

      switch (fileType) {
        case 'csv':
        case 'tsv': {
          // 【標準CSV/TSV処理】: 従来の処理方式
          csvContent = await this.readFileAsText(file);
          
          // 【バイナリコンテンツ検証】
          if (this.containsBinaryData(csvContent)) {
            throw new Error('Invalid CSV format');
          }
          break;
        }

        case 'excel': {
          // 【Excel処理】: xlsx ライブラリによる Excel ファイル処理
          processingInfo += ' (Excel file processed)';
          const worksheets = await parseExcelFile(file);
          
          // 【ワークシート選択】: 最初のワークシートを使用（将来的にUI選択対応予定）
          if (worksheets.length === 0) {
            throw new Error('No valid worksheets found in Excel file');
          }
          
          const selectedWorksheet = worksheets[0];
          csvContent = convertWorksheetToCSV(selectedWorksheet.data);
          processingInfo += ` - Worksheet: "${selectedWorksheet.name}"`;
          break;
        }

        case 'zip': {
          // 【ZIP処理】: jszip ライブラリによる ZIP ファイル処理
          processingInfo += ' (ZIP file processed)';
          const csvFiles = await extractCSVFilesFromZip(file);
          
          // 【CSVファイル選択】: 最初のCSVファイルを使用（将来的にUI選択対応予定）
          if (csvFiles.length === 0) {
            throw new Error('No CSV/TSV files found in ZIP archive');
          }
          
          const selectedFile = csvFiles[0];
          csvContent = selectedFile.content;
          processingInfo += ` - File: "${selectedFile.filename}"`;
          break;
        }

        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
      
      // 【コンテンツ検証】: 抽出されたCSVコンテンツの検証
      if (!csvContent || csvContent.trim().length === 0) {
        throw new Error('No columns found'); // 【修正】: テスト要件に合わせたエラーメッセージ
      }

      // 【コンテンツハッシュ生成】: 重複検出用のハッシュ生成
      const contentHash = await hashUtils.generateHash(csvContent);

      // 【重複チェック】: 既存のファイルと同じコンテンツかチェック
      const existingMetadata = await this.tableManager.findByContentHash(contentHash);
      if (existingMetadata) {
        // 【重複ファイル処理】: 既存のメタデータを返却（deduplication）
        return existingMetadata;
      }

      // 【CSV解析】: 統一されたCSVパース処理
      const parsedData = parseCSV(csvContent, config);

      // 【データ検証】: パース結果の妥当性チェック
      if (parsedData.totalRows === 0) {
        throw new Error('No data rows found');
      }
      
      if (parsedData.columns.length === 0) {
        throw new Error('No columns found');
      }

      // 【メタデータ生成】: CSVTableMetadataオブジェクトの構築
      const metadata: CSVTableMetadata = {
        id: crypto.randomUUID(),
        filename: file.name, // 【修正】: テスト要件に合わせてファイル名のみを使用
        contentHash,
        fileSizeBytes: file.size,
        totalRows: parsedData.totalRows,
        columns: parsedData.columns,
        createdAt: Date.now(),
        referenceCount: 0,
        referencingPlugins: [],
      };

      // 【メタデータ保存】: データベースへの永続化
      await this.tableManager.store(metadata);

      // 【実データ保存】: パースした行データの保存
      this.storeParsedData(metadata.id, parsedData.rows);

      return metadata;

    } catch (error) {
      // 【エラーハンドリング】: 各種エラーケースの適切な処理
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`ファイル処理中にエラーが発生しました: ${String(error)}`);
    }
  }

  /**
   * 【機能概要】: URLからのCSVダウンロードと処理
   * 【実装方針】: fetch API→ファイル変換→uploadCSVFile の再利用
   * 【テスト対応】: downloadCSVFromUrl テストケース対応
   * 🟡 信頼性レベル: ネットワーク処理、基本的なエラーハンドリング
   * @param url - ダウンロード対象のCSV URL
   * @param config - パース設定（オプション）
   * @returns Promise<CSVTableMetadata> - 生成されたテーブルメタデータ
   */
  async downloadCSVFromUrl(url: string, config: CSVProcessingConfig = {}): Promise<CSVTableMetadata> {
    try {
      // 【URL検証強化】: セキュリティを考慮した厳密なURL検証 🟢
      // 【改善内容】: プライベートネットワークアクセス防止とプロトコル制限
      // 【セキュリティ対策】: SSRF攻撃やローカルファイルアクセスを防止
      validateDownloadUrl(url);

      // 【HTTP リクエスト】: fetch APIによるダウンロード 🟢
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }

      // 【コンテンツ取得】: レスポンスボディの取得
      const content = await response.text();

      // 【ファイル名抽出】: URLからファイル名を抽出 🟡
      const urlPath = new URL(url).pathname;
      const filename = urlPath.split('/').pop() || 'downloaded.csv';

      // 【Fileオブジェクト生成】: Blob→File変換でuploadCSVFileを再利用
      const blob = new Blob([content], { type: 'text/csv' });
      const file = new File([blob], filename, { type: 'text/csv' });

      // 【既存処理再利用】: uploadCSVFileの処理を活用
      const metadata = await this.uploadCSVFile(file, config);

      // 【URL情報追加】: ダウンロード元URLの記録
      metadata.fileUrl = url;
      await this.tableManager.store(metadata);

      return metadata;

    } catch (error) {
      // 【エラーハンドリング】: ネットワーク関連エラーの処理
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`URLからのダウンロードに失敗しました: ${String(error)}`);
    }
  }

  /**
   * 【機能概要】: テーブルメタデータの取得
   * 【実装方針】: TableManagerの機能をそのまま活用
   * 【テスト対応】: getTableMetadata テストケース対応
   * 🟢 信頼性レベル: 単純な委譲処理
   * @param id - 取得対象のテーブルID
   * @returns Promise<CSVTableMetadata | null> - メタデータまたはnull
   */
  async getTableMetadata(id: string): Promise<CSVTableMetadata | null> {
    return await this.tableManager.get(id);
  }

  /**
   * 【機能概要】: テーブル一覧の取得とフィルタリング
   * 【実装方針】: 全データ取得→プラグインフィルタ→ページング
   * 【テスト対応】: listTables の全テストケース対応
   * 🟢 信頼性レベル: 標準的なデータフィルタリングとページング
   * @param pluginId - フィルタ対象のプラグインID（オプション）
   * @param pagination - ページング設定（オプション）
   * @returns Promise<CSVTableListResult> - フィルタされたテーブル一覧
   */
  async listTables(
    pluginId?: string, 
    pagination?: PaginationOptions
  ): Promise<CSVTableListResult> {
    // 【全データ取得】: すべてのテーブルメタデータを取得
    let allTables = await this.tableManager.getAll();

    // 【プラグインフィルタ】: 指定されたプラグインによる絞り込み 🟢
    if (pluginId) {
      allTables = allTables.filter(table => 
        table.referencingPlugins.includes(pluginId)
      );
    }

    // 【ソート】: 作成日時の降順でソート（新しいものが先頭）
    allTables.sort((a, b) => b.createdAt - a.createdAt);

    // 【ページング処理】: offset/limit による結果の絞り込み 🟢
    let paginatedTables = allTables;
    if (pagination) {
      const { offset = 0, limit } = pagination;
      const startIndex = offset;
      const endIndex = limit ? startIndex + limit : undefined;
      paginatedTables = allTables.slice(startIndex, endIndex);
    }

    // 【結果構築】: CSVTableListResult形式での返却
    return {
      tables: paginatedTables,
      total: paginatedTables.length,
      offset: pagination?.offset || 0,
      limit: pagination?.limit || paginatedTables.length,
    };
  }

  /**
   * 【機能概要】: テーブルの削除
   * 【実装方針】: TableManagerの削除機能を活用
   * 【テスト対応】: deleteTable テストケース対応
   * 🟢 信頼性レベル: 単純な委譲処理
   * @param tableMetadataId - 削除対象のテーブルID
   * @returns Promise<void>
   */
  async deleteTable(tableMetadataId: string): Promise<void> {
    await this.tableManager.delete(tableMetadataId);
  }

  /**
   * 【機能概要】: フィルタを適用したデータプレビューの取得
   * 【実装方針】: 元データ復元→フィルタ適用→行数制限
   * 【テスト対応】: getFilteredPreview の全テストケース対応
   * 🟡 信頼性レベル: データ復元は簡略化、CSVの再パースで実現
   * @param tableId - 対象テーブルのID
   * @param filters - 適用するフィルタルール
   * @param rowCount - 取得する最大行数
   * @returns Promise<CSVDataResult> - フィルタリング済みのデータ
   */
  async getFilteredPreview(
    tableId: string, 
    filters: CSVFilterRule[], 
    rowCount: number
  ): Promise<CSVDataResult> {
    
    // 【メタデータ取得】: テーブル存在確認
    const metadata = await this.tableManager.get(tableId);
    if (!metadata) {
      throw new Error('Table not found');
    }

    // 【実データ取得】: 保存された実際のCSVデータを取得 🟡
    const storedRows = this.getStoredData(tableId);
    if (!storedRows) {
      throw new Error('CSV data not found for table');
    }

    // 【フィルタ適用】: 指定されたフィルタルールを適用
    const filteredRows = applyCsvFilters(storedRows, filters);

    // 【行数制限】: 指定された行数で結果を制限
    const limitedRows = filteredRows.slice(0, rowCount);

    // 【結果構築】: CSVDataResult形式での返却
    return {
      columns: metadata.columns,
      rows: limitedRows,
      totalRows: filteredRows.length, // 【重要】: フィルタ後の総行数
    };
  }

  /**
   * 【機能概要】: フィルタとセレクションを適用したデータの取得
   * 【実装方針】: getFilteredPreview の拡張版として実装
   * 【テスト対応】: 現在のテストケースでは未使用だが将来拡張用
   * 🔴 信頼性レベル: 将来実装予定、現在は基本機能のみ
   * @param tableId - 対象テーブルのID
   * @param selection - データ選択・フィルタ設定
   * @returns Promise<CSVDataResult> - 選択されたデータ
   */
  async getFilteredData(
    tableId: string, 
    selection: CSVSelectionConfig
  ): Promise<CSVDataResult> {
    
    // 【フィルタリング実行】: 指定されたフィルタを適用してデータを取得
    const filters = selection.filterRules;
    const rowLimit = 1000; // Default row limit
    
    const fullData = await this.getFilteredPreview(tableId, filters, rowLimit);
    
    // 【列選択実装】: valueColumnsで指定された列のみを返す
    const selectedColumns = [selection.keyColumn, ...selection.valueColumns].filter(Boolean);
    
    // 【列フィルタリング】: 指定された列のみを含むように結果を絞り込み
    const filteredColumns = fullData.columns.filter(col => 
      selectedColumns.includes(col.name)
    );
    
    const filteredRows = fullData.rows.map(row => {
      const filteredRow: Record<string, string | number | null> = {};
      for (const columnName of selectedColumns) {
        if (columnName && columnName in row) {
          filteredRow[columnName] = row[columnName];
        }
      }
      return filteredRow;
    });
    
    return {
      columns: filteredColumns,
      rows: filteredRows,
      totalRows: filteredRows.length,
    };
  }

  /**
   * 【機能概要】: テーブル参照の追加
   * 【実装方針】: TableManagerの参照管理機能を活用
   * 【テスト対応】: addTableReference テストケース対応
   * 🟢 信頼性レベル: 単純な委譲処理
   * @param tableId - 参照を追加するテーブルID
   * @param pluginId - 参照するプラグインID
   * @returns Promise<void>
   */
  async addTableReference(tableId: string, pluginId: string): Promise<void> {
    await this.tableManager.addReference(tableId, pluginId);
  }

  /**
   * 【機能概要】: テーブル参照の削除
   * 【実装方針】: TableManagerの参照管理機能を活用
   * 【テスト対応】: removeTableReference、自動削除テストケース対応
   * 🟢 信頼性レベル: 単純な委譲処理
   * @param tableId - 参照を削除するテーブルID
   * @param pluginId - 参照を削除するプラグインID
   * @returns Promise<void>
   */
  async removeTableReference(tableId: string, pluginId: string): Promise<void> {
    await this.tableManager.removeReference(tableId, pluginId);
  }

  // 【プライベートメソッド群】: 内部実装用のヘルパーメソッド

  /**
   * 【機能概要】: Fileオブジェクトをテキストとして読み込み
   * 【実装方針】: FileReader API のPromise ラッパー
   * 【テスト対応】: ファイル読み込み処理の基盤機能
   * 🟢 信頼性レベル: 標準的なFileReader使用パターン
   * @param file - 読み込み対象のファイル
   * @returns Promise<string> - ファイルのテキストコンテンツ
   */
  private async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      // 【読み込み完了】: ファイル内容の取得
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('ファイルをテキストとして読み込めませんでした'));
        }
      };

      // 【エラーハンドリング】: 読み込み失敗時の処理
      reader.onerror = () => {
        reject(new Error('ファイルの読み込み中にエラーが発生しました'));
      };

      // 【読み込み開始】: テキストモードでファイル読み込み開始
      reader.readAsText(file);
    });
  }

  /**
   * 【機能概要】: テスト用のサンプルデータ生成
   * 【実装方針】: メタデータに基づいたダミーデータの生成
   * 【テスト対応】: getFilteredPreview テストを通すためのテスト専用機能
   * 🔴 信頼性レベル: テスト専用の実装、実運用では実データを使用予定
   * @param metadata - テーブルメタデータ
   * @returns Array<Record<string, any>> - 生成されたサンプル行データ
   */
  /**
   * 【機能概要】: 実際のCSVデータの保存とアクセス
   * 【実装方針】: CSVパース時に実際のデータを保存し、フィルタリング時に利用
   * 【テスト対応】: getFilteredPreview の実データ取得機能
   * 🟡 信頼性レベル: インメモリストレージによる実装、実運用ではIndexedDBを使用予定
   */
  private csvDataStorage = new Map<string, Array<Record<string, string | number | null>>>();

  /**
   * 【機能概要】: CSVパース時の実際のデータ保存
   * 【実装方針】: uploadCSVFile で呼び出してデータを永続化
   * 【テスト対応】: テスト実行時の実データ保存
   * 🟡 信頼性レベル: Map による一時的な実装
   * @param tableId - テーブルID
   * @param rows - 保存する行データ
   */
  private storeParsedData(tableId: string, rows: Array<Record<string, string | number | null>>): void {
    this.csvDataStorage.set(tableId, rows);
  }

  /**
   * 【機能概要】: 保存された実際のCSVデータの取得
   * 【実装方針】: tableIdをキーとした実データの取得
   * 【テスト対応】: getFilteredPreview での実データ利用
   * 🟡 信頼性レベル: Map からの取得処理
   * @param tableId - テーブルID
   * @returns Array<Record<string, any>> - 保存された実際の行データ
   */
  private getStoredData(tableId: string): Array<Record<string, string | number | null>> | undefined {
    return this.csvDataStorage.get(tableId);
  }

  /**
   * 【機能概要】: コンテンツにバイナリデータが含まれているかチェック
   * 【実装方針】: null文字や制御文字の検出によるバイナリ判定
   * 【テスト対応】: バイナリファイルのアップロード拒否テスト対応
   * 🟡 信頼性レベル: 基本的なバイナリ検出、完全ではないが一般的なケースをカバー
   * @param content - 検証対象のテキストコンテンツ
   * @returns boolean - バイナリデータが含まれている場合true
   */
  private containsBinaryData(content: string): boolean {
    // 【null文字チェック】: バイナリファイルの典型的な特徴
    if (content.includes('\0')) {
      return true;
    }
    
    // 【制御文字チェック】: 印刷不可能な制御文字の検出
    const controlChars = /[\x00-\x08\x0E-\x1F\x7F]/;
    if (controlChars.test(content)) {
      return true;
    }
    
    // 【バイナリパターンチェック】: Base64や16進数のような非テキストパターンを検出
    const binaryPatterns = /^[A-Fa-f0-9]{100,}$|^[A-Za-z0-9+/]{100,}={0,2}$/;
    if (binaryPatterns.test(content.replace(/\s/g, ''))) {
      return true;
    }
    
    return false;
  }
}