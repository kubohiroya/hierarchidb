import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ImportExportService, validateImportDataPayload } from '../../dist/index.js';

class ValidationOnlyPort {
  async bulkCreateNodes() {}

  async listChildren() {
    return [];
  }

  async getNode() {
    return undefined;
  }

  async listVectorTileRecords() {
    return [];
  }
}

const validImportData = {
  nodes: [
    {
      name: 'Folder',
      nodeType: 'folder',
      parentNodeId: 'external-parent',
      version: 1,
      description: 'Imported folder',
      tags: ['top-level-tag'],
      metadata: {
        tags: ['imported', 'fixture'],
        custom: { sourceId: 'src-1' },
      },
      data: {
        pluginOwned: true,
        nested: [{ value: 1 }, null],
      },
      draftData: {
        pluginDraft: 'kept generic',
      },
      draftMetadata: null,
      children: [
        {
          name: 'Child',
          data: { childPayload: true },
        },
      ],
    },
  ],
  metadata: {
    version: '1.0',
    createdAt: 1672531200000,
    source: 'unit-test',
  },
};

describe('ImportData schema validation', () => {
  it('accepts valid import envelopes with generic plugin-owned payloads', () => {
    assert.deepEqual(validateImportDataPayload(validImportData), []);
  });

  it('keeps the legacy invalid-structure issue for a missing nodes array', () => {
    assert.deepEqual(validateImportDataPayload({}), [
      {
        code: 'INVALID_STRUCTURE',
        message: 'Import data must contain a nodes array',
        path: 'nodes',
      },
    ]);
  });

  it('keeps the legacy invalid-nodes issue when nodes is not an array', () => {
    assert.deepEqual(validateImportDataPayload({ nodes: {} }), [
      {
        code: 'INVALID_NODES',
        message: 'Nodes must be an array',
        path: 'nodes',
      },
    ]);
  });

  it('keeps the missing-name issue for nested nodes', () => {
    assert.deepEqual(validateImportDataPayload({ nodes: [{ name: 'Parent', children: [{}] }] }), [
      {
        code: 'MISSING_NAME',
        message: 'Node name is required',
        path: 'nodes[0].children[0].name',
      },
    ]);
  });

  it('accepts legacy node placement and top-level tag fields', () => {
    assert.deepEqual(
      validateImportDataPayload({
        nodes: [
          {
            name: 'Folder',
            parentNodeId: 'external-parent',
            tags: ['imported'],
          },
        ],
      }),
      []
    );
  });

  it('rejects unknown envelope properties without removing them', () => {
    const data = {
      nodes: [{ name: 'Folder', unknownNodeField: 'unexpected' }],
    };

    assert.deepEqual(validateImportDataPayload(data), [
      {
        code: 'SCHEMA_ADDITIONAL_PROPERTIES',
        message: 'Unexpected property "unknownNodeField" at nodes[0].unknownNodeField',
        path: 'nodes[0].unknownNodeField',
      },
    ]);
    assert.equal(Object.hasOwn(data.nodes[0], 'unknownNodeField'), true);
  });

  it('rejects non-JSON plugin payload values', () => {
    const issues = validateImportDataPayload({
      nodes: [{ name: 'Folder', data: { invalid: undefined } }],
    });

    assert.equal(issues.length > 0, true);
    assert.equal(issues[0].code, 'SCHEMA_TYPE');
    assert.equal(issues[0].path, 'nodes[0].data');
  });

  it('uses schema issues from ImportExportService.validateImportData', async () => {
    const service = new ImportExportService(new ValidationOnlyPort());

    const result = await service.validateImportData({
      data: { nodes: [{ name: '' }] },
      format: 'json',
    });

    assert.equal(result.valid, false);
    assert.equal(result.issues?.[0]?.code, 'SCHEMA_MIN_LENGTH');
    assert.equal(result.issues?.[0]?.path, 'nodes[0].name');
    assert.match(result.message, /SCHEMA_MIN_LENGTH:/);
  });
});
