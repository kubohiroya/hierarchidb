import type { NodeId, NodeType, Timestamp, TreeNode } from '@hierarchidb/common-types';
import { generateNodeId } from '@hierarchidb/common-types';

type BaseOverrides = {
  id?: NodeId;
  parentId?: NodeId;
  nodeType?: NodeType;
  name?: string;
  description?: string;
  tags?: string[];
  depth?: number;
  data?: TreeNode['data'];
  draftData?: TreeNode['draftData'];
  draftMetadata?: TreeNode['draftMetadata'];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  version?: number;
  removedAt?: Timestamp;
  originalName?: string;
  originalParentId?: NodeId;
  lastTouchedAt?: Timestamp;
};

export function makeNode(overrides: BaseOverrides = {}): TreeNode {
  const now = Date.now() as Timestamp;
  const {
    id = generateNodeId(),
    parentId = 'r:root' as NodeId,
    nodeType = 'folder' as NodeType,
    name = 'Untitled',
    description,
    tags = [],
    depth = 1,
    data = null,
    draftData = null,
    draftMetadata = null,
    createdAt = now,
    updatedAt = now,
    version = 1,
    removedAt,
    originalName,
    originalParentId,
    lastTouchedAt,
  } = overrides;

  return {
    id,
    parentId,
    nodeType,
    depth,
    createdAt,
    updatedAt,
    version,
    metadata: {
      name,
      description,
      tags,
    },
    draftMetadata,
    data,
    draftData,
    removedAt,
    originalName,
    originalParentId,
    lastTouchedAt,
  } satisfies TreeNode;
}

export function makeDraftNode(overrides: BaseOverrides = {}): TreeNode {
  return makeNode({
    draftMetadata: {
      name: overrides.name ?? 'Untitled',
      description: overrides.description,
      tags: overrides.tags ?? [],
    },
    draftData: overrides.draftData ?? {},
    ...overrides,
  });
}
