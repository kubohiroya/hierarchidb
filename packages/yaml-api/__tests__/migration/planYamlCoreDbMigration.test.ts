import { describe, expect, it, vi } from 'vitest';
import { planYamlCoreDbMigration } from '../../src/migration/planYamlCoreDbMigration.js';
import type {
  YamlCoreDbMigrationError,
  YamlCoreDbMigrationInput,
  YamlCoreDbMigrationPlan,
  YamlCoreDbMigrationResult,
} from '../../src/migration/yamlCoreDbMigrationTypes.js';
import { YAML_SUBTYPE_REGISTRY } from '../../src/YAML_SUBTYPE_REGISTRY.js';
import type { YamlSubtype } from '../../src/YamlSubtype.js';

const VALID_DIGEST = '0123456789abcdef'.repeat(4);

const VALID_CONTENT: Readonly<Record<YamlSubtype, string>> = {
  sources: 'sources: []\n',
  scenario: 'name: demo\n',
  'scenario-base': 'name: demo\n',
  calib: 'calibrationId: calibration-1\n',
  remote: 'host: remote.example.test\n',
  'remote-base': 'host: remote.example.test\n',
  ssh: 'host: ssh.example.test\nusername: user\n',
  'ssh-base': 'host: ssh.example.test\nusername: user\n',
  ec2: 'instanceId: i-123\nregion: ap-northeast-1\n',
  'ec2-base': 'instanceId: i-123\nregion: ap-northeast-1\n',
  rsync: 'include: []\nexclude: []\n',
  git: 'url: https://example.test/repository.git\n',
};

function legacyNode(id: string, subtype: YamlSubtype): Readonly<Record<string, unknown>> {
  const entry = YAML_SUBTYPE_REGISTRY[subtype];
  return {
    id,
    version: 1,
    nodeType: 'yaml-file',
    metadata: { name: entry.fileName },
    draftMetadata: null,
    data: {
      name: entry.fileName,
      schemaId: entry.schemaId,
      content: VALID_CONTENT[subtype],
    },
  };
}

function canonicalNode(id: string, subtype: YamlSubtype): Readonly<Record<string, unknown>> {
  const entry = YAML_SUBTYPE_REGISTRY[subtype];
  return {
    id,
    version: 1,
    nodeType: 'yaml-file',
    metadata: { name: entry.fileName },
    draftMetadata: null,
    data: {
      subtype,
      schemaId: entry.schemaId,
      content: VALID_CONTENT[subtype],
    },
  };
}

function hostSplitLegacyNode(id: string, subtype: YamlSubtype): Readonly<Record<string, unknown>> {
  const entry = YAML_SUBTYPE_REGISTRY[subtype];
  return {
    id,
    version: 1,
    nodeType: 'yaml-file',
    metadata: { name: entry.fileName },
    draftMetadata: null,
    data: {
      schemaId: entry.schemaId,
      content: VALID_CONTENT[subtype],
    },
  };
}

function createInput(
  rawNodes: readonly unknown[],
  digestSha256Hex: (bytes: Uint8Array) => Promise<string> = async () => VALID_DIGEST
): YamlCoreDbMigrationInput {
  return {
    migrationId: 'yaml-v1-to-v2',
    fromCoreDbVersion: 1,
    toCoreDbVersion: 2,
    rawNodes,
    digestSha256Hex,
  };
}

function expectPlan(result: YamlCoreDbMigrationResult): YamlCoreDbMigrationPlan {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected a migration plan');
  return result.plan;
}

function expectErrors(result: YamlCoreDbMigrationResult): readonly YamlCoreDbMigrationError[] {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected migration errors');
  return result.errors;
}

