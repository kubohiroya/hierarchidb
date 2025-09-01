/**
 * @file fileProcessingUtils.ts
 * @description File format processing utilities (Excel, ZIP, etc.)
 * Refactored from Styler plugin for Spreadsheet plugin use
 */

import type { CSVProcessingConfig } from '@hierarchidb/ui-csv-extract';

// SheetJS library for Excel file processing
// Note: In actual implementation, this would be imported from 'xlsx'
declare const XLSX: any;

// JSZip library for ZIP file processing
// Note: In actual implementation, this would be imported from 'jszip'
declare const JSZip: any;

interface ProcessedFile {
  content: string;
  detectedConfig: Partial<CSVProcessingConfig>;
}

/**
 * 【機能概要】: Excel ファイル(.xlsx, .xls)の処理
 * 【実装方針】: SheetJSライブラリによる変換、最初のシートをCSVに変換
 * 【テスト対応】: 各種Excelファイル形式での変換確認テスト
 * 🟡 信頼性レベル: 外部ライブラリ依存、SheetJS動作確認必要
 */
export async function processExcelFile(
  file: File,
  config: CSVProcessingConfig = {}
): Promise<ProcessedFile> {
  try {
    // 【ファイル読み込み】: ArrayBufferでの読み込み
    const arrayBuffer = await file.arrayBuffer();

    // 【Excel解析】: SheetJSによるワークブック読み込み
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellText: false,
      cellDates: true,
    });

    // 【シート選択】: 最初のシートを選択（将来的にはシート選択UI対応）
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('No sheets found in Excel file');
    }

    const worksheet = workbook.Sheets[sheetName];

    // 【CSV変換】: シートをCSV形式に変換
    const csvContent = XLSX.utils.sheet_to_csv(worksheet, {
      header: 1, // 配列形式で取得
      blankrows: !config.skipEmptyLines,
      strip: false, // 空白文字を保持
    });

    // 【設定検出】: Excel特有の設定
    const detectedConfig: Partial<CSVProcessingConfig> = {
      delimiter: ',', // CSV変換時は常にカンマ区切り
      hasHeader: true, // Excelは通常ヘッダーを持つ
      encoding: 'utf-8', // SheetJSはUTF-8で出力
    };

    return {
      content: csvContent,
      detectedConfig,
    };
  } catch (error) {
    throw new Error(
      `Excel file processing failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 【機能概要】: ZIPファイル内のCSV/TSVファイル処理
 * 【実装方針】: JSZipによる展開、最初の対応ファイルを処理
 * 【テスト対応】: ZIP内の各種ファイル形式での処理確認テスト
 * 🟡 信頼性レベル: 外部ライブラリ依存、JSZip動作確認必要
 */
export async function processZipFile(
  file: File,
  _config: CSVProcessingConfig = {}
): Promise<ProcessedFile> {
  try {
    // 【ZIP読み込み】: JSZipによるZIP解析
    const zip = new JSZip();
    const zipData = await zip.loadAsync(file);

    // 【対応ファイル検索】: CSV/TSV/TXTファイルを検索
    const supportedExtensions = ['.csv', '.tsv', '.txt'];
    let targetFile: any = null;
    let targetFileName = '';

    for (const fileName of Object.keys(zipData.files)) {
      const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase();

      if (supportedExtensions.includes(fileExtension)) {
        targetFile = zipData.files[fileName];
        targetFileName = fileName;
        break;
      }
    }

    if (!targetFile) {
      throw new Error(
        `No supported files found in ZIP. Supported formats: ${supportedExtensions.join(', ')}`
      );
    }

    // 【ファイル展開】: 対象ファイルをテキストとして展開
    const content = await targetFile.async('text');

    // 【設定検出】: ファイル名から区切り文字を推測
    const fileExtension = '.' + targetFileName.split('.').pop()?.toLowerCase();
    const detectedConfig: Partial<CSVProcessingConfig> = {
      delimiter: fileExtension === '.tsv' ? '\t' : ',',
      encoding: 'utf-8', // ZIP展開時はUTF-8として処理
    };

    return {
      content,
      detectedConfig,
    };
  } catch (error) {
    throw new Error(
      `ZIP file processing failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 【機能概要】: ファイル内容からの形式自動検出
 * 【実装方針】: バイナリヘッダーによるファイル形式判定
 * 【テスト対応】: 各種ファイル形式のヘッダー検出テスト
 * 🟢 信頼性レベル: 標準的なファイルヘッダー判定
 */
export async function detectFileTypeFromContent(file: File): Promise<string> {
  // 【ヘッダー読み込み】: 最初の数バイトを読み込み
  const headerSize = 8;
  const buffer = await file.slice(0, headerSize).arrayBuffer();
  const headerBytes = new Uint8Array(buffer);

  // 【Excel形式判定】: OLE/OOXML形式の判定
  if (headerBytes[0] === 0x50 && headerBytes[1] === 0x4b) {
    // ZIP形式（XLSX含む）
    if (headerBytes[2] === 0x03 && headerBytes[3] === 0x04) {
      return 'xlsx';
    }
  }

  if (headerBytes[0] === 0xd0 && headerBytes[1] === 0xcf) {
    // OLE形式（XLS）
    return 'xls';
  }

  // 【ZIP形式判定】
  if (
    headerBytes[0] === 0x50 &&
    headerBytes[1] === 0x4b &&
    headerBytes[2] === 0x03 &&
    headerBytes[3] === 0x04
  ) {
    return 'zip';
  }

  // 【テキスト形式判定】: バイナリでない場合はテキスト
  const isText = headerBytes.every(
    (byte) => byte < 128 && (byte >= 32 || [9, 10, 13].includes(byte))
  );

  if (isText) {
    return 'text';
  }

  // 【不明形式】: 判定できない場合
  return 'unknown';
}

/**
 * 【機能概要】: MIME タイプから拡張子の推測
 * 【実装方針】: 標準的なMIMEタイプマッピング
 * 🟢 信頼性レベル: 標準的なMIMEタイプ対応
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeMapping: Record<string, string> = {
    'text/csv': '.csv',
    'application/csv': '.csv',
    'text/tab-separated-values': '.tsv',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/zip': '.zip',
    'text/plain': '.txt',
  };

  return mimeMapping[mimeType] || '.txt';
}

/**
 * 【機能概要】: ファイルサイズの人間可読形式変換
 * 【実装方針】: バイト単位から KB/MB/GB への変換
 * 🟢 信頼性レベル: 単純な数値変換
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * 【機能概要】: CSV区切り文字の自動検出
 * 【実装方針】: 最初の数行のパターン解析
 * 【テスト対応】: 各種区切り文字での検出精度テスト
 * 🟡 信頼性レベル: ヒューリスティック判定、精度向上要検討
 */
export function detectCSVDelimiter(content: string): string {
  const lines = content.split('\n').slice(0, 5); // 最初の5行を解析
  const candidates = [',', ';', '\t', '|'];
  const scores: Record<string, number> = {};

  // 【候補区切り文字の評価】: 各行での一貫性を評価
  for (const delimiter of candidates) {
    let totalScore = 0;
    const fieldCounts: number[] = [];

    for (const line of lines) {
      if (line.trim() === '') continue;

      // 簡易的な分割（クォート考慮なし）
      const fields = line.split(delimiter);
      fieldCounts.push(fields.length);

      // 【スコア計算】: フィールド数の一貫性
      if (fields.length > 1) {
        totalScore += fields.length;
      }
    }

    // 【一貫性ボーナス】: フィールド数が一定の場合にボーナス
    const uniqueCounts = [...new Set(fieldCounts)];
    if (uniqueCounts.length === 1 && uniqueCounts[0] && uniqueCounts[0] > 1) {
      totalScore *= 2; // 一貫性ボーナス
    }

    scores[delimiter] = totalScore;
  }

  // 【最高スコアの区切り文字を選択】
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const bestDelimiter = sorted[0]?.[0];

  return bestDelimiter || ','; // デフォルトはカンマ
}
