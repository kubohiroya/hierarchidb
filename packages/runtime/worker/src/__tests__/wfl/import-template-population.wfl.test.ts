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
  draftData?: Record<string, unknown> | null;
  draftMetadata?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
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
  const { nodes } = data;
  if (!Array.isArray(data.rootNodeIds) || data.rootNodeIds.length === 0) {
    throw new Error('Template must provide rootNodeIds');
  }
  const roots = data.rootNodeIds;
  const toImportNode = (id: string): ImportData['nodes'][number] | null => {
    const node = nodes[id];
    if (!node) return null;
    const children = Object.values(nodes)
      .filter((child) => child?.parentTreeNodeId === id)
      .map((child) => toImportNode(child.treeNodeId))
      .filter((child): child is ImportData['nodes'][number] => child !== null);
    const metadata = (node.metadata && typeof node.metadata === 'object' ? node.metadata : undefined) as
      | Record<string, unknown>
      | undefined;
    const draftData =
      (node.draftData && typeof node.draftData === 'object' ? node.draftData : undefined) ??
      undefined;
    const draftMetadata =
      (node.draftMetadata && typeof node.draftMetadata === 'object' ? node.draftMetadata : undefined) ??
      undefined;
    const dataPayload = node.data && typeof node.data === 'object' ? node.data : undefined;

    return {
      name: node.name,
      nodeType: node.treeNodeType,
      description: node.description,
      metadata,
      draftData: draftData ?? undefined,
      draftMetadata: draftMetadata ?? undefined,
      data: dataPayload ?? undefined,
      children: children.length > 0 ? children : undefined,
    };
  };
  return roots
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
    if (!result?.success) {
      expect(result).toBeTruthy();
      return;
    }

    const rootChildren = await queryAPI.listChildren(rootId);
    const populationFolder = rootChildren.find(
      (node) => node.metadata.name === 'Total Population by Country'
    );
    expect(populationFolder).toBeTruthy();
    if (!populationFolder) throw new Error('Population folder not found');

    const templateChildren = await queryAPI.listChildren(populationFolder.id as NodeId);
    const byType = new Map(templateChildren.map((child) => [child.nodeType, child.metadata.name]));
    expect(byType.get(toNodeType('shape'))).toBe('Country Boundaries');
    expect(byType.get(toNodeType('styler'))).toBe('Population Color Map');
    expect(byType.get(toNodeType('spreadsheet'))).toBe('Population Data Table');
  }, 25_000);
});
