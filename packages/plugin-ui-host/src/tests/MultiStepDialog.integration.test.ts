/**
 * @file MultiStepDialog.integration.test.ts
 * @description Integration tests for the Multi-Step Dialog system
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/common-types';
import { WorkerAPIMock } from '../__tests__/plugin-dialog-mocks';

describe('Multi-Step Dialog Integration', () => {
  let workerAPI: WorkerAPIMock | undefined;
  let dialogAPI: ReturnType<WorkerAPIMock['getMultiStepDialogAPI']>;

  beforeEach(async () => {
    //  WorkerAPI
    workerAPI = new WorkerAPIMock('test-services');
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
      const draftId = await dialogAPI.createDraft('folder-plugin');

      expect(draftId).toBeDefined();
      expect(typeof draftId).toBe('string');

      const draft = await dialogAPI.getDraft(draftId);
      expect(draft).toBeDefined();
      expect(draft?.nodeType).toBe('folder-plugin');
      expect(draft?.data).toEqual({});
    });

    it('should create a working copy for location plugin with parent', async () => {
      const parentId = 'parent-123' as NodeId;
      const draftId = await dialogAPI.createDraft('location', parentId);

      const draft = await dialogAPI.getDraft(draftId);
      expect(draft).toBeDefined();
      expect(draft?.nodeType).toBe('location');
      expect(draft?.parentNodeId).toBe(parentId);
    });

    it('should update a working copy', async () => {
      const draftId = await dialogAPI.createDraft('folder-plugin');

      const updates = {
        data: {
          name: 'Test Folder',
          description: 'A test folder',
        },
        metadata: {
          currentStep: 1,
        },
      };

      const updatedDraft = await dialogAPI.updateDraft(draftId, updates);

      expect(updatedDraft.data.name).toBe('Test Folder');
      expect(updatedDraft.data.description).toBe('A test folder');
      expect(updatedDraft.metadata.currentStep).toBe(1);
    });

    it('should delete a working copy', async () => {
      const draftId = await dialogAPI.createDraft('folder-plugin');

      await dialogAPI.deleteDraft(draftId);

      const draft = await dialogAPI.getDraft(draftId);
      expect(draft).toBeUndefined();
    });
  });

  describe('Folder Plugin Step Capabilities', () => {
    let draftId: NodeId;

    beforeEach(async () => {
      draftId = await dialogAPI.createDraft('folder-plugin');
    });

    it('should evaluate capabilities for step 0 (basic info)', async () => {
      //  -
      let capabilities = await dialogAPI.evaluateCapabilities(draftId, 0);

      expect(capabilities.canNavigateTo).toBe(true);
      expect(capabilities.canStartBatch).toBe(false);
      expect(capabilities.canSave).toBe(false);
      expect(capabilities.canProceedToNext).toBe(false);
      expect(capabilities.canBackToPrevious).toBe(false);

      await dialogAPI.updateDraft(draftId, {
        data: { name: 'Test Folder' },
      });

      capabilities = await dialogAPI.evaluateCapabilities(draftId, 0);
      expect(capabilities.canProceedToNext).toBe(true);
    });

    it('should evaluate capabilities for step 1 (permissions)', async () => {
      let capabilities = await dialogAPI.evaluateCapabilities(draftId, 1);
      expect(capabilities.canNavigateTo).toBe(false);

      await dialogAPI.updateDraft(draftId, {
        data: { name: 'Test Folder' },
      });

      capabilities = await dialogAPI.evaluateCapabilities(draftId, 1);
      expect(capabilities.canNavigateTo).toBe(true);
      expect(capabilities.canStartBatch).toBe(true);
      expect(capabilities.canSave).toBe(true);
      expect(capabilities.canProceedToNext).toBe(true);
      expect(capabilities.canBackToPrevious).toBe(true);
    });

    it('should evaluate capabilities for step 2 (templates and bookmarks)', async () => {
      await dialogAPI.updateDraft(draftId, {
        data: { name: 'Test Folder' },
      });

      const capabilities = await dialogAPI.evaluateCapabilities(draftId, 2);
      expect(capabilities.canNavigateTo).toBe(true);
      expect(capabilities.canStartBatch).toBe(true);
      expect(capabilities.canSave).toBe(true);
      expect(capabilities.canProceedToNext).toBe(false);
      expect(capabilities.canBackToPrevious).toBe(true);
    });
  });

  describe('Location Plugin Step Capabilities', () => {
    let draftId: NodeId;

    beforeEach(async () => {
      draftId = await dialogAPI.createDraft('location');
    });

    it('should evaluate capabilities for step 0 (basic info)', async () => {
      let capabilities = await dialogAPI.evaluateCapabilities(draftId, 0);
      expect(capabilities.canProceedToNext).toBe(false);

      await dialogAPI.updateDraft(draftId, {
        data: {
          name: 'Test Location',
          locationType: 'restaurant',
        },
      });

      capabilities = await dialogAPI.evaluateCapabilities(draftId, 0);
      expect(capabilities.canProceedToNext).toBe(true);
    });

    it('should evaluate capabilities for step 1 (location info)', async () => {
      await dialogAPI.updateDraft(draftId, {
        data: {
          name: 'Test Location',
          locationType: 'restaurant',
        },
      });

      let capabilities = await dialogAPI.evaluateCapabilities(draftId, 1);
      expect(capabilities.canProceedToNext).toBe(false);
      expect(capabilities.canSave).toBe(false);

      await dialogAPI.updateDraft(draftId, {
        data: {
          name: 'Test Location',
          locationType: 'restaurant',
          latitude: 35.6762,
          longitude: 139.6503,
        },
      });

      capabilities = await dialogAPI.evaluateCapabilities(draftId, 1);
      expect(capabilities.canProceedToNext).toBe(true);
      expect(capabilities.canSave).toBe(true);
      expect(capabilities.canStartBatch).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    it('should validate multiple working copies', async () => {
      //  Working Copy
      const folderDraftId = await dialogAPI.createDraft('folder-plugin');
      await dialogAPI.updateDraft(folderDraftId, {
        data: { name: 'Valid Folder' },
      });

      //  Working Copy
      const locationDraftId = await dialogAPI.createDraft('location');
      await dialogAPI.updateDraft(locationDraftId, {
        data: { name: '', locationType: 'restaurant' },
      });

      const results = await dialogAPI.batchValidate([folderDraftId, locationDraftId]);

      expect(results[folderDraftId].valid).toBe(true);
      expect(results[locationDraftId].valid).toBe(false);
      expect(results[locationDraftId].errors).toContain('ロケーション名は必須です');
    });

    it('should batch evaluate capabilities', async () => {
      const draftId1 = await dialogAPI.createDraft('folder-plugin');
      const draftId2 = await dialogAPI.createDraft('location');

      await dialogAPI.updateDraft(draftId1, {
        data: { name: 'Test Folder' },
      });
      await dialogAPI.updateDraft(draftId2, {
        data: {
          name: 'Test Location',
          locationType: 'restaurant',
          latitude: 35.6762,
          longitude: 139.6503,
        },
      });

      const results = await dialogAPI.batchEvaluateCapabilities([
        { draftId: draftId1, step: 1 },
        { draftId: draftId2, step: 2 },
      ]);

      expect(results[draftId1].canNavigateTo).toBe(true);
      expect(results[draftId1].canStartBatch).toBe(true);
      expect(results[draftId2].canNavigateTo).toBe(true);
      expect(results[draftId2].canStartBatch).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should validate folder data', async () => {
      const draftId = await dialogAPI.createDraft('folder-plugin');

      await dialogAPI.updateDraft(draftId, {
        data: {
          name: '',
          permissions: 'invalid',
        },
      });

      const results = await dialogAPI.batchValidate([draftId]);
      const validation = results[draftId];

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('フォルダー名は必須です');
      expect(validation.errors).toContain('権限設定の形式が正しくありません');
    });

    it('should validate location data', async () => {
      const draftId = await dialogAPI.createDraft('location-plugin');

      await dialogAPI.updateDraft(draftId, {
        data: {
          name: 'Test Location',
          locationType: 'restaurant',
          latitude: 91,
          longitude: 181,
          contact: {
            email: 'invalid-email',
          },
        },
      });

      const results = await dialogAPI.batchValidate([draftId]);
      const validation = results[draftId];

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
        'Working copy not found'
      );
    });

    it('should handle unsupported node type', async () => {
      await expect(dialogAPI.createDraft('unsupported-type')).rejects.toThrow(
        'No handler found for node type: unsupported-type'
      );
    });
  });
});
