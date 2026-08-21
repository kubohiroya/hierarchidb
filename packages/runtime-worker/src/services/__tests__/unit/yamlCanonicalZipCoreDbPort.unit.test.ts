import 'fake-indexeddb/auto';
import { toNodeId, toNodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { YamlCanonicalZipImportTransactionRequest } from '@hierarchidb/worker-api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CoreDB } from '../../CoreDB.js';
import { YamlCanonicalZipCoreDbPort } from '../../YamlCanonicalZipCoreDbPort.js';

const parentId = toNodeId('parent');

function parentNode(): TreeNode {
  return {
    id: parentId,
    parentId: toNodeId('root'),
    nodeType: toNodeType('folder'),
    depth: 1,
    createdAt: 1,
    updatedAt: 2,
    version: 1,
    metadata: { name: 'folder', description: '', tags: [] },
    draftMetadata: null,
    data: null,
    visible: true,
    hasChildren: false,
  } as unknown as TreeNode;
}

function importRequest(): YamlCanonicalZipImportTransactionRequest {
  return {
    parentGuard: {
      sourceIndex: 0,
      nodeId: parentId,
      expectedVersion: 1,
      expectedDepth: 1,
      expectedHasChildren: false,
    },
    siblingGuards: [],
    existingNodeIdGuard: [parentId],
    nodes: [
      {
        id: 'imported',
        parentId,
        nodeType: 'yaml-file',
        depth: 2,
        createdAt: 100,
        updatedAt: 100,
        version: 1,
        metadata: { name: 'scenario.yml', description: '', tags: [] },
        draftMetadata: null,
        data: {
          subtype: 'scenario',
          schemaId: 'ide-gsm/scenario',
          content: 'name: imported\n',
        },
        visible: true,
      },
    ],
    parentPatch: {
      id: parentId,
      expectedVersion: 1,
      postimage: { hasChildren: true, updatedAt: 100, version: 2 },
    },
  };
}

describe('YamlCanonicalZipCoreDbPort', () => {
  let coreDB: CoreDB;
  let port: YamlCanonicalZipCoreDbPort;

  beforeEach(async () => {
    coreDB = CoreDB.createForTest(`yaml-zip-port-${crypto.randomUUID()}`);
    await coreDB.open();
    await coreDB.nodes.add(parentNode());
    port = new YamlCanonicalZipCoreDbPort(coreDB);
  });

  afterEach(async () => {
    coreDB.close();
    await coreDB.delete();
  });

  it('inserts every planned YAML node and the parent patch in one transaction', async () => {
    await expect(port.commitImport(importRequest())).resolves.toEqual(['imported']);
    await expect(coreDB.nodes.get(toNodeId('imported'))).resolves.toMatchObject({
      nodeType: 'yaml-file',
      metadata: { name: 'scenario.yml' },
      data: { subtype: 'scenario' },
    });
    await expect(coreDB.nodes.get(parentId)).resolves.toMatchObject({
      hasChildren: true,
      updatedAt: 100,
      version: 2,
    });
  });

  it('rechecks the full ID and sibling cohort and writes nothing after a race', async () => {
    await coreDB.nodes.add({
      ...parentNode(),
      id: toNodeId('racing-sibling'),
      parentId,
      depth: 2,
      metadata: { name: 'racing', description: '', tags: [] },
    } as unknown as TreeNode);

    await expect(port.commitImport(importRequest())).rejects.toThrow(
      'yaml-canonical-zip-import-guard-mismatch'
    );
    await expect(coreDB.nodes.get(toNodeId('imported'))).resolves.toBeUndefined();
    await expect(coreDB.nodes.get(parentId)).resolves.toMatchObject({
      hasChildren: false,
      updatedAt: 2,
      version: 1,
    });
  });
});
