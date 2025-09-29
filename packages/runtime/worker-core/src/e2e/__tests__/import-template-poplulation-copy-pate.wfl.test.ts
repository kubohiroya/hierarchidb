import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import * as Comlink from 'comlink';
import { MessageChannel } from 'worker_threads';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { ImportData } from '@hierarchidb/common-api';
import type { NodeId, TreeId } from '@hierarchidb/common-type';
import { exposeTestAPI } from '../test-worker.entry.js';

const endpointFromPort = (port: MessagePort): Comlink.Endpoint => {
  const listeners = new Map<(event: MessageEvent) => void, (value: unknown) => void>();
  return {
    postMessage(value, transfer) {
      if (transfer && transfer.length > 0) {
        port.postMessage(value, transfer);
      } else {
        port.postMessage(value);
      }
    },
    addEventListener(_type, handler) {
      const wrapped = (data: unknown) => handler({ data } as MessageEvent);
      listeners.set(handler, wrapped);
      port.on('message', wrapped);
    },
    removeEventListener(_type, handler) {
      const wrapped = listeners.get(handler);
      if (wrapped) {
        port.off('message', wrapped);
        listeners.delete(handler);
      }
    },
    start() {
      port.start?.();
    },
  };
};

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

function createPasteEnvelope(payload: {
  nodes: Record<string, any>;
  nodeIds: NodeId[];
  toParentId: NodeId;
  onNameConflict?: 'error' | 'auto-rename';
}) {
  return {
    commandId: randomUUID(),
    groupId: randomUUID(),
    kind: 'pasteNodes' as const,
    payload,
    issuedAt: Date.now(),
    type: 'pasteNodes' as const,
  };
}

describe('WFL paste behavior for imported template', () => {
  it('pastes folder under root with unique name and allows self/descendant targets', async () => {
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(endpointFromPort(port1));
    const client = Comlink.wrap<TestWorkerAPI>(endpointFromPort(port2));

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

    const pasteSelf = await mutationAPI.pasteNodes(
      createPasteEnvelope({
        nodes: clipboard.nodes,
        nodeIds: clipboard.nodeIds,
        toParentId: populationFolder.id as NodeId,
        onNameConflict: 'auto-rename',
      }),
    );
    expect(pasteSelf?.success).toBe(true);
    expect(pasteSelf?.newNodeIds?.length).toBe(clipboard.nodeIds.length);

    const templateChildren = await queryAPI.listChildren(populationFolder.id as NodeId);
    const shapeNode = templateChildren.find((node) => node.nodeType === 'shape');
    if (!shapeNode) throw new Error('Shape child not found');

    const pasteToDescendant = await mutationAPI.pasteNodes(
      createPasteEnvelope({
        nodes: clipboard.nodes,
        nodeIds: clipboard.nodeIds,
        toParentId: shapeNode.id as NodeId,
        onNameConflict: 'auto-rename',
      }),
    );
    expect(pasteToDescendant?.success).toBe(true);

    const pasteRoot = await mutationAPI.pasteNodes(
      createPasteEnvelope({
        nodes: clipboard.nodes,
        nodeIds: clipboard.nodeIds,
        toParentId: rootId,
        onNameConflict: 'auto-rename',
      }),
    );
    expect(pasteRoot?.success).toBe(true);
    const pastedRootId = pasteRoot?.newNodeIds?.[0];
    expect(pastedRootId).toBeDefined();

    const rootChildrenAfterPaste = await queryAPI.listChildren(rootId);
    const pastedFolder = rootChildrenAfterPaste.find((child) => child.id === pastedRootId);
    expect(pastedFolder).toBeTruthy();
    expect(pastedFolder?.name).not.toBe(populationFolder.name);
    expect(pastedFolder?.name.startsWith(populationFolder.name)).toBe(true);

    const uniqueNames = new Set(rootChildrenAfterPaste.map((node) => node.name));
    expect(uniqueNames.size).toBe(rootChildrenAfterPaste.length);
  }, 30_000);
});
