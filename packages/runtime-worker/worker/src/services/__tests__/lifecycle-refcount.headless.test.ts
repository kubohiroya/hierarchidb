import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { NodeId, NodeType, PluginDefinition } from '@hierarchidb/common-type';
import { CoreDB } from '../CoreDB.js';
import { NodeLifecycleManager } from '../NodeLifecycleManager.js';

describe('NodeLifecycleManager reference counting port', () => {
  it('invokes increment/decrement when registry provided', async () => {
    const core = await CoreDB.getSingleton(`refcount-${Date.now()}`);
    const plugins: Record<string, PluginDefinition> = {};
    const nlm = await NodeLifecycleManager.getSingleton(core, plugins);
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
    const internals = nlm as unknown as {
      handleReferenceCountIncrement(targetNodeId: NodeId, nodeType: NodeType): Promise<void>;
      handleReferenceCountDecrement(targetNodeId: NodeId, nodeType: NodeType): Promise<void>;
    };
    await internals.handleReferenceCountIncrement(nodeId, 'folder' as NodeType);
    await internals.handleReferenceCountDecrement(nodeId, 'folder' as NodeType);
    expect(inc).toBe(1);
    expect(dec).toBe(1);
  });
});
