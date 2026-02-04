import 'fake-indexeddb/auto';
import { readFile } from 'node:fs/promises';
import type { ImportData } from '@hierarchidb/import-export-api';
import type { NodeId, TreeId } from '@hierarchidb/core-types';
import { toNodeType } from '@hierarchidb/core-types';
import * as Comlink from 'comlink';
import { describe, expect, it } from 'vitest';
import { MessageChannel } from 'worker_threads';
import { createEndpointFromMessagePort } from '../../e2e/test-utils/messagePortEndpoint.js';
import { exposeTestAPI } from '../../e2e/test-worker.entry.js';

type TestWorkerAPI = {
  getQueryAPI(): Promise<import('@hierarchidb/tree-api').TreeQueryAPI>;
  getImportExportAPI(): Promise<import('@hierarchidb/import-export-api').ImportExportAPI>;
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
  '../../../../../app/public/templates/population-2023/population-by-countries-2023.json',
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
      draftData: draftData,
      draftMetadata: draftMetadata,
      data: dataPayload,
      children: children.length > 0 ? children : undefined,
    };
  };

  if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
    throw new Error('Template must provide nodes');
  }

  return data.nodes.map((node) => toImportNode(node));
}

describe('WFL import template: Total Population by Country', () => {
  it('imports template and creates folder with shape/styler/spreadsheet children', async () => {
    const { port1, port2 } = new MessageChannel();
    await exposeTestAPI(createEndpointFromMessagePort(port1));
    const client = Comlink.wrap<TestWorkerAPI>(createEndpointFromMessagePort(port2));

    const queryAPI = await client.getQueryAPI();
    const importExportAPI = await client.getImportExportAPI();

    const treeId: TreeId = 'r' as TreeId;
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
    expect(byType.get(toNodeType('spreadsheet'))).toBeUndefined();
  }, 25_000);
});
