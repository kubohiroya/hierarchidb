import { toNodeId } from '@hierarchidb/core-types';
import type {
  YamlCanonicalZipCoreDbPort,
  YamlCanonicalZipServiceEnvironment,
} from '@hierarchidb/worker-api';
import { describe, expect, it, vi } from 'vitest';
import { encodeCanonicalYamlZip } from '../../src/canonical-yaml-zip-codec/index.js';
import { createYamlCanonicalZipService } from '../../src/worker/createYamlCanonicalZipService.js';

const parent = Object.freeze({
  id: 'parent',
  parentId: 'root',
  nodeType: 'folder',
  depth: 1,
  createdAt: 1,
  updatedAt: 2,
  version: 4,
  metadata: { name: 'folder', description: '', tags: [] },
  draftMetadata: null,
  data: null,
  visible: true,
  hasChildren: true,
});

const yamlNode = Object.freeze({
  id: 'scenario-node',
  parentId: 'parent',
  nodeType: 'yaml-file',
  depth: 2,
  createdAt: 1,
  updatedAt: 2,
  version: 3,
  metadata: { name: 'scenario.yml', description: '', tags: [] },
  draftMetadata: null,
  data: {
    subtype: 'scenario',
    schemaId: 'ide-gsm/scenario',
    content: 'name: demo\n',
  },
  visible: true,
});

function archiveBase64(): string {
  const encoded = encodeCanonicalYamlZip([
    {
      filename: 'git.yml',
      payload: {
        subtype: 'git',
        schemaId: 'ide-gsm/git',
        content: 'url: repo\n',
      },
    },
  ]);
  if (!encoded.ok) throw new Error('fixture archive failed');
  return encoded.value.base64;
}

function createEnvironment(overrides: Partial<YamlCanonicalZipServiceEnvironment> = {}) {
  const coreDB: YamlCanonicalZipCoreDbPort = {
    readFolderSnapshot: vi.fn(async () => ({
      parent,
      children: [yamlNode],
      existingNodeIds: ['parent', 'scenario-node'],
    })),
    commitImport: vi.fn(async (request) => request.nodes.map((node) => toNodeId(node.id))),
  };
  const environment: YamlCanonicalZipServiceEnvironment = {
    coreDB,
    assertCanonicalAccess: vi.fn(),
    generateNodeId: vi.fn(() => toNodeId('generated-node')),
    now: vi.fn(() => 100),
    ...overrides,
  };
  return { coreDB, environment };
}

describe('createYamlCanonicalZipService', () => {
  it('exports one authoritative committed snapshot through the canonical planner', async () => {
    const { coreDB, environment } = createEnvironment();
    const api = createYamlCanonicalZipService(environment);

    const result = await api.exportYamlCanonicalZip({
      parentId: toNodeId('parent'),
      slot: 'committed',
    });

    expect(result).toMatchObject({ ok: true, nodeIds: ['scenario-node'] });
    expect(coreDB.readFolderSnapshot).toHaveBeenCalledOnce();
    expect(coreDB.commitImport).not.toHaveBeenCalled();
  });

  it('plans every import before calling the CoreDB transaction port exactly once', async () => {
    const { coreDB, environment } = createEnvironment();
    const api = createYamlCanonicalZipService(environment);

    const result = await api.importYamlCanonicalZip({
      parentId: toNodeId('parent'),
      archiveBase64: archiveBase64(),
    });

    expect(result).toEqual({ ok: true, nodeIds: ['generated-node'] });
    expect(coreDB.commitImport).toHaveBeenCalledOnce();
    expect(coreDB.commitImport).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: [
          expect.objectContaining({
            id: 'generated-node',
            parentId: 'parent',
            nodeType: 'yaml-file',
            data: expect.objectContaining({ subtype: 'git' }),
          }),
        ],
      })
    );
  });

  it('performs zero storage work when canonical access is denied', async () => {
    const { coreDB, environment } = createEnvironment({
      assertCanonicalAccess: () => {
        throw new Error('denied');
      },
    });
    const api = createYamlCanonicalZipService(environment);

    await expect(
      api.exportYamlCanonicalZip({ parentId: toNodeId('parent'), slot: 'committed' })
    ).resolves.toEqual({ ok: false, code: 'ACCESS_DENIED' });
    expect(coreDB.readFolderSnapshot).not.toHaveBeenCalled();
    expect(coreDB.commitImport).not.toHaveBeenCalled();
  });

  it('does not retry or expose a failed CoreDB transaction', async () => {
    const { coreDB, environment } = createEnvironment();
    vi.mocked(coreDB.commitImport).mockRejectedValue(new Error('storage-secret'));
    const api = createYamlCanonicalZipService(environment);

    await expect(
      api.importYamlCanonicalZip({
        parentId: toNodeId('parent'),
        archiveBase64: archiveBase64(),
      })
    ).resolves.toEqual({ ok: false, code: 'IMPORT_TRANSACTION_REJECTED' });
    expect(coreDB.commitImport).toHaveBeenCalledOnce();
  });
});
