import { describe, expect, it } from 'vitest';
import {
  classifyInterruptedCoreV1Snapshot,
  type InterruptedCoreV1Snapshot,
} from '../classifyInterruptedCoreV1Snapshot.js';

const VALID_DIGEST = '0123456789abcdef'.repeat(4);

function defaultTree(treeId: 'r' | 'p'): Readonly<Record<string, unknown>> {
  return {
    id: treeId,
    name: treeId === 'r' ? 'Resources' : 'Projects',
    superRootId: `${treeId}:superRoot`,
    rootId: `${treeId}:root`,
    archiveRootId: `${treeId}:archive`,
  };
}

function defaultNode(
  treeId: 'r' | 'p',
  kind: 'root' | 'archive'
): Readonly<Record<string, unknown>> {
  return {
    parentId: `${treeId}:superRoot`,
    id: `${treeId}:${kind}`,
    nodeType: kind === 'root' ? 'folder' : 'archive',
    depth: 0,
    createdAt: 1,
    updatedAt: 1,
    version: 1,
    metadata: {
      name: kind === 'archive' ? 'Archive' : treeId === 'r' ? 'Resources' : 'Projects',
      description: undefined,
      tags: [],
    },
    draftMetadata: null,
    data: null,
    draftData: undefined,
  };
}

function defaultRootState(
  treeId: 'r' | 'p',
  kind: 'root' | 'archive' | 'draft'
): Readonly<Record<string, unknown>> {
  return {
    treeId,
    rootNodeId: `${treeId}:${kind}`,
    expanded: {},
  };
}

function createDefaultSnapshot(): InterruptedCoreV1Snapshot {
  return {
    trees: [defaultTree('r'), defaultTree('p')],
    nodes: [
      defaultNode('r', 'root'),
      defaultNode('r', 'archive'),
      defaultNode('p', 'root'),
      defaultNode('p', 'archive'),
    ],
    rootStates: [
      defaultRootState('r', 'root'),
      defaultRootState('r', 'archive'),
      defaultRootState('r', 'draft'),
      defaultRootState('p', 'root'),
      defaultRootState('p', 'archive'),
      defaultRootState('p', 'draft'),
    ],
    tags: [],
    tagAssociations: [],
  };
}

function legacyYamlNode(): Readonly<Record<string, unknown>> {
  return {
    id: 'yaml-1',
    parentId: 'p:root',
    nodeType: 'yaml-file',
    depth: 1,
    createdAt: 2,
    updatedAt: 2,
    version: 1,
    metadata: { name: 'scenario.yml', description: '', tags: ['important'] },
    draftMetadata: null,
    data: {
      name: 'scenario.yml',
      schemaId: 'ide-gsm/scenario',
      content: 'name: demo\n',
    },
    draftData: undefined,
  };
}

function nonYamlNode(): Readonly<Record<string, unknown>> {
  return {
    id: 'folder-1',
    parentId: 'p:root',
    nodeType: 'folder',
    depth: 1,
    createdAt: 2,
    updatedAt: 2,
    version: 1,
    metadata: { name: 'Folder', description: '', tags: [] },
    draftMetadata: null,
    data: null,
    draftData: undefined,
  };
}

function classify(snapshot: InterruptedCoreV1Snapshot) {
  return classifyInterruptedCoreV1Snapshot({
    snapshot,
    digestSha256Hex: async () => VALID_DIGEST,
  });
}

