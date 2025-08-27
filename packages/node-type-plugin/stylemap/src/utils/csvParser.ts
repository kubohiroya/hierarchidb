/**
 * @file csvParser.ts
 * @description CSVファイルのパースと型検出機能
 * 【機能概要】: CSV/TSVファイルの解析、列型の自動検出、フィルタリング機能
 * 【実装方針】: シンプルなCSVパーサーで基本機能を実装、RFC4180準拠は後回し
 * 【テスト対応】: StyleMapCSVApiDriver.test.ts の全パース関連テストケース対応
 * 🟡 信頼性レベル: 基本的なCSVパース機能、複雑なエスケープ処理は簡略化
 */

import type { CSVColumnInfo, CSVColumnType, CSVFilterRule, CSVProcessingConfig } from '../../../../ui/csv-extract/src/types/index';
import { validateCsvCellValue, sanitizeCsvCellValue } from './securityUtils';
import { detectColumnTypeOptimized } from './performanceUtils';

/**
 * 【型定義】: CSVパース結果の構造
 */
export interface ParsedCSV {
  columns: CSVColumnInfo[];
  rows: Array<Record<string, string | number | null>>;
  totalRows: number;
}

/**
 * 【機能概要】: CSV/TSVコンテンツのパース処理
 * 【実装方針】: デリミタ自動検出、ヘッダー処理、型変換を順次実行
 * 【テスト対応】: uploadCSVFile テストの基盤機能
 * 🟡 信頼性レベル: 基本的なCSV形式に対応、複雑なクォート処理は簡略化
 * @param content - CSVファイルのテキストコンテンツ
 * @param config - パース設定（デリミタ、ヘッダー有無）
 * @returns ParsedCSV - パース結果（列情報、行データ、行数）
 */
export function parseCSV(content: string, config: CSVProcessingConfig = {}): ParsedCSV {
  // 【入力値検証】: 空コンテンツのチェック 🟢
  if (!content || content.trim().length === 0) {
    throw new Error('No columns found');
  }

  // 【前処理】: 改行コードの統一 🟢
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedContent.split('\n').filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('No columns found');
  }

  // 【デリミタ検出】: 設定またはファイル内容からデリミタを決定 🟡
  const delimiter = config.delimiter || detectDelimiter(lines[0]);

  // 【ヘッダー処理】: ヘッダー行の存在確認と処理 🟢
  const hasHeader = config.hasHeader !== false; // デフォルトはtrue
  let columnNames: string[];
  let dataLines: string[];

  if (hasHeader && lines.length > 0) {
    // 【ヘッダー解析】: 1行目をヘッダーとして処理
    columnNames = parseLine(lines[0], delimiter);
    dataLines = lines.slice(1);
  } else {
    // 【自動ヘッダー生成】: ヘッダーなしの場合は自動生成
    const firstLineColumns = parseLine(lines[0], delimiter);
    columnNames = firstLineColumns.map((_, index) => `Column${index + 1}`);
    dataLines = lines;
  }

  if (columnNames.length === 0) {
    throw new Error('No columns found');
  }

  // 【データ行解析】: 各行をオブジェクト形式に変換 🟡
  const rows: Array<Record<string, string | number | null>> = [];
  
  for (const line of dataLines) {
    if (line.trim().length === 0) continue;
    
    const values = parseLine(line, delimiter);
    const row: Record<string, string | number | null> = {};
    
    // 【セル値処理】: 各セルの値を適切な型に変換とセキュリティ検証
    for (let i = 0; i < columnNames.length; i++) {
      const columnName = columnNames[i];
      const rawValue = values[i] || '';
      
      // 【空値処理】: 空文字やnullの統一処理
      if (rawValue === '' || rawValue === null || rawValue === undefined) {
        row[columnName] = '';
      } else {
        const trimmedValue = rawValue.trim();
        
        // 【セキュリティ検証】: CSVインジェクション攻撃を防止 🟢
        // 【改善内容】: 危険なセル値の検出とサニタイズ処理
        if (!validateCsvCellValue(trimmedValue)) {
          // 【安全化処理】: 危険な値を安全な形式に変換
          row[columnName] = sanitizeCsvCellValue(trimmedValue);
        } else {
          row[columnName] = trimmedValue;
        }
      }
    }
    
    rows.push(row);
  }

  // 【列型検出の最適化】: サンプリングベースによる効率的な型検出 🟢
  // 【改善内容】: 大容量データでのパフォーマンス向上
  // 【パフォーマンス対策】: 全行スキャンを避けて処理速度を大幅改善
  const columns: CSVColumnInfo[] = columnNames.map((name, index) => {
    const columnValues = rows.map(row => row[name]);
    const detectedType = detectColumnTypeOptimized(columnValues);
    
    return {
      name,
      type: detectedType,
      index,
      uniqueValues: 0, // 実装簡略化のため0を設定
      hasNullValues: columnValues.some(v => v === '' || v === null),
      sampleValues: columnValues.slice(0, 5), // 最初の5個をサンプルとして保存
    };
  });

  // 【型変換適用】: 検出された型に基づいてデータを変換
  for (const row of rows) {
    for (const column of columns) {
      const rawValue = row[column.name];
      if (rawValue !== '' && rawValue !== null) {
        row[column.name] = convertValue(rawValue as string, column.type);
      }
    }
  }

  // 【結果構築】: パース結果オブジェクトの構築
  return {
    columns,
    rows,
    totalRows: rows.length,
  };
}

