import type { NodeId } from '@hierarchidb/common-types';
import type { TreeMutationAPI } from '@hierarchidb/common-api';

export type EmptyTrashBranchDeps = {
  nodeIds: ReadonlyArray<NodeId>;
  getMutationAPI: () => Promise<Pick<TreeMutationAPI, 'removeNodes'>>;
};

export type EmptyTrashBranchResult = {
  success: boolean;
};

/**
 * Permanently delete the provided trash nodes (and their descendants).
 *
 * `nodeIds` should contain the branch root IDs that need to be removed.
 * For the trash container view, pass the visible row IDs. For branch views,
 * pass the branch root identifier.
 */
export async function emptyTrashBranch({
  nodeIds,
  getMutationAPI,
}: EmptyTrashBranchDeps): Promise<EmptyTrashBranchResult> {
  const targets = nodeIds.filter((id): id is NodeId => Boolean(id));
  if (targets.length === 0) {
    return { success: false };
  }

  try {
    const mutationAPI = await getMutationAPI();
    const result = await mutationAPI.removeNodes(targets);
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
