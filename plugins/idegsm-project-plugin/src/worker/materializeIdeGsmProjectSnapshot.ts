import { type NodeId, type NodeType, toNodeId } from '@hierarchidb/core-types';
import {
  assertIdeGsmProjectRootNodeData,
  createIdeGsmProjectChildMetadata,
  createIdeGsmProjectSnapshotManifest,
  type IdeGsmProjectChildMetadata,
  type IdeGsmProjectRootNodeData,
  type IdeGsmProjectSnapshotEntry,
} from '@hierarchidb/idegsm-project-api';
import type { TreeNode, TreeNodeMetadata } from '@hierarchidb/tree-api';
import type {
  IdeGsmProjectCommittedRootNode,
  IdeGsmProjectCoreDbPort,
  IdeGsmProjectMaterializationInput,
  IdeGsmProjectMaterializationResult,
  IdeGsmProjectMaterializedNode,
  IdeGsmProjectSyncJournal,
} from './ideGsmProjectMaterializationTypes.js';

const FOLDER_NODE_TYPE = 'folder' as NodeType;
const YAML_NODE_TYPE = 'yaml-file' as NodeType;
const CSV_METADATA_NODE_TYPE = 'spreadsheet' as NodeType;

export async function materializeIdeGsmProjectSnapshot(
  port: IdeGsmProjectCoreDbPort,
  input: IdeGsmProjectMaterializationInput
): Promise<IdeGsmProjectMaterializationResult> {
  const manifest = createIdeGsmProjectSnapshotManifest(input.snapshot);
  const startedJournal: IdeGsmProjectSyncJournal = {
    operationId: input.operationId,
    generationId: input.generationId,
    projectNodeId: input.projectNodeId,
    state: 'started',
    manifest,
    createdAt: input.now,
    committedAt: null,
    error: null,
  };

  await port.putJournal(startedJournal);
  try {
    return await port.runInTx('rw', ['nodes'], async () => {
      const root = await port.getNode(input.projectNodeId);
      if (!root) {
        throw new Error('IDEGSM_PROJECT_ROOT_NOT_FOUND');
      }
      const rootData = root.data;
      assertIdeGsmProjectRootNodeData(rootData);
      if (root.version !== input.expectedRootVersion) {
        throw new Error('IDEGSM_PROJECT_ROOT_VERSION_CONFLICT');
      }
      if (
        rootData.connectionName !== input.snapshot.connectionName ||
        rootData.projectRelativePath !== input.snapshot.projectRelativePath
      ) {
        throw new Error('IDEGSM_PROJECT_IDENTITY_CONFLICT');
      }

      await port.putJournal({ ...startedJournal, state: 'validated' });
      const childNodes = buildMaterializedChildNodes(input, root.depth);
      await port.putNodes(childNodes);
      const committedRoot = buildCommittedRoot(root, {
        ...rootData,
        activeSyncGenerationId: input.generationId,
        syncState: 'synced',
        syncedAt: new Date(input.now).toISOString(),
      });
      await port.putNode(committedRoot);
      await port.putJournal({
        ...startedJournal,
        state: 'committed',
        committedAt: input.now,
      });
      return {
        operationId: input.operationId,
        generationId: input.generationId,
        manifest,
        childNodeIds: childNodes.map((node) => node.id),
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await port.putJournal({
      ...startedJournal,
      state: 'reverted',
      error: message,
    });
    throw error;
  }
}

export function buildMaterializedChildNodes(
  input: IdeGsmProjectMaterializationInput,
  rootDepth: number
): readonly IdeGsmProjectMaterializedNode[] {
  const entries = [...input.snapshot.entries].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  );
  const entryByPath = new Map(entries.map((entry) => [entry.relativePath, entry]));
  const nodes: IdeGsmProjectMaterializedNode[] = [];
  for (const entry of entries) {
    const parentPath = getParentPath(entry.relativePath);
    if (parentPath !== null && !entryByPath.has(parentPath)) {
      throw new Error(`IDEGSM_PROJECT_PARENT_MISSING:${entry.relativePath}`);
    }
    const metadata = createIdeGsmProjectChildMetadata({
      projectNodeId: input.projectNodeId,
      generationId: input.generationId,
      relativePath: entry.relativePath,
      kind: entry.kind,
      digest: entry.digest ?? null,
      sizeBytes: entry.sizeBytes ?? null,
      updatedAt: entry.updatedAt ?? null,
    });
    nodes.push(buildChildNode(input, entry, metadata, parentPath, rootDepth));
  }
  return nodes;
}

function buildCommittedRoot(
  root: TreeNode,
  data: IdeGsmProjectRootNodeData
): IdeGsmProjectCommittedRootNode {
  assertIdeGsmProjectRootNodeData(data);
  return {
    ...root,
    data,
    draftData: undefined,
    updatedAt: data.syncedAt ? Date.parse(data.syncedAt) : root.updatedAt,
    hasChildren: true,
  } as IdeGsmProjectCommittedRootNode;
}

function buildChildNode(
  input: IdeGsmProjectMaterializationInput,
  entry: IdeGsmProjectSnapshotEntry,
  metadata: IdeGsmProjectChildMetadata,
  parentPath: string | null,
  rootDepth: number
): IdeGsmProjectMaterializedNode {
  const id = childNodeId(input.projectNodeId, input.generationId, entry.relativePath);
  const parentId =
    parentPath === null
      ? input.projectNodeId
      : childNodeId(input.projectNodeId, input.generationId, parentPath);
  const nodeMetadata: TreeNodeMetadata = {
    name: basename(entry.relativePath),
    description: '',
    tags: [],
  };
  const data = buildChildData(entry, metadata);
  return {
    id,
    parentId,
    nodeType: nodeTypeForEntry(entry),
    depth: rootDepth + entry.relativePath.split('/').length,
    createdAt: input.now,
    updatedAt: input.now,
    version: 1,
    metadata: nodeMetadata,
    draftMetadata: null,
    data,
    visible: true,
    hasChildren: entry.kind === 'folder',
  };
}

function buildChildData(
  entry: IdeGsmProjectSnapshotEntry,
  metadata: IdeGsmProjectChildMetadata
): Record<string, unknown> | null {
  if (entry.kind === 'folder') return null;
  if (entry.kind === 'yaml-file') {
    return {
      name: basename(entry.relativePath),
      schemaId: 'ide-gsm/yaml',
      content: entry.yamlContent,
      ideGsm: metadata,
    };
  }
  return {
    ideGsm: metadata,
  };
}

function nodeTypeForEntry(entry: IdeGsmProjectSnapshotEntry): NodeType {
  if (entry.kind === 'folder') return FOLDER_NODE_TYPE;
  if (entry.kind === 'yaml-file') return YAML_NODE_TYPE;
  return CSV_METADATA_NODE_TYPE;
}

function childNodeId(projectNodeId: NodeId, generationId: string, relativePath: string): NodeId {
  return toNodeId(
    `idegsm-project:${encodeURIComponent(projectNodeId)}:${encodeURIComponent(generationId)}:${encodeURIComponent(relativePath)}`
  );
}

function basename(relativePath: string): string {
  const segments = relativePath.split('/');
  const last = segments[segments.length - 1];
  if (typeof last !== 'string' || last.length === 0) {
    throw new Error(`IDEGSM_PROJECT_INVALID_BASENAME:${relativePath}`);
  }
  return last;
}

function getParentPath(relativePath: string): string | null {
  const separator = relativePath.lastIndexOf('/');
  if (separator < 0) return null;
  return relativePath.slice(0, separator);
}
