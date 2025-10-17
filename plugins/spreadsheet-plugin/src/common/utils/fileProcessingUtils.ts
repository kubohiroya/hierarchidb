/**
 * @file fileProcessingUtils.ts
 * @description File format processing utilities (Excel, ZIP, etc.)
 * Refactored from Styler plugin for Spreadsheet plugin use
 */

import type { CSVProcessingConfig } from '@hierarchidb/ui-tabular-extract';

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
  * : Excel (.xlsx, .xls)
 * : SheetJSCSV
 * : Excel
 * : SheetJS
  */
export async function processExcelFile(
  file: File,
  config: CSVProcessingConfig = {},
): Promise<ProcessedFile> {
  try {
    //  : ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    //  Excel: SheetJS
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellText: false,
      cellDates: true,
    });

    //  : UI
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('No sheets found in Excel file');
    }

    const worksheet = workbook.Sheets[sheetName];

    //  CSV: CSV
    const csvContent = XLSX.utils.sheet_to_csv(worksheet, {
      header: 1, blankrows: !config.skipEmptyLines,
      strip: false,
    });

    //  : Excel
    const detectedConfig: Partial<CSVProcessingConfig> = {
      delimiter: ',', //  CSV
      hasHeader: true, //  Excel
      encoding: 'utf-8', //  SheetJSUTF-8
    };

    return {
      content: csvContent,
      detectedConfig,
    };
  } catch (error) {
    throw new Error(
      `Excel file processing failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
  * : ZIPCSV/TSV
 * : JSZip
 * : ZIP
 * : JSZip
  */
export async function processZipFile(
  file: File,
  _config: CSVProcessingConfig = {},
): Promise<ProcessedFile> {
  try {
    //  ZIP: JSZipZIP
    const zip = new JSZip();
    const zipData = await zip.loadAsync(file);

    //  : CSV/TSV/TXT
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
        `No supported files found in ZIP. Supported formats: ${supportedExtensions.join(', ')}`,
      );
    }

    //  :
    const content = await targetFile.async('text');

    //  :
    const fileExtension = '.' + targetFileName.split('.').pop()?.toLowerCase();
    const detectedConfig: Partial<CSVProcessingConfig> = {
      delimiter: fileExtension === '.tsv' ? '\t' : ',',
      encoding: 'utf-8', //  ZIPUTF-8
    };

    return {
      content,
      detectedConfig,
    };
  } catch (error) {
    throw new Error(
      `ZIP file processing failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
  * :
 * :
 * :
 * :
  */
export async function detectFileTypeFromContent(file: File): Promise<string> {
  //  :
  const headerSize = 8;
  const buffer = await file.slice(0, headerSize).arrayBuffer();
  const headerBytes = new Uint8Array(buffer);

  //  Excel: OLE/OOXML
  if (headerBytes[0] === 0x50 && headerBytes[1] === 0x4b) {
    //  ZIPXLSX
    if (headerBytes[2] === 0x03 && headerBytes[3] === 0x04) {
      return 'xlsx';
    }
  }

  if (headerBytes[0] === 0xd0 && headerBytes[1] === 0xcf) {
    //  OLEXLS
    return 'xls';
  }

  //  ZIP
  if (
    headerBytes[0] === 0x50 &&
    headerBytes[1] === 0x4b &&
    headerBytes[2] === 0x03 &&
    headerBytes[3] === 0x04
  ) {
    return 'zip';
  }

  //  :
  const isText = headerBytes.every(
    (byte) => byte < 128 && (byte >= 32 || [9, 10, 13].includes(byte)),
  );

  if (isText) {
    return 'text';
  }

  //  :
  return 'unknown';
}

/**
  * : MIME
 * : MIME
 * : MIME
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
  * :
 * : KB/MB/GB
 * :
  */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

/**
  * : CSV
 * :
 * :
 * :
  */
export function detectCSVDelimiter(content: string): string {
  const lines = content.split('\n').slice(0, 5); //  5
  const candidates = [',', ';', '\t', '|'];
  const scores: Record<string, number> = {};

  //  :
  for (const delimiter of candidates) {
    let totalScore = 0;
    const fieldCounts: number[] = [];

    for (const line of lines) {
      if (line.trim() === '') continue;

      const fields = line.split(delimiter);
      fieldCounts.push(fields.length);

      //  :
      if (fields.length > 1) {
        totalScore += fields.length;
      }
    }

    //  :
    const uniqueCounts = [...new Set(fieldCounts)];
    if (uniqueCounts.length === 1 && uniqueCounts[0] && uniqueCounts[0] > 1) {
      totalScore *= 2;
    }

    scores[delimiter] = totalScore;
  }

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const bestDelimiter = sorted[0]?.[0];

  return bestDelimiter || ',';
}
