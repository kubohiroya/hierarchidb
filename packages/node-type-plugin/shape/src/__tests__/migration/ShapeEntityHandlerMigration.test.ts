/**
 * @file ShapeEntityHandlerMigration.test.ts
 * @description ERIA-Cartograph移植に向けたShapeEntityHandler実装テスト (TDD Red Phase)
 * 
 * テスト目的：
 * - HierarchiDBのEntityHandlerパターンに適合したShapeEntityHandlerの動作検証
 * - Working Copy Patternを使用した安全な編集機能の確認
 * - BatchConfig管理機能の実装検証
 * 
 * 前提条件：
 * - ShapeEntityHandlerがBaseEntityHandlerを継承して実装済み
 * - ShapeEntityがHierarchiDBのEntity仕様に準拠
 * - Working Copy PatternでのEphemeralDB連携が実装済み
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NodeId, EntityId, TreeNodeId } from '@hierarchidb/core';
import { createNodeId, createEntityId } from '@hierarchidb/core';
import { ShapeEntityHandler } from '../../services/ShapeEntityHandler';
import type { ShapeEntity, ShapeWorkingCopy } from '../../types/ShapeEntity';
import type { BatchConfig } from '../../types/BatchConfig';

describe('ShapeEntityHandler Migration Tests', () => {
  let entityHandler: ShapeEntityHandler;
  let mockNodeId: NodeId;
  let mockEntityId: EntityId;
  let mockTreeNodeId: TreeNodeId;

  beforeEach(() => {
    // Given: テスト用のIDとEntityHandlerを準備
    mockNodeId = createNodeId('test-node-123');
    mockEntityId = createEntityId(); // Generate a valid UUID
    mockTreeNodeId = 'tree-node-789' as TreeNodeId;
    entityHandler = new ShapeEntityHandler();
  });

  describe('EntityHandler基本機能テスト', () => {
    it('新しいShapeエンティティが正常に作成される', async () => {
      // Given: Shape作成に必要なデータ
      const shapeData = {
        dataSourceName: 'naturalearth' as const,
        selectedCountries: ['JPN', 'USA'],
        selectedAdminLevels: [0, 1],
        licenseAgreement: true
      };
      
      // When: 新しいShapeエンティティを作成
      const createdEntity = await entityHandler.createEntity(mockNodeId, shapeData);
      
      // Then: HierarchiDBのEntity仕様に準拠したエンティティが作成される
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
      // Given: 既存のShapeエンティティを作成
      await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'gadm',
        selectedCountries: ['DEU'],
        selectedAdminLevels: [0, 1, 2],
        licenseAgreement: true
      });
      
      // When: エンティティを取得
      const retrievedEntity = await entityHandler.getEntity(mockNodeId);
      
      // Then: 正しいエンティティが取得される
      expect(retrievedEntity).toBeDefined();
      expect(retrievedEntity?.nodeId).toBe(mockNodeId);
      expect(retrievedEntity?.dataSourceName).toBe('gadm');
    });

    it('Shapeエンティティが正常に更新される', async () => {
      // Given: 既存のShapeエンティティを作成
      await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'naturalearth',
        selectedCountries: ['USA'],
        selectedAdminLevels: [0, 1],
        licenseAgreement: true
      });
      
      const updateData = {
        selectedCountries: ['JPN', 'KOR', 'CHN'],
        selectedAdminLevels: [0, 1, 2, 3]
      };
      
      // When: エンティティを更新
      const updatedEntity = await entityHandler.updateEntity(mockNodeId, updateData);
      
      // Then: 更新が正常に反映される
      expect(updatedEntity).toBeDefined();
      expect(updatedEntity.selectedCountries).toEqual(['JPN', 'KOR', 'CHN']);
      expect(updatedEntity.selectedAdminLevels).toEqual([0, 1, 2, 3]);
      expect(updatedEntity.version).toBeGreaterThan(1);
      expect(updatedEntity.updatedAt).toBeGreaterThan(updatedEntity.createdAt);
    });

    it('Shapeエンティティが正常に削除される', async () => {
      // Given: 削除対象のShapeエンティティを作成
      await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'naturalearth',
        selectedCountries: ['USA'],
        selectedAdminLevels: [0, 1],
        licenseAgreement: true
      });
      
      // When: エンティティを削除
      await entityHandler.deleteEntity(mockNodeId);
      
      // Then: エンティティが削除される
      const deletedEntity = await entityHandler.getEntity(mockNodeId);
      expect(deletedEntity).toBeUndefined();
    });
  });

  describe('Working Copy Pattern実装テスト', () => {
    it('Working Copyが正常に作成される', async () => {
      // Given: 既存のShapeエンティティを作成
      const baseEntity = await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'naturalearth',
        selectedCountries: ['JPN'],
        selectedAdminLevels: [0, 1],
        licenseAgreement: true
      });
      
      // When: Working Copyを作成
      const workingCopy = await entityHandler.createWorkingCopy(mockNodeId);
      
      // Then: Working Copyが正常に作成される
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
        changes: {}
      };
      
      // When: Working Copyを変更
      const modifiedWorkingCopy = await entityHandler.modifyWorkingCopy(workingCopy, {
        selectedCountries: ['USA', 'CAN'],
        selectedAdminLevels: [0, 1, 2]
      });
      
      // Then: 変更が正常に追跡される
      expect(modifiedWorkingCopy.isModified).toBe(true);
      expect(modifiedWorkingCopy.changes.selectedCountries).toEqual(['USA', 'CAN']);
      expect(modifiedWorkingCopy.changes.selectedAdminLevels).toEqual([0, 1, 2]);
    });

    it('Working Copyのコミットが正常に動作する', async () => {
      // Given: ベースエンティティを作成
      await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'naturalearth',
        selectedCountries: ['JPN'],
        selectedAdminLevels: [0, 1],
        licenseAgreement: true
      });
      
      // 変更されたWorking Copy
      const modifiedWorkingCopy: ShapeWorkingCopy = {
        nodeId: mockNodeId,
        baseVersion: 1,
        isModified: true,
        changes: {
          selectedCountries: ['FRA', 'DEU', 'ITA'],
          dataSourceName: 'geoboundaries'
        }
      };
      
      // When: Working Copyをコミット
      const committedEntity = await entityHandler.commitWorkingCopy(modifiedWorkingCopy);
      
      // Then: 変更がCoreDBに反映される
      expect(committedEntity).toBeDefined();
      expect(committedEntity.selectedCountries).toEqual(['FRA', 'DEU', 'ITA']);
      expect(committedEntity.dataSourceName).toBe('geoboundaries');
      expect(committedEntity.version).toBe(2); // バージョンが増加
    });

    it('Working Copyの破棄が正常に動作する', async () => {
      // Given: 変更されたWorking Copy
      const workingCopyToDiscard: ShapeWorkingCopy = {
        nodeId: mockNodeId,
        baseVersion: 1,
        isModified: true,
        changes: {
          selectedCountries: ['INVALID']
        }
      };
      
      // When: Working Copyを破棄
      await entityHandler.discardWorkingCopy(workingCopyToDiscard);
      
      // Then: 変更が破棄され、元のエンティティが保持される
      const originalEntity = await entityHandler.getEntity(mockNodeId);
      expect(originalEntity?.selectedCountries).not.toEqual(['INVALID']);
    });
  });

  describe('BatchConfig管理機能テスト', () => {
    it('BatchConfigが正常に設定される', async () => {
      // Given: エンティティを作成してからBatchConfig設定データ
      await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'naturalearth',
        selectedCountries: ['JPN'],
        selectedAdminLevels: [0, 1],
        licenseAgreement: true
      });
      
      const batchConfig: BatchConfig = {
        corsProxyBaseURL: 'https://proxy.example.com',
        dataSource: 'naturalearth',
        download: {
          concurrentDownloads: 3,
          deleteOnComplete: false
        },
        simplify1: {
          concurrentProcesses: 4,
          enableFeatureFiltering: true,
          featureAreaThreshold: 0.1,
          minVertexCountForAreaFilter: 50,
          aspectRatioThreshold: 10,
          featureFilterMethod: 'hybrid',
          deleteOnComplete: false
        },
        simplify2: {
          concurrentProcesses: 4,
          quantize: 1e4,
          simplify: 0.01,
          tolerance: 0.1,
          enablePerFeatureSimplification: true,
          deleteOnComplete: false
        },
        vectorTiles: {
          concurrentProcesses: 4,
          maxZoom: 8,
          tileCountThresholdForZoomStop: 10000
        }
      };
      
      // When: BatchConfigを設定
      await entityHandler.setBatchConfig(mockNodeId, batchConfig);
      
      // Then: BatchConfigが正常に設定される
      const entity = await entityHandler.getEntity(mockNodeId);
      expect(entity?.batchConfig).toBeDefined();
      expect(entity?.batchConfig?.dataSource).toBe('naturalearth');
      expect(entity?.batchConfig?.download.concurrentDownloads).toBe(3);
    });

    it('BatchConfigが正常に取得される', async () => {
      // Given: BatchConfigを持つShapeエンティティを作成
      await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'naturalearth',
        selectedCountries: ['JPN'],
        selectedAdminLevels: [0, 1],
        licenseAgreement: true
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
          deleteOnComplete: false 
        },
        simplify2: { 
          concurrentProcesses: 4, 
          quantize: 1e4, 
          simplify: 0.01, 
          tolerance: 0.1, 
          enablePerFeatureSimplification: true, 
          deleteOnComplete: false 
        },
        vectorTiles: { 
          concurrentProcesses: 4, 
          maxZoom: 8, 
          tileCountThresholdForZoomStop: 10000 
        }
      };
      
      await entityHandler.setBatchConfig(mockNodeId, batchConfig);
      
      // When: BatchConfigを取得
      const retrievedBatchConfig = await entityHandler.getBatchConfig(mockNodeId);
      
      // Then: 正しいBatchConfigが取得される
      expect(retrievedBatchConfig).toBeDefined();
      expect(retrievedBatchConfig?.corsProxyBaseURL).toBeDefined();
      expect(retrievedBatchConfig?.download).toBeDefined();
      expect(retrievedBatchConfig?.simplify1).toBeDefined();
      expect(retrievedBatchConfig?.simplify2).toBeDefined();
      expect(retrievedBatchConfig?.vectorTiles).toBeDefined();
    });
  });
});