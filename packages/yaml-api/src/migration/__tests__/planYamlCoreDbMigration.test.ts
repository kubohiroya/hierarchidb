import { describe, expect, it } from 'vitest';
import { YAML_SUBTYPE_REGISTRY } from '../../YAML_SUBTYPE_REGISTRY.js';
import { planYamlCoreDbMigration } from '../planYamlCoreDbMigration.js';

const VALID_DIGEST = '0123456789abcdef'.repeat(4);

describe('planYamlCoreDbMigration historical draft representation', () => {
  it('treats null draftData as an absent draft slot without changing version guards', async () => {
    const scenario = YAML_SUBTYPE_REGISTRY.scenario;
    const rawNode = {
      id: 'scenario-node',
      version: 7,
      nodeType: 'yaml-file',
      metadata: { name: scenario.fileName },
      draftMetadata: null,
      data: {
        name: scenario.fileName,
        schemaId: scenario.schemaId,
        content: 'name: demo\n',
      },
      draftData: null,
    };

    const result = await planYamlCoreDbMigration({
      migrationId: 'yaml-v1-to-v2',
      fromCoreDbVersion: 1,
      toCoreDbVersion: 2,
      rawNodes: [rawNode],
      digestSha256Hex: async () => VALID_DIGEST,
    });

    expect(result.ok).toBe(true);
    if (result.ok === false) throw new Error('Expected migration planning success');
    expect(result.plan.nodeGuards).toEqual([
      { sourceIndex: 0, nodeId: 'scenario-node', expectedVersion: 7 },
    ]);
    expect(result.plan.entries).toHaveLength(1);
    expect(result.plan.entries[0]).toMatchObject({
      action: 'migrate',
      nodeId: 'scenario-node',
      slot: 'committed',
      preimageRepresentation: 'legacy-with-name',
    });
    expect(Object.hasOwn(rawNode, 'draftData')).toBe(true);
    expect(rawNode.draftData).toBeNull();
  });
});