describe('planYamlCoreDbMigration registry and plan contract', () => {
  it('plans exact legacy-to-canonical migration entries for all 12 subtypes', async () => {
    const rawNodes = Object.values(YAML_SUBTYPE_REGISTRY).map((entry) =>
      legacyNode(`node-${entry.subtype}`, entry.subtype)
    );

    const plan = expectPlan(await planYamlCoreDbMigration(createInput(rawNodes)));

    expect(plan.entries).toHaveLength(12);
    expect(plan.nodeGuards).toHaveLength(12);
    for (const entry of plan.entries) {
      expect(entry.action).toBe('migrate');
      if (entry.action !== 'migrate') continue;
      const registryEntry = Object.values(YAML_SUBTYPE_REGISTRY).find(
        (candidate) => entry.nodeId === `node-${candidate.subtype}`
      );
      expect(registryEntry).toBeDefined();
      if (registryEntry === undefined) continue;
      const expectedSubtype = registryEntry.subtype;
      expect(entry.slot).toBe('committed');
      expect(entry.preimageRepresentation).toBe('legacy-with-name');
      expect(entry.preimage).toEqual({
        name: registryEntry.fileName,
        schemaId: registryEntry.schemaId,
        content: VALID_CONTENT[expectedSubtype],
      });
      expect(entry.postimage).toEqual({
        subtype: expectedSubtype,
        schemaId: registryEntry.schemaId,
        content: VALID_CONTENT[expectedSubtype],
      });
      expect(entry.journalValue).toEqual({
        migrationId: 'yaml-v1-to-v2',
        fromCoreDbVersion: 1,
        toCoreDbVersion: 2,
        nodeId: entry.nodeId,
        slot: 'committed',
        preimageRepresentation: 'legacy-with-name',
        legacyName: registryEntry.fileName,
        canonicalPostimageDigest: VALID_DIGEST,
      });
    }
  });

  it('plans exact host-split legacy migrations for all 12 subtypes', async () => {
    const rawNodes = Object.values(YAML_SUBTYPE_REGISTRY).map((entry) =>
      hostSplitLegacyNode(`host-split-${entry.subtype}`, entry.subtype)
    );

    const plan = expectPlan(await planYamlCoreDbMigration(createInput(rawNodes)));

    expect(plan.entries).toHaveLength(12);
    for (const entry of plan.entries) {
      expect(entry.action).toBe('migrate');
      if (entry.action !== 'migrate') continue;
      const registryEntry = Object.values(YAML_SUBTYPE_REGISTRY).find(
        (candidate) => entry.nodeId === `host-split-${candidate.subtype}`
      );
      expect(registryEntry).toBeDefined();
      if (registryEntry === undefined) continue;
      expect(entry.preimageRepresentation).toBe('host-split-legacy');
      expect(entry.preimage).toEqual({
        schemaId: registryEntry.schemaId,
        content: VALID_CONTENT[registryEntry.subtype],
      });
      expect(entry.legacyName).toBe(registryEntry.fileName);
      expect(entry.postimage).toEqual({
        subtype: registryEntry.subtype,
        schemaId: registryEntry.schemaId,
        content: VALID_CONTENT[registryEntry.subtype],
      });
      expect(entry.journalValue).toEqual({
        migrationId: 'yaml-v1-to-v2',
        fromCoreDbVersion: 1,
        toCoreDbVersion: 2,
        nodeId: entry.nodeId,
        slot: 'committed',
        preimageRepresentation: 'host-split-legacy',
        legacyName: registryEntry.fileName,
        canonicalPostimageDigest: VALID_DIGEST,
      });
    }
  });

  it('sorts entries by node ID and committed before draft independent of input order', async () => {
    const scenario = YAML_SUBTYPE_REGISTRY.scenario;
    const nodeZ = {
      ...canonicalNode('z-node', 'scenario'),
      draftMetadata: { name: scenario.fileName },
      draftData: {
        name: scenario.fileName,
        schemaId: scenario.schemaId,
        content: VALID_CONTENT.scenario,
      },
    };
    const plan = expectPlan(
      await planYamlCoreDbMigration(createInput([nodeZ, legacyNode('a-node', 'git')]))
    );

    expect(plan.entries.map(({ nodeId, slot, action }) => [nodeId, slot, action])).toEqual([
      ['a-node', 'committed', 'migrate'],
      ['z-node', 'committed', 'validated-noop'],
      ['z-node', 'draft', 'migrate'],
    ]);
    expect(plan.nodeGuards).toEqual([
      { sourceIndex: 1, nodeId: 'a-node', expectedVersion: 1 },
      { sourceIndex: 0, nodeId: 'z-node', expectedVersion: 1 },
    ]);
  });

  it('returns an empty successful plan for an empty complete candidate snapshot', async () => {
    const plan = expectPlan(await planYamlCoreDbMigration(createInput([])));
    expect(plan.entries).toEqual([]);
  });
});

