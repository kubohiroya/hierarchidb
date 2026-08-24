import { YAML_SUBTYPE_REGISTRY } from '@hierarchidb/yaml-api';
import { describe, expect, it, vi } from 'vitest';
import { encodeCanonicalYamlZip } from '../../src/canonical-yaml-zip-codec/encodeCanonicalYamlZip.js';
import { commitCanonicalYamlZipImportPlan } from '../../src/canonical-yaml-zip-plan/commitCanonicalYamlZipImportPlan.js';
import { planCanonicalYamlZipExport } from '../../src/canonical-yaml-zip-plan/planCanonicalYamlZipExport.js';
import { planCanonicalYamlZipImport } from '../../src/canonical-yaml-zip-plan/planCanonicalYamlZipImport.js';

const scenario = YAML_SUBTYPE_REGISTRY.scenario;
const git = YAML_SUBTYPE_REGISTRY.git;

function metadata(name: string) {
  return { name, description: '', tags: [] };
}

function yamlNode(
  id: string,
  filename = scenario.fileName,
  payload: unknown = {
    subtype: scenario.subtype,
    schemaId: scenario.schemaId,
    content: 'name: demo\n',
  }
) {
  return {
    id,
    parentId: 'parent',
    nodeType: 'yaml-file',
    depth: 2,
    createdAt: 1,
    updatedAt: 2,
    version: 3,
    metadata: metadata(filename),
    draftMetadata: metadata(filename),
    data: payload,
    draftData: payload,
    visible: true,
  };
}

function parent(hasChildren: boolean | undefined = false) {
  return {
    id: 'parent',
    parentId: 'root',
    nodeType: 'folder',
    depth: 1,
    createdAt: 1,
    updatedAt: 2,
    version: 4,
    metadata: metadata('folder'),
    draftMetadata: null,
    data: null,
    visible: true,
    ...(hasChildren === undefined ? {} : { hasChildren }),
  };
}

function sibling(id = 'sibling', name = 'other.yml') {
  return {
    id,
    parentId: 'parent',
    nodeType: 'folder',
    depth: 2,
    createdAt: 1,
    updatedAt: 2,
    version: 2,
    metadata: metadata(name),
    draftMetadata: null,
    data: null,
    visible: true,
  };
}

function archive() {
  const encoded = encodeCanonicalYamlZip([
    {
      filename: git.fileName,
      payload: { subtype: git.subtype, schemaId: git.schemaId, content: 'url: repo\n' },
    },
    {
      filename: scenario.fileName,
      payload: {
        subtype: scenario.subtype,
        schemaId: scenario.schemaId,
        content: 'name: demo\n',
      },
    },
  ]);
  if (!encoded.ok) throw new Error('fixture archive failed');
  return encoded.value.bytes;
}

function importInput(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    archive: archive(),
    parent: parent(),
    siblings: [sibling()],
    existingNodeIds: ['parent', 'sibling'],
    generatedNodeIds: ['generated-git', 'generated-scenario'],
    timestamp: 100,
    ...overrides,
  };
}

