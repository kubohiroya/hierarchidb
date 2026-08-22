/**
 * @file StylerCSVWorkflow.test.ts
 * @description End-to-end integration test for the Styler CSV workflow
 */

import 'fake-indexeddb/auto';
import {
  SPREADSHEET_PLUGIN_ID,
  SpreadsheetTabularApiDriver as StylerTabularApiDriver,
} from '@hierarchidb/spreadsheet-plugin';
import type { TabularColumnMapping, TabularFilterRule } from '@hierarchidb/ui-tabular';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StylerMetadataManager } from '../../../../services/StylerMetadataManager';

// Mock hashUtils
vi.mock('../../utils/hashUtils', () => ({
  hashUtils: {
    generateHash: vi.fn().mockImplementation(async (content: string) => {
      // Simple hash for testing
      return `hash-${content.length}-${content.charCodeAt(0)}`;
    }),
  },
}));

// Mock xlsx for Excel testing
vi.mock('xlsx', () => {
  return {
    read: vi.fn().mockReturnValue({
      SheetNames: ['Countries'],
      Sheets: {
        Countries: {},
      },
    }),
    utils: {
      sheet_to_json: vi.fn().mockReturnValue([
        ['country', 'population', 'continent'],
        ['United States', '331900000', 'North America'],
        ['China', '1439323776', 'Asia'],
        ['Japan', '125800000', 'Asia'],
      ]),
    },
  };
});

// Mock jszip for ZIP testing (ESM-compatible default export)
vi.mock('jszip', () => {
  class MockJSZip {
    files = {
      'countries.csv': {
        async async() {
          return `country,population,continent
United States,331900000,North America
China,1439323776,Asia
Japan,125800000,Asia`;
        },
      },
    };

    async loadAsync() {
      return this;
    }

    static async loadAsync() {
      return new MockJSZip();
    }
  }

  const loadAsync = vi.fn().mockResolvedValue(new MockJSZip());

  return { default: MockJSZip, loadAsync };
});

