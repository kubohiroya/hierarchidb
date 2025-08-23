import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type {
  SpreadsheetImportOptions,
  SpreadsheetImportResult,
} from '~/entities/types';
import { SpreadsheetError, SpreadsheetErrorCode } from '~/entities/types';

/**
 * FileLoader handles importing spreadsheet data from various sources
 */
export class FileLoader {
  /**
   * Import from a File object (CSV or Excel)
   */
  async importFromFile(
    file: File,
    options: SpreadsheetImportOptions = {}
  ): Promise<SpreadsheetImportResult> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    try {
      if (extension === 'csv' || extension === 'tsv' || extension === 'txt') {
        return await this.importCSV(file, options);
      } else if (extension === 'xlsx' || extension === 'xls') {
        return await this.importExcel(file, options);
      } else {
        throw this.createError(SpreadsheetErrorCode.UNSUPPORTED_FORMAT, `Unsupported file extension: ${extension}`);
      }
    } catch (error) {
      if (this.isSpreadsheetError(error)) {
        throw error;
      }
      throw this.createError(SpreadsheetErrorCode.IMPORT_FAILED, error instanceof Error ? error.message : 'Import failed');
    }
  }

  /**
   * Import from a URL
   */
  async importFromURL(
    url: string,
    options: SpreadsheetImportOptions = {}
  ): Promise<SpreadsheetImportResult> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw this.createError(SpreadsheetErrorCode.NETWORK_ERROR, `HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const blob = await response.blob();

      // Determine file type from URL or content-type
      let filename = url.split('/').pop() || 'data';
      if (contentType.includes('csv') || contentType.includes('text/plain')) {
        filename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
      } else if (contentType.includes('excel') || contentType.includes('spreadsheet')) {
        filename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
      }

      const file = new File([blob], filename, { type: contentType });
      return await this.importFromFile(file, options);
    } catch (error) {
      if (this.isSpreadsheetError(error)) {
        throw error;
      }
      throw this.createError(SpreadsheetErrorCode.NETWORK_ERROR, error instanceof Error ? error.message : 'Network error');
    }
  }

  /**
   * Import from clipboard text
   */
  async importFromClipboard(
    text: string,
    options: SpreadsheetImportOptions = {}
  ): Promise<SpreadsheetImportResult> {
    // Default to tab delimiter for clipboard data
    const delimiter = options.delimiter || '\t';
    
    return await this.parseCSVText(text, {
      ...options,
      delimiter,
    });
  }

  /**
   * Import CSV file
   */
  private async importCSV(
    file: File,
    options: SpreadsheetImportOptions
  ): Promise<SpreadsheetImportResult> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        delimiter: options.delimiter || this.detectDelimiter(file.name),
        header: options.hasHeader !== false, // Default true
        skipEmptyLines: options.skipEmptyLines !== false, // Default true
        encoding: options.encoding || 'UTF-8',
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(this.createError(SpreadsheetErrorCode.PARSE_ERROR, results.errors[0]?.message || 'Parse error'));
            return;
          }

          const headers = results.meta.fields || [];
          const rows = results.data as Record<string, unknown>[];

          resolve({
            headers,
            rows: this.normalizeRows(rows, headers),
            totalRows: rows.length,
            format: 'csv',
            originalSize: file.size,
          });
        },
        error: (error: any) => {
          reject(this.createError(SpreadsheetErrorCode.PARSE_ERROR, error.message));
        },
      });
    });
  }

  /**
   * Parse CSV text directly
   */
  private async parseCSVText(
    text: string,
    options: SpreadsheetImportOptions
  ): Promise<SpreadsheetImportResult> {
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        delimiter: options.delimiter || '	',
        header: options.hasHeader !== false,
        skipEmptyLines: options.skipEmptyLines !== false,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(this.createError(SpreadsheetErrorCode.PARSE_ERROR, results.errors[0]?.message || 'Parse error'));
            return;
          }

          const headers = results.meta.fields || [];
          const rows = results.data as Record<string, unknown>[];

          resolve({
            headers,
            rows: this.normalizeRows(rows, headers),
            totalRows: rows.length,
            format: 'tsv',
            originalSize: text.length,
          });
        },
        error: (error: any) => {
          reject(this.createError(SpreadsheetErrorCode.PARSE_ERROR, error.message));
        },
      });
    });
  }

  /**
   * Import Excel file
   */
  private async importExcel(
    file: File,
    options: SpreadsheetImportOptions
  ): Promise<SpreadsheetImportResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            reject(this.createError(SpreadsheetErrorCode.IMPORT_FAILED, 'Failed to read file'));
            return;
          }

          const workbook = XLSX.read(data, { type: 'binary' });
          
          // Use specified sheet or first sheet
          const sheetName = options.sheetName || workbook.SheetNames[0];
          if (!sheetName) {
            reject(this.createError(SpreadsheetErrorCode.PARSE_ERROR, 'No sheets found in workbook'));
            return;
          }
          const worksheet = workbook.Sheets[sheetName];
          
          if (!worksheet) {
            reject(this.createError(SpreadsheetErrorCode.PARSE_ERROR, `Sheet "${sheetName}" not found`));
            return;
          }

          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: options.hasHeader === false ? 1 : undefined,
            defval: '', // Default value for empty cells
          });

          // Extract headers
          let headers: string[];
          let rows: Record<string, unknown>[];

          if (options.hasHeader === false) {
            // Generate column names if no header
            const firstRow = jsonData[0] as Record<string, unknown>;
            headers = Object.keys(firstRow).map((_, i) => `Column${i + 1}`);
            rows = jsonData as Record<string, unknown>[];
          } else {
            // Use first row as headers
            const firstRow = jsonData[0] as Record<string, unknown>;
            headers = firstRow ? Object.keys(firstRow) : [];
            rows = jsonData as Record<string, unknown>[];
          }

          resolve({
            headers,
            rows: this.normalizeRows(rows, headers),
            totalRows: rows.length,
            format: 'excel',
            originalSize: file.size,
          });
        } catch (error) {
          reject(this.createError(SpreadsheetErrorCode.PARSE_ERROR, error instanceof Error ? error.message : 'Parse error'));
        }
      };

      reader.onerror = () => {
        reject(this.createError(SpreadsheetErrorCode.IMPORT_FAILED, 'Failed to read file'));
      };

      reader.readAsBinaryString(file);
    });
  }

  /**
   * Detect delimiter from filename
   */
  private detectDelimiter(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'tsv':
        return '\t';
      case 'csv':
        return ',';
      default:
        return '\t'; // Default to tab
    }
  }

  /**
   * Normalize rows to ensure all have the same columns
   */
  private normalizeRows(
    rows: Record<string, unknown>[],
    headers: string[]
  ): Record<string, unknown>[] {
    return rows.map(row => {
      const normalized: Record<string, unknown> = {};
      for (const header of headers) {
        normalized[header] = row[header] ?? '';
      }
      return normalized;
    });
  }

  /**
   * Create a SpreadsheetError
   */
  private createError(code: SpreadsheetErrorCode, message: string): SpreadsheetError {
    return new SpreadsheetError(code, message);
  }

  /**
   * Type guard for SpreadsheetImportError
   */
  private isSpreadsheetError(error: unknown): error is SpreadsheetError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error
    );
  }
}

// Export singleton instance
export const fileLoader = new FileLoader();