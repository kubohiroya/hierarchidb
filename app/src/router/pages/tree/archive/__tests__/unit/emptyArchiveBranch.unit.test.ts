import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import { emptyArchiveBranch } from '~/router/pages/tree/archive/emptyArchiveBranch';

const nodeA = 'archive-node-a' as NodeId;
const nodeB = 'archive-node-b' as NodeId;

describe('emptyArchiveBranch', () => {
  it('removes the provided node ids', async () => {
    const removeNodes = vi.fn().mockResolvedValue({ success: true });
    const result = await emptyArchiveBranch({
      nodeIds: [nodeA, nodeB],
      getMutationAPI: async () => ({ removeNodes }),
    });

    expect(removeNodes).toHaveBeenCalledWith([nodeA, nodeB]);
    expect(result.success).toBe(true);
  });

  it('skips execution when list is empty', async () => {
    const removeNodes = vi.fn();
    const result = await emptyArchiveBranch({
      nodeIds: [],
      getMutationAPI: async () => ({ removeNodes }),
    });

    expect(removeNodes).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('propagates worker failures', async () => {
    const removeNodes = vi.fn().mockResolvedValue({ success: false, error: 'boom' });
    const result = await emptyArchiveBranch({
      nodeIds: [nodeA],
      getMutationAPI: async () => ({ removeNodes }),
    });

    expect(removeNodes).toHaveBeenCalledWith([nodeA]);
    expect(result.success).toBe(false);
  });
});
