import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import { beforeEach, describe, expect, it } from 'vitest';
import { CommandProcessor } from '../../services/CommandProcessor.js';
import { CoreDB } from '../../services/CoreDB.js';
import { commandMetrics } from '../../services/utils/metrics.js';

describe('Headless metrics (command latency)', () => {
  beforeEach(() => {
    commandMetrics.reset();
  });

  async function newCore(name: string): Promise<CoreDB> {
    return await CoreDB.getSingleton(`metrics-${name}-${Date.now()}-${Math.random()}`);
  }

  it('records latency and counts for simple commands', async () => {
    const core = await newCore('basic');
    const cp = new CommandProcessor(core);

    // Create
    await cp.processCommand(
      cp.createEnvelope('createNode', {
        nodeType: 'folder' as NodeType,
        treeId: 'r' as TreeId,
        parentId: 'r:root' as NodeId,
        metadata: { name: 'X' },
      })
    );
    // Ping (registered success)
    const pingPayload: Record<string, never> = {};
    await cp.processCommand(cp.createEnvelope('ping', pingPayload));

    const snap = commandMetrics.snapshot();
    expect(snap.createNode?.count ?? 0).toBeGreaterThan(0);
    expect(snap.ping?.count ?? 0).toBeGreaterThan(0);
    expect((snap.ping?.totalMs ?? 0) >= 0).toBe(true);
  });
});
