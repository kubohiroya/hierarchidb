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
import type { ShapeDraft } from '../../types/ShapeEntity.js';
import type { BatchConfig } from '../../types/BatchConfig.js';

const toIso2 = (index: number): string => {
  const first = String.fromCharCode(65 + Math.floor(index / 26));
  const second = String.fromCharCode(65 + (index % 26));
  return `${first}${second}`;
};

const buildSelectionMap = (countries: number, levels: number): Record<string, boolean[]> =>
  Object.fromEntries(
    Array.from({ length: countries }, (_, index) => [toIso2(index), Array.from({ length: levels }, () => true)]),
  );

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
        selectedArrayByCountries: buildSelectionMap(2, 2),
        licenseAgreement: true,
      };

      //  When: Shape
      const createdEntity = await entityHandler.createEntity(mockNodeId, shapeData);

      //  Then: HierarchiDBEntity
      expect(createdEntity).toBeDefined();
      expect(createdEntity.id).toBeDefined();
      expect(createdEntity.nodeId).toBe(mockNodeId);
      expect(createdEntity.dataSourceName).toBe('naturalearth');
      expect(createdEntity.selectedArrayByCountries).toEqual(buildSelectionMap(2, 2));
      expect(createdEntity.licenseAgreement).toBe(true);
    });

    it('既存のShapeエンティティが正常に取得される', async () => {
      //  Given: Shape
      await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'gadm',
        selectedArrayByCountries: buildSelectionMap(1, 3),
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
        selectedArrayByCountries: buildSelectionMap(1, 2),
        licenseAgreement: true,
      });

      const updateData = {
        selectedArrayByCountries: buildSelectionMap(3, 4),
      };

      //  When:
      const updatedEntity = await entityHandler.updateEntity(mockNodeId, updateData);

      //  Then:
      expect(updatedEntity).toBeDefined();
      expect(updatedEntity.selectedArrayByCountries).toEqual(buildSelectionMap(3, 4));
    });

    it('Shapeエンティティが正常に削除される', async () => {
      //  Given: Shape
      await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'naturalearth',
        selectedArrayByCountries: buildSelectionMap(1, 2),
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
        selectedArrayByCountries: buildSelectionMap(1, 2),
        licenseAgreement: true,
      });

      //  When: Working Copy
      const draft = await entityHandler.createDraft(mockNodeId);

      //  Then: Working Copy
      expect(draft).toBeDefined();
      expect(draft.nodeId).toBe(mockNodeId);
      expect(draft.isModified).toBe(false);
    });

    it('Working Copyの変更が正常に追跡される', async () => {
      // Given: Working Copy
      const draft: ShapeDraft = {
        nodeId: mockNodeId,
        baseVersion: 1,
        isModified: false,
        changes: {},
      };

      //  When: Working Copy
      const modifiedDraft = await entityHandler.modifyDraft(draft, {
        selectedArrayByCountries: buildSelectionMap(2, 3),
      });

      //  Then:
      expect(modifiedDraft.isModified).toBe(true);
      expect(modifiedDraft.changes.selectedArrayByCountries).toEqual(buildSelectionMap(2, 3));
    });

    it('Working Copyのコミットが正常に動作する', async () => {
      //  Given:
      await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'naturalearth',
        selectedArrayByCountries: buildSelectionMap(1, 2),
        licenseAgreement: true,
      });

      //  Working Copy
      const modifiedDraft: ShapeDraft = {
        nodeId: mockNodeId,
        baseVersion: 1,
        isModified: true,
        changes: {
          selectedArrayByCountries: buildSelectionMap(3, 2),
          dataSourceName: 'geoboundaries',
        },
      };

      //  When: Working Copy
      const committedEntity = await entityHandler.commitDraft(modifiedDraft);

      //  Then: CoreDB
      expect(committedEntity).toBeDefined();
      expect(committedEntity.selectedArrayByCountries).toEqual(buildSelectionMap(3, 2));
      expect(committedEntity.dataSourceName).toBe('geoboundaries');
    });

    it('Working Copyの破棄が正常に動作する', async () => {
      //  Given: Working Copy
      const draftToDiscard: ShapeDraft = {
        nodeId: mockNodeId,
        baseVersion: 1,
        isModified: true,
        changes: {
          selectedArrayByCountries: buildSelectionMap(1, 1),
        },
      };

      //  When: Working Copy
      await entityHandler.discardDraft(draftToDiscard);

      //  Then:
      const originalEntity = await entityHandler.getEntity(mockNodeId);
      expect(originalEntity?.selectedArrayByCountries).not.toEqual(buildSelectionMap(1, 1));
    });
  });

  describe('BatchConfig管理機能テスト', () => {
    it('BatchConfigが正常に設定される', async () => {
      //  Given: BatchConfig
      await entityHandler.createEntity(mockNodeId, {
        dataSourceName: 'naturalearth',
        selectedArrayByCountries: buildSelectionMap(1, 2),
        licenseAgreement: true,
      });

      const batchConfig: BatchConfig = {
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
          minZoom: 0,
          maxZoom: 8,
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
        selectedArrayByCountries: buildSelectionMap(1, 2),
        licenseAgreement: true,
      });

      const batchConfig: BatchConfig = {
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
          minZoom: 0,
          maxZoom: 8,
        },
      };

      await entityHandler.setBatchConfig(mockNodeId, batchConfig);

      //  When: BatchConfig
      const retrievedBatchConfig = await entityHandler.getBatchConfig(mockNodeId);

      //  Then: BatchConfig
      expect(retrievedBatchConfig).toBeDefined();
      expect(retrievedBatchConfig?.download).toBeDefined();
      expect(retrievedBatchConfig?.simplify1).toBeDefined();
      expect(retrievedBatchConfig?.simplify2).toBeDefined();
      expect(retrievedBatchConfig?.vectorTiles).toBeDefined();
    });
  });
});
