import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import { emptyTrashBranch } from '../../emptyTrashBranch.js';

const nodeA = 'trash-node-a' as NodeId;
const nodeB = 'trash-node-b' as NodeId;

describe('emptyTrashBranch', () => {
  it('removes the provided node ids', async () => {
    const removeNodes = vi.fn().mockResolvedValue({ success: true });
    const result = await emptyTrashBranch({
      nodeIds: [nodeA, nodeB],
      getMutationAPI: async () => ({ removeNodes }),
    });

    expect(removeNodes).toHaveBeenCalledWith([nodeA, nodeB]);
    expect(result.success).toBe(true);
  });

  it('skips execution when list is empty', async () => {
    const removeNodes = vi.fn();
    const result = await emptyTrashBranch({
      nodeIds: [],
      getMutationAPI: async () => ({ removeNodes }),
    });

    expect(removeNodes).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('propagates worker failures', async () => {
    const removeNodes = vi.fn().mockResolvedValue({ success: false, error: 'boom' });
    const result = await emptyTrashBranch({
      nodeIds: [nodeA],
      getMutationAPI: async () => ({ removeNodes }),
    });

    expect(removeNodes).toHaveBeenCalledWith([nodeA]);
    expect(result.success).toBe(false);
  });
});
