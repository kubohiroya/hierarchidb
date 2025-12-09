/**
 * @file SpreadsheetTabularApiDriver.test.ts
 * @description Integration tests for SpreadsheetTabularApiDriver
 */

import 'fake-indexeddb/auto';
import { SpreadsheetTabularApiDriver } from '@hierarchidb/spreadsheet-plugin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StylerMetadataManager } from '../../../services/StylerMetadataManager.js';

const originalFetch = global.fetch;

// Mock hashUtils with deterministic hashes based on content
vi.mock('../../utils/hashUtils', () => ({
  hashUtils: {
    generateHash: vi.fn().mockImplementation((content: string) => {
      // Generate a deterministic hash based on content
      // Same content will always get the same hash, different content gets different hashes
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Promise.resolve(`mock-hash-${Math.abs(hash)}`);
    }),
  },
}));

describe('SpreadsheetTabularApiDriver', () => {
  let csvApi: SpreadsheetTabularApiDriver;
  let tableManager: StylerMetadataManager;

  beforeEach(async () => {
    tableManager = new StylerMetadataManager();
    csvApi = new SpreadsheetTabularApiDriver(tableManager);
  });

  afterEach(async () => {
    await tableManager.clear();
    global.fetch = originalFetch;
  });

  describe('uploadCSVFile', () => {
    it('should parse and store CSV file successfully', async () => {
      const csvContent = `name,age,city
John,30,New York
Jane,25,Los Angeles
Bob,35,Chicago`;

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const config: CSVProcessingConfig = {
        delimiter: ',',
        hasHeader: true,
      };

      const result = await csvApi.uploadCSVFile(file, config);

      expect(result).toMatchObject({
        filename: 'test.csv',
        totalRows: 3,
        fileSizeBytes: file.size,
        referenceCount: 0,
        referencingPlugins: [],
      });

      expect(result.columns).toHaveLength(3);
      expect(result.columns[0].name).toBe('name');
      expect(result.columns[1].name).toBe('age');
      expect(result.columns[2].name).toBe('city');
    });

    it('should handle TSV files with tab delimiter', async () => {
      const tsvContent = `name\tage\tcity
John\t30\tNew York
Jane\t25\tLos Angeles`;

      const file = new File([tsvContent], 'test.tsv', { type: 'text/tab-separated-values' });

      const result = await csvApi.uploadCSVFile(file);

      expect(result.totalRows).toBe(2);
      expect(result.columns).toHaveLength(3);
    });

    it('should detect column types correctly', async () => {
      const csvContent = `name,age,is_active,created_date
John,30,true,2023-01-15
Jane,25,false,2023-02-20`;

      const file = new File([csvContent], 'types.csv', { type: 'text/csv' });

      const result = await csvApi.uploadCSVFile(file);

      expect(result.columns[0].type).toBe('string'); // name
      expect(result.columns[1].type).toBe('number'); // age
      // Note: boolean and date detection depends on implementation
    });

    it('should throw error for empty CSV', async () => {
      const file = new File([''], 'empty.csv', { type: 'text/csv' });

      await expect(csvApi.uploadCSVFile(file)).rejects.toThrow('No columns found');
    });

    it('should deduplicate identical files', async () => {
      const csvContent = `name,age
John,30
Jane,25`;

      const file1 = new File([csvContent], 'test1.csv', { type: 'text/csv' });
      const file2 = new File([csvContent], 'test2.csv', { type: 'text/csv' });

      const result1 = await csvApi.uploadCSVFile(file1);
      const result2 = await csvApi.uploadCSVFile(file2);

      // Should return the same table metadata for identical content
      expect(result1.id).toBe(result2.id);
      expect(result1.contentHash).toBe(result2.contentHash);
    });
  });

  describe('getFilteredPreview', () => {
    let tableId: string;

    beforeEach(async () => {
      const csvContent = `name,age,city,salary
John,30,New York,75000
Jane,25,Los Angeles,65000
Bob,35,Chicago,85000
Alice,28,New York,70000
Charlie,32,Boston,80000`;

      const file = new File([csvContent], 'employees.csv', { type: 'text/csv' });
      const result = await csvApi.uploadCSVFile(file);
      tableId = result.id;
    });

    it('should return unfiltered data when no filters applied', async () => {
      const result = await csvApi.getFilteredPreview(tableId, [], 10);

      expect(result.totalRows).toBe(5);
      expect(result.rows).toHaveLength(5);
      expect(result.columns).toHaveLength(4);
    });

    it('should filter data by equals condition', async () => {
      const filters: CSVFilterRule[] = [
        {
          id: '1',
          column: 'city',
          operator: 'equals',
          value: 'New York',
          enabled: true,
        },
      ];

      const result = await csvApi.getFilteredPreview(tableId, filters, 10);

      expect(result.totalRows).toBe(2); // John and Alice
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].city).toBe('New York');
      expect(result.rows[1].city).toBe('New York');
    });

    it('should filter data by contains condition', async () => {
      const filters: CSVFilterRule[] = [
        {
          id: '1',
          column: 'name',
          operator: 'contains',
          value: 'a',
          enabled: true,
        },
      ];

      const result = await csvApi.getFilteredPreview(tableId, filters, 10);

      expect(result.totalRows).toBe(3); // Jane, Alice, Charlie
      expect(result.rows).toHaveLength(3);
    });

    it('should apply multiple filters with AND logic', async () => {
      const filters: CSVFilterRule[] = [
        {
          id: '1',
          column: 'city',
          operator: 'equals',
          value: 'New York',
          enabled: true,
        },
        {
          id: '2',
          column: 'age',
          operator: 'greater_than',
          value: 25,
          enabled: true,
        },
      ];

      const result = await csvApi.getFilteredPreview(tableId, filters, 10);

      expect(result.totalRows).toBe(2); // John (30) and Alice (28)
    });

    it('should ignore disabled filters', async () => {
      const filters: CSVFilterRule[] = [
        {
          id: '1',
          column: 'city',
          operator: 'equals',
          value: 'New York',
          enabled: false, // Disabled
        },
      ];

      const result = await csvApi.getFilteredPreview(tableId, filters, 10);

      expect(result.totalRows).toBe(5); // All rows
    });

    it('should limit results to requested row count', async () => {
      const result = await csvApi.getFilteredPreview(tableId, [], 3);

      expect(result.totalRows).toBe(5); // Total available
      expect(result.rows).toHaveLength(3); // Limited to 3
    });
  });

  describe('reference management', () => {
    let tableId: string;

    beforeEach(async () => {
      const csvContent = `name,value
A,1
B,2`;

      const file = new File([csvContent], 'ref-test.csv', { type: 'text/csv' });
      const result = await csvApi.uploadCSVFile(file);
      tableId = result.id;
    });

    it('should add and remove table references', async () => {
      // Add references
      await csvApi.addTableReference(tableId, 'plugin1');
      await csvApi.addTableReference(tableId, 'plugin2');

      let table = await csvApi.getTableMetadata(tableId);
      expect(table?.referenceCount).toBe(2);
      expect(table?.referencingPlugins).toContain('plugin1');
      expect(table?.referencingPlugins).toContain('plugin2');

      // Remove one reference
      await csvApi.removeTableReference(tableId, 'plugin1');

      table = await csvApi.getTableMetadata(tableId);
      expect(table?.referenceCount).toBe(1);
      expect(table?.referencingPlugins).toContain('plugin2');
      expect(table?.referencingPlugins).not.toContain('plugin1');
    });

    it('should auto-delete table when all references removed', async () => {
      await csvApi.addTableReference(tableId, 'plugin1');

      // Remove the only reference
      await csvApi.removeTableReference(tableId, 'plugin1');

      // Table should be auto-deleted
      const table = await csvApi.getTableMetadata(tableId);
      expect(table).toBeNull();
    });

    it('should not add duplicate references', async () => {
      await csvApi.addTableReference(tableId, 'plugin1');
      await csvApi.addTableReference(tableId, 'plugin1'); // Duplicate

      const table = await csvApi.getTableMetadata(tableId);
      expect(table?.referenceCount).toBe(1);
      expect(table?.referencingPlugins).toEqual(['plugin1']);
    });
  });

  describe('downloadCSVFromUrl', () => {
    it('should download and process CSV from URL', async () => {
      const csvContent = `name,age
John,30
Jane,25`;

      const encoder = new TextEncoder();
      const buffer = encoder.encode(csvContent).buffer;

      global.fetch = vi.fn().mockImplementation((_input, init?: RequestInit) => {
        if (init?.method === 'HEAD') {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ 'content-type': 'text/csv' }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => buffer,
          headers: new Headers({ 'content-type': 'text/csv' }),
        } as Response);
      });

      const result = await csvApi.downloadCSVFromUrl('https://example.com/data.csv');

      expect(result.filename).toBe('data.csv');
      expect(result.totalRows).toBe(2);
    });

    it('should handle download errors', async () => {
      const encoder = new TextEncoder();
      const buffer = encoder.encode('').buffer;

      global.fetch = vi.fn().mockImplementation((_input, init?: RequestInit) => {
        if (init?.method === 'HEAD') {
          return Promise.resolve({ ok: true, headers: new Headers() } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          arrayBuffer: async () => buffer,
        } as Response);
      });

      await expect(csvApi.downloadCSVFromUrl('https://example.com/missing.csv')).rejects.toThrow(
        'CSV download failed: HTTP 404'
      );
    });
  });

  describe('listTables', () => {
    beforeEach(async () => {
      // Create multiple test tables
      const tables = [
        { content: 'name,age\nJohn,30', filename: 'table1.csv', plugin: 'plugin1' },
        { content: 'city,population\nNY,8000000', filename: 'table2.csv', plugin: 'plugin2' },
        { content: 'product,price\nLaptop,1000', filename: 'table3.csv', plugin: 'plugin1' },
      ];

      for (const { content, filename, plugin } of tables) {
        const file = new File([content], filename, { type: 'text/csv' });
        const result = await csvApi.uploadCSVFile(file);
        await csvApi.addTableReference(result.id, plugin);
      }
    });

    it('should list all tables', async () => {
      const result = await csvApi.listTables();

      expect(result.total).toBe(3);
      expect(result.tables).toHaveLength(3);
    });

    it('should filter tables by plugin', async () => {
      const result = await csvApi.listTables('plugin1');

      expect(result.total).toBe(2); // table1.csv and table3.csv
      expect(result.tables).toHaveLength(2);
      expect(result.tables.every((t) => t.referencingPlugins.includes('plugin1'))).toBe(true);
    });

    it('should support pagination', async () => {
      const result = await csvApi.listTables(undefined, { offset: 1, limit: 2 });

      expect(result.total).toBe(2); // After offset
      expect(result.tables).toHaveLength(2);
    });
  });

  // Additional boundary value and error handling test cases
  describe('boundary value tests', () => {
    it('should handle large CSV files (10MB limit)', async () => {
      // Create a large CSV content (close to 10MB)
      const largeRows: string[] = ['name,age,description'];
      const rowContent =
        'John Doe Smith Johnson,30,A very long description with many words that takes up significant space in the CSV file to test large file handling capabilities';

      // Generate enough rows to approach 10MB
      for (let i = 0; i < 50000; i++) {
        largeRows.push(`${rowContent}_${i},${30 + (i % 50)},${rowContent}_description_${i}`);
      }

      const csvContent = largeRows.join('\n');
      const file = new File([csvContent], 'large.csv', { type: 'text/csv' });

      // Should succeed for files under 10MB
      if (file.size < 10 * 1024 * 1024) {
        const result = await csvApi.uploadCSVFile(file);
        expect(result.totalRows).toBe(50000);
        expect(result.fileSizeBytes).toBe(file.size);
      } else {
        // Should fail for files over 10MB
        await expect(csvApi.uploadCSVFile(file)).rejects.toThrow('File size exceeds 10MB limit');
      }
    });

    it('should handle CSV with maximum columns (1000)', async () => {
      // Create CSV with many columns
      const columnNames = Array.from({ length: 1000 }, (_, i) => `col_${i}`);
      const columnValues = Array.from({ length: 1000 }, (_, i) => `value_${i}`);

      const csvContent = `${columnNames.join(',')}
${columnValues.join(',')}`;
      const file = new File([csvContent], 'wide.csv', { type: 'text/csv' });

      const result = await csvApi.uploadCSVFile(file);
      expect(result.columns).toHaveLength(1000);
      expect(result.totalRows).toBe(1);
    });

    it('should handle CSV with 100,000 rows', async () => {
      const rows: string[] = ['id,name,value'];

      // Generate 100,000 rows
      for (let i = 1; i <= 100000; i++) {
        rows.push(`${i},name_${i},${i * 10}`);
      }

      const csvContent = rows.join('\n');
      const file = new File([csvContent], 'long.csv', { type: 'text/csv' });

      const result = await csvApi.uploadCSVFile(file);
      expect(result.totalRows).toBe(100000);
    });

    it('should handle extreme numeric values', async () => {
      const csvContent = `name,min_value,max_value,large_decimal
Test,${Number.MIN_SAFE_INTEGER},${Number.MAX_SAFE_INTEGER},${Number.MAX_VALUE}`;

      const file = new File([csvContent], 'extreme.csv', { type: 'text/csv' });

      const result = await csvApi.uploadCSVFile(file);
      expect(result.columns[1].type).toBe('number');
      expect(result.columns[2].type).toBe('number');
      expect(result.columns[3].type).toBe('number');
    });

    it('should handle null and empty values correctly', async () => {
      const csvContent = `name,age,city,notes
John,30,New York,
Jane,,Los Angeles,Some notes
,25,Chicago,
Bob,35,,No notes`;

      const file = new File([csvContent], 'nulls.csv', { type: 'text/csv' });

      const result = await csvApi.uploadCSVFile(file);
      expect(result.totalRows).toBe(4);

      const preview = await csvApi.getFilteredPreview(result.id, [], 10);
      expect(preview.rows[0].notes).toBe('');
      expect(preview.rows[1].age).toBe('');
      expect(preview.rows[2].name).toBe('');
    });

    it('should handle unicode and special characters', async () => {
      const csvContent = `名前,年齢,都市,説明
田中太郎,30,東京,「こんにちは」と言った
山田花子,25,大阪,émoji: 🎉 test
Smith,35,New York,"Contains ""quotes"" and commas, semicolons;"`;

      const file = new File([csvContent], 'unicode.csv', { type: 'text/csv' });

      const result = await csvApi.uploadCSVFile(file);
      expect(result.totalRows).toBe(3);
      expect(result.columns[0].name).toBe('名前');
      expect(result.columns[3].name).toBe('説明');
    });
  });

  describe('additional error handling tests', () => {
    it('should handle network timeout for URL downloads', async () => {
      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Network timeout')), 100);
          })
      );

      await expect(csvApi.downloadCSVFromUrl('https://slow-server.com/data.csv')).rejects.toThrow(
        'Network timeout'
      );
    });

    it('should handle invalid table ID in getFilteredPreview', async () => {
      const invalidTableId = 'non-existent-table-id';

      await expect(csvApi.getFilteredPreview(invalidTableId, [], 10)).rejects.toThrow(
        'Table not found'
      );
    });

    it('should handle invalid table ID in reference management', async () => {
      const invalidTableId = 'non-existent-table-id';

      await expect(csvApi.addTableReference(invalidTableId, 'plugin1')).rejects.toThrow(
        'Table not found'
      );

      await expect(csvApi.removeTableReference(invalidTableId, 'plugin1')).rejects.toThrow(
        'Table not found'
      );
    });

    it('should handle corrupted CSV content', async () => {
      const corruptedContent = 'name,age\nJohn,30\nJane"broken"quote,25,extra,columns\n';
      const file = new File([corruptedContent], 'corrupted.csv', { type: 'text/csv' });

      // Should either handle gracefully or throw appropriate error
      try {
        const result = await csvApi.uploadCSVFile(file);
        // If it doesn't throw, it should still parse some data
        expect(result.totalRows).toBeGreaterThan(0);
      } catch (error) {
        expect(error.message).toContain('CSV parsing error');
      }
    });

    it('should handle binary file uploaded as CSV', async () => {
      // Create binary content that's not CSV
      const binaryData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); // JPEG header
      const file = new File([binaryData], 'image.csv', { type: 'text/csv' });

      await expect(csvApi.uploadCSVFile(file)).rejects.toThrow('Invalid CSV format');
    });

    it('should handle very long cell content', async () => {
      const longText = 'a'.repeat(100000); // 100KB in a single cell
      const csvContent = `name,description
John,"${longText}"`;

      const file = new File([csvContent], 'long-cell.csv', { type: 'text/csv' });

      const result = await csvApi.uploadCSVFile(file);
      expect(result.totalRows).toBe(1);

      const preview = await csvApi.getFilteredPreview(result.id, [], 1);
      expect(preview.rows[0].description).toBe(longText);
    });

    it('should handle malformed filter rules gracefully', async () => {
      const csvContent = 'name,age\nJohn,30\nJane,25';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const result = await csvApi.uploadCSVFile(file);

      const malformedFilters: CSVFilterRule[] = [
        {
          id: '1',
          column: 'non_existent_column',
          operator: 'equals',
          value: 'test',
          enabled: true,
        },
        {
          id: '2',
          column: 'age',
          operator: 'invalid_operator' as CSVFilterRule['operator'],
          value: 'not_a_number',
          enabled: true,
        },
      ];

      // Should handle gracefully without crashing
      const preview = await csvApi.getFilteredPreview(result.id, malformedFilters, 10);
      expect(preview.rows).toBeDefined();
    });

    it('should handle memory pressure with large filtered results', async () => {
      // Create a large dataset
      const rows: string[] = ['id,category,value'];
      for (let i = 0; i < 50000; i++) {
        rows.push(`${i},category_${i % 10},${Math.random() * 1000}`);
      }

      const csvContent = rows.join('\n');
      const file = new File([csvContent], 'large-filter.csv', { type: 'text/csv' });
      const result = await csvApi.uploadCSVFile(file);

      // Filter that matches many rows
      const filters: CSVFilterRule[] = [
        {
          id: '1',
          column: 'category',
          operator: 'contains',
          value: 'category_',
          enabled: true,
        },
      ];

      // Should handle large result sets efficiently
      const preview = await csvApi.getFilteredPreview(result.id, filters, 1000);
      expect(preview.rows).toBeDefined();
      expect(preview.rows.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('concurrent access tests', () => {
    it('should handle concurrent CSV uploads', async () => {
      const csvContent1 = 'name,age\nJohn,30';
      const csvContent2 = 'city,population\nNY,8000000';
      const csvContent3 = 'product,price\nLaptop,1000';

      const files = [
        new File([csvContent1], 'test1.csv', { type: 'text/csv' }),
        new File([csvContent2], 'test2.csv', { type: 'text/csv' }),
        new File([csvContent3], 'test3.csv', { type: 'text/csv' }),
      ];

      // Upload concurrently
      const promises = files.map((file) => csvApi.uploadCSVFile(file));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.id).toBeDefined();
        expect(result.totalRows).toBeGreaterThan(0);
      });
    });

    it('should handle concurrent reference operations', async () => {
      const csvContent = 'name,value\nA,1\nB,2';
      const file = new File([csvContent], 'concurrent.csv', { type: 'text/csv' });
      const result = await csvApi.uploadCSVFile(file);

      // Add references concurrently
      const addPromises = [
        csvApi.addTableReference(result.id, 'plugin1'),
        csvApi.addTableReference(result.id, 'plugin2'),
        csvApi.addTableReference(result.id, 'plugin3'),
      ];

      await Promise.all(addPromises);

      const table = await csvApi.getTableMetadata(result.id);
      expect(table?.referenceCount).toBe(3);
      expect(table?.referencingPlugins).toHaveLength(3);
    });
  });
});
