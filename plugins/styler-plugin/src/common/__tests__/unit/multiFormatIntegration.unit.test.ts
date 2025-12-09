/**
 * @file multiFormatIntegration.test.ts
 * @description Integration tests for multi-format file processing (CSV/TSV/Excel/ZIP)
 */

import 'fake-indexeddb/auto';
import { SpreadsheetTabularApiDriver as StylerTabularApiDriver } from '@hierarchidb/spreadsheet-plugin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StylerMetadataManager } from '../../../services/StylerMetadataManager.js';
import { detectFileType } from '../../utils/fileProcessingUtils.js';

// Mock hashUtils
vi.mock('../../utils/hashUtils', () => ({
  hashUtils: {
    generateHash: vi.fn().mockImplementation((content: string) => {
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return Promise.resolve(`mock-hash-${Math.abs(hash)}`);
    }),
  },
}));

// Mock xlsx library for Excel tests
vi.mock('xlsx', () => ({
  read: vi.fn().mockReturnValue({
    SheetNames: ['Sheet1'],
    Sheets: {
      Sheet1: {},
    },
  }),
  utils: {
    sheet_to_json: vi.fn().mockReturnValue([
      ['Product', 'Price', 'Category'],
      ['Laptop', '1000', 'Electronics'],
      ['Mouse', '25', 'Accessories'],
    ]),
  },
}));

// Mock jszip library for ZIP tests
vi.mock('jszip', () => {
  class JSZip {
    files = {
      'data.csv': {
        dir: false,
        async: vi.fn().mockResolvedValue('Name,Value\nItem1,100\nItem2,200'),
        _data: { uncompressedSize: 50 },
      },
      'folder/': {
        dir: true,
      },
    };

    async loadAsync() {
      return this;
    }

    static async loadAsync() {
      return new JSZip();
    }
  }

  const loadAsync = vi.fn().mockResolvedValue(new JSZip());

  return {
    default: JSZip,
    loadAsync,
  };
});

describe('Multi-format File Processing Integration', () => {
  let csvApi: StylerTabularApiDriver;
  let tableManager: StylerMetadataManager;

  beforeEach(async () => {
    tableManager = new StylerMetadataManager();
    csvApi = new StylerTabularApiDriver(tableManager);
  });

  afterEach(async () => {
    await tableManager.clear();
  });

  describe('File Type Detection', () => {
    it('should correctly identify different file formats', () => {
      const csvFile = new File([''], 'data.csv', { type: 'text/csv' });
      expect(detectFileType(csvFile)).toBe('csv');

      const excelFile = new File([''], 'data.xlsx', { type: 'application/excel' });
      expect(detectFileType(excelFile)).toBe('excel');

      const zipFile = new File([''], 'data.zip', { type: 'application/zip' });
      expect(detectFileType(zipFile)).toBe('zip');

      const tsvFile = new File([''], 'data.tsv', { type: 'text/tsv' });
      expect(detectFileType(tsvFile)).toBe('tsv');
    });
  });

  describe('CSV File Processing', () => {
    it('should process standard CSV files', async () => {
      const csvContent = `Name,Age,City
John,30,New York
Jane,25,Los Angeles`;

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const result = await csvApi.uploadCSVFile(file);

      expect(result.filename).toBe('test.csv');
      expect(result.totalRows).toBe(2);
      expect(result.columns).toHaveLength(3);
    });
  });

  describe('TSV File Processing', () => {
    it('should process TSV files with tab delimiters', async () => {
      const tsvContent = `Name\tAge\tCity
John\t30\tNew York
Jane\t25\tLos Angeles`;

      const file = new File([tsvContent], 'test.tsv', { type: 'text/tsv' });
      const result = await csvApi.uploadCSVFile(file);

      expect(result.filename).toBe('test.tsv');
      expect(result.totalRows).toBe(2);
      expect(result.columns).toHaveLength(3);
      expect(result.columns[0].name).toBe('Name');
    });
  });

  describe('Excel File Processing', () => {
    it('should process Excel .xlsx files', async () => {
      const buffer = new ArrayBuffer(100);
      const file = new File([buffer], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      // Add arrayBuffer method to File object for test
      file.arrayBuffer = vi.fn().mockResolvedValue(buffer);

      const result = await csvApi.uploadCSVFile(file);

      expect(result.filename).toBe('test.xlsx');
      expect(result.totalRows).toBe(2); // From mocked data
      expect(result.columns).toHaveLength(3);
      expect(result.columns[0].name).toBe('Product');
    });

    it('should handle Excel file size limits', async () => {
      const largeBuffer = new ArrayBuffer(60 * 1024 * 1024); // 60MB
      const file = new File([largeBuffer], 'large.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      await expect(csvApi.uploadCSVFile(file)).rejects.toThrow(
        'File size exceeds 50MB limit for EXCEL files'
      );
    });
  });

  describe('ZIP File Processing', () => {
    it('should process ZIP files containing CSV', async () => {
      const buffer = new ArrayBuffer(100);
      const file = new File([buffer], 'test.zip', { type: 'application/zip' });

      // Add arrayBuffer method to File object for test
      file.arrayBuffer = vi.fn().mockResolvedValue(buffer);

      const result = await csvApi.uploadCSVFile(file);

      expect(result.filename).toBe('test.zip');
      expect(result.totalRows).toBe(2); // From mocked data
      expect(result.columns).toHaveLength(2);
      expect(result.columns[0].name).toBe('Name');
    });

    it('should handle ZIP file size limits', async () => {
      const largeBuffer = new ArrayBuffer(120 * 1024 * 1024); // 120MB
      const file = new File([largeBuffer], 'large.zip', { type: 'application/zip' });

      await expect(csvApi.uploadCSVFile(file)).rejects.toThrow(
        'File size exceeds 100MB limit for ZIP files'
      );
    });
  });

  describe('Unsupported File Handling', () => {
    it('should reject unsupported file formats', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      await expect(csvApi.uploadCSVFile(file)).rejects.toThrow('Unsupported file format');
    });

    it('should reject image files', async () => {
      const file = new File(['binary'], 'image.jpg', { type: 'image/jpeg' });

      await expect(csvApi.uploadCSVFile(file)).rejects.toThrow('Unsupported file format');
    });
  });

  describe('Format-specific Features', () => {
    it('should apply different size limits per format', async () => {
      // CSV: 10MB limit
      const csv11MB = new File(['x'.repeat(11 * 1024 * 1024)], 'big.csv', { type: 'text/csv' });
      await expect(csvApi.uploadCSVFile(csv11MB)).rejects.toThrow(
        'File size exceeds 10MB limit for CSV files'
      );

      // Excel: 50MB limit
      const excel51MB = new ArrayBuffer(51 * 1024 * 1024);
      const excelFile = new File([excel51MB], 'big.xlsx', { type: 'application/excel' });
      await expect(csvApi.uploadCSVFile(excelFile)).rejects.toThrow(
        'File size exceeds 50MB limit for EXCEL files'
      );

      // ZIP: 100MB limit
      const zip101MB = new ArrayBuffer(101 * 1024 * 1024);
      const zipFile = new File([zip101MB], 'big.zip', { type: 'application/zip' });
      await expect(csvApi.uploadCSVFile(zipFile)).rejects.toThrow(
        'File size exceeds 100MB limit for ZIP files'
      );
    });
  });
});
