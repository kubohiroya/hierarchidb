import 'fake-indexeddb/auto';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { NodePayload, TreeNode } from '@hierarchidb/tree-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreDB } from '../../CoreDB.js';
import { getYamlCoreDbReadOnlyInventory } from '../../getYamlCoreDbReadOnlyInventory.js';

const DATABASE_NAME = 'yaml-coredb-readonly-inventory-unit';
const TIMESTAMP = 1_700_000_000_000;

function rawNode(
  id: string,
  nodeType: string,
  data: unknown,
  options: Readonly<{
    readonly name?: string;
    readonly draftMetadata?: Readonly<{ readonly name: string }> | null;
    readonly draftData?: unknown;
    readonly isTemporary?: boolean;
  }> = {}
): Readonly<Record<string, unknown>> {
  return {
    id: id as NodeId,
    parentId: `r:parent-${id}` as NodeId,
    nodeType: nodeType as NodeType,
    metadata: { name: options.name ?? 'scenario.yml', description: '', tags: [] },
    draftMetadata: options.draftMetadata ?? null,
    data,
    ...(options.draftData === undefined ? {} : { draftData: options.draftData }),
    ...(options.isTemporary === undefined ? {} : { isTemporary: options.isTemporary }),
    depth: 1,
    visible: true,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    version: options.isTemporary === true ? 0 : 1,
  };
}

async function putRawNodes(coreDB: CoreDB, nodes: readonly Readonly<Record<string, unknown>>[]) {
  await coreDB.nodes.bulkPut(Array.from(nodes) as unknown as TreeNode<NodePayload>[]);
}

describe('getYamlCoreDbReadOnlyInventory', () => {
  let coreDB: CoreDB;

  beforeEach(async () => {
    coreDB = CoreDB.createForTest(DATABASE_NAME);
    await coreDB.delete();
    coreDB = CoreDB.createForTest(DATABASE_NAME);
    await coreDB.open();
  });

  afterEach(async () => {
    await coreDB.delete();
    vi.restoreAllMocks();
  });

  it('accounts every accepted YAML slot and ignores non-YAML nodes', async () => {
    await putRawNodes(coreDB, [
      rawNode('folder', 'folder', {}),
      rawNode('legacy', 'yaml-file', {
        name: 'scenario.yml',
        schemaId: 'ide-gsm/scenario',
        content: 'name: legacy\n',
      }),
      rawNode('host-split', 'yaml-file', {
        schemaId: 'ide-gsm/scenario',
        content: 'name: host-split\n',
      }),
      rawNode(
        'canonical-with-metadata-only-draft',
        'yaml-file',
        {
          subtype: 'scenario',
          schemaId: 'ide-gsm/scenario',
          content: 'name: canonical\n',
        },
        { draftMetadata: { name: 'scenario.yml' } }
      ),
      rawNode('placeholder', 'yaml-file', null, {
        draftMetadata: { name: 'scenario.yml' },
        draftData: {},
        isTemporary: true,
      }),
    ]);
    const transactionSpy = vi.spyOn(coreDB, 'runInTx');
    const singletonSpy = vi.spyOn(CoreDB, 'getSingleton');
    const initializeSpy = vi.spyOn(coreDB, 'initialize');
    const addSpy = vi.spyOn(coreDB.nodes, 'add');
    const bulkAddSpy = vi.spyOn(coreDB.nodes, 'bulkAdd');
    const bulkPutSpy = vi.spyOn(coreDB.nodes, 'bulkPut');
    const clearSpy = vi.spyOn(coreDB.nodes, 'clear');
    const deleteSpy = vi.spyOn(coreDB.nodes, 'delete');
    const putSpy = vi.spyOn(coreDB.nodes, 'put');
    const updateSpy = vi.spyOn(coreDB.nodes, 'update');

    const result = await getYamlCoreDbReadOnlyInventory(coreDB);

    expect(result).toEqual({
      contractVersion: 1,
      status: 'accepted',
      yamlNodeCount: 4,
      slotCount: 5,
      invalidRecordCount: 0,
      errorCount: 0,
      slotCounts: {
        legacyWithName: 1,
        hostSplitLegacy: 1,
        canonical: 1,
        temporaryPlaceholder: 1,
        metadataOnlyDraft: 1,
      },
    });
    expect(transactionSpy).toHaveBeenCalledWith('r', ['nodes'], expect.any(Function));
    expect(singletonSpy).not.toHaveBeenCalled();
    expect(initializeSpy).not.toHaveBeenCalled();
    for (const writeSpy of [
      addSpy,
      bulkAddSpy,
      bulkPutSpy,
      clearSpy,
      deleteSpy,
      putSpy,
      updateSpy,
    ]) {
      expect(writeSpy).not.toHaveBeenCalled();
    }
    expect(Object.isFrozen(result)).toBe(true);
    if (result.status === 'accepted') expect(Object.isFrozen(result.slotCounts)).toBe(true);
  });

  it('deduplicates invalid records while preserving all sanitized planner errors', async () => {
    await putRawNodes(coreDB, [
      rawNode(
        'invalid-both-slots',
        'yaml-file',
        { schemaId: 'ide-gsm/scenario' },
        {
          draftMetadata: { name: 'scenario.yml' },
          draftData: { content: 'must-not-leak\n' },
        }
      ),
    ]);

    const result = await getYamlCoreDbReadOnlyInventory(coreDB);

    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') throw new Error('Expected a rejected inventory report');
    expect(result.yamlNodeCount).toBe(1);
    expect(result.invalidRecordCount).toBe(1);
    expect(result.errorCount).toBe(2);
    expect(result.errors.map(({ slot, code }) => [slot, code])).toEqual([
      ['committed', 'INCOMPLETE_PAYLOAD'],
      ['draft', 'INCOMPLETE_PAYLOAD'],
    ]);
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(result).not.toHaveProperty('slotCounts');
    expect(Object.isFrozen(result.errors)).toBe(true);
    expect(result.errors.every((error) => Object.isFrozen(error))).toBe(true);
  });

  it('returns a stable failure without exposing the CoreDB read error', async () => {
    vi.spyOn(coreDB.nodes, 'toArray').mockRejectedValue(
      new Error('coredb-read-secret-must-not-leak')
    );

    const result = await getYamlCoreDbReadOnlyInventory(coreDB);

    expect(result).toEqual({
      contractVersion: 1,
      status: 'failed',
      code: 'COREDB_READ_FAILED',
    });
    expect(JSON.stringify(result)).not.toContain('coredb-read-secret-must-not-leak');
  });
});
