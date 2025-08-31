/**
 * @file MultiStepDialog.integration.test.ts
 * @description Integration tests for the Multi-Step Dialog system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
// import { WorkerAPIImpl } from '@hierarchidb/runtime-worker-worker/WorkerAPIImpl';
import type { EntityId, NodeId } from '@hierarchidb/common-type';

describe('Multi-Step Dialog Integration', () => {
  let workerAPI: any; // WorkerAPIImpl type not available
  let dialogAPI: any;

  beforeEach(async () => {
    // テスト用のWorkerAPI初期化
    // TODO: WorkerAPIImplのインポートパスを修正する必要がある
    // workerAPI = new WorkerAPIImpl('test-db');
    // await workerAPI.initialize();
    // dialogAPI = workerAPI.getMultiStepDialogAPI();
  });

  afterEach(async () => {
    if (workerAPI) {
      await workerAPI.shutdown();
    }
  });

  describe('Working Copy Management', () => {
    it('should create a working copy for folder plugin', async () => {
      const workingCopyId = await dialogAPI.createWorkingCopy('folder-plugin');
      
      expect(workingCopyId).toBeDefined();
      expect(typeof workingCopyId).toBe('string');

      const workingCopy = await dialogAPI.getWorkingCopy(workingCopyId);
      expect(workingCopy).toBeDefined();
      expect(workingCopy?.nodeType).toBe('folder-plugin');
      expect(workingCopy?.data).toEqual({});
    });

    it('should create a working copy for location plugin with parent', async () => {
      const parentId = 'parent-123' as NodeId;
      const workingCopyId = await dialogAPI.createWorkingCopy('location-plugin', parentId);
      
      const workingCopy = await dialogAPI.getWorkingCopy(workingCopyId);
      expect(workingCopy).toBeDefined();
      expect(workingCopy?.nodeType).toBe('location-plugin');
      expect(workingCopy?.parentNodeId).toBe(parentId);
    });

    it('should update a working copy', async () => {
      const workingCopyId = await dialogAPI.createWorkingCopy('folder-plugin');
      
      const updates = {
        data: {
          name: 'Test Folder',
          description: 'A test folder'
        },
        metadata: {
          currentStep: 1
        }
      };

      const updatedWorkingCopy = await dialogAPI.updateWorkingCopy(workingCopyId, updates);
      
      expect(updatedWorkingCopy.data.name).toBe('Test Folder');
      expect(updatedWorkingCopy.data.description).toBe('A test folder');
      expect(updatedWorkingCopy.metadata.currentStep).toBe(1);
    });

    it('should delete a working copy', async () => {
      const workingCopyId = await dialogAPI.createWorkingCopy('folder-plugin');
      
      await dialogAPI.deleteWorkingCopy(workingCopyId);
      
      const workingCopy = await dialogAPI.getWorkingCopy(workingCopyId);
      expect(workingCopy).toBeUndefined();
    });
  });

  describe('Folder Plugin Step Capabilities', () => {
    let workingCopyId: EntityId;

    beforeEach(async () => {
      workingCopyId = await dialogAPI.createWorkingCopy('folder-plugin');
    });

    it('should evaluate capabilities for step 0 (basic info)', async () => {
      // 初期状態 - 名前なし
      let capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 0);
      
      expect(capabilities.canNavigateTo).toBe(true);
      expect(capabilities.canStartBatch).toBe(false);
      expect(capabilities.canSave).toBe(false);
      expect(capabilities.canProceedToNext).toBe(false);
      expect(capabilities.canBackToPrevious).toBe(false);

      // 名前を追加
      await dialogAPI.updateWorkingCopy(workingCopyId, {
        data: { name: 'Test Folder' }
      });

      capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 0);
      expect(capabilities.canProceedToNext).toBe(true);
    });

    it('should evaluate capabilities for step 1 (permissions)', async () => {
      // 基本情報なしではアクセス不可
      let capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 1);
      expect(capabilities.canNavigateTo).toBe(false);

      // 基本情報を追加
      await dialogAPI.updateWorkingCopy(workingCopyId, {
        data: { name: 'Test Folder' }
      });

      capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 1);
      expect(capabilities.canNavigateTo).toBe(true);
      expect(capabilities.canStartBatch).toBe(true);
      expect(capabilities.canSave).toBe(true);
      expect(capabilities.canProceedToNext).toBe(true);
      expect(capabilities.canBackToPrevious).toBe(true);
    });

    it('should evaluate capabilities for step 2 (templates and bookmarks)', async () => {
      await dialogAPI.updateWorkingCopy(workingCopyId, {
        data: { name: 'Test Folder' }
      });

      const capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 2);
      expect(capabilities.canNavigateTo).toBe(true);
      expect(capabilities.canStartBatch).toBe(true);
      expect(capabilities.canSave).toBe(true);
      expect(capabilities.canProceedToNext).toBe(false); // 最終ステップ
      expect(capabilities.canBackToPrevious).toBe(true);
    });
  });

  describe('Location Plugin Step Capabilities', () => {
    let workingCopyId: EntityId;

    beforeEach(async () => {
      workingCopyId = await dialogAPI.createWorkingCopy('location-plugin');
    });

    it('should evaluate capabilities for step 0 (basic info)', async () => {
      // 初期状態
      let capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 0);
      expect(capabilities.canProceedToNext).toBe(false);

      // 名前とタイプを追加
      await dialogAPI.updateWorkingCopy(workingCopyId, {
        data: { 
          name: 'Test Location',
          locationType: 'restaurant' 
        }
      });

      capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 0);
      expect(capabilities.canProceedToNext).toBe(true);
    });

    it('should evaluate capabilities for step 1 (location info)', async () => {
      await dialogAPI.updateWorkingCopy(workingCopyId, {
        data: { 
          name: 'Test Location',
          locationType: 'restaurant' 
        }
      });

      // 位置情報なし
      let capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 1);
      expect(capabilities.canProceedToNext).toBe(false);
      expect(capabilities.canSave).toBe(false);

      // 座標を追加
      await dialogAPI.updateWorkingCopy(workingCopyId, {
        data: { 
          name: 'Test Location',
          locationType: 'restaurant',
          latitude: 35.6762,
          longitude: 139.6503
        }
      });

      capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 1);
      expect(capabilities.canProceedToNext).toBe(true);
      expect(capabilities.canSave).toBe(true);
      expect(capabilities.canStartBatch).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    it('should validate multiple working copies', async () => {
      // フォルダーのWorking Copy作成
      const folderWorkingCopyId = await dialogAPI.createWorkingCopy('folder-plugin');
      await dialogAPI.updateWorkingCopy(folderWorkingCopyId, {
        data: { name: 'Valid Folder' }
      });

      // ロケーションのWorking Copy作成（無効なデータ）
      const locationWorkingCopyId = await dialogAPI.createWorkingCopy('location-plugin');
      await dialogAPI.updateWorkingCopy(locationWorkingCopyId, {
        data: { name: '', locationType: 'restaurant' } // 空の名前
      });

      const results = await dialogAPI.batchValidate([
        folderWorkingCopyId,
        locationWorkingCopyId
      ]);

      expect(results[folderWorkingCopyId].valid).toBe(true);
      expect(results[locationWorkingCopyId].valid).toBe(false);
      expect(results[locationWorkingCopyId].errors).toContain('ロケーション名は必須です');
    });

    it('should batch evaluate capabilities', async () => {
      const workingCopyId1 = await dialogAPI.createWorkingCopy('folder-plugin');
      const workingCopyId2 = await dialogAPI.createWorkingCopy('location-plugin');

      // 有効なデータを設定
      await dialogAPI.updateWorkingCopy(workingCopyId1, {
        data: { name: 'Test Folder' }
      });
      await dialogAPI.updateWorkingCopy(workingCopyId2, {
        data: { 
          name: 'Test Location',
          locationType: 'restaurant',
          latitude: 35.6762,
          longitude: 139.6503
        }
      });

      const results = await dialogAPI.batchEvaluateCapabilities([
        { workingCopyId: workingCopyId1, step: 1 },
        { workingCopyId: workingCopyId2, step: 2 }
      ]);

      expect(results[workingCopyId1].canNavigateTo).toBe(true);
      expect(results[workingCopyId1].canStartBatch).toBe(true);
      expect(results[workingCopyId2].canNavigateTo).toBe(true);
      expect(results[workingCopyId2].canStartBatch).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should validate folder data', async () => {
      const workingCopyId = await dialogAPI.createWorkingCopy('folder-plugin');

      // 無効なデータ
      await dialogAPI.updateWorkingCopy(workingCopyId, {
        data: { 
          name: '',
          permissions: 'invalid' // オブジェクトではない
        }
      });

      const results = await dialogAPI.batchValidate([workingCopyId]);
      const validation = results[workingCopyId];
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('フォルダー名は必須です');
      expect(validation.errors).toContain('権限設定の形式が正しくありません');
    });

    it('should validate location data', async () => {
      const workingCopyId = await dialogAPI.createWorkingCopy('location-plugin');

      // 無効なデータ
      await dialogAPI.updateWorkingCopy(workingCopyId, {
        data: { 
          name: 'Test Location',
          locationType: 'restaurant',
          latitude: 91, // 無効な緯度
          longitude: 181, // 無効な経度
          contact: {
            email: 'invalid-email' // 無効なメール形式
          }
        }
      });

      const results = await dialogAPI.batchValidate([workingCopyId]);
      const validation = results[workingCopyId];
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('緯度は-90から90の数値である必要があります');
      expect(validation.errors).toContain('経度は-180から180の数値である必要があります');
      expect(validation.warnings).toContain('メールアドレスの形式が正しくない可能性があります');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent working copy', async () => {
      const nonExistentId = 'non-existent-id' as EntityId;
      
      await expect(
        dialogAPI.evaluateCapabilities(nonExistentId, 0)
      ).rejects.toThrow('Working copy not found');
    });

    it('should handle unsupported node type', async () => {
      await expect(
        dialogAPI.createWorkingCopy('unsupported-type')
      ).rejects.toThrow('No handler found for node type: unsupported-type');
    });
  });
});