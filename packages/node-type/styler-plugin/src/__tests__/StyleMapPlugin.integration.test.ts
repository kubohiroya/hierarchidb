/**
  * @file StylerPlugin.integration.test.ts
 * @description Styler plugin integration tests
 * : Styler
 * : Spreadsheet
 * :
  */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';
import { StylerExtension } from '../extension/definition';
import { StylerEntityHandler } from '../handlers/StylerEntityHandler';
import { StylerDataService } from '../services/StylerDataService';
import type { StylerEntity } from '../entities/StylerEntity';
import { StylerConfigDefault } from '../types/stylerTypes';

// Mock dependencies
const mockSpreadsheetHandler = {
  createEntity: vi.fn(),
  getEntity: vi.fn(),
  updateEntity: vi.fn(),
  deleteEntity: vi.fn(),
};

const mockCSVApiDriver = {
  uploadCSVFile: vi.fn(),
  downloadCSVFromUrl: vi.fn(),
  getFilteredPreview: vi.fn(),
  listTables: vi.fn(),
  addTableReference: vi.fn(),
  removeTableReference: vi.fn(),
};

describe('Styler Plugin Integration', () => {
  let dataService: StylerDataService;
  let entityHandler: StylerEntityHandler;
  const testNodeId = 'test-node-123' as NodeId;

  beforeEach(() => {
    vi.clearAllMocks();
    dataService = new StylerDataService(mockCSVApiDriver);
    entityHandler = new StylerEntityHandler(mockSpreadsheetHandler as any, dataService);
  });

  describe('Plugin Extension Definition', () => {
    it('should have correct extension structure', () => {
      expect(StylerExtension.extends).toBe('spreadsheet');
      expect(StylerExtension.nodeType).toBe('styler');
      expect(StylerExtension.name).toBe('Styler');
      expect(StylerExtension.displayName).toBe('スタイルマップ');
    });

    it('should define extended steps correctly', () => {
      expect(StylerExtension.extendedSteps).toHaveLength(2);

      const step5 = StylerExtension.extendedSteps![0];
      const step6 = StylerExtension.extendedSteps![1];

      expect(step5.stepNumber).toBe(5);
      expect(step5.title).toBe('Style Mapping Configuration');
      expect(step5.component).toBeDefined();
      expect(step5.validation).toBeDefined();

      expect(step6.stepNumber).toBe(6);
      expect(step6.title).toBe('Preview with Style Mapping');
      expect(step6.component).toBeDefined();
      expect(step6.validation).toBeDefined();
    });

    it('should define extended fields correctly', () => {
      expect(StylerExtension.extendedFields).toHaveLength(4);

      const fields = StylerExtension.extendedFields!;
      const fieldNames = fields.map(f => f.name);

      expect(fieldNames).toContain('stylerConfig');
      expect(fieldNames).toContain('selectedKeyColumn');
      expect(fieldNames).toContain('selectedValueColumn');
      expect(fieldNames).toContain('generatedStyle');
    });

    it('should have proper validation rules', () => {
      const validation = StylerExtension.extendedValidation!;
      expect(validation.extendedRules).toBeDefined();
      expect(validation.extendedRules!.styleConfigRule).toBeDefined();
      expect(validation.extendedRules!.valueColumnRule).toBeDefined();
      expect(validation.extendedRules!.mappingRangeRule).toBeDefined();
    });
  });

  describe('Entity Handler Integration', () => {
    const mockSpreadsheetEntity = {
      id: 'entity-123',
      nodeId: testNodeId,
      name: 'Test Spreadsheet',
      description: 'Test description',
      dataSource: { type: 'file' as const, source: 'test.csv' },
      spreadsheetMetadataId: 'table-456',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    it('should create Styler entity by extending Spreadsheet entity', async () => {
      // Arrange
      mockSpreadsheetHandler.createEntity.mockResolvedValue({
        success: true,
        data: mockSpreadsheetEntity,
      });

      const createData: Partial<StylerEntity> = {
        name: 'Test Styler',
        stylerConfig: StylerConfigDefault,
        selectedValueColumn: 'population',
        dataSource: { type: 'file', source: 'test.csv' },
      };

      // Act
      const result = await entityHandler.createEntity(testNodeId, createData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      if (result.success) {
        expect(result.data.name).toBe('Test Styler');
        expect(result.data.stylerConfig).toEqual(StylerConfigDefault);
        expect(result.data.selectedValueColumn).toBe('population');
        // Should inherit Spreadsheet fields
        expect(result.data.dataSource).toEqual({ type: 'file', source: 'test.csv' });
      }

      expect(mockSpreadsheetHandler.createEntity).toHaveBeenCalledWith(
        testNodeId,
        expect.objectContaining({
          name: 'Test Styler',
          dataSource: { type: 'file', source: 'test.csv' },
        }),
      );
    });

    it('should get Styler entity with merged data', async () => {
      // Arrange
      mockSpreadsheetHandler.getEntity.mockResolvedValue({
        success: true,
        data: mockSpreadsheetEntity,
      });

      // Act
      const result = await entityHandler.getEntity(testNodeId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      if (result.success && result.data) {
        // Should have Spreadsheet fields
        expect(result.data.name).toBe('Test Spreadsheet');
        expect(result.data.dataSource).toBeDefined();
        // Should have Styler fields
        expect(result.data.stylerConfig).toBeDefined();
      }
    });

    it('should update Styler entity with style regeneration', async () => {
      // Arrange
      mockSpreadsheetHandler.updateEntity.mockResolvedValue({
        success: true,
        data: { ...mockSpreadsheetEntity, name: 'Updated Name' },
      });

      mockSpreadsheetHandler.getEntity.mockResolvedValue({
        success: true,
        data: {
          ...mockSpreadsheetEntity,
          stylerConfig: StylerConfigDefault,
          selectedValueColumn: 'population',
        },
      });

      mockCSVApiDriver.getFilteredPreview.mockResolvedValue({
        rows: [
          { id: '1', population: 100 },
          { id: '2', population: 200 },
        ],
        columns: [{ name: 'id' }, { name: 'population' }],
        totalRows: 2,
      });

      const updateData = {
        name: 'Updated Styler',
        stylerConfig: {
          ...StylerConfigDefault,
          targetProperty: 'fill-color' as const,
        },
        selectedKeyColumn: 'id',
        selectedValueColumn: 'population',
        spreadsheetMetadataId: 'table-456',
      };

      // Act
      const result = await entityHandler.updateEntity(testNodeId, updateData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.generatedStyle).toBeDefined();
        expect(result.data.generatedStyle?.maplibreStyleSpec).toBeDefined();
        expect(result.data.generatedStyle?.colorMapping).toBeDefined();
      }
    });

    it('should delete Styler entity with reference cleanup', async () => {
      // Arrange
      mockSpreadsheetHandler.getEntity.mockResolvedValue({
        success: true,
        data: {
          ...mockSpreadsheetEntity,
          spreadsheetMetadataId: 'table-456',
        },
      });

      mockSpreadsheetHandler.deleteEntity.mockResolvedValue({
        success: true,
        data: undefined,
      });

      // Act
      const result = await entityHandler.deleteEntity(testNodeId);

      // Assert
      expect(result.success).toBe(true);
      expect(mockCSVApiDriver.removeTableReference).toHaveBeenCalledWith('table-456', 'styler');
      expect(mockSpreadsheetHandler.deleteEntity).toHaveBeenCalledWith(testNodeId);
    });
  });

  describe('Data Service Integration', () => {
    it('should upload CSV file and generate initial config', async () => {
      // Arrange
      const mockFile = new File(['id,population\n1,100\n2,200'], 'test.csv', {
        type: 'text/csv',
      });

      const mockTableMetadata = {
        id: 'table-123',
        filename: 'test.csv',
        columns: [
          { name: 'id', type: 'string' },
          { name: 'population', type: 'number' },
        ],
        totalRows: 2,
        contentHash: 'hash123',
        createdAt: Date.now(),
      };

      mockCSVApiDriver.uploadCSVFile.mockResolvedValue(mockTableMetadata);

      // Act
      const result = await dataService.uploadCSVFile(mockFile);

      // Assert
      expect(result.tableMetadata).toEqual(mockTableMetadata);
      expect(result.suggestedConfig).toBeDefined();
      expect(result.suggestedConfig.selectedValueColumn).toBe('population');
      expect(result.suggestedConfig.selectedKeyColumn).toBe('id');
    });

    it('should generate styled preview with color mapping', async () => {
      // Arrange
      const mockData = {
        rows: [
          { id: '1', population: 100 },
          { id: '2', population: 200 },
          { id: '3', population: 150 },
        ],
        columns: [
          { name: 'id', type: 'string' },
          { name: 'population', type: 'number' },
        ],
        totalRows: 3,
      };

      mockCSVApiDriver.getFilteredPreview.mockResolvedValue(mockData);

      const styleConfig = {
        ...StylerConfigDefault,
        selectedValueColumn: 'population',
        targetProperty: 'fill-color' as const,
      };

      // Act
      const result = await dataService.getStyledPreview('table-123', styleConfig);

      // Assert
      expect(result.data).toEqual(mockData);
      expect(result.styledRows).toHaveLength(3);

      result.styledRows.forEach((styledRow) => {
        expect(styledRow.row).toBeDefined();
        expect(styledRow.styles).toBeDefined();
        if (styledRow.styles.population) {
          expect(styledRow.styles.population.backgroundColor).toMatch(/^#[0-9a-f]{6}$/i);
        }
      });
    });

    it('should generate MapLibre style specification', async () => {
      // Arrange
      const mockEntity: StylerEntity = {
        id: 'entity-123',
        nodeId: testNodeId,
        name: 'Test Styler',
        dataSource: { type: 'file', source: 'test.csv' },
        spreadsheetMetadataId: 'table-456',
        stylerConfig: {
          ...StylerConfigDefault,
          targetProperty: 'fill-color',
        },
        selectedKeyColumn: 'id',
        selectedValueColumn: 'population',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      mockCSVApiDriver.getFilteredPreview.mockResolvedValue({
        rows: [
          { id: '1', population: 100 },
          { id: '2', population: 200 },
        ],
        columns: [{ name: 'id' }, { name: 'population' }],
        totalRows: 2,
      });

      // Act
      const result = await dataService.generateMapLibreStyle('table-456', mockEntity);

      // Assert
      expect(result.styleSpec).toBeDefined();
      expect(result.styleSpec.version).toBe(8);
      expect(result.styleSpec.layers).toHaveLength(1);
      expect(result.styleSpec.layers[0].paint['fill-color']).toBeDefined();

      expect(result.colorMapping).toBeDefined();
      expect(result.colorMapping['100']).toMatch(/^#[0-9a-f]{6}$/i);
      expect(result.colorMapping['200']).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});