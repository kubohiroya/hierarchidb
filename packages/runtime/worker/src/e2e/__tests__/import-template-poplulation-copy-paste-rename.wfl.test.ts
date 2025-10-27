import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import * as Comlink from 'comlink';
import { MessageChannel } from 'worker_threads';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { ImportData } from '@hierarchidb/common-api';
import type { NodeId, TreeId } from '@hierarchidb/common-types';
import { exposeTestAPI } from '../test-worker.entry.js';
import { createEndpointFromMessagePort } from '../test-utils/messagePortEndpoint.js';

type TestWorkerAPI = {
  getQueryAPI(): Promise<import('@hierarchidb/common-api').TreeQueryAPI>;
  getMutationAPI(): Promise<import('@hierarchidb/common-api').TreeMutationAPI>;
  getImportExportAPI(): Promise<import('@hierarchidb/common-api').ImportExportAPI>;
};

type TemplateNode = {
  treeNodeId: string;
  parentTreeNodeId: string | null;
  treeNodeType: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

type TemplateFile = {
  nodes: Record<string, TemplateNode>;
  rootNodeIds: string[];
};

const templateUrl = new URL('../../../../../../app/public/templates/population-2023/tree-nodes.json', import.meta.url);

async function loadTemplate(): Promise<TemplateFile> {
  const raw = await readFile(templateUrl, 'utf-8');
  return JSON.parse(raw) as TemplateFile;
}

function buildImportNodes(data: TemplateFile): ImportData['nodes'] {
  const { nodes, rootNodeIds } = data;
  const toImportNode = (id: string): ImportData['nodes'][number] | null => {
    const node = nodes[id];
    if (!node) return null;
    const children = Object.values(nodes)
      .filter((child) => child?.parentTreeNodeId === id)
      .map((child) => toImportNode(child.treeNodeId))
      .filter((child): child is ImportData['nodes'][number] => child !== null);
    return {
      name: node.name,
      nodeType: node.treeNodeType,
      description: node.description,
      metadata: node.metadata,
      children: children.length > 0 ? children : undefined,
    };
  };
  return rootNodeIds
    .map((rootId) => toImportNode(rootId))
    .filter((node): node is ImportData['nodes'][number] => node !== null);
}

async function buildClipboard(
  queryAPI: import('@hierarchidb/common-api').TreeQueryAPI,
  rootId: NodeId,
): Promise<{ nodes: Record<string, any>; nodeIds: NodeId[] }> {
  const rootNode = await queryAPI.getNode(rootId);
  if (!rootNode) throw new Error(`Node ${rootId} not found`);
  const result: Record<string, any> = { [rootNode.id]: { ...rootNode } };
  const order: NodeId[] = [rootNode.id as NodeId];
  const stack: NodeId[] = [rootNode.id as NodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = await queryAPI.listChildren(current);
    for (const child of children) {
      result[child.id] = { ...child };
      order.push(child.id as NodeId);
      stack.push(child.id as NodeId);
    }
  }
  return { nodes: result, nodeIds: order };
}

const createPasteEnvelope = (payload: {
  nodes: Record<string, any>;
  nodeIds: NodeId[];
  toParentId: NodeId;
  onNameConflict?: 'error' | 'auto-rename';
}) => ({
  commandId: randomUUID(),
  groupId: randomUUID(),
  kind: 'pasteNodes' as const,
  payload,
  issuedAt: Date.now(),
  type: 'pasteNodes' as const,
});

describe('WFL paste rename behavior for imported template', () => {
  it('pastes with unique name, allows rename, and blocks conflicting rename', async () => {
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
    expect(importResult?.success).toBe(true);

    const rootChildren = await queryAPI.listChildren(rootId);
    const populationFolder = rootChildren.find((node) => node.name === 'Total Population by Country');
    if (!populationFolder) throw new Error('Population folder not found');

    const clipboard = await buildClipboard(queryAPI, populationFolder.id as NodeId);

    const pasteRoot = await mutationAPI.pasteNodes(
      createPasteEnvelope({
        nodes: clipboard.nodes,
        nodeIds: clipboard.nodeIds,
        toParentId: rootId,
        onNameConflict: 'auto-rename',
      }),
    );
    expect(pasteRoot?.success).toBe(true);
    const pastedRootId = pasteRoot?.newNodeIds?.[0] as NodeId | undefined;
    expect(pastedRootId).toBeDefined();

    const rootChildrenAfterPaste = await queryAPI.listChildren(rootId);
    const pastedFolder = rootChildrenAfterPaste.find((child) => child.id === pastedRootId);
    expect(pastedFolder).toBeTruthy();
    expect(pastedFolder?.name).not.toBe(populationFolder.name);

    const renameRes = await mutationAPI.updateNode({
      nodeId: pastedRootId!,
      name: 'Population Folder Copy',
    });
    expect(renameRes.success).toBe(true);

    const renamedNode = await queryAPI.getNode(pastedRootId!);
    expect(renamedNode?.name).toBe('Population Folder Copy');

    const renameConflict = await mutationAPI.updateNode({
      nodeId: pastedRootId!,
      name: populationFolder.name,
    });
    expect(renameConflict.success).toBe(false);
    expect(renameConflict.error ?? '').toMatch(/ConstraintError|already exists|NAME_NOT_UNIQUE/);

    const finalRootChildren = await queryAPI.listChildren(rootId);
    const originalNameCount = finalRootChildren.filter((node) => node.name === populationFolder.name).length;
    expect(originalNameCount).toBe(1);
    expect(finalRootChildren.some((node) => node.name === 'Population Folder Copy')).toBe(true);
  }, 30_000);
});
