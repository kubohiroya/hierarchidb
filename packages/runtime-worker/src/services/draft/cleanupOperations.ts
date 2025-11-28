import { generateUUID } from '@hierarchidb/util';
import type { CommandEnvelope } from '../command-types.js';
import type { CoreDB } from '../CoreDB.js';
import type { NodeId, Timestamp } from '@hierarchidb/common-types';

/**
 * Discard a draft by clearing draftMetadata/draftData/dialogUIState on the node.
 * If the node has no committed data, delete it entirely.
 */
export async function discardTreeNodeDraft(coreDB: CoreDB, draftNodeId: NodeId): Promise<void> {
  const existing = await coreDB.nodes.get(draftNodeId);
  if (!existing) return;

  // If this was a create-only draft (no committed data), delete the node entirely.
  const hasCommittedData =
    (existing as { data?: unknown }).data !== null &&
    (existing as { data?: unknown }).data !== undefined;

  if (!hasCommittedData) {
    await coreDB.nodes.delete(draftNodeId);
  } else {
    await coreDB.nodes.update(draftNodeId, {
      draftMetadata: null,
      draftData: null,
      dialogUIState: undefined,
    });
  }
  try {
    const { EntityLifecycleManager } = await import('../../entity/EntityLifecycleManager.js');
    const lifecycle = EntityLifecycleManager.getSingleton(coreDB);
    const envelope: CommandEnvelope<'discardDraft', { draftId: NodeId }> = {
      commandId: generateUUID(),
      groupId: generateUUID(),
      kind: 'discardDraft',
      payload: { draftId: draftNodeId },
      issuedAt: Date.now() as Timestamp,
      type: 'discardDraft',
    };
    await lifecycle.handleCommand(envelope);
  } catch {}
}