describe('classifyInterruptedCoreV1Snapshot', () => {
  it('accepts and accounts the exact 12-record initializer cohort', async () => {
    const result = await classify(createDefaultSnapshot());

    expect(result).toEqual({
      ok: true,
      code: 'INTERRUPTED_CORE_V1_PRESERVATION_ACCEPTED',
      summary: {
        storeCounts: {
          trees: 2,
          nodes: 4,
          rootStates: 6,
          tags: 0,
          tagAssociations: 0,
          total: 12,
        },
        recordClassification: {
          exactDefault: 12,
          modifiedDefaultIdentity: 0,
          additional: 0,
          invalid: 0,
        },
        defaultIdentityStatus: 'complete',
        additionalNodeCounts: { yaml: 0, nonYaml: 0 },
        graphStatus: 'exact',
        yamlPlanningStatus: 'valid',
        yamlSlotCounts: {
          canonical: 0,
          legacyWithName: 0,
          hostSplitLegacy: 0,
          temporaryPlaceholder: 0,
          metadataOnlyDraft: 0,
        },
      },
    });
  });

  it('classifies a 15-record YAML, tag, and association cohort without exposing values', async () => {
    const baseline = createDefaultSnapshot();
    const snapshot: InterruptedCoreV1Snapshot = {
      ...baseline,
      nodes: [...baseline.nodes, legacyYamlNode()],
      tags: [
        {
          id: 'tag-1',
          name: 'Important',
          color: '#ff0000',
          description: undefined,
          createdAt: 2,
        },
      ],
      tagAssociations: [
        {
          id: 'yaml-1_tag-1_published',
          nodeId: 'yaml-1',
          tagId: 'tag-1',
          scope: 'published',
          assignedAt: 2,
        },
      ],
    };

    const result = await classify(snapshot);

    expect(result.ok).toBe(true);
    if (result.ok === false) throw new Error('Expected preservation classification acceptance');
    expect(result.summary.storeCounts).toEqual({
      trees: 2,
      nodes: 5,
      rootStates: 6,
      tags: 1,
      tagAssociations: 1,
      total: 15,
    });
    expect(result.summary.recordClassification).toEqual({
      exactDefault: 12,
      modifiedDefaultIdentity: 0,
      additional: 3,
      invalid: 0,
    });
    expect(result.summary.additionalNodeCounts).toEqual({ yaml: 1, nonYaml: 0 });
    expect(result.summary.yamlSlotCounts).toEqual({
      canonical: 0,
      legacyWithName: 1,
      hostSplitLegacy: 0,
      temporaryPlaceholder: 0,
      metadataOnlyDraft: 0,
    });
    expect(JSON.stringify(result)).not.toContain('scenario.yml');
    expect(JSON.stringify(result)).not.toContain('yaml-1');
    expect(JSON.stringify(result)).not.toContain('Important');
  });

  it('distinguishes a valid modified default identity from additional non-YAML state', async () => {
    const baseline = createDefaultSnapshot();
    const modifiedRoot = {
      ...defaultNode('p', 'root'),
      metadata: { name: 'Renamed Projects', description: '', tags: [] },
      updatedAt: 2,
    };
    const snapshot: InterruptedCoreV1Snapshot = {
      ...baseline,
      nodes: [baseline.nodes[0], baseline.nodes[1], modifiedRoot, baseline.nodes[3], nonYamlNode()],
    };

    const result = await classify(snapshot);

    expect(result.ok).toBe(true);
    if (result.ok === false) throw new Error('Expected preservation classification acceptance');
    expect(result.summary.recordClassification).toEqual({
      exactDefault: 11,
      modifiedDefaultIdentity: 1,
      additional: 1,
      invalid: 0,
    });
    expect(result.summary.additionalNodeCounts).toEqual({ yaml: 0, nonYaml: 1 });
  });

  it('preserves older initializer omissions as a modified default identity without filling them', async () => {
    const baseline = createDefaultSnapshot();
    const olderRoot = {
      id: 'p:root',
      parentId: 'p:superRoot',
      nodeType: 'folder',
      depth: 0,
      createdAt: 1,
      updatedAt: 1,
      version: 1,
      metadata: { name: 'Projects' },
    };
    const result = await classify({
      ...baseline,
      nodes: [baseline.nodes[0], baseline.nodes[1], olderRoot, baseline.nodes[3]],
    });

    expect(result.ok).toBe(true);
    if (result.ok === false) throw new Error('Expected historical omission acceptance');
    expect(result.summary.recordClassification).toEqual({
      exactDefault: 11,
      modifiedDefaultIdentity: 1,
      additional: 0,
      invalid: 0,
    });
    expect(Object.hasOwn(olderRoot, 'data')).toBe(false);
    expect(Object.hasOwn(olderRoot.metadata, 'tags')).toBe(false);
  });

  it('aggregates canonical, host-split legacy, and temporary placeholder YAML states', async () => {
    const baseline = createDefaultSnapshot();
    const common = {
      parentId: 'p:root',
      nodeType: 'yaml-file',
      depth: 1,
      createdAt: 2,
      updatedAt: 2,
      version: 1,
      draftMetadata: null,
      draftData: undefined,
    };
    const canonical = {
      ...common,
      id: 'yaml-canonical',
      metadata: { name: 'sources.yml', description: '', tags: [] },
      data: {
        subtype: 'sources',
        schemaId: 'ide-gsm/sources',
        content: 'sources: []\n',
      },
    };
    const hostSplitLegacy = {
      ...common,
      id: 'yaml-host-split',
      metadata: { name: 'git.yml', description: '', tags: [] },
      data: {
        schemaId: 'ide-gsm/git',
        content: 'url: https://example.test/repository.git\n',
      },
    };
    const placeholder = {
      ...common,
      id: 'yaml-placeholder',
      metadata: { name: 'scenario.yml', description: '', tags: [] },
      draftMetadata: { name: 'scenario.yml', description: '', tags: [] },
      data: null,
      draftData: {},
      isTemporary: true,
    };

    const result = await classify({
      ...baseline,
      nodes: [...baseline.nodes, canonical, hostSplitLegacy, placeholder],
    });

    expect(result.ok).toBe(true);
    if (result.ok === false) throw new Error('Expected YAML aggregate acceptance');
    expect(result.summary.additionalNodeCounts).toEqual({ yaml: 3, nonYaml: 0 });
    expect(result.summary.yamlSlotCounts).toEqual({
      canonical: 1,
      legacyWithName: 0,
      hostSplitLegacy: 1,
      temporaryPlaceholder: 1,
      metadataOnlyDraft: 0,
    });
  });

  it('rejects a dangling tag association as a graph violation', async () => {
    const baseline = createDefaultSnapshot();
    const snapshot: InterruptedCoreV1Snapshot = {
      ...baseline,
      tagAssociations: [
        {
          id: 'missing_missing_published',
          nodeId: 'missing-node',
          tagId: 'missing-tag',
          scope: 'published',
          assignedAt: 2,
        },
      ],
    };

    const result = await classify(snapshot);

    expect(result.ok).toBe(false);
    expect(result.code).toBe('INTERRUPTED_CORE_V1_PRESERVATION_GRAPH_INVALID');
    if (result.ok) throw new Error('Expected graph rejection');
    expect(result.summary?.graphStatus).toBe('invalid');
    expect(result.summary?.recordClassification.invalid).toBe(1);
  });

  it('rejects malformed structural records before YAML planning', async () => {
    const baseline = createDefaultSnapshot();
    const invalid = { ...legacyYamlNode(), metadata: { description: '', tags: [] } };
    const result = await classify({ ...baseline, nodes: [...baseline.nodes, invalid] });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('INTERRUPTED_CORE_V1_PRESERVATION_SNAPSHOT_INVALID');
    if (result.ok) throw new Error('Expected snapshot rejection');
    expect(result.summary?.recordClassification.invalid).toBe(1);
    expect(result.summary?.yamlPlanningStatus).toBe('not-run');
  });

  it('rejects invalid YAML through the existing migration planner', async () => {
    const baseline = createDefaultSnapshot();
    const invalidYaml = {
      ...legacyYamlNode(),
      data: {
        name: 'scenario.yml',
        schemaId: 'ide-gsm/scenario',
        content: 'not: [valid',
      },
    };
    const result = await classify({ ...baseline, nodes: [...baseline.nodes, invalidYaml] });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('INTERRUPTED_CORE_V1_PRESERVATION_YAML_INVALID');
    if (result.ok) throw new Error('Expected YAML rejection');
    expect(result.summary?.yamlPlanningStatus).toBe('invalid');
    expect(result.summary?.recordClassification.invalid).toBe(1);
    expect(JSON.stringify(result)).not.toContain('not: [valid');
  });

  it('rejects a missing default identity even when every present record is valid', async () => {
    const baseline = createDefaultSnapshot();
    const result = await classify({ ...baseline, rootStates: baseline.rootStates.slice(1) });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('INTERRUPTED_CORE_V1_PRESERVATION_GRAPH_INVALID');
    if (result.ok) throw new Error('Expected default identity rejection');
    expect(result.summary?.defaultIdentityStatus).toBe('incomplete');
    expect(result.summary?.storeCounts.total).toBe(11);
  });

  it('rejects a default root state linked to a different tree', async () => {
    const baseline = createDefaultSnapshot();
    const crossTreeRootState = {
      ...defaultRootState('p', 'root'),
      treeId: 'r',
    };
    const result = await classify({
      ...baseline,
      rootStates: [
        ...baseline.rootStates.slice(0, 3),
        crossTreeRootState,
        ...baseline.rootStates.slice(4),
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('INTERRUPTED_CORE_V1_PRESERVATION_GRAPH_INVALID');
    if (result.ok) throw new Error('Expected cross-tree root-state rejection');
    expect(result.summary?.graphStatus).toBe('invalid');
  });

  it('rejects a snapshot array with an extra own property', async () => {
    const baseline = createDefaultSnapshot();
    const nodes = [...baseline.nodes] as unknown[] & { diagnostic?: string };
    nodes.diagnostic = 'must-not-be-accepted';
    const result = await classify({ ...baseline, nodes });

    expect(result).toEqual({
      ok: false,
      code: 'INTERRUPTED_CORE_V1_PRESERVATION_SNAPSHOT_INVALID',
    });
  });
});
