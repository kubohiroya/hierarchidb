/**
 * @file fileProcessingUtils.test.ts
 * @description Unit tests for file processing utilities
 */

import { describe, it, expect, vi } from 'vitest';
import { 
  detectFileType, 
  parseExcelFile, 
  extractCSVFilesFromZip, 
  convertWorksheetToCSV 
} from '../utils/fileProcessingUtils';

// Mock xlsx library
vi.mock('xlsx', () => {
  const mockWorkbook = {
    SheetNames: ['TestSheet', 'EmptySheet'],
    Sheets: {
      TestSheet: {
        A1: { v: 'Name' },
        B1: { v: 'Age' },
        C1: { v: 'City' },
        A2: { v: 'John' },
        B2: { v: 30 },
        C2: { v: 'New York' }
      },
      EmptySheet: {}
    }
  };

  return {
    read: vi.fn().mockReturnValue(mockWorkbook),
    utils: {
      sheet_to_json: vi.fn().mockImplementation((sheet, options) => {
        if (sheet === mockWorkbook.Sheets.TestSheet) {
          return [
            ['Name', 'Age', 'City'],
            ['John', 30, 'New York'],
            ['Jane', 25, 'Los Angeles']
          ];
        }
        return []; // Empty sheet
      })
    }
  };
});

