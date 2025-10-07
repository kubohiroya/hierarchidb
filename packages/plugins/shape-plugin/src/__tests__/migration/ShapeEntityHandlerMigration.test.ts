/**
  * @file ShapeEntityHandlerMigration.test.ts
 * @description ERIA-CartographShapeEntityHandler (TDD Red Phase)
   * - HierarchiDBEntityHandlerShapeEntityHandler
 * - Working Copy Pattern
 * - BatchConfig
   * - ShapeEntityHandlerBaseEntityHandler
 * - ShapeEntityHierarchiDBEntity
 * - Working Copy PatternEphemeralDB
  */

import { beforeEach, describe, expect, it } from 'vitest';
import type { NodeId } from '@hierarchidb/common-types';
import { ShapeEntityHandler } from '../../services/ShapeEntityHandler.js';
import type { ShapeWorkingCopy } from '../../types/ShapeEntity.js';
import type { BatchConfig } from '../../types/BatchConfig.js';

describe('ShapeEntityHandler Migration Tests', () => {
  let entityHandler: ShapeEntityHandler;
  let mockNodeId: NodeId;

  beforeEach(() => {
    // Given
    mockNodeId = 'test-node-123' as NodeId;
    entityHandler = new ShapeEntityHandler();
  });

  describe('EntityHandler基本機能テスト', () => {
    it('新しいShapeエンティティが正常に作成される', async () => {
      //  Given: Shape
      const shapeData = {
        dataSourceName: 'naturalearth' as const,
        selectedCountries: ['JPN', 'USA'],
        selectedAdminLevels: [0, 1],
        licenseAgreement: true,
      };

      //  When: Shape
      const createdEntity = await entityHandler.createEntity(mockNodeId, shapeData);

      //  Then: HierarchiDBEntity
      expect(createdEntity).toBeDefined();
      expect(createdEntity.id).toBeDefined();
      expect(createdEntity.nodeId).toBe(mockNodeId);
      expect(createdEntity.dataSourceName).toBe('naturalearth');
      expect(createdEntity.selectedCountries).toEqual(['JPN', 'USA']);
      expect(createdEntity.selectedAdminLevels).toEqual([0, 1]);
      expect(createdEntity.licenseAgreement).toBe(true);
      expect(createdEntity.createdAt).toBeDefined();
      expect(createdEntity.updatedAt).toBeDefined();
      expect(createdEntity.version).toBe(1);
    });

    it('既存のShapeエンティティが正常に取得される', async () => {
      //  Given: Shape
      await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'gadm',
        selectedCountries: ['DEU'],
        selectedAdminLevels: [0, 1, 2],
        licenseAgreement: true,
      });

      //  When:
      const retrievedEntity = await entityHandler.getEntity(mockNodeId);

      //  Then:
      expect(retrievedEntity).toBeDefined();
      expect(retrievedEntity?.nodeId).toBe(mockNodeId);
      expect(retrievedEntity?.dataSourceName).toBe('gadm');
    });

    it('Shapeエンティティが正常に更新される', async () => {
      //  Given: Shape
      await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'naturalearth',
        selectedCountries: ['USA'],
        selectedAdminLevels: [0, 1],
        licenseAgreement: true,
      });

      const updateData = {
        selectedCountries: ['JPN', 'KOR', 'CHN'],
        selectedAdminLevels: [0, 1, 2, 3],
      };

      //  When:
      const updatedEntity = await entityHandler.updateEntity(mockNodeId, updateData);

      //  Then:
      expect(updatedEntity).toBeDefined();
      expect(updatedEntity.selectedCountries).toEqual(['JPN', 'KOR', 'CHN']);
      expect(updatedEntity.selectedAdminLevels).toEqual([0, 1, 2, 3]);
      expect(updatedEntity.version).toBeGreaterThan(1);
      expect(updatedEntity.updatedAt).toBeGreaterThan(updatedEntity.createdAt);
    });

    it('Shapeエンティティが正常に削除される', async () => {
      //  Given: Shape
      await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'naturalearth',
        selectedCountries: ['USA'],
        selectedAdminLevels: [0, 1],
        licenseAgreement: true,
      });

      //  When:
      await entityHandler.deleteEntity(mockNodeId);

      //  Then:
      const deletedEntity = await entityHandler.getEntity(mockNodeId);
      expect(deletedEntity).toBeUndefined();
    });
  });

  describe('Working Copy Pattern実装テスト', () => {
    it('Working Copyが正常に作成される', async () => {
      //  Given: Shape
      const baseEntity = await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'naturalearth',
        selectedCountries: ['JPN'],
        selectedAdminLevels: [0, 1],
        licenseAgreement: true,
      });

      //  When: Working Copy
      const workingCopy = await entityHandler.createWorkingCopy(mockNodeId);

      //  Then: Working Copy
      expect(workingCopy).toBeDefined();
      expect(workingCopy.nodeId).toBe(mockNodeId);
      expect(workingCopy.baseVersion).toBe(baseEntity.version);
      expect(workingCopy.isModified).toBe(false);
    });

    it('Working Copyの変更が正常に追跡される', async () => {
      // Given: Working Copy
      const workingCopy: ShapeWorkingCopy = {
        nodeId: mockNodeId,
        baseVersion: 1,
        isModified: false,
        changes: {},
      };

      //  When: Working Copy
      const modifiedWorkingCopy = await entityHandler.modifyWorkingCopy(workingCopy, {
        selectedCountries: ['USA', 'CAN'],
        selectedAdminLevels: [0, 1, 2],
      });

      //  Then:
      expect(modifiedWorkingCopy.isModified).toBe(true);
      expect(modifiedWorkingCopy.changes.selectedCountries).toEqual(['USA', 'CAN']);
      expect(modifiedWorkingCopy.changes.selectedAdminLevels).toEqual([0, 1, 2]);
    });

    it('Working Copyのコミットが正常に動作する', async () => {
      //  Given:
      await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'naturalearth',
        selectedCountries: ['JPN'],
        selectedAdminLevels: [0, 1],
        licenseAgreement: true,
      });

      //  Working Copy
      const modifiedWorkingCopy: ShapeWorkingCopy = {
        nodeId: mockNodeId,
        baseVersion: 1,
        isModified: true,
        changes: {
          selectedCountries: ['FRA', 'DEU', 'ITA'],
          dataSourceName: 'geoboundaries',
        },
      };

      //  When: Working Copy
      const committedEntity = await entityHandler.commitWorkingCopy(modifiedWorkingCopy);

      //  Then: CoreDB
      expect(committedEntity).toBeDefined();
      expect(committedEntity.selectedCountries).toEqual(['FRA', 'DEU', 'ITA']);
      expect(committedEntity.dataSourceName).toBe('geoboundaries');
      expect(committedEntity.version).toBe(2);
    });

    it('Working Copyの破棄が正常に動作する', async () => {
      //  Given: Working Copy
      const workingCopyToDiscard: ShapeWorkingCopy = {
        nodeId: mockNodeId,
        baseVersion: 1,
        isModified: true,
        changes: {
          selectedCountries: ['INVALID'],
        },
      };

      //  When: Working Copy
      await entityHandler.discardWorkingCopy(workingCopyToDiscard);

      //  Then:
      const originalEntity = await entityHandler.getEntity(mockNodeId);
      expect(originalEntity?.selectedCountries).not.toEqual(['INVALID']);
    });
  });

  describe('BatchConfig管理機能テスト', () => {
    it('BatchConfigが正常に設定される', async () => {
      //  Given: BatchConfig
      await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'naturalearth',
        selectedCountries: ['JPN'],
        selectedAdminLevels: [0, 1],
        licenseAgreement: true,
      });

      const batchConfig: BatchConfig = {
        corsProxyBaseURL: 'https://proxy.example.com',
        dataSource: 'naturalearth',
        download: {
          concurrentDownloads: 3,
          deleteOnComplete: false,
        },
        simplify1: {
          concurrentProcesses: 4,
          enableFeatureFiltering: true,
          featureAreaThreshold: 0.1,
          minVertexCountForAreaFilter: 50,
          aspectRatioThreshold: 10,
          featureFilterMethod: 'hybrid',
          deleteOnComplete: false,
        },
        simplify2: {
          concurrentProcesses: 4,
          quantize: 1e4,
          simplify: 0.01,
          tolerance: 0.1,
          enablePerFeatureSimplification: true,
          deleteOnComplete: false,
        },
        vectorTiles: {
          concurrentProcesses: 4,
          maxZoom: 8,
          tileCountThresholdForZoomStop: 10000,
        },
      };

      //  When: BatchConfig
      await entityHandler.setBatchConfig(mockNodeId, batchConfig);

      //  Then: BatchConfig
      const entity = await entityHandler.getEntity(mockNodeId);
      expect(entity?.batchConfig).toBeDefined();
      expect(entity?.batchConfig?.dataSource).toBe('naturalearth');
      expect(entity?.batchConfig?.download.concurrentDownloads).toBe(3);
    });

    it('BatchConfigが正常に取得される', async () => {
      //  Given: BatchConfigShape
      await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'naturalearth',
        selectedCountries: ['JPN'],
        selectedAdminLevels: [0, 1],
        licenseAgreement: true,
      });

      const batchConfig: BatchConfig = {
        corsProxyBaseURL: 'https://proxy.example.com',
        dataSource: 'naturalearth',
        download: { concurrentDownloads: 3, deleteOnComplete: false },
        simplify1: {
          concurrentProcesses: 4,
          enableFeatureFiltering: true,
          featureAreaThreshold: 0.1,
          minVertexCountForAreaFilter: 50,
          aspectRatioThreshold: 10,
          featureFilterMethod: 'hybrid',
          deleteOnComplete: false,
        },
        simplify2: {
          concurrentProcesses: 4,
          quantize: 1e4,
          simplify: 0.01,
          tolerance: 0.1,
          enablePerFeatureSimplification: true,
          deleteOnComplete: false,
        },
        vectorTiles: {
          concurrentProcesses: 4,
          maxZoom: 8,
          tileCountThresholdForZoomStop: 10000,
        },
      };

      await entityHandler.setBatchConfig(mockNodeId, batchConfig);

      //  When: BatchConfig
      const retrievedBatchConfig = await entityHandler.getBatchConfig(mockNodeId);

      //  Then: BatchConfig
      expect(retrievedBatchConfig).toBeDefined();
      expect(retrievedBatchConfig?.corsProxyBaseURL).toBeDefined();
      expect(retrievedBatchConfig?.download).toBeDefined();
      expect(retrievedBatchConfig?.simplify1).toBeDefined();
      expect(retrievedBatchConfig?.simplify2).toBeDefined();
      expect(retrievedBatchConfig?.vectorTiles).toBeDefined();
    });
  });
});
