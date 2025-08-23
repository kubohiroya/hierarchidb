/**
 * @file StyleMapCSVApiDriver.test.ts
 * @description Integration tests for StyleMapCSVApiDriver
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StyleMapCSVApiDriver } from '../services/StyleMapCSVApiDriver';
import { SimpleTableMetadataManager } from '../services/SimpleTableMetadataManager';
import type { CSVProcessingConfig, CSVFilterRule } from '@hierarchidb/11-ui-csv-extract';

// Mock hashUtils
vi.mock('../utils/hashUtils', () => ({
  hashUtils: {
    generateHash: vi.fn().mockResolvedValue('mock-hash-123'),
  },
}));

describe('StyleMapCSVApiDriver', () => {
  let csvApi: StyleMapCSVApiDriver;
  let tableManager: SimpleTableMetadataManager;

  beforeEach(async () => {
    tableManager = new SimpleTableMetadataManager();
    csvApi = new StyleMapCSVApiDriver(tableManager);
  });

  afterEach(async () => {
    await tableManager.clear();
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
      // Mock fetch
      const csvContent = `name,age
John,30
Jane,25`;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(csvContent),
      });

      const result = await csvApi.downloadCSVFromUrl('https://example.com/data.csv');

      expect(result.filename).toBe('data.csv');
      expect(result.fileUrl).toBe('https://example.com/data.csv');
      expect(result.totalRows).toBe(2);
    });

    it('should handle download errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        csvApi.downloadCSVFromUrl('https://example.com/missing.csv')
      ).rejects.toThrow('Failed to download: 404 Not Found');
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
      expect(result.tables.every(t => t.referencingPlugins.includes('plugin1'))).toBe(true);
    });

    it('should support pagination', async () => {
      const result = await csvApi.listTables(undefined, { offset: 1, limit: 2 });

      expect(result.total).toBe(2); // After offset
      expect(result.tables).toHaveLength(2);
    });
  });
});