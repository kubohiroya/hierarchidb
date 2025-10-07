import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { MultiStepDialogState } from '@hierarchidb/common-types';
import { DialogStateService } from '../DialogStateService.js';
import { storeRegistry } from '../../entity/store-registry.js';
import { registerFolderWorkerStores } from '../../../../../plugins/folder-plugin/src/worker-factory/registerFolderWorkerStores.ts';

describe('DialogStateService with plugin-provided peer stores', () => {
  it('publishes state when folder peer store is registered via plugin wiring', async () => {
    const registryProxy = {
      registerPeer(nodeType: string, store: unknown) {
        storeRegistry.registerPeer(nodeType, store as any);
      },
      registerGroup(nodeType: string, store: unknown) {
        storeRegistry.registerGroup(nodeType, store as any);
      },
      registerRelations(nodeType: string, store: unknown) {
        storeRegistry.registerRelations(nodeType, store as any);
      },
      getPeer<T = unknown>(nodeType: string): T | undefined {
        return storeRegistry.getPeer(nodeType) as T | undefined;
      },
      getGroup<T = unknown>(nodeType: string): T | undefined {
        return storeRegistry.getGroup(nodeType) as T | undefined;
      },
      getRelations<T = unknown>(nodeType: string): T | undefined {
        return storeRegistry.getRelations(nodeType) as T | undefined;
      },
    } as const;

    await registerFolderWorkerStores({ storeRegistry: registryProxy as unknown as {
      registerPeer(nodeType: string, store: unknown): void;
      registerGroup(nodeType: string, store: unknown): void;
      registerRelations(nodeType: string, store: unknown): void;
      getPeer<T = unknown>(nodeType: string): T | undefined;
      getGroup<T = unknown>(nodeType: string): T | undefined;
      getRelations<T = unknown>(nodeType: string): T | undefined;
    } });

    const service = new DialogStateService();
    const state: MultiStepDialogState = {
      nodeId: 'folder-node',
      activeStepIndex: 0,
      steps: [
        { id: 'basic', title: 'Basic', enabled: true, completed: false, error: null },
      ],
      canProceedNext: true,
      canGoBack: false,
      canSave: false,
      canStartBatch: false,
      validationErrors: undefined,
      updatedAt: Date.now(),
      metadata: { title: 'Create Folder', subtitle: 'Draft', committableStepIndices: [0] },
    };

    await service.publishState({ nodeType: 'folder', nodeId: 'folder-node', state });
    const stored = await service.getState({ nodeType: 'folder', nodeId: 'folder-node' });
    expect(stored?.steps?.[0]?.id).toBe('basic');
  });
});
