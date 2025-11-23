import 'fake-indexeddb/auto';
import { readFile } from 'node:fs/promises';
import type { ImportData } from '@hierarchidb/common-api';
import type { NodeId, TreeId } from '@hierarchidb/common-types';
import { toNodeType, toTreeId } from '@hierarchidb/common-types';
import * as Comlink from 'comlink';
import { describe, expect, it } from 'vitest';
import { MessageChannel } from 'worker_threads';
import { createEndpointFromMessagePort } from '../../e2e/test-utils/messagePortEndpoint.js';
import { exposeTestAPI } from '../../e2e/test-worker.entry.js';

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

const templateUrl = new URL(
  '../../../../../../app/public/templates/population-2023/console-nodes.json',
  import.meta.url
);

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
      name: (node.metadata.name ?? '') as string,
      nodeType: node.treeNodeType,
      description:
        typeof node.metadata.description === 'string' ? node.metadata.description : undefined,
      metadata: {
        ...node.metadata,
        name: (node.metadata.name ?? '') as string,
        description:
          typeof node.metadata.description === 'string' ? node.metadata.description : undefined,
      },
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
    await exposeTestAPI(createEndpointFromMessagePort(port1));
    const client = Comlink.wrap<TestWorkerAPI>(createEndpointFromMessagePort(port2));

    const queryAPI = await client.getQueryAPI();
    const mutationAPI = await client.getMutationAPI();
    const importExportAPI = await client.getImportExportAPI();

    const treeId: TreeId = toTreeId('r');
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
    const populationFolder = rootChildren.find(
      (node) => node.metadata.name === 'Total Population by Country'
    );
    expect(populationFolder).toBeTruthy();
    if (!populationFolder) throw new Error('Population folder not found');

    const duplicateRes = await mutationAPI.duplicateNodes({
      nodeIds: [populationFolder.id as NodeId],
      toParentId: rootId,
    });
    if (!duplicateRes.success) {
      const message = 'error' in duplicateRes ? duplicateRes.error : 'unknown error';
      throw new Error(`duplicateNodes failed: ${message}`);
    }
    const duplicateId = duplicateRes.nodeIds[0];
    expect(duplicateId).toBeDefined();

    const rootChildrenAfterDup = await queryAPI.listChildren(rootId);
    const duplicateNode = rootChildrenAfterDup.find((node) => node.id === duplicateId);
    expect(duplicateNode).toBeTruthy();
    expect(duplicateNode?.metadata.name).not.toBe(populationFolder.metadata.name);
    expect(duplicateNode?.metadata.name.startsWith(populationFolder.metadata.name)).toBe(true);

    const uniqueNames = new Set(rootChildrenAfterDup.map((node) => node.metadata.name));
    expect(uniqueNames.size).toBe(rootChildrenAfterDup.length);

    const duplicateSelf = await mutationAPI.duplicateNodes({
      nodeIds: [populationFolder.id as NodeId],
      toParentId: populationFolder.id as NodeId,
    });
    expect(duplicateSelf.success).toBe(false);
    if (!duplicateSelf.success) {
      const message = 'error' in duplicateSelf ? duplicateSelf.error : '';
      expect(message).toContain('Cannot duplicate node into itself');
    }

    const templateChildren = await queryAPI.listChildren(populationFolder.id as NodeId);
    const shapeNode = templateChildren.find((node) => node.nodeType === toNodeType('shape'));
    if (!shapeNode) throw new Error('Shape child not found');

    const duplicateToDescendant = await mutationAPI.duplicateNodes({
      nodeIds: [populationFolder.id as NodeId],
      toParentId: shapeNode.id as NodeId,
    });
    expect(duplicateToDescendant.success).toBe(false);
    if (!duplicateToDescendant.success) {
      const message = 'error' in duplicateToDescendant ? duplicateToDescendant.error : '';
      expect(message).toContain('descendant');
    }
  }, 30_000);
});