/**
 * 【機能概要】: 行データの分割処理
 * 【実装方針】: 基本的なデリミタ分割、クォート処理は最小限
 * 【テスト対応】: CSV/TSV両方のフォーマット対応
 * 🟡 信頼性レベル: シンプルな分割処理、複雑なエスケープは対応していない
 * @param line - 分割対象の行
 * @param delimiter - 使用するデリミタ
 * @returns string[] - 分割された値の配列
 */
function parseLine(line: string, delimiter: string): string[] {
  // 【基本分割】: デリミタによる単純分割 🟡
  // Note: 将来的にはクォート内のデリミタ処理を追加予定
  const parts = line.split(delimiter);
  
  // 【クォート除去】: 前後のクォートを除去 🟡
  return parts.map(part => {
    let cleaned = part.trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1);
      // 【エスケープ処理】: ダブルクォートのエスケープ処理
      cleaned = cleaned.replace(/""/g, '"');
    }
    return cleaned;
  });
}

/**
 * 【機能概要】: デリミタの自動検出
 * 【実装方針】: カンマ、タブ、セミコロンの出現頻度で判定
 * 【テスト対応】: TSVファイルの自動検出テスト対応
 * 🟢 信頼性レベル: 一般的なデリミタ検出手法
 * @param firstLine - デリミタ検出用の最初の行
 * @returns string - 検出されたデリミタ
 */
function detectDelimiter(firstLine: string): string {
  // 【候補デリミタ】: 一般的なCSVデリミタの候補
  const delimiters = [',', '\t', ';'];
  
  // 【出現回数計算】: 各デリミタの出現回数をカウント
  let maxCount = 0;
  let bestDelimiter = ',';
  
  for (const delimiter of delimiters) {
    const count = (firstLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      bestDelimiter = delimiter;
    }
  }
  
  return bestDelimiter;
}

/**
 * 【機能概要】: 列の型検出処理
 * 【実装方針】: サンプル値の解析による型判定
 * 【テスト対応】: 型検出テストケース対応
 * 🟡 信頼性レベル: 基本的な型検出、複雑な日付形式は対応していない
 * @param values - 列の値の配列
 * @returns CSVColumnType - 検出された型
 */
export function detectColumnType(values: (string | number | null)[]): CSVColumnType {
  // 【有効値抽出】: null/空文字でない値のみを対象
  const nonEmptyValues = values.filter(v => v !== null && v !== '' && v !== undefined);
  
  if (nonEmptyValues.length === 0) {
    return 'string'; // 【デフォルト型】: データがない場合は文字列型
  }
  
  // 【数値型判定】: すべての値が数値として解析可能かチェック 🟢
  const allNumbers = nonEmptyValues.every(value => {
    if (typeof value === 'number') return true;
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return !isNaN(num) && isFinite(num);
    }
    return false;
  });
  
  if (allNumbers) {
    return 'number';
  }
  
  // 【ブール型判定】: boolean値の判定 🟡
  const allBooleans = nonEmptyValues.every(value => {
    if (typeof value === 'boolean') return true;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      return ['true', 'false', '1', '0', 'yes', 'no'].includes(lower);
    }
    return false;
  });
  
  if (allBooleans) {
    return 'boolean';
  }
  
  // 【日付型判定】: 簡単な日付パターンの検出 🟡
  // Note: 詳細な日付判定は将来的に改善予定
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,        // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/,      // MM/DD/YYYY
    /^\d{4}\/\d{2}\/\d{2}$/,      // YYYY/MM/DD
  ];
  
  const allDates = nonEmptyValues.every(value => {
    if (typeof value === 'string') {
      return datePatterns.some(pattern => pattern.test(value));
    }
    return false;
  });
  
  if (allDates) {
    return 'date';
  }
  
  // 【デフォルト】: 上記以外はすべて文字列型
  return 'string';
}

