import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CommandEnvelope,
  CommandResult,
  NodeId,
  NodeType,
  PasteNodesPayload,
  Timestamp,
  TreeNode,
} from '@hierarchidb/common-types';
import { toNodeId, toNodeType } from '@hierarchidb/common-types';
import type { CoreDB } from '../CoreDB.js';
import type { CommandProcessor } from '../CommandProcessor.js';

const makeNode = (id: string, parentId: string, name: string): TreeNode => ({
  id: toNodeId(id),
  parentId: toNodeId(parentId),
  nodeType: toNodeType('folder'),
  name,
  depth: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version: 1,
});

describe('TreeMutationService bulk paths', () => {
  beforeEach(() => vi.resetModules());

  it('pasteNodes uses bulkCreateNodes for multiple nodes', async () => {
    const core: Pick<CoreDB, 'listChildren' | 'createNode' | 'bulkCreateNodes'> = {
      listChildren: vi.fn(async () => []),
      createNode: vi.fn(async (node: TreeNode) => node.id),
      bulkCreateNodes: vi.fn(async () => undefined),
    };
    const processor: Pick<CommandProcessor, 'processCommand'> = {
      processCommand: vi.fn(async () => ({ success: true, seq: 1 } as CommandResult)),
    };
    const { TreeMutationService } = await import('../TreeMutationService.js');
    const svc = new TreeMutationService(core as unknown as CoreDB, processor as CommandProcessor);

    const payload: PasteNodesPayload = {
      nodes: {
        [toNodeId('a')]: makeNode('a', 'x', 'A'),
        [toNodeId('b')]: makeNode('b', 'x', 'B'),
      },
      nodeIds: [toNodeId('a'), toNodeId('b')],
      toParentId: toNodeId('p'),
      onNameConflict: 'error',
    };
    const env: CommandEnvelope<'pasteNodes', PasteNodesPayload> = {
      commandId: 'c1',
      groupId: 'g1',
      kind: 'pasteNodes',
      payload,
      issuedAt: Date.now() as Timestamp,
    };
    const r = await svc.pasteNodes(env);
    expect(r.success).toBe(true);
    expect(core.bulkCreateNodes).toHaveBeenCalledOnce();
  });
});