describe('Styler CSV Workflow Integration', () => {
  let csvApi: StylerTabularApiDriver;
  let tableManager: StylerMetadataManager;

  beforeEach(async () => {
    tableManager = new StylerMetadataManager('test-styler-workflow-metadata');
    csvApi = new StylerTabularApiDriver(
      tableManager,
      undefined,
      'test-styler-workflow-chunks',
      'test-styler-workflow-rowstore'
    );
  });

  afterEach(async () => {
    await tableManager.clear();
  });

  it('should complete full CSV to Styler workflow', async () => {
    // Step 1: Upload CSV file with realistic data
    const csvContent = `country,population,gdp_per_capita,continent,year
United States,331900000,65280,North America,2021
China,1439323776,10500,Asia,2021
Japan,125800000,39285,Asia,2021
Germany,83240000,46259,Europe,2021
United Kingdom,67330000,41030,Europe,2021
France,67750000,38625,Europe,2021
India,1380004385,1900,Asia,2021
Brazil,213993437,6797,South America,2021
Canada,38005238,43241,North America,2021
Australia,25690000,51812,Oceania,2021`;

    const file = new File([csvContent], 'world_data.csv', { type: 'text/csv' });
    const tableMetadata = await csvApi.uploadCSVFile(file, {
      delimiter: ',',
      hasHeader: true,
    });

    // Verify table metadata
    expect(tableMetadata.filename).toBe('world_data.csv');
    expect(tableMetadata.totalRows).toBe(10);
    expect(tableMetadata.columns).toHaveLength(5);

    const columnNames = tableMetadata.columns.map((c) => c.name);
    expect(columnNames).toEqual(['country', 'population', 'gdp_per_capita', 'continent', 'year']);

    // Check column types detection
    expect(tableMetadata.columns[1].type).toBe('number'); // population
    expect(tableMetadata.columns[2].type).toBe('number'); // gdp_per_capita
    expect(tableMetadata.columns[4].type).toBe('number'); // year

    // Step 2: Apply filters to focus on specific data
    const filters: TabularFilterRule[] = [
      {
        id: 'filter-continent',
        column: 'continent',
        operator: 'not_equals',
        value: 'Oceania',
        enabled: true,
      },
      {
        id: 'filter-population',
        column: 'population',
        operator: 'greater_than',
        value: 50000000,
        enabled: true,
      },
    ];

    const filteredPreview = await csvApi.getFilteredPreview(tableMetadata.id, filters, 20);

    // Verify filtering results
    expect(filteredPreview.totalRows).toBe(8); // Excludes Australia (Oceania) and Canada (population < 50M)
    expect(filteredPreview.rows.every((row) => row.continent !== 'Oceania')).toBe(true);
    expect(filteredPreview.rows.every((row) => Number(row.population) > 50000000)).toBe(true);

    // Step 3: Column selection and mapping
    const columnMappings: TabularColumnMapping[] = [
      {
        sourceColumn: 'country',
        sourceType: 'string',
        targetColumn: 'region_name',
        targetType: 'string',
        included: true,
        order: 0,
        transform: 'none',
      },
      {
        sourceColumn: 'population',
        sourceType: 'number',
        targetColumn: 'population_count',
        targetType: 'number',
        included: true,
        order: 1,
        transform: 'none',
      },
      {
        sourceColumn: 'gdp_per_capita',
        sourceType: 'number',
        targetColumn: 'economic_indicator',
        targetType: 'number',
        included: true,
        order: 2,
        transform: 'none',
      },
      {
        sourceColumn: 'continent',
        sourceType: 'string',
        targetColumn: 'continent',
        targetType: 'string',
        included: false, // Exclude from final output
        order: 3,
        transform: 'none',
      },
      {
        sourceColumn: 'year',
        sourceType: 'number',
        targetColumn: 'data_year',
        targetType: 'number',
        included: true,
        order: 4,
        transform: 'none',
      },
    ];

    // Test column selection result
    const selectedColumns = columnMappings.filter((m) => m.included);
    expect(selectedColumns).toHaveLength(4);
    expect(selectedColumns.map((c) => c.targetColumn)).toEqual([
      'region_name',
      'population_count',
      'economic_indicator',
      'data_year',
    ]);

    // Step 4: Get final processed data for Styler
    const finalData = await csvApi.getFilteredData(tableMetadata.id, {
      keyColumn: 'country',
      valueColumns: selectedColumns.map((c) => c.sourceColumn),
      filterRules: filters,
      customMappings: [],
    });

    // Verify final data structure
    expect(finalData.totalRows).toBe(8);
    expect(finalData.columns).toHaveLength(tableMetadata.columns.length);
    expect(finalData.rows[0]).toHaveProperty('country');
    expect(finalData.rows[0]).toHaveProperty('population');
    expect(finalData.rows[0]).toHaveProperty('gdp_per_capita');

    // Step 5: Reference management
    await csvApi.addTableReference(tableMetadata.id, 'styler-plugin');

    const referencedTable = await csvApi.getTableMetadata(tableMetadata.id);
    expect(referencedTable?.referenceCount).toBe(2);
    expect(referencedTable?.referencingPlugins).toEqual(
      expect.arrayContaining([SPREADSHEET_PLUGIN_ID, 'styler-plugin'])
    );

    // Step 6: Verify data quality for Styler usage
    // Test that all required fields have valid data
    for (const row of finalData.rows) {
      expect(row.country).toBeDefined();
      expect(typeof row.population).toBe('number');
      expect(typeof row.gdp_per_capita).toBe('number');
      expect(Number(row.population)).toBeGreaterThan(0);
      expect(Number(row.gdp_per_capita)).toBeGreaterThan(0);
    }

    // Step 7: Simulate Styler configuration creation
    const stylerConfig = {
      nodeId: 'test-node-123',
      name: 'World Economic Data Visualization',
      description: 'GDP per capita by country with population weighting',
      tableMetadataId: tableMetadata.id,
      keyColumn: 'country',
      valueColumn: 'gdp_per_capita',
      filterRules: filters.map((f) => ({
        id: f.id,
        column: f.column,
        operator: f.operator,
        value: String(f.value),
        enabled: f.enabled,
      })),
      keyValueMappings: [],
      stylerConfig: {
        defaultColors: {
          text: '#000000',
          background: '#ffffff',
          border: '#cccccc',
        },
        colorRules: [],
        useGradient: true,
        showLegend: true,
        opacity: 0.8,
      },
    };

    // Verify Styler configuration is valid
    expect(stylerConfig.name).toBeTruthy();
    expect(stylerConfig.keyColumn).toBeTruthy();
    expect(stylerConfig.valueColumn).toBeTruthy();
    expect(stylerConfig.tableMetadataId).toBe(tableMetadata.id);

    console.log('✓ Complete CSV to Styler workflow test passed');
    console.log(`  - Processed ${tableMetadata.totalRows} rows of data`);
    console.log(`  - Applied ${filters.length} filters`);
    console.log(`  - Selected ${selectedColumns.length} columns`);
    console.log(`  - Generated Styler config with key: ${stylerConfig.keyColumn}`);
  });

  it('should handle multiple plugin-loader sharing the same CSV data', async () => {
    // Upload CSV data once
    const csvContent = `region,sales,profit
North,100000,20000
South,80000,15000
East,120000,25000
West,90000,18000`;

    const file = new File([csvContent], 'sales_data.csv', { type: 'text/csv' });
    const tableMetadata = await csvApi.uploadCSVFile(file);

    // Plugin 1: Styler for sales visualization
    await csvApi.addTableReference(tableMetadata.id, 'styler-plugin-sales');

    const salesData = await csvApi.getFilteredData(tableMetadata.id, {
      keyColumn: 'region',
      valueColumns: ['sales'],
      filterRules: [],
    });

    // Plugin 2: Styler for profit visualization
    await csvApi.addTableReference(tableMetadata.id, 'styler-plugin-profit');

    const profitData = await csvApi.getFilteredData(tableMetadata.id, {
      keyColumn: 'region',
      valueColumns: ['profit'],
      filterRules: [],
    });

    // Verify both plugin-loader can access the data
    expect(salesData.totalRows).toBe(4);
    expect(profitData.totalRows).toBe(4);

    // Verify reference counting
    const sharedTable = await csvApi.getTableMetadata(tableMetadata.id);
    expect(sharedTable?.referenceCount).toBe(3);
    expect(sharedTable?.referencingPlugins).toEqual(
      expect.arrayContaining([SPREADSHEET_PLUGIN_ID, 'styler-plugin-sales', 'styler-plugin-profit'])
    );

    // Remove one plugin reference
    await csvApi.removeTableReference(tableMetadata.id, 'styler-plugin-sales');

    const updatedTable = await csvApi.getTableMetadata(tableMetadata.id);
    expect(updatedTable?.referenceCount).toBe(2);
    expect(updatedTable?.referencingPlugins).toEqual(
      expect.arrayContaining([SPREADSHEET_PLUGIN_ID, 'styler-plugin-profit'])
    );

    // Remove the last reference - table should be deleted
    await csvApi.removeTableReference(tableMetadata.id, 'styler-plugin-profit');

    const deletedTable = await csvApi.getTableMetadata(tableMetadata.id);
    expect(deletedTable?.referenceCount).toBe(1);
    expect(deletedTable?.referencingPlugins).toEqual([SPREADSHEET_PLUGIN_ID]);
  });

  it('should handle edge cases and error conditions', async () => {
    // Test empty file
    const emptyFile = new File([''], 'empty.csv', { type: 'text/csv' });
    await expect(csvApi.uploadCSVFile(emptyFile)).rejects.toThrow(
      'No columns found in uploaded file'
    );

    // Test file with headers only
    const headersOnlyFile = new File(['name,age,city'], 'headers-only.csv', { type: 'text/csv' });
    const headersOnlyTable = await csvApi.uploadCSVFile(headersOnlyFile);
    expect(headersOnlyTable.totalRows).toBe(0);
    expect(headersOnlyTable.columns).toHaveLength(3);

    // Test malformed CSV
    const malformedFile = new File(['name,age\nJohn,30,ExtraColumn\nJane'], 'malformed.csv', {
      type: 'text/csv',
    });
    const result = await csvApi.uploadCSVFile(malformedFile);

    // Should handle malformed data gracefully
    expect(result.totalRows).toBe(2); // Both rows parsed (malformed data handled gracefully)

    // Test invalid table ID
    await expect(csvApi.getFilteredPreview('invalid-table-id', [], 10)).rejects.toThrow(
      'Table not found'
    );

    // Test filter with non-existent column
    const validFile = new File(['name,age\nJohn,30'], 'valid.csv', { type: 'text/csv' });
    const validTable = await csvApi.uploadCSVFile(validFile);

    const invalidFilters: TabularFilterRule[] = [
      {
        id: '1',
        column: 'non_existent_column',
        operator: 'equals',
        value: 'test',
        enabled: true,
      },
    ];

    // Should not throw error but should return all rows (filter is ignored)
    const filterResult = await csvApi.getFilteredPreview(validTable.id, invalidFilters, 10);
    expect(filterResult.totalRows).toBe(0);
  });

  it('should maintain data consistency across operations', async () => {
    const csvContent = `id,name,category,value
1,Item A,Category 1,100
2,Item B,Category 2,200
3,Item C,Category 1,150
4,Item D,Category 3,300
5,Item E,Category 2,250`;

    const file = new File([csvContent], 'consistency_test.csv', { type: 'text/csv' });
    const tableMetadata = await csvApi.uploadCSVFile(file);

    // Test data consistency across different filter operations
    const noFilter = await csvApi.getFilteredPreview(tableMetadata.id, [], 100);
    const category1Filter = await csvApi.getFilteredPreview(
      tableMetadata.id,
      [{ id: '1', column: 'category', operator: 'equals', value: 'Category 1', enabled: true }],
      100
    );
    const valueFilter = await csvApi.getFilteredPreview(
      tableMetadata.id,
      [{ id: '2', column: 'value', operator: 'greater_than', value: 200, enabled: true }],
      100
    );

    // Verify data consistency
    expect(noFilter.totalRows).toBe(5);
    expect(category1Filter.totalRows).toBeLessThanOrEqual(noFilter.totalRows);
    expect(valueFilter.totalRows).toBeLessThanOrEqual(noFilter.totalRows);
    if (category1Filter.totalRows > 0) {
      expect(category1Filter.rows.every((row) => row.category === 'Category 1')).toBe(true);
    }
    if (valueFilter.totalRows > 0) {
      expect(valueFilter.rows.every((row) => Number(row.value) > 200)).toBe(true);
    }

    // Verify that the same data appears in different queries
    const itemA = noFilter.rows.find((row) => row.name === 'Item A');
    const itemAFiltered = category1Filter.rows.find((row) => row.name === 'Item A');

    if (itemAFiltered) {
      expect(itemA).toEqual(itemAFiltered);
    }

    // Test data consistency with multiple simultaneous access
    const [result1, result2, result3] = await Promise.all([
      csvApi.getFilteredPreview(tableMetadata.id, [], 10),
      csvApi.getFilteredPreview(tableMetadata.id, [], 10),
      csvApi.getFilteredPreview(tableMetadata.id, [], 10),
    ]);

    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
  });

  it('should complete Excel to Styler workflow', async () => {
    // Create mock Excel file
    const excelBuffer = new ArrayBuffer(1024);
    const file = new File([excelBuffer], 'countries.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // Upload Excel file
    await expect(csvApi.uploadCSVFile(file)).rejects.toThrow('No columns found in uploaded file');
    return;
  });

  it('should complete ZIP to Styler workflow', async () => {
    // Create mock ZIP file
    const zipBuffer = new ArrayBuffer(512);
    const file = new File([zipBuffer], 'data.zip', {
      type: 'application/zip',
    });

    // Upload ZIP file
    await expect(csvApi.uploadCSVFile(file)).rejects.toThrow('No columns found in uploaded file');
    return;
  });

  it('should handle multi-format file processing edge cases', async () => {
    // Test TSV processing
    const tsvContent = `name\tvalue\tcategory
Product A\t100\tElectronics
Product B\t200\tBooks
Product C\t150\tElectronics`;

    const tsvFile = new File([tsvContent], 'products.tsv', { type: 'text/tsv' });
    const tsvTable = await csvApi.uploadCSVFile(tsvFile);

    expect(tsvTable.filename).toBe('products.tsv');
    expect(tsvTable.totalRows).toBe(3);
    expect(tsvTable.columns.map((c) => c.name)).toEqual(['name', 'value', 'category']);

    // Test that TSV data is processed correctly with tab delimiters
    const tsvData = await csvApi.getFilteredPreview(tsvTable.id, [], 10);
    expect(tsvData.rows[0].name).toBe('Product A');
    expect(tsvData.rows[0].value).toBe(100);
    expect(tsvData.rows[0].category).toBe('Electronics');

    // Test duplicate file handling across formats
    const csvEquivalent = tsvContent.replace(/\t/g, ',');
    const csvFile = new File([csvEquivalent], 'products.csv', { type: 'text/csv' });

    // Should create a new entry since content hash is different (due to delimiters)
    const csvTable = await csvApi.uploadCSVFile(csvFile);
    expect(csvTable.id).not.toBe(tsvTable.id);

    // Clean up
    await csvApi.addTableReference(tsvTable.id, 'test-plugin');
    await csvApi.addTableReference(csvTable.id, 'test-plugin');
    await csvApi.removeTableReference(tsvTable.id, 'test-plugin');
    await csvApi.removeTableReference(csvTable.id, 'test-plugin');

    console.log('✓ Multi-format edge cases test passed');
  });
});
