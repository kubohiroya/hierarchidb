import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { NodeId, NodeType } from '@hierarchidb/common-type';
import { CoreDB } from '../CoreDB.js';
import { NodeLifecycleManager } from '../NodeLifecycleManager.js';

describe('NodeLifecycleManager reference counting port', () => {
  it('invokes increment/decrement when registry provided', async () => {
    const core = await CoreDB.getSingleton(`refcount-${Date.now()}`);
    const nlm = await NodeLifecycleManager.getSingleton(core, {} as any);
    let inc = 0;
    let dec = 0;
    nlm.setReferenceCountingRegistry({
      'folder': {
        async incrementReferenceCount(_nodeId: NodeId) {
          inc++;
        },
        async decrementReferenceCount(_nodeId: NodeId) {
          dec++;
        },
      },
    });

    const nodeId = 'x' as NodeId;
    await (nlm as any).handleReferenceCountIncrement(nodeId, 'folder' as NodeType);
    await (nlm as any).handleReferenceCountDecrement(nodeId, 'folder' as NodeType);
    expect(inc).toBe(1);
    expect(dec).toBe(1);
  });
});