describe('planCanonicalYamlZipExport', () => {
  it('pairs committed metadata and data and emits deterministic guards', () => {
    const result = planCanonicalYamlZipExport({
      slot: 'committed',
      nodes: [yamlNode('z-node')],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.nodeGuards).toEqual([
      { sourceIndex: 0, nodeId: 'z-node', expectedVersion: 3 },
    ]);
    expect(result.plan.archive.bytes.length).toBeGreaterThan(0);
  });

  it('uses only the explicit draft pair', () => {
    const node = yamlNode('draft-node');
    node.data = { subtype: 'invalid' };
    const result = planCanonicalYamlZipExport({ slot: 'draft', nodes: [node] });
    expect(result.ok).toBe(true);
  });

  it('does not fall back from a missing draft pair', () => {
    const node = yamlNode('draft-node');
    node.draftMetadata = null;
    delete node.draftData;
    const result = planCanonicalYamlZipExport({ slot: 'draft', nodes: [node] });
    expect(result).toEqual({
      ok: false,
      errors: [{ code: 'CANONICAL_VALIDATION_FAILED', sourceIndex: 0, slot: 'draft' }],
    });
  });

  it('rejects unsafe raw nodes without running accessors', () => {
    const node = yamlNode('safe');
    const getter = vi.fn(() => {
      throw new Error('credential-accessor-secret');
    });
    Object.defineProperty(node, 'id', { enumerable: true, get: getter });
    const result = planCanonicalYamlZipExport({ slot: 'committed', nodes: [node] });
    expect(result.ok).toBe(false);
    expect(getter).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('credential-accessor-secret');
  });

  it('returns no partial plan when one of multiple nodes is invalid', () => {
    const result = planCanonicalYamlZipExport({
      slot: 'committed',
      nodes: [yamlNode('valid'), yamlNode('invalid', scenario.fileName, { subtype: 'invalid' })],
    });
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('plan');
  });

  it('rejects symbol fields and sparse candidate arrays', () => {
    const node = yamlNode('symbol-node');
    Object.defineProperty(node, Symbol('unsafe'), { value: 'secret' });
    expect(planCanonicalYamlZipExport({ slot: 'committed', nodes: [node] }).ok).toBe(false);

    const sparse: unknown[] = [];
    sparse.length = 1;
    expect(planCanonicalYamlZipExport({ slot: 'committed', nodes: sparse }).ok).toBe(false);
  });
});

describe('planCanonicalYamlZipImport', () => {
  it('creates deterministic canonical nodes and a parent patch', () => {
    const result = planCanonicalYamlZipImport(importInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.request.nodes.map((node) => node.metadata.name)).toEqual([
      git.fileName,
      scenario.fileName,
    ]);
    expect(result.plan.request.nodes[0]).toMatchObject({
      id: 'generated-git',
      parentId: 'parent',
      nodeType: 'yaml-file',
      depth: 2,
      createdAt: 100,
      updatedAt: 100,
      version: 1,
      draftMetadata: null,
      visible: true,
    });
    expect(result.plan.request.parentPatch).toEqual({
      id: 'parent',
      expectedVersion: 4,
      postimage: { hasChildren: true, updatedAt: 100, version: 5 },
    });
    expect(Object.isFrozen(result.plan)).toBe(true);
    expect(Object.isFrozen(result.plan.request.nodes)).toBe(true);
  });

  it('does not patch a parent that already has children', () => {
    const result = planCanonicalYamlZipImport(importInput({ parent: parent(true) }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.request).not.toHaveProperty('parentPatch');
  });

  it('rejects sibling name and generated node ID collisions', () => {
    const nameConflict = planCanonicalYamlZipImport(
      importInput({ siblings: [sibling('sibling', scenario.fileName)] })
    );
    expect(nameConflict).toMatchObject({
      ok: false,
      errors: [{ code: 'SIBLING_NAME_CONFLICT' }],
    });

    const idConflict = planCanonicalYamlZipImport(
      importInput({ generatedNodeIds: ['sibling', 'new-id'] })
    );
    expect(idConflict).toMatchObject({ ok: false, errors: [{ code: 'NODE_ID_COLLISION' }] });
  });

  it('requires the full existing ID snapshot and exact generated ID count', () => {
    expect(planCanonicalYamlZipImport(importInput({ existingNodeIds: ['parent'] }))).toMatchObject({
      ok: false,
      errors: [{ code: 'INVALID_INPUT' }],
    });
    expect(planCanonicalYamlZipImport(importInput({ generatedNodeIds: ['one'] }))).toMatchObject({
      ok: false,
      errors: [{ code: 'INVALID_INPUT' }],
    });
  });

  it('rejects non-folder parents and unsafe version increments', () => {
    expect(
      planCanonicalYamlZipImport(importInput({ parent: { ...parent(), nodeType: 'yaml-file' } }))
    ).toMatchObject({ ok: false, errors: [{ code: 'INVALID_INPUT' }] });
    expect(
      planCanonicalYamlZipImport(
        importInput({ parent: { ...parent(), version: Number.MAX_SAFE_INTEGER } })
      )
    ).toMatchObject({ ok: false, errors: [{ code: 'INVALID_INPUT' }] });
  });

  it('redacts reflection failures from proxied raw input', () => {
    const secret = 'proxy-secret-content';
    const proxiedParent = new Proxy(parent(), {
      ownKeys() {
        throw new Error(secret);
      },
    });
    const result = planCanonicalYamlZipImport(importInput({ parent: proxiedParent }));
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('rejects empty archives without producing a parent patch', () => {
    const empty = encodeCanonicalYamlZip([]);
    if (!empty.ok) throw new Error('empty archive fixture failed');
    const result = planCanonicalYamlZipImport(
      importInput({ archive: empty.value.bytes, generatedNodeIds: [] })
    );
    expect(result).toMatchObject({ ok: false, errors: [{ code: 'INVALID_INPUT' }] });
    expect(result).not.toHaveProperty('plan');
  });

  it('does not mutate caller-owned raw snapshots', () => {
    const input = importInput();
    const before = JSON.stringify(input);
    expect(planCanonicalYamlZipImport(input).ok).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('commitCanonicalYamlZipImportPlan', () => {
  it('calls the transaction port exactly once for an issued plan', async () => {
    const result = planCanonicalYamlZipImport(importInput());
    if (!result.ok) throw new Error('fixture plan failed');
    const port = vi.fn(async () => undefined);
    await expect(commitCanonicalYamlZipImportPlan(result.plan, port)).resolves.toEqual({
      ok: true,
    });
    expect(port).toHaveBeenCalledTimes(1);
    expect(port).toHaveBeenCalledWith(result.plan.request);
  });

  it('rejects fabricated plans without calling the port', async () => {
    const port = vi.fn(async () => undefined);
    const result = await commitCanonicalYamlZipImportPlan(Object.freeze({}), port);
    expect(result).toEqual({ ok: false, error: { code: 'INVALID_PLAN' } });
    expect(port).not.toHaveBeenCalled();
  });

  it('does not retry a failed transaction port', async () => {
    const result = planCanonicalYamlZipImport(importInput());
    if (!result.ok) throw new Error('fixture plan failed');
    const port = vi.fn(async () => {
      throw new Error('storage-secret');
    });
    await expect(commitCanonicalYamlZipImportPlan(result.plan, port)).resolves.toEqual({
      ok: false,
      error: { code: 'TRANSACTION_PORT_FAILED' },
    });
    expect(port).toHaveBeenCalledTimes(1);
    await expect(commitCanonicalYamlZipImportPlan(result.plan, port)).resolves.toEqual({
      ok: false,
      error: { code: 'INVALID_PLAN' },
    });
    expect(port).toHaveBeenCalledTimes(1);
  });
});
