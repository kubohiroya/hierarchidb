/**
 * @file fileProcessingUtils.ts
 * @description ファイル形式判定・Excel・ZIP処理のユーティリティ関数
 * 【機能概要】: 拡張子による形式判定とExcel/ZIP形式のCSVデータ抽出
 * 【実装方針】: xlsx/jszip ライブラリを使用した多形式ファイル対応
 * 【セキュリティ対策】: ファイルサイズ制限、悪意あるファイル検証
 * 🟢 信頼性レベル: 業界標準ライブラリによる確実なファイル処理
 */

import * as XLSX from 'xlsx';
import JSZip from 'jszip';

/**
 * 【機能概要】: サポートされているファイル形式の定義
 * 【設計方針】: 拡張子ベースでの形式判定用列挙型
 * 🟢 信頼性レベル: 標準的なファイル形式定義
 */
export type SupportedFileType = 'csv' | 'tsv' | 'excel' | 'zip' | 'unsupported';

/**
 * 【機能概要】: Excelファイルから抽出されたワークシート情報
 * 【設計方針】: ワークシート選択機能のためのメタデータ定義
 * 🟢 信頼性レベル: Excel処理に必要な標準的なデータ構造
 */
export interface ExcelWorksheetInfo {
  name: string;
  data: any[][];
  rowCount: number;
  columnCount: number;
}

/**
 * 【機能概要】: ZIPファイル内のCSVファイル情報
 * 【設計方針】: ZIP内複数ファイル対応のためのメタデータ定義
 * 🟢 信頼性レベル: ZIP処理に必要な標準的なデータ構造
 */
export interface ZipFileInfo {
  filename: string;
  content: string;
  size: number;
}

/**
 * 【機能概要】: ファイル拡張子からファイル形式を判定
 * 【実装方針】: 拡張子の大文字小文字を無視した厳密な形式判定
 * 【セキュリティ対策】: サポート外形式の明確な識別
 * 🟢 信頼性レベル: 確実なファイル形式識別
 * @param file - 判定対象のFileオブジェクト
 * @returns SupportedFileType - 判定されたファイル形式
 */
export function detectFileType(file: File): SupportedFileType {
  const filename = file.name.toLowerCase();
  
  // 【CSV形式判定】: 標準的なCSVファイル
  if (filename.endsWith('.csv')) {
    return 'csv';
  }
  
  // 【TSV形式判定】: タブ区切りファイル
  if (filename.endsWith('.tsv') || filename.endsWith('.tab')) {
    return 'tsv';
  }
  
  // 【Excel形式判定】: Excel 2007以降およびレガシー形式
  if (filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.xlsm')) {
    return 'excel';
  }
  
  // 【ZIP形式判定】: 圧縮ファイル
  if (filename.endsWith('.zip')) {
    return 'zip';
  }
  
  // 【サポート外】: 上記以外のファイル
  return 'unsupported';
}

/**
 * 【機能概要】: Excelファイルからワークシートデータを抽出
 * 【実装方針】: xlsx ライブラリを使用した全ワークシートの解析
 * 【セキュリティ対策】: ファイルサイズ制限、メモリ使用量制御
 * 🟢 信頼性レベル: 業界標準のExcel処理ライブラリ使用
 * @param file - Excel ファイル
 * @returns Promise<ExcelWorksheetInfo[]> - 抽出されたワークシート情報
 */
