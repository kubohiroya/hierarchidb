import type { DiscardDraftOptions } from '@hierarchidb/tree-api';
import type { NodeId } from '@hierarchidb/core-types';
import { generateUUID } from '@hierarchidb/util';
import type { CoreDB } from '~/services/CoreDB';
import type { CommandEnvelope } from '~/services/command-types';

/**
 * Discard a draft by clearing draftMetadata/draftData/dialogUIState on the node.
 * Optionally delete uncommitted drafts when `forceDelete` is set; otherwise
 * only deletes nodes with neither committed nor draft atoms.
 */
export async function discardTreeNodeDraft(
  coreDB: CoreDB,
  draftNodeId: NodeId,
  options?: DiscardDraftOptions
): Promise<void> {
  const existing = await coreDB.nodes.get(draftNodeId);
  if (!existing) return;

  const data = (existing as { data?: unknown }).data;
  const draftMetadata = (existing as { draftMetadata?: unknown }).draftMetadata;
  const draftData = (existing as { draftData?: unknown }).draftData;
  const version = (existing as { version?: number }).version ?? 0;
  const hasCommittedData = data !== null && data !== undefined;
  const hasCommittedVersion = version > 1;

  const hasDraftPayload =
    draftData !== undefined &&
    (typeof draftData !== 'object' || Object.keys(draftData as Record<string, unknown>).length > 0);
  const hasDraftState = hasDraftPayload || draftMetadata !== null;

  const hasCommittedState = hasCommittedData || hasCommittedVersion;

  const shouldDelete =
    options?.forceDelete === true
      ? !hasCommittedState
      : !hasCommittedData && !hasCommittedVersion && !hasDraftState;

  if (shouldDelete) {
    await coreDB.nodes.delete(draftNodeId);
  } else {
    await coreDB.nodes.update(draftNodeId, {
      draftMetadata: null,
      draftData: undefined,
      dialogUIState: undefined,
    });
  }

  const { EntityLifecycleManager } = await import('~/entity/EntityLifecycleManager');
  const lifecycle = EntityLifecycleManager.getSingleton(coreDB);
  const envelope: CommandEnvelope<'discardDraft', { draftId: NodeId }> = {
    commandId: generateUUID(),
    groupId: generateUUID(),
    kind: 'discardDraft',
    payload: { draftId: draftNodeId },
    issuedAt: Date.now(),
    type: 'discardDraft',
  };
  await lifecycle.handleCommand(envelope);
}