/**
 * 【機能概要】: 値の型変換処理
 * 【実装方針】: 検出された型に基づいた値の変換
 * 【テスト対応】: データ型変換テスト対応
 * 🟢 信頼性レベル: 標準的な型変換処理
 * @param value - 変換対象の文字列値
 * @param type - 変換先の型
 * @returns string | number | boolean | null - 変換後の値
 */
function convertValue(value: string, type: CSVColumnType): string | number | boolean | null {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  
  switch (type) {
    case 'number':
      // 【数値変換】: 文字列を数値に変換
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
      
    case 'boolean':
      // 【ブール値変換】: 文字列をブール値に変換
      const lower = value.toLowerCase();
      if (['true', '1', 'yes'].includes(lower)) return true;
      if (['false', '0', 'no'].includes(lower)) return false;
      return null;
      
    case 'date':
      // 【日付変換】: 現在は文字列のまま返却（将来的にDate型に変換予定）
      return value;
      
    default:
      // 【文字列型】: そのまま返却
      return value;
  }
}

/**
 * 【機能概要】: CSVデータのフィルタリング処理
 * 【実装方針】: フィルタールールに基づく行データの絞り込み
 * 【テスト対応】: getFilteredPreview テストケース対応
 * 🟡 信頼性レベル: 基本的なフィルタ演算子に対応、複雑な条件は簡略化
 * @param rows - フィルタ対象の行データ
 * @param filters - 適用するフィルタールール
 * @returns Array<Record<string, any>> - フィルタリング後の行データ
 */
export function applyCsvFilters(
  rows: Array<Record<string, string | number | null>>, 
  filters: CSVFilterRule[]
): Array<Record<string, string | number | null>> {
  
  // 【有効フィルタ抽出】: enabled=trueのフィルタのみを対象 🟢
  const activeFilters = filters.filter(filter => filter.enabled);
  
  if (activeFilters.length === 0) {
    return rows; // 【フィルタなし】: すべての行を返却
  }
  
  // 【行フィルタリング】: 各行に対してすべてのフィルタを適用（AND条件）
  return rows.filter(row => {
    return activeFilters.every(filter => {
      return applyFilterRule(row, filter);
    });
  });
}

/**
 * 【機能概要】: 単一フィルタールールの適用
 * 【実装方針】: 演算子に基づく値の比較処理
 * 【テスト対応】: 各種フィルタ演算子のテスト対応
 * 🟡 信頼性レベル: 基本的な演算子のみ実装、複雑な演算子は今後追加
 * @param row - 対象の行データ
 * @param filter - 適用するフィルタールール
 * @returns boolean - フィルタ条件を満たすかどうか
 */
function applyFilterRule(
  row: Record<string, string | number | null>, 
  filter: CSVFilterRule
): boolean {
  // 【列存在チェック】: 指定された列が存在するかチェック 🟢
  const cellValue = row[filter.column];
  
  // 【非存在列の処理】: 列が存在しない場合は無視（trueを返す）
  if (!(filter.column in row)) {
    console.warn(`Filter column "${filter.column}" does not exist, filter ignored`);
    return true;
  }
  
  const filterValue = filter.value;
  
  // 【演算子別処理】: フィルタ演算子に応じた比較処理
  switch (filter.operator) {
    case 'equals':
      // 【等価比較】: 完全一致の判定
      return String(cellValue) === String(filterValue);
      
    case 'contains':
      // 【部分一致比較】: 文字列の包含判定
      return String(cellValue).toLowerCase().includes(String(filterValue).toLowerCase());
      
    case 'greater_than':
      // 【大小比較】: 数値としての大小比較
      const numCell = Number(cellValue);
      const numFilter = Number(filterValue);
      if (isNaN(numCell) || isNaN(numFilter)) return false;
      return numCell > numFilter;
      
    case 'less_than':
      // 【小比較】: 数値としての小比較
      const numCellLess = Number(cellValue);
      const numFilterLess = Number(filterValue);
      if (isNaN(numCellLess) || isNaN(numFilterLess)) return false;
      return numCellLess < numFilterLess;
      
    case 'not_equals':
      // 【不等価比較】: 不一致の判定
      return String(cellValue) !== String(filterValue);
      
    default:
      // 【未対応演算子】: 不明な演算子は常にtrueを返す（安全側の処理）
      console.warn(`Unsupported filter operator: ${filter.operator}`);
      return true;
  }
}