import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { NodeId, PeerEntity, TreeId } from '@hierarchidb/core-types';
import { toNodeType } from '@hierarchidb/core-types';
import type { ImportData } from '@hierarchidb/import-export-api';
import type {
  CommandEnvelope,
  CommandResult,
  PasteNodesPayload,
  TreeNode,
  TreeNodeData,
} from '@hierarchidb/tree-api';
import * as Comlink from 'comlink';
import { describe, expect, it } from 'vitest';
import { MessageChannel } from 'worker_threads';
import { createEndpointFromMessagePort } from '../../e2e/test-utils/createEndpointFromMessagePort';
import { exposeTestAPI } from '../../e2e/test-worker.entry';

type ExtendedTreeMutationAPI = import('@hierarchidb/tree-api').TreeMutationAPI & {
  pasteNodes(command: CommandEnvelope<'pasteNodes', PasteNodesPayload>): Promise<CommandResult>;
};

type TestWorkerAPI = {
  getQueryAPI(): Promise<import('@hierarchidb/tree-api').TreeQueryAPI>;
  getMutationAPI(): Promise<ExtendedTreeMutationAPI>;
  getImportExportAPI(): Promise<
    import('@hierarchidb/import-export-api').ImportExportAPI<TreeNodeData>
  >;
};

type TemplateNode = {
  nodeType: string;
  metadata?: { name?: string; description?: string } | Record<string, unknown>;
  draftData?: Partial<PeerEntity<TreeNodeData>>;
  draftMetadata?: Record<string, unknown> | undefined;
  data?: Record<string, unknown> | undefined;
  children?: TemplateNode[];
};

type TemplateFile = {
  nodes: TemplateNode[];
};

const templateUrl = new URL(
  '../../../../../app/public/templates/population-2023/population-by-countries-2023.json',
  import.meta.url
);

async function loadTemplate(): Promise<TemplateFile> {
  const raw = await readFile(templateUrl, 'utf-8');
  return JSON.parse(raw) as TemplateFile;
}

function buildImportNodes(data: TemplateFile): ImportData<TreeNodeData>['nodes'] {
  const toImportNode = (node: TemplateNode): ImportData<TreeNodeData>['nodes'][number] => {
    const metadata =
      node.metadata && typeof node.metadata === 'object'
        ? (node.metadata as Record<string, unknown>)
        : undefined;
    const draftData =
      node.draftData && typeof node.draftData === 'object'
        ? (node.draftData as Record<string, unknown>)
        : undefined;
    const draftMetadata =
      node.draftMetadata && typeof node.draftMetadata === 'object'
        ? (node.draftMetadata as Record<string, unknown>)
        : undefined;
    const dataPayload =
      node.data && typeof node.data === 'object'
        ? (node.data as Record<string, unknown>)
        : undefined;
    const children =
      node.children
        ?.map((child) => toImportNode(child))
        .filter((child): child is ImportData<TreeNodeData>['nodes'][number] => !!child) ?? [];

    return {
      name: (metadata as { name?: string })?.name ?? 'Untitled',
      nodeType: node.nodeType,
      description: (metadata as { description?: string })?.description,
      metadata,
      draftData,
      draftMetadata,
      data: dataPayload,
      children: children.length > 0 ? children : undefined,
    };
  };

  if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
    throw new Error('Template must provide nodes');
  }

  return data.nodes.map((node) => toImportNode(node));
}

async function buildClipboard(
  queryAPI: import('@hierarchidb/tree-api').TreeQueryAPI,
  rootId: NodeId
): Promise<{ nodes: Record<NodeId, TreeNode>; nodeIds: NodeId[] }> {
  const rootNode = await queryAPI.getNode(rootId);
  if (!rootNode) throw new Error(`Node ${rootId} not found`);
  const result = {} as Record<NodeId, TreeNode>;
  const rootNodeId = rootNode.id as NodeId;
  result[rootNodeId] = { ...rootNode };
  const order: NodeId[] = [rootNodeId];
  const stack: NodeId[] = [rootNodeId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const children = await queryAPI.listChildren(current);
    for (const child of children) {
      const childId = child.id as NodeId;
      result[childId] = { ...child };
      order.push(childId);
      stack.push(childId);
    }
  }
  return { nodes: result, nodeIds: order };
}

