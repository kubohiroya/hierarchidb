/**
 * @file StyleMapCSVWorkflow.test.ts
 * @description End-to-end integration test for the StyleMap CSV workflow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StyleMapCSVApiDriver } from '../../services/StyleMapCSVApiDriver';
import { SimpleTableMetadataManager } from '../../services/SimpleTableMetadataManager';
import type { CSVFilterRule, CSVColumnMapping } from '@hierarchidb/11-ui-csv-extract';

// Mock hashUtils
vi.mock('../../utils/hashUtils', () => ({
  hashUtils: {
    generateHash: vi.fn().mockImplementation(async (content: string) => {
      // Simple hash for testing
      return `hash-${content.length}-${content.charCodeAt(0)}`;
    }),
  },
}));

describe('StyleMap CSV Workflow Integration', () => {
  let csvApi: StyleMapCSVApiDriver;
  let tableManager: SimpleTableMetadataManager;

  beforeEach(async () => {
    tableManager = new SimpleTableMetadataManager();
    csvApi = new StyleMapCSVApiDriver(tableManager);
  });

  afterEach(async () => {
    await tableManager.clear();
  });

  it('should complete full CSV to StyleMap workflow', async () => {
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
    
    const columnNames = tableMetadata.columns.map(c => c.name);
    expect(columnNames).toEqual(['country', 'population', 'gdp_per_capita', 'continent', 'year']);
    
    // Check column types detection
    expect(tableMetadata.columns[1].type).toBe('number'); // population
    expect(tableMetadata.columns[2].type).toBe('number'); // gdp_per_capita
    expect(tableMetadata.columns[4].type).toBe('number'); // year

    // Step 2: Apply filters to focus on specific data
    const filters: CSVFilterRule[] = [
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
    expect(filteredPreview.totalRows).toBe(7); // Excludes Australia (Oceania) and Canada, UK (population < 50M)
    expect(filteredPreview.rows.every(row => row.continent !== 'Oceania')).toBe(true);
    expect(filteredPreview.rows.every(row => Number(row.population) > 50000000)).toBe(true);

    // Step 3: Column selection and mapping
    const columnMappings: CSVColumnMapping[] = [
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
    const selectedColumns = columnMappings.filter(m => m.included);
    expect(selectedColumns).toHaveLength(4);
    expect(selectedColumns.map(c => c.targetColumn)).toEqual([
      'region_name',
      'population_count',
      'economic_indicator',
      'data_year',
    ]);

    // Step 4: Get final processed data for StyleMap
    const finalData = await csvApi.getFilteredData(tableMetadata.id, {
      keyColumn: 'country',
      valueColumns: selectedColumns.map(c => c.sourceColumn),
      filterRules: filters,
      customMappings: [],
    });

    // Verify final data structure
    expect(finalData.totalRows).toBe(7);
    expect(finalData.columns).toHaveLength(4); // Only selected columns
    expect(finalData.rows[0]).toHaveProperty('country');
    expect(finalData.rows[0]).toHaveProperty('population');
    expect(finalData.rows[0]).toHaveProperty('gdp_per_capita');

    // Step 5: Reference management
    await csvApi.addTableReference(tableMetadata.id, 'stylemap-plugin');

    const referencedTable = await csvApi.getTableMetadata(tableMetadata.id);
    expect(referencedTable?.referenceCount).toBe(1);
    expect(referencedTable?.referencingPlugins).toContain('stylemap-plugin');

    // Step 6: Verify data quality for StyleMap usage
    // Test that all required fields have valid data
    for (const row of finalData.rows) {
      expect(row.country).toBeDefined();
      expect(typeof row.population).toBe('number');
      expect(typeof row.gdp_per_capita).toBe('number');
      expect(Number(row.population)).toBeGreaterThan(0);
      expect(Number(row.gdp_per_capita)).toBeGreaterThan(0);
    }

    // Step 7: Simulate StyleMap configuration creation
    const styleMapConfig = {
      nodeId: 'test-node-123',
      name: 'World Economic Data Visualization',
      description: 'GDP per capita by country with population weighting',
      tableMetadataId: tableMetadata.id,
      selectedKeyColumn: 'country',
      selectedValueColumns: ['population', 'gdp_per_capita'],
      filterRules: filters.map(f => ({
        id: f.id,
        column: f.column,
        operator: f.operator as any,
        value: String(f.value),
        enabled: f.enabled,
      })),
      keyValueMappings: [],
      styleMapConfig: {
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

    // Verify StyleMap configuration is valid
    expect(styleMapConfig.name).toBeTruthy();
    expect(styleMapConfig.selectedKeyColumn).toBeTruthy();
    expect(styleMapConfig.selectedValueColumns.length).toBeGreaterThan(0);
    expect(styleMapConfig.tableMetadataId).toBe(tableMetadata.id);

    console.log('✓ Complete CSV to StyleMap workflow test passed');
    console.log(`  - Processed ${tableMetadata.totalRows} rows of data`);
    console.log(`  - Applied ${filters.length} filters`);
    console.log(`  - Selected ${selectedColumns.length} columns`);
    console.log(`  - Generated StyleMap config with key: ${styleMapConfig.selectedKeyColumn}`);
  });

  it('should handle multiple plugins sharing the same CSV data', async () => {
    // Upload CSV data once
    const csvContent = `region,sales,profit
North,100000,20000
South,80000,15000
East,120000,25000
West,90000,18000`;

    const file = new File([csvContent], 'sales_data.csv', { type: 'text/csv' });
    const tableMetadata = await csvApi.uploadCSVFile(file);

    // Plugin 1: StyleMap for sales visualization
    await csvApi.addTableReference(tableMetadata.id, 'stylemap-sales');
    
    const salesData = await csvApi.getFilteredData(tableMetadata.id, {
      keyColumn: 'region',
      valueColumns: ['sales'],
      filterRules: [],
    });

    // Plugin 2: StyleMap for profit visualization
    await csvApi.addTableReference(tableMetadata.id, 'stylemap-profit');
    
    const profitData = await csvApi.getFilteredData(tableMetadata.id, {
      keyColumn: 'region',
      valueColumns: ['profit'],
      filterRules: [],
    });

    // Verify both plugins can access the data
    expect(salesData.totalRows).toBe(4);
    expect(profitData.totalRows).toBe(4);

    // Verify reference counting
    const sharedTable = await csvApi.getTableMetadata(tableMetadata.id);
    expect(sharedTable?.referenceCount).toBe(2);
    expect(sharedTable?.referencingPlugins).toContain('stylemap-sales');
    expect(sharedTable?.referencingPlugins).toContain('stylemap-profit');

    // Remove one plugin reference
    await csvApi.removeTableReference(tableMetadata.id, 'stylemap-sales');

    const updatedTable = await csvApi.getTableMetadata(tableMetadata.id);
    expect(updatedTable?.referenceCount).toBe(1);
    expect(updatedTable?.referencingPlugins).toEqual(['stylemap-profit']);

    // Remove the last reference - table should be deleted
    await csvApi.removeTableReference(tableMetadata.id, 'stylemap-profit');

    const deletedTable = await csvApi.getTableMetadata(tableMetadata.id);
    expect(deletedTable).toBeNull();
  });

  it('should handle edge cases and error conditions', async () => {
    // Test empty file
    const emptyFile = new File([''], 'empty.csv', { type: 'text/csv' });
    await expect(csvApi.uploadCSVFile(emptyFile)).rejects.toThrow('No columns found');

    // Test file with headers only
    const headersOnlyFile = new File(['name,age,city'], 'headers-only.csv', { type: 'text/csv' });
    await expect(csvApi.uploadCSVFile(headersOnlyFile)).rejects.toThrow('No data rows found');

    // Test malformed CSV
    const malformedFile = new File(['name,age\nJohn,30,ExtraColumn\nJane'], 'malformed.csv', { type: 'text/csv' });
    const result = await csvApi.uploadCSVFile(malformedFile);
    
    // Should handle malformed data gracefully
    expect(result.totalRows).toBe(1); // Only properly formatted row

    // Test invalid table ID
    await expect(
      csvApi.getFilteredPreview('invalid-table-id', [], 10)
    ).rejects.toThrow('Table not found');

    // Test filter with non-existent column
    const validFile = new File(['name,age\nJohn,30'], 'valid.csv', { type: 'text/csv' });
    const validTable = await csvApi.uploadCSVFile(validFile);
    
    const invalidFilters: CSVFilterRule[] = [
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
    expect(filterResult.totalRows).toBe(1);
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
    const category1Filter = await csvApi.getFilteredPreview(tableMetadata.id, [
      { id: '1', column: 'category', operator: 'equals', value: 'Category 1', enabled: true }
    ], 100);
    const valueFilter = await csvApi.getFilteredPreview(tableMetadata.id, [
      { id: '2', column: 'value', operator: 'greater_than', value: 200, enabled: true }
    ], 100);

    // Verify data consistency
    expect(noFilter.totalRows).toBe(5);
    expect(category1Filter.totalRows).toBe(2); // Items A and C
    expect(valueFilter.totalRows).toBe(2); // Items D and E

    // Verify that the same data appears in different queries
    const itemA = noFilter.rows.find(row => row.name === 'Item A');
    const itemAFiltered = category1Filter.rows.find(row => row.name === 'Item A');
    
    expect(itemA).toEqual(itemAFiltered);

    // Test data consistency with multiple simultaneous access
    const [result1, result2, result3] = await Promise.all([
      csvApi.getFilteredPreview(tableMetadata.id, [], 10),
      csvApi.getFilteredPreview(tableMetadata.id, [], 10),
      csvApi.getFilteredPreview(tableMetadata.id, [], 10),
    ]);

    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
  });
});