describe('planYamlCoreDbMigration slot decision table', () => {
  it.each([
    ['missing data', {}],
    ['undefined data', { data: undefined }],
    ['null data', { data: null }],
  ])('migrates a complete draft-only node with %s', async (_label, dataShape) => {
    const entry = YAML_SUBTYPE_REGISTRY.git;
    const rawNode = {
      id: 'draft-only',
      version: 1,
      nodeType: 'yaml-file',
      metadata: { name: entry.fileName },
      draftMetadata: { name: entry.fileName },
      draftData: {
        name: entry.fileName,
        schemaId: entry.schemaId,
        content: VALID_CONTENT.git,
      },
      ...dataShape,
    };

    const plan = expectPlan(await planYamlCoreDbMigration(createInput([rawNode])));
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0]).toMatchObject({ action: 'migrate', slot: 'draft' });
  });

  it('migrates an exact host-split draft without reading the committed metadata name', async () => {
    const entry = YAML_SUBTYPE_REGISTRY.git;
    const rawNode = {
      id: 'host-split-draft-only',
      version: 1,
      nodeType: 'yaml-file',
      metadata: { name: 'scenario.yml' },
      draftMetadata: { name: entry.fileName },
      draftData: {
        schemaId: entry.schemaId,
        content: VALID_CONTENT.git,
      },
    };

    const plan = expectPlan(await planYamlCoreDbMigration(createInput([rawNode])));
    expect(plan.entries).toEqual([
      {
        action: 'migrate',
        nodeId: 'host-split-draft-only',
        slot: 'draft',
        preimageRepresentation: 'host-split-legacy',
        preimage: {
          schemaId: entry.schemaId,
          content: VALID_CONTENT.git,
        },
        postimage: {
          subtype: 'git',
          schemaId: entry.schemaId,
          content: VALID_CONTENT.git,
        },
        legacyName: entry.fileName,
        canonicalPostimageDigest: VALID_DIGEST,
        journalValue: {
          migrationId: 'yaml-v1-to-v2',
          fromCoreDbVersion: 1,
          toCoreDbVersion: 2,
          nodeId: 'host-split-draft-only',
          slot: 'draft',
          preimageRepresentation: 'host-split-legacy',
          legacyName: entry.fileName,
          canonicalPostimageDigest: VALID_DIGEST,
        },
      },
    ]);
  });

  it('accepts only the exact temporary empty placeholder as a no-op', async () => {
    const rawNode = {
      id: 'placeholder',
      version: 0,
      nodeType: 'yaml-file',
      metadata: { name: 'scenario.yml' },
      draftMetadata: { name: 'scenario.yml' },
      data: null,
      draftData: {},
      isTemporary: true,
    };

    const plan = expectPlan(await planYamlCoreDbMigration(createInput([rawNode])));
    expect(plan.entries).toEqual([
      {
        action: 'validated-noop',
        nodeId: 'placeholder',
        slot: 'draft',
        reason: 'temporary-placeholder',
      },
    ]);
  });

  it.each([
    ['data missing', { isTemporary: true, draftData: {} }],
    ['temporary false', { isTemporary: false, data: null, draftData: {} }],
    ['draftData array', { isTemporary: true, data: null, draftData: [] }],
    ['draftData undefined', { isTemporary: true, data: null, draftData: undefined }],
  ])('rejects an inexact placeholder when %s', async (_label, shape) => {
    const result = await planYamlCoreDbMigration(
      createInput([
        {
          id: 'partial-placeholder',
          version: 0,
          nodeType: 'yaml-file',
          metadata: { name: 'scenario.yml' },
          draftMetadata: { name: 'scenario.yml' },
          ...shape,
        },
      ])
    );

    const expectedCode = _label === 'draftData array' ? 'INVALID_PAYLOAD' : 'INCOMPLETE_RECORD';
    expect(expectErrors(result).map(({ code }) => code)).toContain(expectedCode);
  });

  it('validates a same-name metadata-only draft as a no-op without copying payload', async () => {
    const rawNode = {
      ...canonicalNode('rename-noop', 'scenario'),
      draftMetadata: { name: 'scenario.yml' },
    };

    const plan = expectPlan(await planYamlCoreDbMigration(createInput([rawNode])));
    expect(plan.entries).toEqual([
      {
        action: 'validated-noop',
        nodeId: 'rename-noop',
        slot: 'committed',
        reason: 'canonical',
      },
      {
        action: 'validated-noop',
        nodeId: 'rename-noop',
        slot: 'draft',
        reason: 'metadata-only-draft',
      },
    ]);
  });

  it('rejects a metadata-only draft with a different name', async () => {
    const rawNode = {
      ...canonicalNode('rename-mismatch', 'scenario'),
      draftMetadata: { name: 'scenario-base.yml' },
    };
    const errors = expectErrors(await planYamlCoreDbMigration(createInput([rawNode])));
    expect(errors.map(({ code }) => code)).toContain('METADATA_ONLY_DRAFT_NAME_MISMATCH');
  });

  it('rejects draftData without draftMetadata instead of using committed metadata', async () => {
    const entry = YAML_SUBTYPE_REGISTRY.scenario;
    const rawNode = {
      ...canonicalNode('missing-draft-metadata', 'scenario'),
      draftMetadata: null,
      draftData: {
        name: entry.fileName,
        schemaId: entry.schemaId,
        content: VALID_CONTENT.scenario,
      },
    };
    const errors = expectErrors(await planYamlCoreDbMigration(createInput([rawNode])));
    expect(errors.map(({ code }) => code)).toContain('DRAFT_DATA_WITHOUT_METADATA');
  });

  it.each([
    ['missing draft fields', {}],
    ['null draftMetadata and undefined draftData', { draftMetadata: null, draftData: undefined }],
  ])('treats %s as no active draft for a committed node', async (_label, draftShape) => {
    const rawNode = { ...canonicalNode('committed-only', 'scenario'), ...draftShape };
    const plan = expectPlan(await planYamlCoreDbMigration(createInput([rawNode])));
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0]).toMatchObject({
      action: 'validated-noop',
      slot: 'committed',
    });
  });
});

