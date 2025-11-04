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
  '../../../../../../app/public/templates/population-2023/tree-nodes.json',
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

describe('WFL import template: Total Population by Country', () => {
  it('imports template and creates folder with shape/styler/spreadsheet children', async () => {
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(createEndpointFromMessagePort(port1));
    const client = Comlink.wrap<TestWorkerAPI>(createEndpointFromMessagePort(port2));

    const queryAPI = await client.getQueryAPI();
    const importExportAPI = await client.getImportExportAPI();

    const treeId: TreeId = toTreeId('r');
    const tree = await queryAPI.getTree(treeId);
    expect(tree?.rootId).toBeDefined();
    if (!tree?.rootId) throw new Error('rootId missing');
    const rootId = tree.rootId as NodeId;

    const template = await loadTemplate();
    const importNodes = buildImportNodes(template);

    const result = await importExportAPI.importNodes({
      treeId,
      targetParentId: rootId,
      data: { nodes: importNodes },
      format: 'json',
      conflictResolution: 'rename',
    });
    expect(result?.success).toBe(true);

    const rootChildren = await queryAPI.listChildren(rootId);
    const populationFolder = rootChildren.find(
      (node) => node.name === 'Total Population by Country'
    );
    expect(populationFolder).toBeTruthy();
    if (!populationFolder) throw new Error('Population folder not found');

    const templateChildren = await queryAPI.listChildren(populationFolder.id as NodeId);
    const byType = new Map(templateChildren.map((child) => [child.nodeType, child.name]));
    expect(byType.get(toNodeType('shape'))).toBe('Country Boundaries');
    expect(byType.get(toNodeType('styler'))).toBe('Population Color Map');
    expect(byType.get(toNodeType('spreadsheet'))).toBe('Population Data Table');
  }, 25_000);
});
