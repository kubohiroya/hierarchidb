import 'fake-indexeddb/auto';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { toNodeId, toNodeType } from '@hierarchidb/core-types';
import { describe, expect, it } from 'vitest';
import { CoreDB } from '../../services/CoreDB.js';
import { NodeLifecycleManager } from '../../services/NodeLifecycleManager.js';
import type { RuntimePluginDefinition } from '../../types/RuntimePluginDefinition.js';

describe('NodeLifecycleManager reference counting port', () => {
  it('invokes increment/decrement when registry provided', async () => {
    const core = await CoreDB.getSingleton(`refcount-${Date.now()}`);
    const plugins: Record<string, RuntimePluginDefinition> = {} as Record<
      string,
      RuntimePluginDefinition
    >;
    const nlm = await NodeLifecycleManager.getSingleton(core, plugins);
    let inc = 0;
    let dec = 0;
    nlm.setReferenceCountingRegistry({
      [toNodeType('folder')]: {
        async incrementReferenceCount(_nodeId: NodeId) {
          inc++;
        },
        async decrementReferenceCount(_nodeId: NodeId) {
          dec++;
        },
      },
    });

    const nodeId = toNodeId('x');
    const internals = nlm as unknown as {
      handleReferenceCountIncrement(targetNodeId: NodeId, nodeType: NodeType): Promise<void>;
      handleReferenceCountDecrement(targetNodeId: NodeId, nodeType: NodeType): Promise<void>;
    };
    await internals.handleReferenceCountIncrement(nodeId, toNodeType('folder'));
    await internals.handleReferenceCountDecrement(nodeId, toNodeType('folder'));
    expect(inc).toBe(1);
    expect(dec).toBe(1);
  });
});
