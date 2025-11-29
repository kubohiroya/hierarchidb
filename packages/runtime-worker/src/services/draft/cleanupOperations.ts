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

  const data = (existing as { data?: unknown }).data;
  const draftData = (existing as { draftData?: unknown }).draftData;
  const version = (existing as { version?: number }).version ?? 0;
  const createdAt = (existing as { createdAt?: number }).createdAt;
  const updatedAt = (existing as { updatedAt?: number }).updatedAt;
  const hasCommittedData = data !== null && data !== undefined;
  const hasCommittedVersion = version > 1;
  const hasCommittedTimestamps =
    typeof createdAt === 'number' && typeof updatedAt === 'number' && createdAt !== updatedAt;

  // Treat as create-only draft only when there is no committed payload/version/timestamp signal.
  const hasDraftPayload =
    draftData !== null &&
    draftData !== undefined &&
    (typeof draftData !== 'object' || Object.keys(draftData as Record<string, unknown>).length > 0);

  if (!hasCommittedData && !hasCommittedVersion && !hasCommittedTimestamps && !hasDraftPayload) {
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
