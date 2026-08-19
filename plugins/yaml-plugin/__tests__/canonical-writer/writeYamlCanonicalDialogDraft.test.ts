import type { YamlSubtype } from '@hierarchidb/yaml-api';
import { YAML_SUBTYPE_REGISTRY } from '@hierarchidb/yaml-api';
import { describe, expect, it, vi } from 'vitest';
import { writeYamlCanonicalDialogDraft } from '../../src/canonical-writer/writeYamlCanonicalDialogDraft.js';
import type { YamlCanonicalDialogWriteRequest } from '../../src/canonical-writer/yamlCanonicalDialogWriterTypes.js';

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

function canonicalPayload(subtype: YamlSubtype): Readonly<Record<string, unknown>> {
  const entry = YAML_SUBTYPE_REGISTRY[subtype];
  return {
    subtype,
    schemaId: entry.schemaId,
    content: VALID_CONTENT[subtype],
  };
}

function validInput(subtype: YamlSubtype = 'scenario'): Record<PropertyKey, unknown> {
  const entry = YAML_SUBTYPE_REGISTRY[subtype];
  return {
    nodeId: 'node-1',
    mode: 'save-draft',
    filename: entry.fileName,
    description: 'description',
    tags: ['alpha', 'beta'],
    payload: canonicalPayload(subtype),
  };
}

function createWritePort() {
  return vi.fn(async (_request: YamlCanonicalDialogWriteRequest) => undefined);
}

describe('writeYamlCanonicalDialogDraft canonical contract', () => {
  it.each(Object.values(YAML_SUBTYPE_REGISTRY))(
    'writes the exact $subtype tuple once',
    async (entry) => {
      const writePort = createWritePort();
      const input = validInput(entry.subtype);

      await expect(writeYamlCanonicalDialogDraft(input, writePort)).resolves.toEqual({ ok: true });
      expect(writePort).toHaveBeenCalledTimes(1);

      const request = writePort.mock.calls[0]?.[0];
      expect(request).toEqual({
        nodeId: 'node-1',
        mode: 'save-draft',
        draftMetadata: {
          name: entry.fileName,
          description: 'description',
          tags: ['alpha', 'beta'],
        },
        draftData: {
          subtype: entry.subtype,
          schemaId: entry.schemaId,
          content: VALID_CONTENT[entry.subtype],
        },
        onNameConflict: 'error',
      });
      expect(Reflect.ownKeys(request ?? {})).toEqual([
        'nodeId',
        'mode',
        'draftMetadata',
        'draftData',
        'onNameConflict',
      ]);
      expect(Reflect.ownKeys(request?.draftData ?? {})).not.toContain('name');
    }
  );

  it('preserves save mode and emits one atomic-shaped request', async () => {
    const writePort = createWritePort();
    const input = { ...validInput(), mode: 'save' };

    expect(await writeYamlCanonicalDialogDraft(input, writePort)).toEqual({ ok: true });
    expect(writePort).toHaveBeenCalledTimes(1);
    expect(writePort.mock.calls[0]?.[0]?.mode).toBe('save');
  });

  it('does not mutate input, payload, or tags and writes fresh values', async () => {
    const payload = Object.freeze(canonicalPayload('scenario'));
    const tags = Object.freeze(['alpha', 'beta']);
    const input = Object.freeze({
      nodeId: 'node-frozen',
      mode: 'save-draft',
      filename: 'scenario.yml',
      description: 'frozen description',
      tags,
      payload,
    });
    const writePort = createWritePort();

    expect(await writeYamlCanonicalDialogDraft(input, writePort)).toEqual({ ok: true });
    const request = writePort.mock.calls[0]?.[0];
    expect(request?.draftMetadata.tags).not.toBe(tags);
    expect(request?.draftData).not.toBe(payload);
    expect(input.tags).toBe(tags);
    expect(input.payload).toBe(payload);
  });
});