// Mock jszip library
vi.mock('jszip', () => {
  const MockJSZip = vi.fn().mockImplementation(() => ({
    files: {
      'data.csv': {
        dir: false,
        async: vi.fn().mockResolvedValue('Name,Age,City\nAlice,28,Tokyo\nBob,32,Osaka'),
        _data: { uncompressedSize: 50 }
      },
      'info.tsv': {
        dir: false,
        async: vi.fn().mockResolvedValue('Product\tPrice\nLaptop\t1000\nMouse\t25'),
        _data: { uncompressedSize: 30 }
      },
      'readme.txt': {
        dir: false,
        async: vi.fn().mockResolvedValue('This is not a CSV file'),
        _data: { uncompressedSize: 20 }
      },
      'empty.csv': {
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

describe('File Processing Utils', () => {
  describe('detectFileType', () => {
    it('should detect CSV files', () => {
      const file = new File([''], 'test.csv', { type: 'text/csv' });
      expect(detectFileType(file)).toBe('csv');
      
      // Case insensitive
      const upperFile = new File([''], 'TEST.CSV', { type: 'text/csv' });
      expect(detectFileType(upperFile)).toBe('csv');
    });

    it('should detect TSV files', () => {
      const tsvFile = new File([''], 'test.tsv', { type: 'text/tsv' });
      expect(detectFileType(tsvFile)).toBe('tsv');
      
      const tabFile = new File([''], 'test.tab', { type: 'text/plain' });
      expect(detectFileType(tabFile)).toBe('tsv');
    });

    it('should detect Excel files', () => {
      const xlsxFile = new File([''], 'test.xlsx', { type: 'application/xlsx' });
      expect(detectFileType(xlsxFile)).toBe('excel');
      
      const xlsFile = new File([''], 'test.xls', { type: 'application/xls' });
      expect(detectFileType(xlsFile)).toBe('excel');
      
      const xlsmFile = new File([''], 'test.xlsm', { type: 'application/xlsm' });
      expect(detectFileType(xlsmFile)).toBe('excel');
    });

    it('should detect ZIP files', () => {
      const file = new File([''], 'test.zip', { type: 'application/zip' });
      expect(detectFileType(file)).toBe('zip');
    });

    it('should detect unsupported files', () => {
      const pdfFile = new File([''], 'test.pdf', { type: 'application/pdf' });
      expect(detectFileType(pdfFile)).toBe('unsupported');
      
      const imgFile = new File([''], 'image.png', { type: 'image/png' });
      expect(detectFileType(imgFile)).toBe('unsupported');
      
      const noExtFile = new File([''], 'noextension', { type: 'text/plain' });
      expect(detectFileType(noExtFile)).toBe('unsupported');
    });
  });

  describe('parseExcelFile', () => {
    it('should parse Excel file successfully', async () => {
      const buffer = new ArrayBuffer(100);
      const file = new File([buffer], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const worksheets = await parseExcelFile(file);

      expect(worksheets).toHaveLength(1); // Only TestSheet has data
      expect(worksheets[0].name).toBe('TestSheet');
      expect(worksheets[0].data).toHaveLength(3); // Header + 2 data rows
      expect(worksheets[0].rowCount).toBe(3);
      expect(worksheets[0].columnCount).toBe(3);
    });

    it('should reject files that are too large', async () => {
      const largeBuffer = new ArrayBuffer(60 * 1024 * 1024); // 60MB
      const file = new File([largeBuffer], 'large.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      await expect(parseExcelFile(file))
        .rejects
        .toThrow('Excel file too large: 60MB exceeds 50MB limit');
    });

    it('should handle Excel parsing errors', async () => {
      const xlsx = await vi.importActual('xlsx') as any;
      vi.mocked(xlsx.read).mockImplementationOnce(() => {
        throw new Error('Invalid Excel file');
      });

      const buffer = new ArrayBuffer(100);
      const file = new File([buffer], 'corrupt.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      await expect(parseExcelFile(file))
        .rejects
        .toThrow('Failed to parse Excel file: Invalid Excel file');
    });

    it('should handle Excel files with no valid worksheets', async () => {
      const xlsx = await vi.importActual('xlsx') as any;
      vi.mocked(xlsx.read).mockReturnValueOnce({
        SheetNames: [],
        Sheets: {}
      });

      const buffer = new ArrayBuffer(100);
      const file = new File([buffer], 'empty.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      await expect(parseExcelFile(file))
        .rejects
        .toThrow('No valid worksheets found in Excel file');
    });
  });

  describe('extractCSVFilesFromZip', () => {
    it('should extract CSV and TSV files from ZIP', async () => {
      const buffer = new ArrayBuffer(100);
      const file = new File([buffer], 'test.zip', { type: 'application/zip' });

      const csvFiles = await extractCSVFilesFromZip(file);

      expect(csvFiles).toHaveLength(2); // data.csv and info.tsv
      
      const csvFile = csvFiles.find(f => f.filename === 'data.csv');
      expect(csvFile).toBeDefined();
      expect(csvFile?.content).toContain('Name,Age,City');
      
      const tsvFile = csvFiles.find(f => f.filename === 'info.tsv');
      expect(tsvFile).toBeDefined();
      expect(tsvFile?.content).toContain('Product\tPrice');
    });

    it('should reject ZIP files that are too large', async () => {
      const largeBuffer = new ArrayBuffer(120 * 1024 * 1024); // 120MB
      const file = new File([largeBuffer], 'large.zip', { type: 'application/zip' });

      await expect(extractCSVFilesFromZip(file))
        .rejects
        .toThrow('ZIP file too large: 120MB exceeds 100MB limit');
    });

    it('should handle ZIP extraction errors', async () => {
      const JSZip = await vi.importActual('jszip') as any;
      vi.mocked(JSZip.loadAsync).mockImplementationOnce(() => {
        throw new Error('Invalid ZIP file');
      });

      const buffer = new ArrayBuffer(100);
      const file = new File([buffer], 'corrupt.zip', { type: 'application/zip' });

      await expect(extractCSVFilesFromZip(file))
        .rejects
        .toThrow('Failed to extract ZIP file: Invalid ZIP file');
    });

    it('should handle ZIP with no CSV files', async () => {
      const JSZip = await vi.importActual('jszip') as any;
      const mockZip = {
        files: {
          'readme.txt': { dir: false, async: vi.fn().mockResolvedValue('Hello') },
          'image.jpg': { dir: false, async: vi.fn().mockResolvedValue('binary data') }
        }
      };
      vi.mocked(JSZip.loadAsync).mockResolvedValueOnce(mockZip);

      const buffer = new ArrayBuffer(100);
      const file = new File([buffer], 'no-csv.zip', { type: 'application/zip' });

      await expect(extractCSVFilesFromZip(file))
        .rejects
        .toThrow('No CSV/TSV files found in ZIP archive');
    });

    it('should skip directories and empty files', async () => {
      const buffer = new ArrayBuffer(100);
      const file = new File([buffer], 'test.zip', { type: 'application/zip' });

      const csvFiles = await extractCSVFilesFromZip(file);

      // Should not include folder/ (directory) or empty.csv (empty content)
      const filenames = csvFiles.map(f => f.filename);
      expect(filenames).not.toContain('folder/');
      expect(filenames).not.toContain('empty.csv');
    });
  });

  describe('convertWorksheetToCSV', () => {
    it('should convert worksheet data to CSV format', () => {
      const worksheetData = [
        ['Name', 'Age', 'City'],
        ['John', 30, 'New York'],
        ['Jane', 25, 'Los Angeles']
      ];

      const csvContent = convertWorksheetToCSV(worksheetData);

      expect(csvContent).toBe('Name,Age,City\nJohn,30,New York\nJane,25,Los Angeles');
    });

    it('should handle null and undefined values', () => {
      const worksheetData = [
        ['Name', 'Age', 'City'],
        ['John', null, undefined],
        [null, 25, '']
      ];

      const csvContent = convertWorksheetToCSV(worksheetData);

      expect(csvContent).toBe('Name,Age,City\nJohn,,\n,25,');
    });

    it('should escape values containing commas and quotes', () => {
      const worksheetData = [
        ['Name', 'Description', 'Notes'],
        ['John Smith', 'Engineer, Senior', 'Works on "special" projects'],
        ['Jane Doe', 'Manager\nTeam Lead', 'Very "experienced"']
      ];

      const csvContent = convertWorksheetToCSV(worksheetData);

      const expectedLines = [
        'Name,Description,Notes',
        'John Smith,"Engineer, Senior","Works on ""special"" projects"',
        'Jane Doe,"Manager\nTeam Lead","Very ""experienced"""'
      ];
      expect(csvContent).toBe(expectedLines.join('\n'));
    });

    it('should handle empty worksheet data', () => {
      const worksheetData: any[][] = [];
      const csvContent = convertWorksheetToCSV(worksheetData);
      expect(csvContent).toBe('');
    });

    it('should handle rows with different lengths', () => {
      const worksheetData = [
        ['Name', 'Age'],
        ['John', 30, 'Extra Column'],
        ['Jane']
      ];

      const csvContent = convertWorksheetToCSV(worksheetData);

      expect(csvContent).toBe('Name,Age\nJohn,30,Extra Column\nJane');
    });
  });
});