import { generateUUID } from '@hierarchidb/util';
import type { CommandEnvelope } from '../command-types.js';
import type { CoreDB } from '../CoreDB.js';
import type { NodeId, Timestamp } from '@hierarchidb/common-types';

/**
 * Discard a draft by clearing draftData/dialogUIState on the node.
 */
export async function discardWorkingCopy(coreDB: CoreDB, workingCopyNodeId: NodeId): Promise<void> {
  const existing = await coreDB.nodes.get(workingCopyNodeId);
  if (!existing) return;

  // If this was a create-only draft (no committed data), delete the node entirely.
  const hasCommittedData =
    (existing as { data?: unknown }).data !== null &&
    (existing as { data?: unknown }).data !== undefined;

  if (!hasCommittedData) {
    await coreDB.nodes.delete(workingCopyNodeId);
  } else {
    await coreDB.nodes.update(workingCopyNodeId, { draftData: null, dialogUIState: undefined });
  }
  try {
    const { EntityLifecycleManager } = await import('../../entity/EntityLifecycleManager.js');
    const lifecycle = EntityLifecycleManager.getSingleton(coreDB);
    const envelope: CommandEnvelope<'discardWorkingCopy', { workingCopyId: NodeId }> = {
      commandId: generateUUID(),
      groupId: generateUUID(),
      kind: 'discardWorkingCopy',
      payload: { workingCopyId: workingCopyNodeId },
      issuedAt: Date.now() as Timestamp,
      type: 'discardWorkingCopy',
    };
    await lifecycle.handleCommand(envelope);
  } catch {}
}
