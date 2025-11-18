import { generateUUID } from '@hierarchidb/util';
import type { CommandEnvelope } from '../command-types.js';
import type { CoreDB } from '../CoreDB.js';
import type { NodeId, Timestamp } from '@hierarchidb/common-types';

/**
 * Discard a working copy by removing the holder and working copy node pair.
 */
export async function discardWorkingCopy(
  coreDB: CoreDB,
  workingCopyNodeIdPair: NodeId[]
): Promise<void> {
  await coreDB.nodes.bulkDelete(workingCopyNodeIdPair);
  try {
    const wcId = workingCopyNodeIdPair?.[1];
    if (wcId) {
      const { EntityLifecycleManager } = await import('../../entity/EntityLifecycleManager.js');
      const lifecycle = EntityLifecycleManager.getSingleton(coreDB);
      const envelope: CommandEnvelope<'discardWorkingCopy', { workingCopyId: NodeId }> = {
        commandId: generateUUID(),
        groupId: generateUUID(),
        kind: 'discardWorkingCopy',
        payload: { workingCopyId: wcId },
        issuedAt: Date.now() as Timestamp,
        type: 'discardWorkingCopy',
      };
      await lifecycle.handleCommand(envelope);
    }
  } catch {}
}