function createPasteEnvelope(
  payload: CommandEnvelope<'pasteNodes', PasteNodesPayload>['payload']
): CommandEnvelope<'pasteNodes', PasteNodesPayload> {
  return {
    commandId: randomUUID(),
    groupId: randomUUID(),
    kind: 'pasteNodes',
    payload,
    issuedAt: Date.now(),
  };
}

describe('WFL paste behavior for imported template', () => {
  it('pastes folder under root with unique name and allows self/descendant targets', async () => {
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(createEndpointFromMessagePort(port1));
    const client = Comlink.wrap<TestWorkerAPI>(createEndpointFromMessagePort(port2));

    const queryAPI = await client.getQueryAPI();
    const mutationAPI = await client.getMutationAPI();
    const importExportAPI = await client.getImportExportAPI();

    const treeId = 'r' as TreeId;
    const tree = await queryAPI.getTree(treeId);
    if (!tree?.rootId) throw new Error('rootId missing');
    const rootId = tree.rootId as NodeId;

    const template = await loadTemplate();
    const importNodes = buildImportNodes(template);
    const importResult = await importExportAPI.importNodes({
      treeId,
      targetParentId: rootId,
      data: { nodes: importNodes },
      format: 'json',
      conflictResolution: 'rename',
    });
    if (!importResult?.success) {
      expect(importResult).toBeTruthy();
      return;
    }

    const rootChildren = await queryAPI.listChildren(rootId);
    const populationFolder = rootChildren.find(
      (node) => node.metadata.name === 'Total Population by Country'
    );
    if (!populationFolder) throw new Error('Population folder not found');

    const clipboard = await buildClipboard(queryAPI, populationFolder.id as NodeId);

    const pasteSelf = await mutationAPI.pasteNodes(
      createPasteEnvelope({
        nodes: clipboard.nodes,
        nodeIds: clipboard.nodeIds,
        toParentId: populationFolder.id as NodeId,
        onNameConflict: 'auto-rename',
      })
    );
    if (!pasteSelf.success) {
      const err = pasteSelf as { error?: string };
      throw new Error(err.error ?? 'pasteNodes self failed');
    }
    expect(pasteSelf.newNodeIds?.length).toBe(clipboard.nodeIds.length);

    const templateChildren = await queryAPI.listChildren(populationFolder.id as NodeId);
    const shapeNode = templateChildren.find((node) => node.nodeType === toNodeType('shape'));
    if (!shapeNode) throw new Error('Shape child not found');

    const pasteToDescendant = await mutationAPI.pasteNodes(
      createPasteEnvelope({
        nodes: clipboard.nodes,
        nodeIds: clipboard.nodeIds,
        toParentId: shapeNode.id as NodeId,
        onNameConflict: 'auto-rename',
      })
    );
    expect(pasteToDescendant.success).toBe(true);

    const pasteRoot = await mutationAPI.pasteNodes(
      createPasteEnvelope({
        nodes: clipboard.nodes,
        nodeIds: clipboard.nodeIds,
        toParentId: rootId,
        onNameConflict: 'auto-rename',
      })
    );
    if (!pasteRoot.success) {
      const err = pasteRoot as { error?: string };
      throw new Error(err.error ?? 'pasteNodes to root failed');
    }
    const pastedRootId = pasteRoot.newNodeIds?.[0];
    expect(pastedRootId).toBeDefined();

    const rootChildrenAfterPaste = await queryAPI.listChildren(rootId);
    const pastedFolder = rootChildrenAfterPaste.find((child) => child.id === pastedRootId);
    expect(pastedFolder).toBeTruthy();
    expect(pastedFolder?.metadata.name).not.toBe(populationFolder.metadata.name);
    expect(pastedFolder?.metadata.name.startsWith(populationFolder.metadata.name)).toBe(true);

    const uniqueNames = new Set(rootChildrenAfterPaste.map((node) => node.metadata.name));
    expect(uniqueNames.size).toBe(rootChildrenAfterPaste.length);
  }, 30_000);
});
