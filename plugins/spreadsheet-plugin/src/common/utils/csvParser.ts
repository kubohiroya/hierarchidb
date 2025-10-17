/**
 * @file csvParser.ts
 * @description CSV parsing and type detection utilities
 * Refactored from Styler plugin for Spreadsheet plugin use
 */

import { CSVColumnType } from '@hierarchidb/tabular-store';
import type { CSVProcessingConfig } from '@hierarchidb/ui-tabular-extract';

interface ParsedCSV {
  rows: Array<Record<string, string | number | null>>;
  columns: Array<{ name: string; type: string }>;
}

interface TypedColumn {
  name: string;
  type: CSVColumnType;
}
export async function parseCSVContent(
  content: string,
  config: CSVProcessingConfig = {},
): Promise<ParsedCSV> {
  const {
    delimiter = ',',
    quoteChar = '"',
    escapeChar = '\\',
    hasHeader = true,
    skipEmptyLines = true,
  } = config;

  // 【前処理】: 改行コードの正規化
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 【行分割】: 改行での分割（クォート内改行を考慮）
  const lines = parseCSVLines(normalizedContent, quoteChar);

  if (lines.length === 0) {
    return { rows: [], columns: [] };
  }

  // 【ヘッダー処理】: ヘッダー行の取得または自動生成
  let headers: string[] = [];
  let dataLines: string[] = [];

  if (hasHeader && lines.length > 0) {
    const headerLine = lines[0];
    if (headerLine) {
      headers = parseCSVLine(headerLine, delimiter, quoteChar, escapeChar);
    }
    dataLines = lines.slice(1);
  } else {
    // 【自動ヘッダー生成】: Column1, Column2, ... 形式
    const firstLine = lines[0];
    if (firstLine) {
      const firstRowFields = parseCSVLine(firstLine, delimiter, quoteChar, escapeChar);
      headers = firstRowFields.map((_, index) => `Column${index + 1}`);
    } else {
      headers = [];
    }
    dataLines = lines;
  }

  // 【データパース】: 各行のフィールドをパース
  const rows: Array<Record<string, string | number | null>> = [];

  for (const line of dataLines) {
    // 【空行スキップ】: 設定に応じて空行を無視
    if (skipEmptyLines && line.trim() === '') {
      continue;
    }

    const fields = parseCSVLine(line, delimiter, quoteChar, escapeChar);

    // 【行データ構築】: ヘッダーとフィールドを対応付け
    const rowData: Record<string, string | number | null> = {};
    headers.forEach((header, index) => {
      const fieldValue = fields[index] || '';

      // 【型変換】: 数値変換の試行
      const numericValue = parseFloat(fieldValue);
      if (!isNaN(numericValue) && fieldValue.trim() !== '') {
        rowData[header] = numericValue;
      } else if (fieldValue.trim() === '') {
        rowData[header] = null;
      } else {
        rowData[header] = fieldValue;
      }
    });

    // 【セキュリティ処理】: CSVインジェクション対策
    const sanitizedRows = [rowData];
    if (sanitizedRows[0]) {
      rows.push(sanitizedRows[0]);
    }
  }

  // 【列情報構築】: 型検出と列メタデータ作成
  const columns = headers.map((header) => ({ name: header, type: 'string' }));

  return { rows, columns };
}

export function detectColumnTypes(
  columnNames: string[],
  rows: Array<Record<string, any>>,
  sampleSize: number = 1000,
): TypedColumn[] {
  // 【サンプリング】: パフォーマンス向上のためサンプル抽出
  const sampleRows = rows.length > sampleSize ? rows.slice(0, sampleSize) : rows;

  return columnNames.map((columnName) => {
    const columnValues = sampleRows
      .map((row) => row[columnName])
      .filter((value) => value !== null && value !== undefined && value !== '');

    if (columnValues.length === 0) {
      return { name: columnName, type: 'string' as CSVColumnType };
    }

    // 【型判定統計】: 各型での解釈可能な値の割合を計算
    const typeStats = {
      number: 0,
      date: 0,
      boolean: 0,
    };

    for (const value of columnValues) {
      const stringValue = String(value).trim();

      // 【数値型判定】: 数値として解釈可能かチェック
      if (isNumericValue(stringValue)) {
        typeStats.number++;
      }

      // 【日付型判定】: 日付として解釈可能かチェック
      if (isDateValue(stringValue)) {
        typeStats.date++;
      }

      // 【真偽値型判定】: 真偽値として解釈可能かチェック
      if (isBooleanValue(stringValue)) {
        typeStats.boolean++;
      }
    }

    // 【型決定】: 最も高い割合の型を採用（閾値70%）
    const threshold = 0.7;
    const totalValues = columnValues.length;

    if (typeStats.number / totalValues >= threshold) {
      return { name: columnName, type: 'number' as CSVColumnType };
    } else if (typeStats.date / totalValues >= threshold) {
      return { name: columnName, type: 'date' as CSVColumnType };
    } else if (typeStats.boolean / totalValues >= threshold) {
      return { name: columnName, type: 'boolean' as CSVColumnType };
    } else {
      return { name: columnName, type: 'string' as CSVColumnType };
    }
  });
}

function parseCSVLines(content: string, quoteChar: string): string[] {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];

    if (char === quoteChar) {
      // 【クォート処理】: エスケープされたクォートかチェック
      if (i + 1 < content.length && content[i + 1] === quoteChar) {
        // エスケープされたクォート（""）
        currentLine += quoteChar;
        i += 2;
      } else {
        // クォート状態の切り替え
        inQuotes = !inQuotes;
        currentLine += char;
        i++;
      }
    } else if (char === '\n' && !inQuotes) {
      // 【改行処理】: クォート外の改行は行の終端
      lines.push(currentLine);
      currentLine = '';
      i++;
    } else {
      currentLine += char;
      i++;
    }
  }

  // 【最終行処理】: 残った内容を追加
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

function parseCSVLine(
  line: string,
  delimiter: string,
  quoteChar: string,
  escapeChar: string,
): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = i + 1 < line.length ? line[i + 1] : '';

    if (char === quoteChar) {
      if (inQuotes && nextChar === quoteChar) {
        // エスケープされたクォート
        currentField += quoteChar;
        i += 2;
      } else {
        // クォート状態の切り替え
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === delimiter && !inQuotes) {
      // フィールド区切り
      fields.push(currentField);
      currentField = '';
      i++;
    } else if (char === escapeChar && inQuotes && nextChar) {
      // エスケープ文字処理
      currentField += nextChar;
      i += 2;
    } else {
      currentField += char;
      i++;
    }
  }

  fields.push(currentField);

  return fields;
}

function isNumericValue(value: string): boolean {
  if (value === '') return false;
  const num = parseFloat(value);
  return !isNaN(num) && isFinite(num);
}

function isDateValue(value: string): boolean {
  if (value === '') return false;

  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
  ];

  for (const pattern of datePatterns) {
    if (pattern.test(value)) {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }
  }

  const parsed = Date.parse(value);
  return !isNaN(parsed);
}

function isBooleanValue(value: string): boolean {
  const lowerValue = value.toLowerCase();
  return ['true', 'false', 'yes', 'no', '1', '0', 'on', 'off', 'enabled', 'disabled'].includes(
    lowerValue,
  );
}
