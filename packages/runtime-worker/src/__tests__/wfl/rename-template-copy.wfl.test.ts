import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { ImportData } from '@hierarchidb/common-api';
import type {
  CommandEnvelope,
  CommandResult,
  NodeId,
  PasteNodesPayload,
  TreeId,
  TreeNode,
} from '@hierarchidb/common-types';
import * as Comlink from 'comlink';
import { describe, expect, it } from 'vitest';
import { MessageChannel } from 'worker_threads';
import { createEndpointFromMessagePort } from '../../e2e/test-utils/messagePortEndpoint.js';
import { exposeTestAPI } from '../../e2e/test-worker.entry.js';

type ExtendedTreeMutationAPI = import('@hierarchidb/common-api').TreeMutationAPI & {
  pasteNodes(command: CommandEnvelope<'pasteNodes', PasteNodesPayload>): Promise<CommandResult>;
};

type TestWorkerAPI = {
  getQueryAPI(): Promise<import('@hierarchidb/common-api').TreeQueryAPI>;
  getMutationAPI(): Promise<ExtendedTreeMutationAPI>;
  getImportExportAPI(): Promise<import('@hierarchidb/common-api').ImportExportAPI>;
};

type TemplateNode = {
  nodeType: string;
  metadata?: { name?: string; description?: string } | Record<string, unknown>;
  draftData?: Record<string, unknown> | null;
  draftMetadata?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
  children?: TemplateNode[];
};

type TemplateFile = {
  nodes: TemplateNode[];
};

const templateUrl = new URL(
  '../../../../../app/public/templates/population-2023/tree-nodes.json',
  import.meta.url
);

async function loadTemplate(): Promise<TemplateFile> {
  const raw = await readFile(templateUrl, 'utf-8');
  return JSON.parse(raw) as TemplateFile;
}

function buildImportNodes(data: TemplateFile): ImportData['nodes'] {
  const toImportNode = (node: TemplateNode): ImportData['nodes'][number] => {
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
        .filter((child): child is ImportData['nodes'][number] => !!child) ?? [];

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
  queryAPI: import('@hierarchidb/common-api').TreeQueryAPI,
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

const createPasteEnvelope = (
  payload: CommandEnvelope<'pasteNodes', PasteNodesPayload>['payload']
): CommandEnvelope<'pasteNodes', PasteNodesPayload> => ({
  commandId: randomUUID(),
  groupId: randomUUID(),
  kind: 'pasteNodes',
  payload,
  issuedAt: Date.now(),
});

describe('WFL paste rename behavior for imported template', () => {
  it('pastes with unique name, allows rename, and blocks conflicting rename', async () => {
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(createEndpointFromMessagePort(port1));
    const client = Comlink.wrap<TestWorkerAPI>(createEndpointFromMessagePort(port2));

    const queryAPI = await client.getQueryAPI();
    const mutationAPI = await client.getMutationAPI();
    const importExportAPI = await client.getImportExportAPI();

    const treeId: TreeId = 'r' as TreeId;
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
      throw new Error(err.error ?? 'pasteNodes failed');
    }
    const pastedRootId = pasteRoot.newNodeIds?.[0] as NodeId | undefined;
    expect(pastedRootId).toBeDefined();

    const rootChildrenAfterPaste = await queryAPI.listChildren(rootId);
    const pastedFolder = rootChildrenAfterPaste.find((child) => child.id === pastedRootId);
    expect(pastedFolder).toBeTruthy();
    expect(pastedFolder?.metadata.name).not.toBe(populationFolder.metadata.name);

    if (!pastedRootId) {
      throw new Error('pasted root id missing');
    }

    const renameRes = await mutationAPI.updateNode({
      nodeId: pastedRootId,
      name: 'Population Folder Copy',
    });
    expect(renameRes.success).toBe(true);

    const renamedNode = await queryAPI.getNode(pastedRootId);
    expect(renamedNode?.metadata.name).toBeDefined();
    expect(renamedNode?.metadata.name).not.toBe(populationFolder.metadata.name);

    const renameConflict = await mutationAPI.updateNode({
      nodeId: pastedRootId,
      name: populationFolder.metadata.name,
    });
    expect(renameConflict.success).toBe(false);

    const finalRootChildren = await queryAPI.listChildren(rootId);
    const originalNameCount = finalRootChildren.filter(
      (node) => node.metadata.name === populationFolder.metadata.name
    ).length;
    expect(originalNameCount).toBeGreaterThanOrEqual(1);
  }, 30_000);
});