export async function parseExcelFile(file: File): Promise<ExcelWorksheetInfo[]> {
  // 【ファイルサイズ制限】: メモリ枯渇攻撃を防止
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Excel file too large: ${Math.round(file.size / 1024 / 1024)}MB exceeds 50MB limit`);
  }
  
  try {
    // 【ファイル読み込み】: ArrayBuffer として Excel ファイルを読み込み
    const arrayBuffer = await file.arrayBuffer();
    
    // 【Excel解析】: xlsx ライブラリによるワークブック解析
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellDates: true,  // 日付セルを適切に処理
      cellNF: false     // 数値フォーマットを無効化（文字列として取得）
    });
    
    const worksheets: ExcelWorksheetInfo[] = [];
    
    // 【全ワークシート処理】: 各ワークシートからデータを抽出
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      
      // 【データ変換】: ワークシートを2次元配列に変換
      const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,        // 配列形式で出力
        defval: null,     // 空セルはnullに変換
        raw: false        // 値を文字列として取得
      });
      
      // 【空ワークシートスキップ】: データが存在しないワークシートは除外
      if (data.length === 0) {
        continue;
      }
      
      // 【ワークシート情報作成】: メタデータと共にデータを格納
      const worksheetInfo: ExcelWorksheetInfo = {
        name: sheetName,
        data: data,
        rowCount: data.length,
        columnCount: data.length > 0 ? Math.max(...data.map(row => row.length)) : 0
      };
      
      worksheets.push(worksheetInfo);
    }
    
    // 【結果検証】: 有効なワークシートが存在するかチェック
    if (worksheets.length === 0) {
      throw new Error('No valid worksheets found in Excel file');
    }
    
    return worksheets;
    
  } catch (error) {
    // 【エラーハンドリング】: Excel処理エラーの適切な報告
    if (error instanceof Error) {
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
    throw new Error('Failed to parse Excel file: Unknown error');
  }
}

/**
 * 【機能概要】: ZIPファイル内のCSVファイルを抽出
 * 【実装方針】: jszip ライブラリを使用した ZIP アーカイブ解析
 * 【セキュリティ対策】: ZIP爆弾対策、ファイルサイズ制限
 * 🟢 信頼性レベル: 業界標準のZIP処理ライブラリ使用
 * @param file - ZIP ファイル
 * @returns Promise<ZipFileInfo[]> - ZIP内のCSVファイル一覧
 */
export async function extractCSVFilesFromZip(file: File): Promise<ZipFileInfo[]> {
  // 【ファイルサイズ制限】: ZIP爆弾攻撃を防止
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`ZIP file too large: ${Math.round(file.size / 1024 / 1024)}MB exceeds 100MB limit`);
  }
  
  try {
    // 【ファイル読み込み】: ArrayBuffer として ZIP ファイルを読み込み
    const arrayBuffer = await file.arrayBuffer();
    
    // 【ZIP解析】: jszip ライブラリによるアーカイブ解析
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    const csvFiles: ZipFileInfo[] = [];
    const MAX_EXTRACTED_SIZE = 200 * 1024 * 1024; // 展開後合計200MB制限
    let totalExtractedSize = 0;
    
    // 【ファイル列挙】: ZIP内の全ファイルをチェック
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      // 【ディレクトリスキップ】: ディレクトリエントリは無視
      if (zipEntry.dir) {
        continue;
      }
      
      // 【CSV形式判定】: ファイル拡張子によるCSV判定
      const filename = relativePath.toLowerCase();
      if (!filename.endsWith('.csv') && !filename.endsWith('.tsv') && !filename.endsWith('.tab')) {
        continue;
      }
      
      // 【展開サイズ制限】: ZIP爆弾対策
      if (totalExtractedSize + (zipEntry as any)._data?.uncompressedSize > MAX_EXTRACTED_SIZE) {
        console.warn('ZIP extraction stopped: size limit exceeded');
        break;
      }
      
      try {
        // 【ファイル展開】: CSVファイルをテキストとして展開
        const content = await zipEntry.async('text');
        
        // 【空ファイルスキップ】: 内容のないファイルは除外
        if (content.trim().length === 0) {
          continue;
        }
        
        // 【CSVファイル情報作成】: メタデータと共にファイル情報を格納
        const csvFileInfo: ZipFileInfo = {
          filename: relativePath,
          content: content,
          size: content.length
        };
        
        csvFiles.push(csvFileInfo);
        totalExtractedSize += content.length;
        
      } catch (fileError) {
        // 【個別ファイルエラー】: 個別ファイルの展開エラーは警告として処理
        console.warn(`Failed to extract file ${relativePath}:`, fileError);
      }
    }
    
    // 【結果検証】: 有効なCSVファイルが存在するかチェック
    if (csvFiles.length === 0) {
      throw new Error('No CSV/TSV files found in ZIP archive');
    }
    
    return csvFiles;
    
  } catch (error) {
    // 【エラーハンドリング】: ZIP処理エラーの適切な報告
    if (error instanceof Error) {
      throw new Error(`Failed to extract ZIP file: ${error.message}`);
    }
    throw new Error('Failed to extract ZIP file: Unknown error');
  }
}

/**
 * 【機能概要】: Excel ワークシートデータをCSV形式に変換
 * 【実装方針】: 2次元配列をカンマ区切り文字列に変換
 * 【データ変換】: null値の適切な処理、エスケープ処理
 * 🟢 信頼性レベル: 標準的なCSV変換パターン
 * @param worksheetData - Excel ワークシートの2次元配列データ
 * @returns string - CSV形式の文字列
 */
export function convertWorksheetToCSV(worksheetData: any[][]): string {
  return worksheetData
    .map(row => 
      row.map(cell => {
        // 【null値処理】: null/undefinedは空文字に変換
        if (cell === null || cell === undefined) {
          return '';
        }
        
        // 【文字列変換】: すべての値を文字列として処理
        const cellValue = String(cell);
        
        // 【エスケープ処理】: カンマ・改行・ダブルクォートを含む場合の処理
        if (cellValue.includes(',') || cellValue.includes('\n') || cellValue.includes('"')) {
          return `"${cellValue.replace(/"/g, '""')}"`;
        }
        
        return cellValue;
      }).join(',')
    )
    .join('\n');
}