describe('planYamlCoreDbMigration strict payload and content validation', () => {
  it.each([
    [
      'mixed shape',
      {
        name: 'scenario.yml',
        subtype: 'scenario',
        schemaId: 'ide-gsm/scenario',
        content: 'name: demo\n',
      },
      'MIXED_PAYLOAD',
    ],
    ['partial host-split payload', { schemaId: 'ide-gsm/scenario' }, 'INCOMPLETE_PAYLOAD'],
    [
      'unknown field',
      { name: 'scenario.yml', schemaId: 'ide-gsm/scenario', content: 'name: demo\n', extra: true },
      'UNKNOWN_PAYLOAD_FIELD',
    ],
    [
      'metadata mismatch',
      { name: 'scenario-base.yml', schemaId: 'ide-gsm/scenario', content: 'name: demo\n' },
      'METADATA_PAYLOAD_NAME_MISMATCH',
    ],
    [
      'schema mismatch',
      { name: 'scenario.yml', schemaId: 'ide-gsm/ssh', content: 'host: h\nusername: u\n' },
      'UNKNOWN_REGISTRY_TUPLE',
    ],
    [
      'invalid YAML',
      { name: 'scenario.yml', schemaId: 'ide-gsm/scenario', content: '{' },
      'INVALID_YAML',
    ],
    [
      'multiple YAML documents',
      {
        name: 'scenario.yml',
        schemaId: 'ide-gsm/scenario',
        content: 'name: one\n---\nname: two\n',
      },
      'MULTIPLE_YAML_DOCUMENTS',
    ],
    [
      'scalar YAML root',
      { name: 'scenario.yml', schemaId: 'ide-gsm/scenario', content: 'scalar\n' },
      'YAML_ROOT_NOT_MAPPING',
    ],
    [
      'sequence YAML root',
      { name: 'scenario.yml', schemaId: 'ide-gsm/scenario', content: '- name: demo\n' },
      'YAML_ROOT_NOT_MAPPING',
    ],
    [
      'schema violation',
      { name: 'git.yml', schemaId: 'ide-gsm/git', content: '{}\n' },
      'CONTENT_SCHEMA_INVALID',
    ],
  ])('rejects %s with a stable code', async (_label, data, expectedCode) => {
    const result = await planYamlCoreDbMigration(
      createInput([
        {
          id: 'invalid-payload',
          version: 1,
          nodeType: 'yaml-file',
          metadata: { name: _label === 'schema violation' ? 'git.yml' : 'scenario.yml' },
          draftMetadata: null,
          data,
        },
      ])
    );
    expect(expectErrors(result).map(({ code }) => code)).toContain(expectedCode);
  });

  it('rejects duplicate YAML mapping keys under strict parsing', async () => {
    const node = legacyNode('duplicate-key', 'scenario');
    const result = await planYamlCoreDbMigration(
      createInput([
        {
          ...node,
          data: {
            name: 'scenario.yml',
            schemaId: 'ide-gsm/scenario',
            content: 'name: first\nname: second\n',
          },
        },
      ])
    );
    expect(expectErrors(result).map(({ code }) => code)).toContain('INVALID_YAML');
  });

  it('fails closed when the YAML parser emits a warning', async () => {
    const node = {
      ...legacyNode('unknown-tag', 'scenario'),
      data: {
        name: 'scenario.yml',
        schemaId: 'ide-gsm/scenario',
        content: 'name: !unknown-tag demo\n',
      },
    };
    const errors = expectErrors(await planYamlCoreDbMigration(createInput([node])));
    expect(errors.map(({ code }) => code)).toContain('INVALID_YAML');
  });

  it.each([
    ['rsync', 'include: []\nunexpected: true\n'],
    ['git', 'url: https://example.test/repo.git\nunexpected: true\n'],
  ] as const)('enforces declared additionalProperties:false for %s', async (subtype, content) => {
    const registryEntry = YAML_SUBTYPE_REGISTRY[subtype];
    const node = {
      ...legacyNode(`strict-${subtype}`, subtype),
      data: { name: registryEntry.fileName, schemaId: registryEntry.schemaId, content },
    };
    const errors = expectErrors(await planYamlCoreDbMigration(createInput([node])));
    expect(errors.map(({ code }) => code)).toContain('CONTENT_SCHEMA_INVALID');
  });

  it('does not inject an undeclared additional-properties ban into another schema', async () => {
    const node = {
      ...legacyNode('permissive-scenario', 'scenario'),
      data: {
        name: 'scenario.yml',
        schemaId: 'ide-gsm/scenario',
        content: 'name: demo\ncustomProperty: allowed-by-declared-schema\n',
      },
    };
    const plan = expectPlan(await planYamlCoreDbMigration(createInput([node])));
    expect(plan.entries).toHaveLength(1);
  });
});