describe('writeYamlCanonicalDialogDraft strict input', () => {
  it.each([null, [], new Date(0), Object.create({ inherited: true })])(
    'rejects a non-plain input without calling the port',
    async (input) => {
      const writePort = createWritePort();
      const result = await writeYamlCanonicalDialogDraft(input, writePort);

      expect(result).toEqual({
        ok: false,
        error: { code: 'INVALID_INPUT', context: { field: 'input', reason: 'invalid-type' } },
      });
      expect(writePort).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['nodeId', 'nodeId'],
    ['mode', 'mode'],
    ['filename', 'filename'],
    ['description', 'description'],
    ['tags', 'tags'],
    ['payload', 'payload'],
  ] as const)('rejects missing %s', async (key, expectedField) => {
    const input = validInput();
    delete input[key];
    const writePort = createWritePort();

    expect(await writeYamlCanonicalDialogDraft(input, writePort)).toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        context: { field: expectedField, reason: 'missing' },
      },
    });
    expect(writePort).not.toHaveBeenCalled();
  });

  it('rejects undefined and extra string or symbol keys', async () => {
    const undefinedInput = { ...validInput(), description: undefined };
    const extraInput = { ...validInput(), extra: true };
    const symbolInput = validInput();
    symbolInput[Symbol('credential')] = 'must-not-leak';
    const writePort = createWritePort();

    expect(await writeYamlCanonicalDialogDraft(undefinedInput, writePort)).toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        context: { field: 'description', reason: 'undefined' },
      },
    });
    expect(await writeYamlCanonicalDialogDraft(extraInput, writePort)).toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        context: { field: 'input', reason: 'unexpected-field' },
      },
    });
    const symbolResult = await writeYamlCanonicalDialogDraft(symbolInput, writePort);
    expect(symbolResult).toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        context: { field: 'input', reason: 'unexpected-field' },
      },
    });
    expect(JSON.stringify(symbolResult)).not.toContain('credential');
    expect(writePort).not.toHaveBeenCalled();
  });

  it('rejects an accessor without invoking its getter', async () => {
    let getterWasCalled = false;
    const input = validInput();
    Object.defineProperty(input, 'description', {
      enumerable: true,
      get() {
        getterWasCalled = true;
        throw new Error('getter-token-must-not-leak');
      },
    });
    const writePort = createWritePort();

    const result = await writeYamlCanonicalDialogDraft(input, writePort);
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        context: { field: 'input', reason: 'accessor-property' },
      },
    });
    expect(getterWasCalled).toBe(false);
    expect(JSON.stringify(result)).not.toContain('getter-token-must-not-leak');
    expect(writePort).not.toHaveBeenCalled();
  });

  it('converts input Proxy reflection failure to a stable redacted result', async () => {
    const input = new Proxy(validInput(), {
      ownKeys() {
        throw new Error('proxy-credential-must-not-leak');
      },
    });
    const writePort = createWritePort();

    const result = await writeYamlCanonicalDialogDraft(input, writePort);
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        context: { field: 'input', reason: 'reflection-failure' },
      },
    });
    expect(JSON.stringify(result)).not.toContain('proxy-credential-must-not-leak');
    expect(writePort).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...validInput(), nodeId: '' }, 'nodeId', 'empty'],
    [{ ...validInput(), nodeId: 1 }, 'nodeId', 'invalid-type'],
    [{ ...validInput(), mode: 'commit' }, 'mode', 'invalid-value'],
    [{ ...validInput(), filename: 1 }, 'filename', 'invalid-type'],
    [{ ...validInput(), description: null }, 'description', 'invalid-type'],
    [{ ...validInput(), tags: ['ok', 1] }, 'tags', 'invalid-item'],
  ] as const)('rejects invalid scalar input', async (input, field, reason) => {
    const writePort = createWritePort();
    expect(await writeYamlCanonicalDialogDraft(input, writePort)).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', context: { field, reason } },
    });
    expect(writePort).not.toHaveBeenCalled();
  });

  it('rejects sparse, accessor, symbol-keyed, and subclass tag arrays', async () => {
    const sparseTags = new Array<string>(1);
    const accessorTags: string[] = ['initial'];
    let getterWasCalled = false;
    Object.defineProperty(accessorTags, '0', {
      enumerable: true,
      get() {
        getterWasCalled = true;
        return 'secret';
      },
    });
    const symbolTags: string[] = ['alpha'];
    Object.defineProperty(symbolTags, Symbol('secret'), { value: 'credential' });
    class Tags extends Array<string> {}
    const subclassTags = new Tags('alpha');
    const writePort = createWritePort();

    for (const tags of [sparseTags, accessorTags, symbolTags, subclassTags]) {
      const result = await writeYamlCanonicalDialogDraft({ ...validInput(), tags }, writePort);
      expect(result.ok).toBe(false);
    }
    expect(getterWasCalled).toBe(false);
    expect(writePort).not.toHaveBeenCalled();
  });

  it('rejects an invalid write port before inspecting input', async () => {
    const input = new Proxy(validInput(), {
      ownKeys() {
        throw new Error('input-must-not-be-read');
      },
    });

    expect(await writeYamlCanonicalDialogDraft(input, undefined as never)).toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        context: { field: 'writePort', reason: 'invalid-type' },
      },
    });
  });
});

