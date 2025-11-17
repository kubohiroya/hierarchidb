import type { NodeId } from '@hierarchidb/common-types';
import type { TreeMutationAPI } from '@hierarchidb/common-api';

export type EmptyTrashBranchDeps = {
  trashRootId: NodeId | null | undefined;
  hasNodes: boolean;
  getMutationAPI: () => Promise<Pick<TreeMutationAPI, 'removeSubtree'>>;
};

export type EmptyTrashBranchResult = {
  success: boolean;
};

/**
 * Permanently delete every descendant under the provided trash root.
 * The dialog supplies the currently viewed trash node ID as `trashRootId`.
 *
 * When the tree is already empty or the root identifier is missing, the helper
 * returns `success: false` without invoking the worker.
 */
export async function emptyTrashBranch({
  trashRootId,
  hasNodes,
  getMutationAPI,
}: EmptyTrashBranchDeps): Promise<EmptyTrashBranchResult> {
  if (!trashRootId || !hasNodes) {
    return { success: false };
  }

  try {
    const mutationAPI = await getMutationAPI();
    const result = await mutationAPI.removeSubtree(trashRootId);
    if (!result.success) {
      console.error('Empty trash failed:', result.error);
      return { success: false };
    }
    return { success: true };
  } catch (error) {
    console.error('Error emptying trash:', error);
    return { success: false };
  }
}
