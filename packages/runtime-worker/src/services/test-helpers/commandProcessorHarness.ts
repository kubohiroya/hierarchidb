import 'fake-indexeddb/auto';
import type { NodeId, NodeType, Timestamp } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { SingletonMixin } from '@hierarchidb/util';
import { CommandProcessor } from '~/services/CommandProcessor';
import { CoreDB } from '~/services/CoreDB';

export type CommandTestHarness = {
  core: CoreDB;
  cp: CommandProcessor;
  cleanup: () => Promise<unknown>;
};

export async function createCommandTestHarness(label: string): Promise<CommandTestHarness> {
  const dbName = `hidb-core-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const core = CoreDB.createForTest(dbName);
  await core.open();
  await core.initialize();
  const cp = new CommandProcessor(core);

  return {
    core,
    cp,
    cleanup: async () => {
      SingletonMixin.terminate('TreeSubscriptionService');
      try {
        await core.delete();
      } finally {
        core.close();
      }
    },
  };
}

export type SeedNodeInput = Partial<TreeNode> & {
  id?: NodeId;
  parentId?: NodeId;
  name?: string;
  nodeType?: NodeType;
};

export async function seedNode(core: CoreDB, input: SeedNodeInput): Promise<TreeNode> {
  const now = Date.now() as Timestamp;
  const metadataName =
    (typeof input.metadata?.name === 'string' && input.metadata.name.length > 0
      ? input.metadata.name
      : undefined) ??
    (typeof input.name === 'string' && input.name.length > 0 ? input.name : undefined) ??
    input.id ??
    'node';
  const metadata = {
    name: metadataName,
    description: '',
    tags: [],
    ...(input.metadata ?? {}),
  };
  const node: TreeNode = {
    id: (input.id ?? `node-${Math.random().toString(36).slice(2)}`) as NodeId,
    parentId: (input.parentId ?? ('root' as NodeId)) as NodeId,
    nodeType: input.nodeType ?? ('folder' as NodeType),
    name: metadataName,
    depth: input.depth ?? 1,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    version: input.version ?? 1,
    metadata,
    ...input,
  } as TreeNode;

  await core.createNode(node);
  const stored = await core.getNode(node.id as NodeId);
  return stored ?? node;
}
