/**
 * @file fileFormats.test.ts
 * @description Multi-format file processing tests for Excel and ZIP support
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StyleMapCSVApiDriver } from '../services/StyleMapCSVApiDriver';
import { SimpleTableMetadataManager } from '../services/SimpleTableMetadataManager';
import { detectFileType } from '../utils/fileProcessingUtils';

// Mock xlsx library for Excel tests
vi.mock('xlsx', () => {
  return {
    read: vi.fn().mockImplementation((buffer, options) => {
      // Mock Excel workbook with sample data
      return {
        SheetNames: ['Sheet1', 'Sheet2'],
        Sheets: {
          Sheet1: {}, // This will be processed by sheet_to_json
          Sheet2: {}
          }
        };
      }),
      utils: {
        sheet_to_json: vi.fn().mockReturnValue([
          ['Name', 'Age', 'City'],
          ['Alice', '28', 'Tokyo'],
          ['Bob', '32', 'Osaka'],
          ['Charlie', '25', 'Kyoto']
        ])
      }
    };
});

// Mock jszip library for ZIP tests
vi.mock('jszip', () => {
  const MockJSZip = vi.fn().mockImplementation(() => ({
    files: {
      'data.csv': {
        dir: false,
        async: vi.fn().mockResolvedValue('Name,Score,Category\nProject A,85,Development\nProject B,92,Testing\nProject C,78,Documentation'),
        _data: { uncompressedSize: 100 }
      },
      'empty.txt': {
        dir: false,
        async: vi.fn().mockResolvedValue(''),
        _data: { uncompressedSize: 0 }
      },
      'folder/': {
        dir: true,
        _data: { uncompressedSize: 0 }
      }
    }
  }));
  
  MockJSZip.loadAsync = vi.fn().mockImplementation(() => Promise.resolve(new MockJSZip()));
  
  return MockJSZip;
});

// Mock hashUtils with deterministic hashes
vi.mock('../utils/hashUtils', () => ({
  hashUtils: {
    generateHash: vi.fn().mockImplementation((content: string) => {
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Promise.resolve(`mock-hash-${Math.abs(hash)}`);
    }),
  },
}));

describe('Multi-format File Processing', () => {
  let csvApi: StyleMapCSVApiDriver;
  let tableManager: SimpleTableMetadataManager;

  beforeEach(async () => {
    tableManager = new SimpleTableMetadataManager();
    csvApi = new StyleMapCSVApiDriver(tableManager);
  });

  afterEach(async () => {
    await tableManager.clear();
  });

  describe('File Type Detection', () => {
    it('should detect CSV files correctly', () => {
      const file = new File([''], 'test.csv', { type: 'text/csv' });
      expect(detectFileType(file)).toBe('csv');
    });

    it('should detect TSV files correctly', () => {
      const file = new File([''], 'test.tsv', { type: 'text/tsv' });
      expect(detectFileType(file)).toBe('tsv');
      
      const tabFile = new File([''], 'test.tab', { type: 'text/plain' });
      expect(detectFileType(tabFile)).toBe('tsv');
    });

    it('should detect Excel files correctly', () => {
      const xlsxFile = new File([''], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      expect(detectFileType(xlsxFile)).toBe('excel');
      
      const xlsFile = new File([''], 'test.xls', { type: 'application/vnd.ms-excel' });
      expect(detectFileType(xlsFile)).toBe('excel');
      
      const xlsmFile = new File([''], 'test.xlsm', { type: 'application/vnd.ms-excel.sheet.macroEnabled.12' });
      expect(detectFileType(xlsmFile)).toBe('excel');
    });

    it('should detect ZIP files correctly', () => {
      const file = new File([''], 'test.zip', { type: 'application/zip' });
      expect(detectFileType(file)).toBe('zip');
    });

    it('should detect unsupported files correctly', () => {
      const file = new File([''], 'test.pdf', { type: 'application/pdf' });
      expect(detectFileType(file)).toBe('unsupported');
      
      const imgFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      expect(detectFileType(imgFile)).toBe('unsupported');
    });
  });

  describe('Excel File Processing', () => {
    it('should process Excel file successfully', async () => {
      // Create mock Excel file with proper MIME type
      const excelBuffer = new ArrayBuffer(1024); // Mock Excel content
      const file = new File([excelBuffer], 'test.xlsx', { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      const result = await csvApi.uploadCSVFile(file);

      expect(result).toBeDefined();
      expect(result.filename).toContain('test.xlsx');
      expect(result.filename).toContain('EXCEL (Excel file processed)');
      expect(result.totalRows).toBe(3); // Header + 3 data rows from mock
      expect(result.columns).toHaveLength(3); // Name, Age, City
    });

    it('should handle Excel file size limits', async () => {
      // Create a mock large Excel file
      const largeBuffer = new ArrayBuffer(60 * 1024 * 1024); // 60MB
      const file = new File([largeBuffer], 'large.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      await expect(csvApi.uploadCSVFile(file))
        .rejects
        .toThrow('File size exceeds 50MB limit for EXCEL files');
    });

    it('should reject unsupported file formats', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      await expect(csvApi.uploadCSVFile(file))
        .rejects
        .toThrow('Unsupported file format. Supported formats: CSV, TSV, Excel (.xlsx/.xls), ZIP');
    });
  });

  describe('ZIP File Processing', () => {
    it('should process ZIP file with CSV content successfully', async () => {
      // Create mock ZIP file
      const zipBuffer = new ArrayBuffer(512); // Mock ZIP content
      const file = new File([zipBuffer], 'test.zip', { type: 'application/zip' });

      const result = await csvApi.uploadCSVFile(file);

      expect(result).toBeDefined();
      expect(result.filename).toContain('test.zip');
      expect(result.filename).toContain('ZIP (ZIP file processed)');
      expect(result.filename).toContain('data.csv'); // From mock
      expect(result.totalRows).toBe(3); // Header + 3 data rows from mock
      expect(result.columns).toHaveLength(3); // Name, Score, Category
    });

    it('should handle ZIP file size limits', async () => {
      // Create a mock large ZIP file
      const largeBuffer = new ArrayBuffer(120 * 1024 * 1024); // 120MB
      const file = new File([largeBuffer], 'large.zip', { type: 'application/zip' });

      await expect(csvApi.uploadCSVFile(file))
        .rejects
        .toThrow('File size exceeds 100MB limit for ZIP files');
    });
  });

  describe('TSV File Processing', () => {
    it('should process TSV file successfully', async () => {
      const tsvContent = `Name\tAge\tCity
John\t30\tNew York
Jane\t25\tLos Angeles`;

      const file = new File([tsvContent], 'test.tsv', { type: 'text/tsv' });
      const result = await csvApi.uploadCSVFile(file);

      expect(result).toBeDefined();
      expect(result.filename).toContain('test.tsv');
      expect(result.filename).toContain('TSV');
      expect(result.totalRows).toBe(2); // 2 data rows
      expect(result.columns).toHaveLength(3); // Name, Age, City columns
    });

    it('should handle TSV file size limits', async () => {
      const largeContent = 'a'.repeat(15 * 1024 * 1024); // 15MB content
      const file = new File([largeContent], 'large.tsv', { type: 'text/tsv' });

      await expect(csvApi.uploadCSVFile(file))
        .rejects
        .toThrow('File size exceeds 10MB limit for TSV files');
    });
  });

  describe('Format-specific Error Handling', () => {
    it('should handle Excel parsing errors gracefully', async () => {
      // Override mock to throw error
      const xlsx = await vi.importActual('xlsx') as any;
      vi.mocked(xlsx.read).mockImplementationOnce(() => {
        throw new Error('Invalid Excel format');
      });

      const file = new File([new ArrayBuffer(100)], 'corrupt.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      await expect(csvApi.uploadCSVFile(file))
        .rejects
        .toThrow('Failed to parse Excel file: Invalid Excel format');
    });

    it('should handle ZIP extraction errors gracefully', async () => {
      // Override mock to throw error  
      const JSZip = await vi.importActual('jszip') as any;
      vi.mocked(JSZip.loadAsync).mockImplementationOnce(() => {
        throw new Error('Invalid ZIP format');
      });

      const file = new File([new ArrayBuffer(100)], 'corrupt.zip', {
        type: 'application/zip'
      });

      await expect(csvApi.uploadCSVFile(file))
        .rejects
        .toThrow('Failed to extract ZIP file: Invalid ZIP format');
    });

    it('should handle empty Excel worksheets', async () => {
      // Override mock to return empty worksheets
      const xlsx = await vi.importActual('xlsx') as any;
      vi.mocked(xlsx.utils.sheet_to_json).mockReturnValueOnce([]);

      const file = new File([new ArrayBuffer(100)], 'empty.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      await expect(csvApi.uploadCSVFile(file))
        .rejects
        .toThrow('No data rows found');
    });

    it('should handle ZIP with no CSV files', async () => {
      // Override mock to return ZIP with no CSV files
      const JSZip = await vi.importActual('jszip') as any;
      const mockZip = {
        files: {
          'document.pdf': { dir: false },
          'image.jpg': { dir: false }
        }
      };
      vi.mocked(JSZip.loadAsync).mockResolvedValueOnce(mockZip);

      const file = new File([new ArrayBuffer(100)], 'no-csv.zip', {
        type: 'application/zip'
      });

      await expect(csvApi.uploadCSVFile(file))
        .rejects
        .toThrow('No CSV/TSV files found in ZIP archive');
    });
  });

  describe('File Content Validation', () => {
    it('should reject files with no content after processing', async () => {
      const file = new File([''], 'empty.csv', { type: 'text/csv' });

      await expect(csvApi.uploadCSVFile(file))
        .rejects
        .toThrow('No content found in file');
    });

    it('should process files with different case extensions', () => {
      const csvFile = new File([''], 'test.CSV', { type: 'text/csv' });
      expect(detectFileType(csvFile)).toBe('csv');

      const excelFile = new File([''], 'test.XLSX', { type: 'application/excel' });
      expect(detectFileType(excelFile)).toBe('excel');

      const zipFile = new File([''], 'test.ZIP', { type: 'application/zip' });
      expect(detectFileType(zipFile)).toBe('zip');
    });
  });
});