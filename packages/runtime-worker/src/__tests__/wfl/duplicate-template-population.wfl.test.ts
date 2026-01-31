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
  getMutationAPI(): Promise<import('@hierarchidb/tree-api').TreeMutationAPI>;
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

describe('WFL duplicate behavior for imported template', () => {
  it('duplicates template folder and enforces invalid destinations', async () => {
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
    expect(populationFolder).toBeTruthy();
    if (!populationFolder) throw new Error('Population folder not found');

    const duplicateRes = await mutationAPI.duplicateNodes({
      nodeIds: [populationFolder.id as NodeId],
      toParentId: rootId,
    });
    if (!duplicateRes.success) {
      const err = duplicateRes as { error?: string };
      throw new Error(err.error ?? 'duplicateNodes failed');
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
      const err = duplicateSelf as { error?: string };
      expect(err.error ?? '').toContain('Cannot duplicate node into itself');
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
      const err = duplicateToDescendant as { error?: string };
      expect(err.error ?? '').toContain('descendant');
    }
  }, 30_000);
});
