import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import * as Comlink from 'comlink';
import { MessageChannel } from 'worker_threads';
import { readFile } from 'node:fs/promises';
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
      const wrapped = (data: unknown) => {
        if (typeof handler === 'function') {
          handler({ data } as MessageEvent);
        } else if (handler && typeof (handler as { handleEvent?: (event: MessageEvent) => void }).handleEvent === 'function') {
          handler.handleEvent({ data } as MessageEvent);
        }
      };
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

describe('WFL duplicate behavior for imported template', () => {
  it('duplicates template folder and enforces invalid destinations', async () => {
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
    expect(populationFolder).toBeTruthy();
    if (!populationFolder) throw new Error('Population folder not found');

    const duplicateRes = await mutationAPI.duplicateNodes({
      nodeIds: [populationFolder.id as NodeId],
      toParentId: rootId,
    });
    expect(duplicateRes?.success).toBe(true);
    const duplicateId = duplicateRes?.nodeIds?.[0] as NodeId | undefined;
    expect(duplicateId).toBeDefined();

    const rootChildrenAfterDup = await queryAPI.listChildren(rootId);
    const duplicateNode = rootChildrenAfterDup.find((node) => node.id === duplicateId);
    expect(duplicateNode).toBeTruthy();
    expect(duplicateNode?.name).not.toBe(populationFolder.name);
    expect(duplicateNode?.name.startsWith(populationFolder.name)).toBe(true);

    const uniqueNames = new Set(rootChildrenAfterDup.map((node) => node.name));
    expect(uniqueNames.size).toBe(rootChildrenAfterDup.length);

    const duplicateSelf = await mutationAPI.duplicateNodes({
      nodeIds: [populationFolder.id as NodeId],
      toParentId: populationFolder.id as NodeId,
    });
    expect(duplicateSelf?.success).toBe(false);
    expect(duplicateSelf?.error).toContain('Cannot duplicate node into itself');

    const templateChildren = await queryAPI.listChildren(populationFolder.id as NodeId);
    const shapeNode = templateChildren.find((node) => node.nodeType === 'shape');
    if (!shapeNode) throw new Error('Shape child not found');

    const duplicateToDescendant = await mutationAPI.duplicateNodes({
      nodeIds: [populationFolder.id as NodeId],
      toParentId: shapeNode.id as NodeId,
    });
    expect(duplicateToDescendant?.success).toBe(false);
    expect(duplicateToDescendant?.error).toContain('descendant');
  }, 30_000);
});