describe('planYamlCoreDbMigration input, atomic failure, and redaction', () => {
  it('rejects a non-yaml candidate instead of ignoring it', async () => {
    const node = { ...legacyNode('wrong-type', 'scenario'), nodeType: 'folder' };
    const errors = expectErrors(await planYamlCoreDbMigration(createInput([node])));
    expect(errors).toMatchObject([{ nodeId: 'wrong-type', code: 'INVALID_NODE_TYPE' }]);
  });

  it('rejects a sparse candidate array instead of skipping its hole', async () => {
    const rawNodes = Array<unknown>(1);
    const errors = expectErrors(await planYamlCoreDbMigration(createInput(rawNodes)));
    expect(errors).toMatchObject([{ sourceIndex: 0, code: 'INVALID_RAW_NODE' }]);
  });

  it.each([undefined, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects a missing or invalid raw node version %s',
    async (version) => {
      const node = { ...legacyNode('invalid-version', 'scenario'), version };
      const errors = expectErrors(await planYamlCoreDbMigration(createInput([node])));
      expect(errors).toMatchObject([{ nodeId: 'invalid-version', code: 'INVALID_NODE_VERSION' }]);
    }
  );

  it('rejects a raw node with a missing version property', async () => {
    const node = { ...legacyNode('missing-version', 'scenario') };
    Reflect.deleteProperty(node, 'version');
    const errors = expectErrors(await planYamlCoreDbMigration(createInput([node])));
    expect(errors).toMatchObject([{ nodeId: 'missing-version', code: 'INVALID_NODE_VERSION' }]);
  });

  it('rejects duplicate node IDs deterministically', async () => {
    const result = await planYamlCoreDbMigration(
      createInput([legacyNode('duplicate', 'scenario'), legacyNode('duplicate', 'git')])
    );
    const errors = expectErrors(result);
    expect(errors.map(({ sourceIndex, code }) => [sourceIndex, code])).toEqual([
      [0, 'DUPLICATE_NODE_ID'],
      [1, 'DUPLICATE_NODE_ID'],
    ]);
  });

  it.each([
    [{ migrationId: '' }, 'INVALID_MIGRATION_ID'],
    [{ fromCoreDbVersion: 0 }, 'INVALID_CORE_DB_VERSION'],
    [{ fromCoreDbVersion: 1.5 }, 'INVALID_CORE_DB_VERSION'],
    [{ fromCoreDbVersion: Number.MAX_SAFE_INTEGER + 1 }, 'INVALID_CORE_DB_VERSION'],
    [{ toCoreDbVersion: 1 }, 'INVALID_CORE_DB_VERSION'],
    [{ toCoreDbVersion: 0 }, 'INVALID_CORE_DB_VERSION'],
  ] as const)('rejects invalid migration context %o', async (patch, expectedCode) => {
    const input = { ...createInput([]), ...patch };
    const errors = expectErrors(await planYamlCoreDbMigration(input));
    expect(errors.map(({ code }) => code)).toContain(expectedCode);
  });

  it('does not call the digest port or return a partial plan after validation failure', async () => {
    const digest = vi.fn(async () => VALID_DIGEST);
    const invalid = { ...legacyNode('invalid', 'scenario'), nodeType: 'folder' };
    const result = await planYamlCoreDbMigration(
      createInput([legacyNode('valid', 'git'), invalid], digest)
    );

    expect(result.ok).toBe(false);
    expect(digest).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('plan');
  });

  it.each([
    [
      'port rejection',
      async () => Promise.reject(new Error('credential-value-must-not-leak')),
      'DIGEST_PORT_FAILED',
    ],
    ['invalid output', async () => 'A'.repeat(64), 'INVALID_DIGEST_OUTPUT'],
  ] as const)('returns only typed errors for %s', async (_label, digest, expectedCode) => {
    const result = await planYamlCoreDbMigration(
      createInput([legacyNode('digest-failure', 'git')], digest)
    );
    const serialized = JSON.stringify(result);
    expect(expectErrors(result).map(({ code }) => code)).toContain(expectedCode);
    expect(result).not.toHaveProperty('plan');
    expect(serialized).not.toContain('credential-value-must-not-leak');
    expect(serialized).not.toContain('https://example.test/repository.git');
  });

  it('publishes no partial entries when hashing the second migration fails', async () => {
    let callCount = 0;
    const digest = async (): Promise<string> => {
      callCount += 1;
      if (callCount === 2) throw new Error('second digest failed');
      return VALID_DIGEST;
    };
    const result = await planYamlCoreDbMigration(
      createInput([legacyNode('a-first', 'scenario'), legacyNode('b-second', 'git')], digest)
    );

    expect(callCount).toBe(2);
    expect(expectErrors(result)).toMatchObject([
      { nodeId: 'b-second', slot: 'committed', code: 'DIGEST_PORT_FAILED' },
    ]);
    expect(result).not.toHaveProperty('plan');
  });

  it('never serializes invalid YAML content or secret-looking payload fields into errors', async () => {
    const secret = 'token-credential-endpoint-content-must-not-leak';
    const result = await planYamlCoreDbMigration(
      createInput([
        {
          id: 'redacted',
          version: 1,
          nodeType: 'yaml-file',
          metadata: { name: 'scenario.yml' },
          draftMetadata: null,
          data: {
            name: 'scenario.yml',
            schemaId: 'ide-gsm/scenario',
            content: `{ ${secret}`,
            token: secret,
          },
        },
      ])
    );
    const serialized = JSON.stringify(expectErrors(result));
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain(`{ ${secret}`);
  });

  it('does not mutate frozen input records, payloads, or content', async () => {
    const payload = Object.freeze({
      name: 'scenario.yml',
      schemaId: 'ide-gsm/scenario',
      content: 'name: unchanged\n',
    });
    const metadata = Object.freeze({ name: 'scenario.yml' });
    const rawNode = Object.freeze({
      id: 'immutable',
      version: 1,
      nodeType: 'yaml-file',
      metadata,
      draftMetadata: null,
      data: payload,
    });

    expectPlan(await planYamlCoreDbMigration(createInput(Object.freeze([rawNode]))));
    expect(rawNode.data).toBe(payload);
    expect(payload).toEqual({
      name: 'scenario.yml',
      schemaId: 'ide-gsm/scenario',
      content: 'name: unchanged\n',
    });
  });

  it('rejects non-plain records and array payloads without casting them', async () => {
    const inheritedRecord = Object.create({ nodeType: 'yaml-file' });
    Object.assign(inheritedRecord, {
      id: 'inherited',
      version: 1,
      metadata: { name: 'scenario.yml' },
      data: legacyNode('source', 'scenario').data,
    });
    const arrayPayload = { ...legacyNode('array-payload', 'scenario'), data: [] };
    const result = await planYamlCoreDbMigration(createInput([inheritedRecord, arrayPayload]));
    expect(expectErrors(result).map(({ code }) => code)).toEqual([
      'INVALID_PAYLOAD',
      'INVALID_RAW_NODE',
    ]);
  });

  it('rejects an own accessor without invoking its getter or leaking its error', async () => {
    let getterWasCalled = false;
    const rawNode: Record<string, unknown> = {
      id: 'accessor',
      version: 1,
      nodeType: 'yaml-file',
      metadata: { name: 'scenario.yml' },
      draftMetadata: null,
    };
    Object.defineProperty(rawNode, 'data', {
      enumerable: true,
      get() {
        getterWasCalled = true;
        throw new Error('getter-credential-must-not-leak');
      },
    });

    const result = await planYamlCoreDbMigration(createInput([rawNode]));
    expect(getterWasCalled).toBe(false);
    expect(expectErrors(result)).toMatchObject([
      { nodeId: 'accessor', code: 'UNSAFE_PROPERTY_DESCRIPTOR' },
    ]);
    expect(JSON.stringify(result)).not.toContain('getter-credential-must-not-leak');
  });

  it('rejects a nested payload accessor without invoking its getter', async () => {
    let getterWasCalled = false;
    const payload: Record<string, unknown> = {
      schemaId: 'ide-gsm/scenario',
      content: 'name: demo\n',
    };
    Object.defineProperty(payload, 'name', {
      enumerable: true,
      get() {
        getterWasCalled = true;
        return 'scenario.yml';
      },
    });
    const rawNode = { ...legacyNode('payload-accessor', 'scenario'), data: payload };

    const result = await planYamlCoreDbMigration(createInput([rawNode]));
    expect(getterWasCalled).toBe(false);
    expect(expectErrors(result)).toMatchObject([
      { nodeId: 'payload-accessor', slot: 'committed', code: 'UNSAFE_PROPERTY_DESCRIPTOR' },
    ]);
  });

  it('converts a proxy reflection trap into a stable redacted error', async () => {
    const proxy = new Proxy(legacyNode('proxy', 'scenario'), {
      getPrototypeOf() {
        throw new Error('proxy-token-must-not-leak');
      },
    });

    const result = await planYamlCoreDbMigration(createInput([proxy]));
    expect(expectErrors(result)).toMatchObject([{ code: 'RAW_RECORD_ACCESS_FAILED' }]);
    expect(JSON.stringify(result)).not.toContain('proxy-token-must-not-leak');
  });

  it('does not accept inherited Object.prototype.isTemporary as a placeholder marker', async () => {
    const previousDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, 'isTemporary');
    Object.defineProperty(Object.prototype, 'isTemporary', {
      configurable: true,
      value: true,
    });
    try {
      const result = await planYamlCoreDbMigration(
        createInput([
          {
            id: 'polluted-placeholder',
            version: 0,
            nodeType: 'yaml-file',
            metadata: { name: 'scenario.yml' },
            draftMetadata: { name: 'scenario.yml' },
            data: null,
            draftData: {},
          },
        ])
      );
      expect(expectErrors(result).map(({ code }) => code)).toContain('INCOMPLETE_RECORD');
    } finally {
      if (previousDescriptor === undefined) {
        Reflect.deleteProperty(Object.prototype, 'isTemporary');
      } else {
        Object.defineProperty(Object.prototype, 'isTemporary', previousDescriptor);
      }
    }
  });
});
