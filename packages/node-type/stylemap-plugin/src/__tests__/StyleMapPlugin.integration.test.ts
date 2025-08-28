/**
 * @file StyleMapPlugin.integration.test.ts
 * @description StyleMap plugin integration tests
 * 【機能概要】: StyleMapプラグインの統合テスト
 * 【実装方針】: Spreadsheetプラグインとの統合動作を検証
 * 🟢 信頼性レベル: 完全な統合テスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';
import { StyleMapExtension } from '../extension/definition';
import { StyleMapEntityHandler } from '../handlers/StyleMapEntityHandler';
import { StyleMapDataService } from '../services/StyleMapDataService';
import type { StyleMapEntity } from '../entities/StyleMapEntity';
import { StyleMapConfigDefault } from '../types/styleMapTypes';

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

describe('StyleMap Plugin Integration', () => {
  let dataService: StyleMapDataService;
  let entityHandler: StyleMapEntityHandler;
  const testNodeId = 'test-node-123' as NodeId;

  beforeEach(() => {
    vi.clearAllMocks();
    dataService = new StyleMapDataService(mockCSVApiDriver);
    entityHandler = new StyleMapEntityHandler(mockSpreadsheetHandler as any, dataService);
  });

  describe('Plugin Extension Definition', () => {
    it('should have correct extension structure', () => {
      expect(StyleMapExtension.extends).toBe('spreadsheet');
      expect(StyleMapExtension.nodeType).toBe('stylemap');
      expect(StyleMapExtension.name).toBe('StyleMap');
      expect(StyleMapExtension.displayName).toBe('スタイルマップ');
    });

    it('should define extended steps correctly', () => {
      expect(StyleMapExtension.extendedSteps).toHaveLength(2);
      
      const step5 = StyleMapExtension.extendedSteps![0];
      const step6 = StyleMapExtension.extendedSteps![1];
      
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
      expect(StyleMapExtension.extendedFields).toHaveLength(4);
      
      const fields = StyleMapExtension.extendedFields!;
      const fieldNames = fields.map(f => f.name);
      
      expect(fieldNames).toContain('styleMapConfig');
      expect(fieldNames).toContain('selectedKeyColumn');
      expect(fieldNames).toContain('selectedValueColumn');
      expect(fieldNames).toContain('generatedStyle');
    });

    it('should have proper validation rules', () => {
      const validation = StyleMapExtension.extendedValidation!;
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

    it('should create StyleMap entity by extending Spreadsheet entity', async () => {
      // Arrange
      mockSpreadsheetHandler.createEntity.mockResolvedValue({
        success: true,
        data: mockSpreadsheetEntity,
      });

      const createData: Partial<StyleMapEntity> = {
        name: 'Test StyleMap',
        styleMapConfig: StyleMapConfigDefault,
        selectedValueColumn: 'population',
        dataSource: { type: 'file', source: 'test.csv' },
      };

      // Act
      const result = await entityHandler.createEntity(testNodeId, createData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      if (result.success) {
        expect(result.data.name).toBe('Test StyleMap');
        expect(result.data.styleMapConfig).toEqual(StyleMapConfigDefault);
        expect(result.data.selectedValueColumn).toBe('population');
        // Should inherit Spreadsheet fields
        expect(result.data.dataSource).toEqual({ type: 'file', source: 'test.csv' });
      }
      
      expect(mockSpreadsheetHandler.createEntity).toHaveBeenCalledWith(
        testNodeId,
        expect.objectContaining({
          name: 'Test StyleMap',
          dataSource: { type: 'file', source: 'test.csv' },
        })
      );
    });

    it('should get StyleMap entity with merged data', async () => {
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
        // Should have StyleMap fields
        expect(result.data.styleMapConfig).toBeDefined();
      }
    });

    it('should update StyleMap entity with style regeneration', async () => {
      // Arrange
      mockSpreadsheetHandler.updateEntity.mockResolvedValue({
        success: true,
        data: { ...mockSpreadsheetEntity, name: 'Updated Name' },
      });
      
      mockSpreadsheetHandler.getEntity.mockResolvedValue({
        success: true,
        data: {
          ...mockSpreadsheetEntity,
          styleMapConfig: StyleMapConfigDefault,
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
        name: 'Updated StyleMap',
        styleMapConfig: {
          ...StyleMapConfigDefault,
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

    it('should delete StyleMap entity with reference cleanup', async () => {
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
      expect(mockCSVApiDriver.removeTableReference).toHaveBeenCalledWith('table-456', 'stylemap');
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
        ...StyleMapConfigDefault,
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
      const mockEntity: StyleMapEntity = {
        id: 'entity-123',
        nodeId: testNodeId,
        name: 'Test StyleMap',
        dataSource: { type: 'file', source: 'test.csv' },
        spreadsheetMetadataId: 'table-456',
        styleMapConfig: {
          ...StyleMapConfigDefault,
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