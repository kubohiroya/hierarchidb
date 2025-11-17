import type { NodeId } from '@hierarchidb/common-types';
import { describe, expect, it, vi } from 'vitest';
import { emptyTrashBranch } from '../../emptyTrashBranch.js';

const trashRootId = 'r:trash' as NodeId;

describe('emptyTrashBranch', () => {
  it('calls removeSubtree when trash root is available and nodes exist', async () => {
    const removeSubtree = vi.fn().mockResolvedValue({ success: true });
    const result = await emptyTrashBranch({
      trashRootId,
      hasNodes: true,
      getMutationAPI: async () => ({ removeSubtree }),
    });

    expect(removeSubtree).toHaveBeenCalledWith(trashRootId);
    expect(result.success).toBe(true);
  });

  it('skips worker call when trash root is missing', async () => {
    const removeSubtree = vi.fn();
    const result = await emptyTrashBranch({
      trashRootId: null,
      hasNodes: true,
      getMutationAPI: async () => ({ removeSubtree }),
    });

    expect(removeSubtree).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('skips worker call when no rows remain', async () => {
    const removeSubtree = vi.fn();
    const result = await emptyTrashBranch({
      trashRootId,
      hasNodes: false,
      getMutationAPI: async () => ({ removeSubtree }),
    });

    expect(removeSubtree).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('propagates worker failures as unsuccessful result', async () => {
    const removeSubtree = vi.fn().mockResolvedValue({ success: false, error: 'boom' });
    const result = await emptyTrashBranch({
      trashRootId,
      hasNodes: true,
      getMutationAPI: async () => ({ removeSubtree }),
    });

    expect(removeSubtree).toHaveBeenCalledWith(trashRootId);
    expect(result.success).toBe(false);
  });
});
