/**
 * @file MultiStepDialog.integration.test.ts
 * @description Integration tests for the Multi-Step Dialog system
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { WorkerAPIImpl } from './mocks/WorkerAPIImpl.js';
import type { NodeId } from '@hierarchidb/common-types';

describe('Multi-Step Dialog Integration', () => {
  let workerAPI: any; // WorkerAPIImpl type not available
  let dialogAPI: any;

  beforeEach(async () => {
    //  WorkerAPI
    workerAPI = new WorkerAPIImpl('test-services');
    await workerAPI.initialize();
    dialogAPI = workerAPI.getMultiStepDialogAPI();
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
      const workingCopyId = await dialogAPI.createWorkingCopy('location', parentId);

      const workingCopy = await dialogAPI.getWorkingCopy(workingCopyId);
      expect(workingCopy).toBeDefined();
      expect(workingCopy?.nodeType).toBe('location');
      expect(workingCopy?.parentNodeId).toBe(parentId);
    });

    it('should update a working copy', async () => {
      const workingCopyId = await dialogAPI.createWorkingCopy('folder-plugin');

      const updates = {
        data: {
          name: 'Test Folder',
          description: 'A test folder',
        },
        metadata: {
          currentStep: 1,
        },
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
    let workingCopyId: NodeId;

    beforeEach(async () => {
      workingCopyId = await dialogAPI.createWorkingCopy('folder-plugin');
    });

    it('should evaluate capabilities for step 0 (basic info)', async () => {
      //  -
      let capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 0);

      expect(capabilities.canNavigateTo).toBe(true);
      expect(capabilities.canStartBatch).toBe(false);
      expect(capabilities.canSave).toBe(false);
      expect(capabilities.canProceedToNext).toBe(false);
      expect(capabilities.canBackToPrevious).toBe(false);

      await dialogAPI.updateWorkingCopy(workingCopyId, {
        data: { name: 'Test Folder' },
      });

      capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 0);
      expect(capabilities.canProceedToNext).toBe(true);
    });

    it('should evaluate capabilities for step 1 (permissions)', async () => {
      let capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 1);
      expect(capabilities.canNavigateTo).toBe(false);

      await dialogAPI.updateWorkingCopy(workingCopyId, {
        data: { name: 'Test Folder' },
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
        data: { name: 'Test Folder' },
      });

      const capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 2);
      expect(capabilities.canNavigateTo).toBe(true);
      expect(capabilities.canStartBatch).toBe(true);
      expect(capabilities.canSave).toBe(true);
      expect(capabilities.canProceedToNext).toBe(false);
      expect(capabilities.canBackToPrevious).toBe(true);
    });
  });

  describe('Location Plugin Step Capabilities', () => {
    let workingCopyId: NodeId;

    beforeEach(async () => {
      workingCopyId = await dialogAPI.createWorkingCopy('location');
    });

    it('should evaluate capabilities for step 0 (basic info)', async () => {
      let capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 0);
      expect(capabilities.canProceedToNext).toBe(false);

      await dialogAPI.updateWorkingCopy(workingCopyId, {
        data: {
          name: 'Test Location',
          locationType: 'restaurant',
        },
      });

      capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 0);
      expect(capabilities.canProceedToNext).toBe(true);
    });

    it('should evaluate capabilities for step 1 (location info)', async () => {
      await dialogAPI.updateWorkingCopy(workingCopyId, {
        data: {
          name: 'Test Location',
          locationType: 'restaurant',
        },
      });

      let capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 1);
      expect(capabilities.canProceedToNext).toBe(false);
      expect(capabilities.canSave).toBe(false);

      await dialogAPI.updateWorkingCopy(workingCopyId, {
        data: {
          name: 'Test Location',
          locationType: 'restaurant',
          latitude: 35.6762,
          longitude: 139.6503,
        },
      });

      capabilities = await dialogAPI.evaluateCapabilities(workingCopyId, 1);
      expect(capabilities.canProceedToNext).toBe(true);
      expect(capabilities.canSave).toBe(true);
      expect(capabilities.canStartBatch).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    it('should validate multiple working copies', async () => {
      //  Working Copy
      const folderWorkingCopyId = await dialogAPI.createWorkingCopy('folder-plugin');
      await dialogAPI.updateWorkingCopy(folderWorkingCopyId, {
        data: { name: 'Valid Folder' },
      });

      //  Working Copy
      const locationWorkingCopyId = await dialogAPI.createWorkingCopy('location');
      await dialogAPI.updateWorkingCopy(locationWorkingCopyId, {
        data: { name: '', locationType: 'restaurant' },
      });

      const results = await dialogAPI.batchValidate([folderWorkingCopyId, locationWorkingCopyId]);

      expect(results[folderWorkingCopyId].valid).toBe(true);
      expect(results[locationWorkingCopyId].valid).toBe(false);
      expect(results[locationWorkingCopyId].errors).toContain('ロケーション名は必須です');
    });

    it('should batch evaluate capabilities', async () => {
      const workingCopyId1 = await dialogAPI.createWorkingCopy('folder-plugin');
      const workingCopyId2 = await dialogAPI.createWorkingCopy('location');

      await dialogAPI.updateWorkingCopy(workingCopyId1, {
        data: { name: 'Test Folder' },
      });
      await dialogAPI.updateWorkingCopy(workingCopyId2, {
        data: {
          name: 'Test Location',
          locationType: 'restaurant',
          latitude: 35.6762,
          longitude: 139.6503,
        },
      });

      const results = await dialogAPI.batchEvaluateCapabilities([
        { workingCopyId: workingCopyId1, step: 1 },
        { workingCopyId: workingCopyId2, step: 2 },
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

      await dialogAPI.updateWorkingCopy(workingCopyId, {
        data: {
          name: '',
          permissions: 'invalid',
        },
      });

      const results = await dialogAPI.batchValidate([workingCopyId]);
      const validation = results[workingCopyId];

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('フォルダー名は必須です');
      expect(validation.errors).toContain('権限設定の形式が正しくありません');
    });

    it('should validate location data', async () => {
      const workingCopyId = await dialogAPI.createWorkingCopy('location-plugin');

      await dialogAPI.updateWorkingCopy(workingCopyId, {
        data: {
          name: 'Test Location',
          locationType: 'restaurant',
          latitude: 91, longitude: 181, contact: {
            email: 'invalid-email',
          },
        },
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
      const nonExistentId = 'non-existent-id' as NodeId;

      await expect(dialogAPI.evaluateCapabilities(nonExistentId, 0)).rejects.toThrow(
        'Working copy not found',
      );
    });

    it('should handle unsupported node type', async () => {
      await expect(dialogAPI.createWorkingCopy('unsupported-type')).rejects.toThrow(
        'No handler found for node type: unsupported-type',
      );
    });
  });
});
