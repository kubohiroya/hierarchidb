import type { NodeId, NodeType } from '@hierarchidb/common-types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PeerEntity, PeerStore } from '../../../entity/store.js';
import { storeRegistry } from '../../../entity/store-registry.js';
import type { CommandTestHarness } from '../../test-helpers/commandProcessorHarness.js';
import { createCommandTestHarness, seedNode } from '../../test-helpers/commandProcessorHarness.js';

const FOLDER_TYPE = 'folder' as NodeType;

type FolderPeerData = { v: number };

describe('PeerEntity delete policy (trash vs permanent vs WC)', () => {
  let harness: CommandTestHarness;
  let folderPeerStore: PeerStore<FolderPeerData>;
  let rootId: NodeId;

  beforeEach(async () => {
    harness = await createCommandTestHarness('peer-entity');
    const [tree] = await harness.core.trees.toArray();
    rootId = (tree?.rootId ?? 'r:root') as NodeId;

    folderPeerStore = createFolderPeerStore();
    storeRegistry.registerPeer<FolderPeerData>(FOLDER_TYPE, folderPeerStore);

    await seedNode(harness.core, {
      id: 'a' as NodeId,
      parentId: rootId,
      name: 'A',
      nodeType: FOLDER_TYPE,
    });
  });

  afterEach(async () => {
    await harness.cleanup();
  });

  function createFolderPeerStore(): PeerStore<FolderPeerData> {
    const entries = new Map<NodeId, PeerEntity<FolderPeerData>>();
    return {
      async get(id: NodeId) {
        return entries.get(id);
      },
      async put(entity: PeerEntity<FolderPeerData>) {
        entries.set(entity.nodeId, { ...entity });
      },
      async delete(id: NodeId) {
        entries.delete(id);
      },
    } satisfies PeerStore<FolderPeerData>;
  }

  it('moveToTrash keeps PeerEntity; restore keeps PeerEntity', async () => {
    const { cp } = harness;
    await folderPeerStore.put({ nodeId: 'a' as NodeId, data: { v: 1 }, displayMode: 'normal' });

    const moveToTrash = cp.createEnvelope('moveToTrash', { nodeIds: ['a' as NodeId] });
    const moved = await cp.processCommand(moveToTrash);
    expect(moved.success).toBe(true);
    const afterTrash = await folderPeerStore.get('a' as NodeId);
    expect(afterTrash?.data?.v).toBe(1);

    const restore = cp.createEnvelope('restoreFromTrash', { nodeIds: ['a' as NodeId] });
    const restored = await cp.processCommand(restore);
    expect(restored.success).toBe(true);
    const afterRestore = await folderPeerStore.get('a' as NodeId);
    expect(afterRestore?.data?.v).toBe(1);
  });

  it('remove (permanent delete) deletes PeerEntity', async () => {
    const { cp } = harness;
    await folderPeerStore.put({ nodeId: 'a' as NodeId, data: { v: 1 }, displayMode: 'maximize' });

    const removeEnvelope = cp.createEnvelope('remove', { nodeIds: ['a' as NodeId] });
    const removed = await cp.processCommand(removeEnvelope);
    expect(removed.success).toBe(true);
    await expect(folderPeerStore.get('a' as NodeId)).resolves.toBeUndefined();
  });
});