describe('writeYamlCanonicalDialogDraft validation and port failures', () => {
  it.each([
    [
      'legacy',
      { name: 'scenario.yml', schemaId: 'ide-gsm/scenario', content: 'name: demo\n' },
      'LEGACY_PAYLOAD',
    ],
    ['mixed', { ...canonicalPayload('scenario'), name: 'scenario.yml' }, 'MIXED_PAYLOAD'],
    ['incomplete', { schemaId: 'ide-gsm/scenario', content: 'name: demo\n' }, 'INCOMPLETE_PAYLOAD'],
    ['unknown', { ...canonicalPayload('scenario'), subtype: 'unknown' }, 'UNKNOWN_REGISTRY_TUPLE'],
    [
      'invalid YAML',
      { ...canonicalPayload('scenario'), content: 'secret-content: [' },
      'INVALID_YAML',
    ],
  ])('rejects %s payload before calling the port', async (_label, payload, expectedCode) => {
    const writePort = createWritePort();
    const result = await writeYamlCanonicalDialogDraft({ ...validInput(), payload }, writePort);

    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'CANONICAL_VALIDATION_FAILED') {
      throw new Error('Expected canonical validation failure');
    }
    expect(result.error.validationError.code).toBe(expectedCode);
    expect(JSON.stringify(result)).not.toContain('secret-content');
    expect(writePort).not.toHaveBeenCalled();
  });

  it('redacts a payload Proxy reflection failure', async () => {
    const payload = new Proxy(canonicalPayload('scenario'), {
      ownKeys() {
        throw new Error('payload-token-must-not-leak');
      },
    });
    const writePort = createWritePort();

    const result = await writeYamlCanonicalDialogDraft({ ...validInput(), payload }, writePort);
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'CANONICAL_VALIDATION_FAILED',
        validationError: {
          code: 'PAYLOAD_ACCESS_FAILED',
          context: { field: 'payload', reason: 'reflection-failure' },
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('payload-token-must-not-leak');
    expect(writePort).not.toHaveBeenCalled();
  });

  it('returns one stable redacted failure without retrying the port', async () => {
    const writePort = vi.fn(async (_request: YamlCanonicalDialogWriteRequest) => {
      throw new Error('https://endpoint-secret.example jwt-secret YAML-secret');
    });

    const result = await writeYamlCanonicalDialogDraft(validInput(), writePort);
    expect(result).toEqual({ ok: false, error: { code: 'WRITE_PORT_FAILED' } });
    expect(JSON.stringify(result)).not.toMatch(/endpoint-secret|jwt-secret|YAML-secret/u);
    expect(writePort).toHaveBeenCalledTimes(1);
  });
});
